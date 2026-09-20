import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOperator, IsNull, Repository } from 'typeorm';
import Redis from 'ioredis';
import { LeaderboardSnapshot, UserProfile } from 'src/entities';
import { LeaderboardPeriod, LeaderboardScope } from 'src/common/constants/enums';
import { REDIS_CLIENT } from '../redis/redis.module';
import { MediaService } from '../media/media.service';
import { UnprocessableException } from 'src/common/exceptions/app-exceptions';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  level: number;
  points: number;
  /** True for the requesting user's own row, so the client can pin it. */
  isMe: boolean;
}

export interface LeaderboardPage {
  scope: LeaderboardScope;
  scopeId: string | null;
  period: LeaderboardPeriod;
  periodKey: string;
  entries: LeaderboardEntry[];
  /** The requester's own standing, even when they are outside the returned page. */
  me: LeaderboardEntry | null;
  totalRanked: number;
  source: 'live' | 'snapshot';
}

export interface ScoreDelta {
  userId: string;
  points: number;
  stateId: string | null;
  districtId: string | null;
}

const EXCLUDED_SET = 'lb:excluded';

/**
 * The national board has no scope id. TypeORM turns a literal `null` in a
 * `where` into `= NULL`, which matches nothing, so it has to become `IS NULL`.
 */
const scopeIdWhere = (scopeId: string | null): string | FindOperator<string> => scopeId ?? IsNull();

@Injectable()
export class LeaderboardsService {
  private readonly logger = new Logger(LeaderboardsService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly dataSource: DataSource,
    @InjectRepository(LeaderboardSnapshot)
    private readonly snapshots: Repository<LeaderboardSnapshot>,
    private readonly media: MediaService,
  ) {}

  /**
   * Applies a scored event to every board it affects: national, state and
   * district, for both the current month and all-time. Six ZINCRBYs in one
   * pipeline, which is why ranks can be live at all — recomputing any of these
   * from `points_ledger` on read would be a full scan per request.
   *
   * Fire-and-forget by design. A Redis blip must not fail a check-in; the
   * nightly rebuild is the repair mechanism.
   */
  async applyDelta(delta: ScoreDelta): Promise<void> {
    if (delta.points === 0) return;

    try {
      if (await this.redis.sismember(EXCLUDED_SET, delta.userId)) return;

      const pipeline = this.redis.pipeline();
      for (const key of this.keysFor(delta.stateId, delta.districtId)) {
        pipeline.zincrby(key, delta.points, delta.userId);
      }
      await pipeline.exec();
    } catch (error) {
      this.logger.error(
        `Leaderboard update failed for user ${delta.userId}; the nightly rebuild will correct it.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async getBoard(params: {
    scope: LeaderboardScope;
    scopeId?: string | null;
    period: LeaderboardPeriod;
    limit: number;
    offset: number;
    requesterId?: string;
  }): Promise<LeaderboardPage> {
    if (params.scope !== LeaderboardScope.NATIONAL && !params.scopeId) {
      throw new UnprocessableException(
        `scope=${params.scope} requires a state or district id.`,
        'missing_scope_id',
      );
    }

    const periodKey = this.periodKey(params.period);
    const key = this.boardKey(params.scope, params.scopeId ?? null, params.period, periodKey);

    const total = await this.redis.zcard(key).catch(() => 0);
    if (total === 0) {
      // Cold Redis (fresh deploy, flush, or a board nobody has scored on yet).
      return this.fromSnapshot(params, periodKey);
    }

    const raw = await this.redis.zrevrange(
      key,
      params.offset,
      params.offset + params.limit - 1,
      'WITHSCORES',
    );

    const ids: string[] = [];
    const scores = new Map<string, number>();
    for (let index = 0; index < raw.length; index += 2) {
      ids.push(raw[index]);
      scores.set(raw[index], Number.parseFloat(raw[index + 1]));
    }

    const profiles = await this.hydrate(ids);
    const entries = ids.map((userId, index) => ({
      ...profiles.get(userId)!,
      rank: params.offset + index + 1,
      points: Math.round(scores.get(userId) ?? 0),
      isMe: userId === params.requesterId,
    }));

    return {
      scope: params.scope,
      scopeId: params.scopeId ?? null,
      period: params.period,
      periodKey,
      entries,
      me: params.requesterId ? await this.standingFor(key, params.requesterId, entries) : null,
      totalRanked: total,
      source: 'live',
    };
  }

  /** Own-rank pinning: one ZREVRANK + one ZSCORE, regardless of how deep the user sits. */
  private async standingFor(
    key: string,
    userId: string,
    page: LeaderboardEntry[],
  ): Promise<LeaderboardEntry | null> {
    const onPage = page.find((entry) => entry.userId === userId);
    if (onPage) return onPage;

    const [rank, score] = await Promise.all([
      this.redis.zrevrank(key, userId),
      this.redis.zscore(key, userId),
    ]);
    if (rank === null || score === null) return null;

    const profiles = await this.hydrate([userId]);
    const profile = profiles.get(userId);
    if (!profile) return null;

    return { ...profile, rank: rank + 1, points: Math.round(Number.parseFloat(score)), isMe: true };
  }

  /**
   * Nightly rebuild from the ledger. This is the authoritative computation —
   * Redis is a cache of it. Also the repair path after a Redis flush and the
   * reason `applyDelta` is allowed to fail silently.
   */
  async rebuild(period: LeaderboardPeriod): Promise<{ boards: number; entries: number }> {
    const periodKey = this.periodKey(period);
    await this.refreshExclusions();

    const windowClause =
      period === LeaderboardPeriod.MONTH
        ? `AND to_char(ledger.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') = $1`
        : '';

    const rows = await this.dataSource.query<
      { user_id: string; state_id: string | null; district_id: string | null; points: string }[]
    >(
      `
      SELECT ledger.user_id, ledger.state_id, ledger.district_id,
             SUM(ledger.leaderboard_delta) AS points
        FROM points_ledger ledger
        JOIN user_profiles profile ON profile.user_id = ledger.user_id
        JOIN users u ON u.id = ledger.user_id
       WHERE ledger.leaderboard_delta <> 0
         AND profile.hide_from_leaderboards = false
         AND u.is_minor = false
         AND u.status NOT IN ('banned', 'leaderboard_suspended', 'deleted')
         ${windowClause}
       GROUP BY ledger.user_id, ledger.state_id, ledger.district_id
      `,
      period === LeaderboardPeriod.MONTH ? [periodKey] : [],
    );

    /** scope key → userId → points */
    const boards = new Map<string, Map<string, number>>();
    const add = (key: string, userId: string, points: number) => {
      const board = boards.get(key) ?? new Map<string, number>();
      board.set(userId, (board.get(userId) ?? 0) + points);
      boards.set(key, board);
    };

    for (const row of rows) {
      const points = Number.parseInt(row.points, 10);
      if (points === 0) continue;

      add(this.boardKey(LeaderboardScope.NATIONAL, null, period, periodKey), row.user_id, points);
      if (row.state_id) {
        add(
          this.boardKey(LeaderboardScope.STATE, row.state_id, period, periodKey),
          row.user_id,
          points,
        );
      }
      if (row.district_id) {
        add(
          this.boardKey(LeaderboardScope.DISTRICT, row.district_id, period, periodKey),
          row.user_id,
          points,
        );
      }
    }

    let entryCount = 0;
    for (const [key, board] of boards) {
      const scored = [...board.entries()].filter(([, points]) => points > 0);
      if (!scored.length) {
        await this.redis.del(key);
        continue;
      }

      // Build beside the live key, then swap, so readers never see a half-built board.
      const staging = `${key}:rebuilding`;
      const pipeline = this.redis.pipeline();
      pipeline.del(staging);
      for (const [userId, points] of scored) {
        pipeline.zadd(staging, points, userId);
      }
      pipeline.rename(staging, key);
      await pipeline.exec();
      entryCount += scored.length;
    }

    await this.persistSnapshots(boards, period, periodKey);
    this.logger.log(`Rebuilt ${boards.size} ${period} boards (${entryCount} entries).`);

    return { boards: boards.size, entries: entryCount };
  }

  /** Keeps the durable copy in step, so a board survives losing Redis entirely. */
  private async persistSnapshots(
    boards: Map<string, Map<string, number>>,
    period: LeaderboardPeriod,
    periodKey: string,
  ): Promise<void> {
    for (const [key, board] of boards) {
      const { scope, scopeId } = this.parseBoardKey(key);

      const ranked = [...board.entries()]
        .filter(([, points]) => points > 0)
        .sort((a, b) => b[1] - a[1])
        // Nobody paginates past a thousand; storing the tail costs rows for nothing.
        .slice(0, 1000)
        .map(([userId, points], index) => ({
          scope,
          scopeId,
          period,
          periodKey,
          userId,
          points,
          rank: index + 1,
          computedAt: new Date(),
        }));

      await this.dataSource.transaction(async (manager) => {
        await manager.delete(LeaderboardSnapshot, {
          scope,
          scopeId: scopeIdWhere(scopeId),
          period,
          periodKey,
        });
        if (ranked.length) {
          await manager.insert(LeaderboardSnapshot, ranked);
        }
      });
    }
  }

  private async fromSnapshot(
    params: {
      scope: LeaderboardScope;
      scopeId?: string | null;
      period: LeaderboardPeriod;
      limit: number;
      offset: number;
      requesterId?: string;
    },
    periodKey: string,
  ): Promise<LeaderboardPage> {
    const rows = await this.snapshots.find({
      where: {
        scope: params.scope,
        scopeId: scopeIdWhere(params.scopeId ?? null),
        period: params.period,
        periodKey,
      },
      order: { rank: 'ASC' },
      skip: params.offset,
      take: params.limit,
    });

    const profiles = await this.hydrate(rows.map((row) => row.userId));
    const entries = rows
      .filter((row) => profiles.has(row.userId))
      .map((row) => ({
        ...profiles.get(row.userId)!,
        rank: row.rank,
        points: row.points,
        isMe: row.userId === params.requesterId,
      }));

    let me: LeaderboardEntry | null = entries.find((entry) => entry.isMe) ?? null;
    if (!me && params.requesterId) {
      const own = await this.snapshots.findOne({
        where: {
          scope: params.scope,
          scopeId: scopeIdWhere(params.scopeId ?? null),
          period: params.period,
          periodKey,
          userId: params.requesterId,
        },
      });
      const ownProfile = own ? (await this.hydrate([own.userId])).get(own.userId) : undefined;
      me =
        own && ownProfile
          ? { ...ownProfile, rank: own.rank, points: own.points, isMe: true }
          : null;
    }

    return {
      scope: params.scope,
      scopeId: params.scopeId ?? null,
      period: params.period,
      periodKey,
      entries,
      me,
      totalRanked: await this.snapshots.count({
        where: {
          scope: params.scope,
          scopeId: scopeIdWhere(params.scopeId ?? null),
          period: params.period,
          periodKey,
        },
      }),
      source: 'snapshot',
    };
  }

  /** Users who must never appear: opted out, minors, or suspended (PRD §11, F19). */
  async refreshExclusions(): Promise<number> {
    const rows = await this.dataSource.query<{ user_id: string }[]>(
      `
      SELECT u.id AS user_id
        FROM users u
        LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.is_minor = true
          OR u.status IN ('banned', 'leaderboard_suspended', 'deleted')
          OR p.hide_from_leaderboards = true
      `,
    );

    const pipeline = this.redis.pipeline();
    pipeline.del(EXCLUDED_SET);
    if (rows.length) {
      pipeline.sadd(EXCLUDED_SET, ...rows.map((row) => row.user_id));
    }
    await pipeline.exec();
    return rows.length;
  }

  /** Called when a user opts out or is suspended — takes effect immediately. */
  async exclude(userId: string): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.sadd(EXCLUDED_SET, userId);
    for (const key of this.allKeysForUserRemoval()) {
      pipeline.zrem(key, userId);
    }
    await pipeline.exec();
  }

  async include(userId: string): Promise<void> {
    await this.redis.srem(EXCLUDED_SET, userId);
  }

  private async hydrate(
    userIds: string[],
  ): Promise<Map<string, Omit<LeaderboardEntry, 'rank' | 'points' | 'isMe'>>> {
    if (!userIds.length) return new Map();

    const profiles = await this.dataSource
      .getRepository(UserProfile)
      .createQueryBuilder('profile')
      .select([
        'profile.user_id AS "userId"',
        'profile.username AS username',
        'profile.display_name AS "displayName"',
        'profile.level AS level',
      ])
      .addSelect(
        `(SELECT m.storage_key FROM media m WHERE m.id = profile.avatar_media_id)`,
        'avatarKey',
      )
      .where('profile.user_id = ANY(:userIds)', { userIds })
      .getRawMany<{
        userId: string;
        username: string;
        displayName: string | null;
        level: number;
        avatarKey: string | null;
      }>();

    return new Map(
      profiles.map((profile) => [
        profile.userId,
        {
          userId: profile.userId,
          username: profile.username,
          displayName: profile.displayName,
          level: profile.level,
          avatarUrl: profile.avatarKey ? this.media.publicUrl(profile.avatarKey) : null,
        },
      ]),
    );
  }

  private keysFor(stateId: string | null, districtId: string | null): string[] {
    const keys: string[] = [];
    for (const period of [LeaderboardPeriod.MONTH, LeaderboardPeriod.ALL]) {
      const periodKey = this.periodKey(period);
      keys.push(this.boardKey(LeaderboardScope.NATIONAL, null, period, periodKey));
      if (stateId) keys.push(this.boardKey(LeaderboardScope.STATE, stateId, period, periodKey));
      if (districtId) {
        keys.push(this.boardKey(LeaderboardScope.DISTRICT, districtId, period, periodKey));
      }
    }
    return keys;
  }

  private boardKey(
    scope: LeaderboardScope,
    scopeId: string | null,
    period: LeaderboardPeriod,
    periodKey: string,
  ): string {
    return `lb:${scope}:${scopeId ?? 'all'}:${period}:${periodKey}`;
  }

  private parseBoardKey(key: string): { scope: LeaderboardScope; scopeId: string | null } {
    const [, scope, scopeId] = key.split(':');
    return {
      scope: scope as LeaderboardScope,
      scopeId: scopeId === 'all' ? null : scopeId,
    };
  }

  /**
   * Opting out has to clear the current boards, not just stop future writes.
   * Only the two boards we can name without a scan are cleared here; the rest
   * disappear at the next rebuild, which honours the exclusion list.
   */
  private allKeysForUserRemoval(): string[] {
    return [
      this.boardKey(
        LeaderboardScope.NATIONAL,
        null,
        LeaderboardPeriod.MONTH,
        this.periodKey(LeaderboardPeriod.MONTH),
      ),
      this.boardKey(
        LeaderboardScope.NATIONAL,
        null,
        LeaderboardPeriod.ALL,
        this.periodKey(LeaderboardPeriod.ALL),
      ),
    ];
  }

  /** Monthly boards reset on IST month boundaries, matching the rest of the platform. */
  private periodKey(period: LeaderboardPeriod): string {
    if (period === LeaderboardPeriod.ALL) return 'all';
    const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
    return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}`;
  }
}
