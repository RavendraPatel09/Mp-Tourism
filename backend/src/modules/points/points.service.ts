import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { PointsLedgerEntry, UserProfile } from 'src/entities';
import {
  LEVEL_THRESHOLDS,
  PointsReason,
  PointsRefType,
  levelForPoints,
} from 'src/common/constants/points';
import { ConflictException, NotFoundException } from 'src/common/exceptions/app-exceptions';
import { Paginated, decodeCursor, encodeCursor, paginate } from 'src/common/dto/pagination.dto';

export interface AwardRequest {
  userId: string;
  /** Positive. Debits go through `reverse`, never through a negative award. */
  delta: number;
  reason: PointsReason;
  refType: PointsRefType;
  /** Required for idempotency. An award with no source cannot be deduplicated. */
  refId: string | null;
  stateId?: string | null;
  districtId?: string | null;
  note?: string | null;
  createdBy?: string | null;
  /**
   * False for awards that should not move the leaderboard — currently nothing,
   * but the flag exists so a future "goodwill" credit cannot be farmed for rank.
   */
  countsTowardLeaderboard?: boolean;
}

export interface AwardResult {
  entryId: string | null;
  /** False when this exact award already existed — the safe, expected outcome of a retry. */
  applied: boolean;
  delta: number;
  leaderboardDelta: number;
  balanceAfter: number;
  level: number;
  levelName: string;
  /** True when the daily cap clipped what the leaderboard saw. */
  cappedForLeaderboard: boolean;
}

interface AwardedRow {
  id: string;
  balance_after: number;
  leaderboard_delta: number;
}

/**
 * The points ledger.
 *
 * Three invariants, in priority order:
 *
 *  1. **Never double-award.** Enforced by a partial unique index on
 *     `(user_id, reason_code, ref_type, ref_id)` and `ON CONFLICT DO NOTHING`,
 *     so a replayed queue job or a double-submitted request is a no-op rather
 *     than free points. Not a read-then-write check — that races.
 *  2. **Every balance is explainable.** Each row records its source and the
 *     balance it produced, and rows are immutable (enforced by trigger).
 *  3. **Reversible without corruption.** A moderator reverses by appending an
 *     opposing row; history is never edited.
 *
 * The profile's `total_points` is a cache written in the same transaction under
 * a row lock on the profile, which is what serialises concurrent awards for one
 * user and keeps `balance_after` a true running balance.
 */
@Injectable()
export class PointsService {
  private readonly logger = new Logger(PointsService.name);
  private readonly dailyCap: number;

  constructor(
    private readonly dataSource: DataSource,
    config: ConfigService,
    @InjectRepository(PointsLedgerEntry)
    private readonly ledger: Repository<PointsLedgerEntry>,
  ) {
    this.dailyCap = config.getOrThrow<number>('points.dailyCap');
  }

  /**
   * Awards points. Safe to call twice with the same request: the second call
   * returns `applied: false` and the balance as it already stands.
   *
   * Pass `manager` to join an existing transaction — the check-in service does,
   * so that approving a check-in and paying for it either both happen or
   * neither does.
   */
  async award(request: AwardRequest, manager?: EntityManager): Promise<AwardResult> {
    const run = (entityManager: EntityManager) => this.awardWithin(entityManager, request);
    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  private async awardWithin(manager: EntityManager, request: AwardRequest): Promise<AwardResult> {
    if (request.delta <= 0) {
      throw new Error(`award() takes a positive delta; got ${request.delta}. Use reverse().`);
    }

    // Serialises every concurrent award for this user behind one lock.
    const profile = await manager
      .createQueryBuilder(UserProfile, 'profile')
      .setLock('pessimistic_write')
      .where('profile.user_id = :userId', { userId: request.userId })
      .getOne();

    if (!profile) throw new NotFoundException('No profile for that user.');

    const countsTowardLeaderboard = request.countsTowardLeaderboard ?? true;
    const leaderboardDelta = countsTowardLeaderboard
      ? await this.applyDailyCap(manager, request.userId, request.delta)
      : 0;

    const balanceAfter = profile.totalPoints + request.delta;

    /*
     * ON CONFLICT names the partial index's predicate as well as its columns,
     * because Postgres will not infer a partial unique index from the column
     * list alone.
     */
    const inserted = await manager.query<AwardedRow[]>(
      `
      INSERT INTO points_ledger
        (user_id, delta, reason_code, ref_type, ref_id, balance_after,
         leaderboard_delta, state_id, district_id, created_by, note)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (user_id, reason_code, ref_type, ref_id)
        WHERE reason_code <> 'reversal' AND ref_id IS NOT NULL
        DO NOTHING
      RETURNING id, balance_after, leaderboard_delta
      `,
      [
        request.userId,
        request.delta,
        request.reason,
        request.refType,
        request.refId,
        balanceAfter,
        leaderboardDelta,
        request.stateId ?? null,
        request.districtId ?? null,
        request.createdBy ?? null,
        request.note ?? null,
      ],
    );

    if (!inserted.length) {
      // Already paid. Nothing to update; report the standing balance.
      const level = levelForPoints(profile.totalPoints);
      this.logger.debug(
        `Duplicate award suppressed: ${request.reason}/${request.refType}/${request.refId}`,
      );
      return {
        entryId: null,
        applied: false,
        delta: 0,
        leaderboardDelta: 0,
        balanceAfter: profile.totalPoints,
        level: level.level,
        levelName: level.name,
        cappedForLeaderboard: false,
      };
    }

    const level = levelForPoints(balanceAfter);
    await manager.update(
      UserProfile,
      { userId: request.userId },
      { totalPoints: balanceAfter, level: level.level },
    );

    return {
      entryId: inserted[0].id,
      applied: true,
      delta: request.delta,
      leaderboardDelta,
      balanceAfter,
      level: level.level,
      levelName: level.name,
      cappedForLeaderboard: leaderboardDelta < request.delta && countsTowardLeaderboard,
    };
  }

  /**
   * Appends an opposing entry and marks the original reversed. Used by
   * moderators reversing a fraudulent check-in (PRD F19) and by the check-in
   * service when an audit overturns an auto-approval.
   */
  async reverse(
    entryId: string,
    moderatorId: string | null,
    reason: string,
    manager?: EntityManager,
  ): Promise<AwardResult> {
    const run = (entityManager: EntityManager) =>
      this.reverseWithin(entityManager, entryId, moderatorId, reason);
    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  private async reverseWithin(
    manager: EntityManager,
    entryId: string,
    moderatorId: string | null,
    reason: string,
  ): Promise<AwardResult> {
    const original = await manager
      .createQueryBuilder(PointsLedgerEntry, 'entry')
      .setLock('pessimistic_write')
      .where('entry.id = :entryId', { entryId })
      .getOne();

    if (!original) throw new NotFoundException('No such ledger entry.');
    if (original.reversedBy) {
      throw new ConflictException('That award has already been reversed.', 'already_reversed');
    }
    if (original.reasonCode === PointsReason.REVERSAL) {
      throw new ConflictException('A reversal cannot itself be reversed.', 'not_reversible');
    }

    const profile = await manager
      .createQueryBuilder(UserProfile, 'profile')
      .setLock('pessimistic_write')
      .where('profile.user_id = :userId', { userId: original.userId })
      .getOne();
    if (!profile) throw new NotFoundException('No profile for that user.');

    const balanceAfter = profile.totalPoints - original.delta;
    const level = levelForPoints(Math.max(balanceAfter, 0));

    const reversal = await manager.getRepository(PointsLedgerEntry).save(
      manager.getRepository(PointsLedgerEntry).create({
        userId: original.userId,
        delta: -original.delta,
        reasonCode: PointsReason.REVERSAL,
        refType: PointsRefType.LEDGER_ENTRY,
        refId: original.id,
        balanceAfter,
        leaderboardDelta: -original.leaderboardDelta,
        stateId: original.stateId,
        districtId: original.districtId,
        createdBy: moderatorId,
        note: reason,
      }),
    );

    /*
     * `reversed_by` is the one mutable column on a ledger row; the append-only
     * trigger allows an update that touches nothing else.
     */
    await manager.update(PointsLedgerEntry, { id: original.id }, { reversedBy: reversal.id });
    await manager.update(
      UserProfile,
      { userId: original.userId },
      { totalPoints: balanceAfter, level: level.level },
    );

    return {
      entryId: reversal.id,
      applied: true,
      delta: -original.delta,
      leaderboardDelta: -original.leaderboardDelta,
      balanceAfter,
      level: level.level,
      levelName: level.name,
      cappedForLeaderboard: false,
    };
  }

  async balance(userId: string) {
    const profile = await this.dataSource.getRepository(UserProfile).findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('No profile for that user.');

    const level = levelForPoints(profile.totalPoints);
    const next = this.nextLevelAt(profile.totalPoints);

    return {
      totalPoints: profile.totalPoints,
      level: level.level,
      levelName: level.name,
      nextLevelAt: next?.minPoints ?? null,
      nextLevelName: next?.name ?? null,
      pointsToNextLevel: next ? next.minPoints - profile.totalPoints : null,
      dailyCap: this.dailyCap,
    };
  }

  async history(
    userId: string,
    limit: number,
    cursor?: string,
  ): Promise<Paginated<PointsLedgerEntry>> {
    const qb = this.ledger
      .createQueryBuilder('entry')
      .where('entry.user_id = :userId', { userId })
      .orderBy('entry.created_at', 'DESC')
      .addOrderBy('entry.id', 'DESC');

    const decoded = decodeCursor<{ createdAt: string; id: string }>(cursor);
    if (decoded) {
      qb.andWhere('(entry.created_at, entry.id) < (:createdAt, :id)', decoded);
    }

    const rows = await qb.take(limit + 1).getMany();
    return paginate(rows, limit, (row) =>
      encodeCursor({ createdAt: row.createdAt.toISOString(), id: row.id }),
    );
  }

  /**
   * Per-day point cap (PRD F14 anti-farming). The user keeps every point they
   * earn — only what the leaderboard counts is clipped. Capping the award itself
   * would punish a genuinely big day of travel; capping the rank contribution
   * removes the incentive to farm without taking anything away.
   *
   * The day boundary is IST, because a check-in at 1 a.m. in Bhopal belongs to
   * that night, not to the previous UTC day.
   */
  private async applyDailyCap(
    manager: EntityManager,
    userId: string,
    delta: number,
  ): Promise<number> {
    const rows = await manager.query<{ total: string | null }[]>(
      `
      SELECT COALESCE(SUM(leaderboard_delta), 0) AS total
        FROM points_ledger
       WHERE user_id = $1
         AND (created_at AT TIME ZONE 'Asia/Kolkata')::date
             = (now() AT TIME ZONE 'Asia/Kolkata')::date
      `,
      [userId],
    );

    const usedToday = Number.parseInt(rows[0]?.total ?? '0', 10);
    const remaining = Math.max(this.dailyCap - usedToday, 0);
    return Math.min(delta, remaining);
  }

  private nextLevelAt(totalPoints: number) {
    return LEVEL_THRESHOLDS.find((threshold) => threshold.minPoints > totalPoints) ?? null;
  }
}
