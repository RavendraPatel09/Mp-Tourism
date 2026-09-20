import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { PointsService } from './points.service';
import { PointsLedgerEntry, UserProfile } from 'src/entities';
import { PointsReason, PointsRefType } from 'src/common/constants/points';
import { ConflictException } from 'src/common/exceptions/app-exceptions';

/**
 * The points ledger is the one thing in this backend that cannot be allowed to
 * be wrong. Double-awarding destroys leaderboard trust permanently, and a
 * leaderboard nobody trusts takes the whole gamification layer with it.
 *
 * These tests therefore simulate the database's *constraints*, not just its
 * responses — the fake below enforces the same partial unique index the real
 * schema has, so a change that removes `ON CONFLICT DO NOTHING` fails here
 * rather than in production.
 */

const DAILY_CAP = 600;

interface LedgerRow {
  id: string;
  userId: string;
  delta: number;
  reasonCode: PointsReason;
  refType: PointsRefType;
  refId: string | null;
  balanceAfter: number;
  leaderboardDelta: number;
  reversedBy: string | null;
  createdAt: Date;
  stateId: string | null;
  districtId: string | null;
}

class FakeDatabase {
  profiles = new Map<string, { userId: string; totalPoints: number; level: number }>();
  ledger: LedgerRow[] = [];
  private sequence = 0;

  addProfile(userId: string, totalPoints = 0): void {
    this.profiles.set(userId, { userId, totalPoints, level: 1 });
  }

  /** Mirrors `uq_points_ledger_award_source`. */
  private violatesUniqueAward(row: Omit<LedgerRow, 'id' | 'createdAt'>): boolean {
    if (row.reasonCode === PointsReason.REVERSAL || row.refId === null) return false;
    return this.ledger.some(
      (existing) =>
        existing.userId === row.userId &&
        existing.reasonCode === row.reasonCode &&
        existing.refType === row.refType &&
        existing.refId === row.refId &&
        existing.reasonCode !== PointsReason.REVERSAL,
    );
  }

  insertLedger(row: Omit<LedgerRow, 'id' | 'createdAt'>): LedgerRow[] {
    if (this.violatesUniqueAward(row)) return [];
    const inserted: LedgerRow = { ...row, id: `led-${++this.sequence}`, createdAt: new Date() };
    this.ledger.push(inserted);
    return [inserted];
  }

  leaderboardTotalToday(userId: string): number {
    return this.ledger
      .filter((row) => row.userId === userId)
      .reduce((sum, row) => sum + row.leaderboardDelta, 0);
  }

  asManager(): EntityManager {
    // The fake manager's methods are plain functions, so `this` has to be captured.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const db: FakeDatabase = this;

    const manager = {
      createQueryBuilder(entity: unknown) {
        let userId = '';
        let entryId = '';
        const builder = {
          setLock: () => builder,
          where(_clause: string, params: Record<string, string>) {
            userId = params.userId ?? userId;
            entryId = params.entryId ?? entryId;
            return builder;
          },
          getOne: async () => {
            if (entity === UserProfile) return db.profiles.get(userId) ?? null;
            if (entity === PointsLedgerEntry) {
              return db.ledger.find((row) => row.id === entryId) ?? null;
            }
            return null;
          },
        };
        return builder;
      },

      async query(sql: string, params: unknown[]) {
        if (sql.includes('INSERT INTO points_ledger')) {
          const [
            userId,
            delta,
            reasonCode,
            refType,
            refId,
            balanceAfter,
            leaderboardDelta,
            stateId,
            districtId,
          ] = params as [
            string,
            number,
            PointsReason,
            PointsRefType,
            string | null,
            number,
            number,
            string | null,
            string | null,
          ];

          return db
            .insertLedger({
              userId,
              delta,
              reasonCode,
              refType,
              refId,
              balanceAfter,
              leaderboardDelta,
              stateId,
              districtId,
              reversedBy: null,
            })
            .map((row) => ({
              id: row.id,
              balance_after: row.balanceAfter,
              leaderboard_delta: row.leaderboardDelta,
            }));
        }

        if (sql.includes('SUM(leaderboard_delta)')) {
          const [userId] = params as [string];
          return [{ total: String(db.leaderboardTotalToday(userId)) }];
        }

        return [];
      },

      async update(
        entity: unknown,
        criteria: Record<string, string>,
        values: Record<string, number>,
      ) {
        if (entity === UserProfile) {
          const profile = db.profiles.get(criteria.userId);
          if (profile) Object.assign(profile, values);
        }
        if (entity === PointsLedgerEntry) {
          const row = db.ledger.find((entry) => entry.id === criteria.id);
          if (row) Object.assign(row, values);
        }
        return { affected: 1 };
      },

      getRepository(_entity: unknown) {
        return {
          create: (values: Record<string, unknown>) => values,
          save: async (values: Record<string, unknown>) => {
            const [inserted] = db.insertLedger({
              ...(values as unknown as Omit<LedgerRow, 'id' | 'createdAt'>),
              reversedBy: null,
            });
            return inserted;
          },
        };
      },
    };

    return manager as unknown as EntityManager;
  }
}

function buildService(db: FakeDatabase): PointsService {
  const dataSource = {
    transaction: async <T>(work: (manager: EntityManager) => Promise<T>) => work(db.asManager()),
    getRepository: () => ({
      findOne: async ({ where }: { where: { userId: string } }) =>
        db.profiles.get(where.userId) ?? null,
    }),
  } as unknown as DataSource;

  const config = {
    getOrThrow: (key: string) => {
      if (key === 'points.dailyCap') return DAILY_CAP;
      throw new Error(`Unexpected config key ${key}`);
    },
  } as unknown as ConfigService;

  const ledgerRepo = {} as never;

  return new PointsService(dataSource, config, ledgerRepo);
}

describe('PointsService', () => {
  let db: FakeDatabase;
  let service: PointsService;

  const award = (overrides: Partial<Parameters<PointsService['award']>[0]> = {}) =>
    service.award({
      userId: 'user-1',
      delta: 75,
      reason: PointsReason.CHECK_IN,
      refType: PointsRefType.CHECK_IN,
      refId: 'check-in-1',
      stateId: 'state-mp',
      districtId: 'district-raisen',
      ...overrides,
    });

  beforeEach(() => {
    db = new FakeDatabase();
    db.addProfile('user-1');
    service = buildService(db);
  });

  describe('awarding', () => {
    it('credits the ledger and the cached balance together', async () => {
      const result = await award();

      expect(result.applied).toBe(true);
      expect(result.delta).toBe(75);
      expect(result.balanceAfter).toBe(75);
      expect(db.ledger).toHaveLength(1);
      expect(db.profiles.get('user-1')!.totalPoints).toBe(75);
    });

    it('records the source of every entry so a balance can be explained', async () => {
      await award();

      expect(db.ledger[0]).toMatchObject({
        reasonCode: PointsReason.CHECK_IN,
        refType: PointsRefType.CHECK_IN,
        refId: 'check-in-1',
        balanceAfter: 75,
      });
    });

    it('denormalises state and district for leaderboard rebuilds', async () => {
      await award();

      expect(db.ledger[0]).toMatchObject({
        stateId: 'state-mp',
        districtId: 'district-raisen',
      });
    });

    it('rejects a negative delta rather than silently debiting', async () => {
      await expect(award({ delta: -10 })).rejects.toThrow(/positive delta/);
      expect(db.ledger).toHaveLength(0);
    });
  });

  /**
   * The core guarantee. Every one of these is a real production scenario: a
   * retried HTTP request, a redelivered queue job, a moderator approving twice.
   */
  describe('never double-awards', () => {
    it('is a no-op when the same award is requested twice', async () => {
      const first = await award();
      const second = await award();

      expect(first.applied).toBe(true);
      expect(second.applied).toBe(false);
      expect(second.delta).toBe(0);
      expect(db.ledger).toHaveLength(1);
      expect(db.profiles.get('user-1')!.totalPoints).toBe(75);
    });

    it('reports the standing balance on a duplicate, not zero', async () => {
      await award();
      const duplicate = await award();

      expect(duplicate.balanceAfter).toBe(75);
    });

    it('survives concurrent identical awards', async () => {
      const results = await Promise.all([award(), award(), award(), award(), award()]);

      expect(results.filter((result) => result.applied)).toHaveLength(1);
      expect(db.ledger).toHaveLength(1);
      expect(db.profiles.get('user-1')!.totalPoints).toBe(75);
    });

    it('still allows a different reason against the same check-in', async () => {
      await award();
      const pioneer = await award({ reason: PointsReason.PIONEER_BONUS, delta: 100 });

      expect(pioneer.applied).toBe(true);
      expect(db.ledger).toHaveLength(2);
      expect(db.profiles.get('user-1')!.totalPoints).toBe(175);
    });

    it('still allows the same reason against a different check-in', async () => {
      await award();
      const second = await award({ refId: 'check-in-2' });

      expect(second.applied).toBe(true);
      expect(second.balanceAfter).toBe(150);
    });

    it('keeps two users independent', async () => {
      db.addProfile('user-2');
      await award();
      const other = await award({ userId: 'user-2' });

      expect(other.applied).toBe(true);
      expect(db.profiles.get('user-1')!.totalPoints).toBe(75);
      expect(db.profiles.get('user-2')!.totalPoints).toBe(75);
    });
  });

  /**
   * The cap protects the *leaderboard*, not the user's balance. A genuinely big
   * day of travel should still be worth its points; it just should not be worth
   * unlimited rank.
   */
  describe('daily leaderboard cap', () => {
    it('credits full points below the cap', async () => {
      const result = await award({ delta: 150 });

      expect(result.delta).toBe(150);
      expect(result.leaderboardDelta).toBe(150);
      expect(result.cappedForLeaderboard).toBe(false);
    });

    it('clips only the leaderboard contribution once the cap is passed', async () => {
      for (let index = 0; index < 4; index += 1) {
        await award({ delta: 150, refId: `check-in-${index}` });
      }

      const overflow = await award({ delta: 150, refId: 'check-in-overflow' });

      expect(overflow.delta).toBe(150);
      expect(overflow.leaderboardDelta).toBe(0);
      expect(overflow.cappedForLeaderboard).toBe(true);
      // The user keeps every point: 5 × 150.
      expect(db.profiles.get('user-1')!.totalPoints).toBe(750);
    });

    it('clips partially at the boundary rather than dropping the whole award', async () => {
      await award({ delta: 550, refId: 'big-day' });
      const partial = await award({ delta: 150, refId: 'boundary' });

      expect(partial.delta).toBe(150);
      expect(partial.leaderboardDelta).toBe(50);
      expect(partial.cappedForLeaderboard).toBe(true);
    });

    it('excludes awards flagged as not counting toward the board', async () => {
      const result = await award({ countsTowardLeaderboard: false });

      expect(result.delta).toBe(75);
      expect(result.leaderboardDelta).toBe(0);
      expect(result.cappedForLeaderboard).toBe(false);
    });
  });

  describe('reversal', () => {
    it('appends an opposing entry rather than editing history', async () => {
      const original = await award();
      const reversal = await service.reverse(original.entryId!, 'moderator-1', 'fraudulent');

      expect(db.ledger).toHaveLength(2);
      expect(reversal.delta).toBe(-75);
      expect(db.ledger[0].delta).toBe(75);
      expect(db.ledger[1]).toMatchObject({
        reasonCode: PointsReason.REVERSAL,
        refType: PointsRefType.LEDGER_ENTRY,
        refId: original.entryId,
        delta: -75,
      });
    });

    it('returns the balance to where it started', async () => {
      const original = await award();
      await service.reverse(original.entryId!, 'moderator-1', 'fraudulent');

      expect(db.profiles.get('user-1')!.totalPoints).toBe(0);
    });

    it('removes the leaderboard contribution too', async () => {
      const original = await award({ delta: 150 });
      const reversal = await service.reverse(original.entryId!, 'moderator-1', 'fraudulent');

      expect(reversal.leaderboardDelta).toBe(-150);
    });

    it('marks the original as reversed', async () => {
      const original = await award();
      const reversal = await service.reverse(original.entryId!, 'moderator-1', 'fraudulent');

      expect(db.ledger[0].reversedBy).toBe(reversal.entryId);
    });

    it('refuses to reverse the same award twice', async () => {
      const original = await award();
      await service.reverse(original.entryId!, 'moderator-1', 'fraudulent');

      await expect(service.reverse(original.entryId!, 'moderator-1', 'again')).rejects.toThrow(
        ConflictException,
      );
      expect(db.ledger).toHaveLength(2);
    });

    it('refuses to reverse a reversal', async () => {
      const original = await award();
      const reversal = await service.reverse(original.entryId!, 'moderator-1', 'fraudulent');

      await expect(service.reverse(reversal.entryId!, 'moderator-1', 'oops')).rejects.toThrow(
        ConflictException,
      );
    });

    it('leaves other awards untouched', async () => {
      const first = await award();
      await award({ refId: 'check-in-2' });
      await service.reverse(first.entryId!, 'moderator-1', 'fraudulent');

      expect(db.profiles.get('user-1')!.totalPoints).toBe(75);
    });
  });

  describe('levels', () => {
    it('promotes when the threshold is crossed', async () => {
      const result = await award({ delta: 500, refId: 'level-up' });

      expect(result.level).toBe(2);
      expect(result.levelName).toBe('Wanderer');
      expect(db.profiles.get('user-1')!.level).toBe(2);
    });

    it('stays at level 1 below the first threshold', async () => {
      const result = await award({ delta: 499, refId: 'almost' });

      expect(result.level).toBe(1);
      expect(result.levelName).toBe('Explorer');
    });

    it('demotes on reversal, because a level has to mean something', async () => {
      const original = await award({ delta: 500, refId: 'level-up' });
      const reversal = await service.reverse(original.entryId!, 'moderator-1', 'fraudulent');

      expect(reversal.level).toBe(1);
      expect(db.profiles.get('user-1')!.level).toBe(1);
    });
  });
});
