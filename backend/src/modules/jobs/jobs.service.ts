import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { LeaderboardPeriod, ChallengeStatus } from 'src/common/constants/enums';
import { LeaderboardsService } from '../leaderboards/leaderboards.service';
import { TokenService } from '../auth/token.service';

/**
 * Scheduled work. Runs only in the worker process — two API containers running
 * the same cron would rebuild the same leaderboard twice.
 *
 * Every job here is idempotent and safe to run twice anyway, because "only one
 * process has the cron" is an operational promise and operational promises get
 * broken during a deploy.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly leaderboards: LeaderboardsService,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Live ranks come from Redis, which is incremented as points are awarded and
   * can therefore drift — a dropped ZINCRBY during a Redis blip is never
   * retried. This rebuild from the ledger is the correction, and it is why
   * `LeaderboardsService.applyDelta` is allowed to fail quietly.
   */
  @Cron('0 15 * * * *', { name: 'leaderboard-monthly-rebuild' })
  async rebuildMonthlyLeaderboards(): Promise<void> {
    const result = await this.leaderboards.rebuild(LeaderboardPeriod.MONTH);
    this.logger.log(
      `Monthly leaderboards rebuilt: ${result.boards} boards, ${result.entries} entries.`,
    );
  }

  /** All-time boards move slowly; nightly is plenty and the query is heavier. */
  @Cron('0 30 3 * * *', { name: 'leaderboard-alltime-rebuild' })
  async rebuildAllTimeLeaderboards(): Promise<void> {
    const result = await this.leaderboards.rebuild(LeaderboardPeriod.ALL);
    this.logger.log(
      `All-time leaderboards rebuilt: ${result.boards} boards, ${result.entries} entries.`,
    );
  }

  /** Challenges open and close on their own dates rather than by hand. */
  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'challenge-window-sync' })
  async syncChallengeWindows(): Promise<void> {
    const activated = await this.dataSource.query<{ id: string }[]>(
      `UPDATE challenges SET status = $1
        WHERE status = $2 AND starts_at <= now() AND ends_at > now()
        RETURNING id`,
      [ChallengeStatus.ACTIVE, ChallengeStatus.DRAFT],
    );

    const ended = await this.dataSource.query<{ id: string }[]>(
      `UPDATE challenges SET status = $1 WHERE status = $2 AND ends_at <= now() RETURNING id`,
      [ChallengeStatus.ENDED, ChallengeStatus.ACTIVE],
    );

    if (activated.length || ended.length) {
      this.logger.log(`Challenges: ${activated.length} activated, ${ended.length} ended.`);
    }
  }

  /**
   * Quarterly tier recompute (PRD Appendix A) — the mechanism that keeps the
   * incentive pointed at the long tail: a destination that gets popular *drops*
   * in tier and becomes worth fewer points.
   *
   * Proposes rather than applies. Tier drives every point award on the platform,
   * so a query silently re-pricing 150 destinations is not something that should
   * happen while everyone is asleep. The proposal lands in the CMS for a human
   * to confirm.
   */
  @Cron('0 0 4 1 1,4,7,10 *', { name: 'tier-recompute-proposal' })
  async proposeTierRecompute(): Promise<void> {
    const proposals = await this.dataSource.query<
      { id: string; name: string; tier: number; proposed_tier: number; annual: number | null }[]
    >(
      `
      SELECT d.id, d.name, d.tier,
             CASE
               WHEN COALESCE(d.annual_visitors, 0) > 1000000 THEN 1
               WHEN COALESCE(d.annual_visitors, 0) > 200000  THEN 2
               WHEN COALESCE(d.annual_visitors, 0) > 20000   THEN 3
               ELSE 4
             END AS proposed_tier,
             d.annual_visitors AS annual
        FROM destinations d
       WHERE d.status = 'published'
         AND d.annual_visitors IS NOT NULL
      `,
    );

    const changes = proposals.filter((row) => row.proposed_tier !== row.tier);
    if (!changes.length) {
      this.logger.log('Quarterly tier review: no changes proposed.');
      return;
    }

    /*
     * Recorded in the audit log rather than applied, so the CMS can show it and
     * a Super Admin can accept or reject each one.
     */
    await this.dataSource.query(
      `
      INSERT INTO audit_logs (actor_id, actor_role, action, entity, entity_id, before, after)
      SELECT NULL, 'system', 'destination.tier_proposal', 'destination',
             (value ->> 'id')::uuid,
             jsonb_build_object('tier', (value ->> 'tier')::int),
             jsonb_build_object('proposedTier', (value ->> 'proposed_tier')::int,
                                'annualVisitors', value -> 'annual')
        FROM jsonb_array_elements($1::jsonb) AS value
      `,
      [JSON.stringify(changes)],
    );

    this.logger.warn(
      `Quarterly tier review: ${changes.length} tier changes proposed and logged for approval.`,
    );
  }

  /** Expired refresh tokens have no forensic value and the table only grows. */
  @Cron('0 0 4 * * *', { name: 'prune-refresh-tokens' })
  async pruneRefreshTokens(): Promise<void> {
    const removed = await this.tokens.pruneExpired();
    if (removed) this.logger.log(`Pruned ${removed} expired refresh tokens.`);
  }

  /**
   * Idempotency records only need to outlive the client's retry window. Keeping
   * them for a day is generous; keeping them forever would make the table one of
   * the largest in the database for no benefit.
   */
  @Cron('0 15 4 * * *', { name: 'prune-idempotency-records' })
  async pruneIdempotencyRecords(): Promise<void> {
    const result = await this.dataSource.query<unknown[]>(
      `DELETE FROM idempotency_records WHERE created_at < now() - interval '2 days'`,
    );
    this.logger.debug(`Idempotency records pruned: ${JSON.stringify(result)}`);
  }

  /**
   * The check-in review SLA is 12 hours (PRD §9). Nothing here can clear the
   * queue — only a moderator can — but an unnoticed breach is worse than a
   * noticed one, so it is logged loudly for alerting to pick up.
   */
  @Cron(CronExpression.EVERY_HOUR, { name: 'moderation-sla-check' })
  async checkModerationSla(): Promise<void> {
    const rows = await this.dataSource.query<{ breached: string; oldest_hours: string | null }[]>(
      `
      SELECT COUNT(*) AS breached,
             MAX(EXTRACT(EPOCH FROM (now() - submitted_at)) / 3600) AS oldest_hours
        FROM check_ins
       WHERE status = 'pending' AND needs_review = true
         AND submitted_at < now() - interval '12 hours'
      `,
    );

    const breached = Number.parseInt(rows[0]?.breached ?? '0', 10);
    if (breached > 0) {
      this.logger.error(
        `Moderation SLA breached: ${breached} check-ins waiting over 12h ` +
          `(oldest ${Number(rows[0]?.oldest_hours ?? 0).toFixed(1)}h). Users are waiting on points.`,
      );
    }
  }

  /**
   * Denormalised counters can drift if an approval ever lands outside the
   * transaction that maintains them. This repairs them nightly, so a bug shows
   * up as a corrected count rather than as a destination page that quietly
   * under-reports its own footfall forever.
   */
  @Cron('0 45 4 * * *', { name: 'reconcile-destination-counters' })
  async reconcileDestinationCounters(): Promise<void> {
    await this.dataSource.query(`
      UPDATE destinations d
         SET check_in_count = stats.approved
        FROM (
          SELECT destination_id, COUNT(*) AS approved
            FROM check_ins WHERE status = 'approved'
           GROUP BY destination_id
        ) AS stats
       WHERE d.id = stats.destination_id AND d.check_in_count <> stats.approved
    `);

    await this.dataSource.query(`
      UPDATE destinations d SET check_in_count = 0
       WHERE d.check_in_count <> 0
         AND NOT EXISTS (
           SELECT 1 FROM check_ins c
            WHERE c.destination_id = d.id AND c.status = 'approved'
         )
    `);

    this.logger.log('Destination counters reconciled.');
  }
}
