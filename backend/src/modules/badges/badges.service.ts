import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Badge, BadgeCriteria, UserBadge } from 'src/entities';

export interface EarnedBadge {
  code: string;
  name: string;
  description: string;
  icon: string | null;
  tier: string;
}

/**
 * Everything the criteria evaluator needs, gathered in one pass so that
 * evaluating twenty badges costs a fixed number of queries rather than twenty.
 */
interface UserStats {
  approvedCheckIns: number;
  /** state code → distinct destinations checked into */
  perState: Map<string, number>;
  /** state code → published destination count, for completion ratios */
  statePublished: Map<string, number>;
  distinctLiveStates: number;
  liveStateCount: number;
  /** category slug → distinct destinations */
  perCategory: Map<string, number>;
  /** tier → distinct destinations at exactly that tier */
  perTier: Map<number, number>;
  isPioneer: boolean;
  /** IST hour → check-in count */
  perHour: Map<number, number>;
  /** season → check-in count at destinations whose best season includes it */
  perSeason: Map<string, number>;
  acceptedMedia: number;
}

/**
 * Badge engine (PRD §5.2 F13).
 *
 * Runs on the check-in-approved event, and is safe to run at any other time:
 * criteria are evaluated against current state rather than incremented, so the
 * engine is idempotent and a backfill over every user produces exactly the same
 * badges as the live path did. That property is what makes it safe to add a new
 * badge to a live platform — insert the row, run the backfill.
 */
@Injectable()
export class BadgesService {
  private readonly logger = new Logger(BadgesService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Badge) private readonly badges: Repository<Badge>,
    @InjectRepository(UserBadge) private readonly userBadges: Repository<UserBadge>,
  ) {}

  async evaluateForUser(userId: string, refId?: string | null): Promise<EarnedBadge[]> {
    const [definitions, alreadyEarned] = await Promise.all([
      this.badges.find({ where: { isActive: true } }),
      this.userBadges.find({ where: { userId }, select: { badgeId: true } }),
    ]);

    const earnedIds = new Set(alreadyEarned.map((row) => row.badgeId));
    const candidates = definitions.filter((badge) => !earnedIds.has(badge.id));
    if (!candidates.length) return [];

    const stats = await this.collectStats(userId);
    const newlyEarned: EarnedBadge[] = [];

    for (const badge of candidates) {
      if (!this.satisfies(badge.criteria, stats)) continue;

      /*
       * ON CONFLICT DO NOTHING rather than a pre-check: two approvals for the
       * same user can land concurrently, and the unique index is the only thing
       * that actually settles which one wins.
       */
      const result = await this.userBadges
        .createQueryBuilder()
        .insert()
        .values({ userId, badgeId: badge.id, refId: refId ?? null })
        .orIgnore()
        .execute();

      if (result.raw?.length || (result.identifiers?.length ?? 0) > 0) {
        newlyEarned.push({
          code: badge.code,
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          tier: badge.tier,
        });
      }
    }

    if (newlyEarned.length) {
      this.logger.log(
        `User ${userId} earned ${newlyEarned.length} badge(s): ${newlyEarned
          .map((badge) => badge.code)
          .join(', ')}`,
      );
    }

    return newlyEarned;
  }

  async listForUser(userId: string) {
    const [all, earned] = await Promise.all([
      this.badges.find({ where: { isActive: true }, order: { tier: 'ASC', name: 'ASC' } }),
      this.userBadges.find({ where: { userId } }),
    ]);

    const earnedMap = new Map(earned.map((row) => [row.badgeId, row.earnedAt]));

    return all.map((badge) => ({
      code: badge.code,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      tier: badge.tier,
      earnedAt: earnedMap.get(badge.id) ?? null,
      /** The badge wall shows locked badges too — they are the roadmap. */
      isEarned: earnedMap.has(badge.id),
    }));
  }

  /** Backfill entry point for a newly added badge. */
  async backfill(badgeCode: string): Promise<number> {
    const badge = await this.badges.findOne({ where: { code: badgeCode } });
    if (!badge) throw new Error(`No badge with code ${badgeCode}`);

    const users = await this.dataSource.query<{ user_id: string }[]>(
      `SELECT DISTINCT user_id FROM check_ins WHERE status = 'approved'`,
    );

    let awarded = 0;
    for (const { user_id: userId } of users) {
      const earned = await this.evaluateForUser(userId);
      if (earned.some((entry) => entry.code === badgeCode)) awarded += 1;
    }
    return awarded;
  }

  private satisfies(criteria: BadgeCriteria, stats: UserStats): boolean {
    switch (criteria.kind) {
      case 'check_in_count':
        return stats.approvedCheckIns >= criteria.count;

      case 'state_destinations': {
        if (criteria.state_code) {
          return (stats.perState.get(criteria.state_code) ?? 0) >= criteria.count;
        }
        // No state named: satisfied by reaching the count in *any* one state.
        return [...stats.perState.values()].some((count) => count >= criteria.count);
      }

      case 'state_completion': {
        const check = (code: string) => {
          const published = stats.statePublished.get(code) ?? 0;
          if (published === 0) return false;
          return (stats.perState.get(code) ?? 0) / published >= criteria.ratio;
        };
        return criteria.state_code
          ? check(criteria.state_code)
          : [...stats.statePublished.keys()].some(check);
      }

      case 'all_states':
        /*
         * Measured against live states, not all 36. At MVP there is one live
         * state, so this badge is unreachable — deliberately: it should unlock
         * when a traveller has covered the platform, not when the platform is
         * small.
         */
        return stats.liveStateCount > 1 && stats.distinctLiveStates >= stats.liveStateCount;

      case 'category_count':
        return (stats.perCategory.get(criteria.category_slug) ?? 0) >= criteria.count;

      case 'tier_count': {
        let total = 0;
        for (const [tier, count] of stats.perTier) {
          if (tier >= criteria.min_tier) total += count;
        }
        return total >= criteria.count;
      }

      case 'pioneer':
        return stats.isPioneer;

      case 'time_of_day': {
        let total = 0;
        for (const [hour, count] of stats.perHour) {
          const inRange =
            criteria.from_hour <= criteria.to_hour
              ? hour >= criteria.from_hour && hour <= criteria.to_hour
              : // Wraps midnight, e.g. 22:00–04:00.
                hour >= criteria.from_hour || hour <= criteria.to_hour;
          if (inRange) total += count;
        }
        return total >= criteria.count;
      }

      case 'season_count':
        return (stats.perSeason.get(criteria.season) ?? 0) >= criteria.count;

      case 'accepted_media':
        return stats.acceptedMedia >= criteria.count;

      default:
        /*
         * An unknown criteria kind means the database has a badge this build
         * cannot evaluate. Never award by default.
         */
        this.logger.warn(`Unknown badge criteria kind: ${JSON.stringify(criteria)}`);
        return false;
    }
  }

  private async collectStats(userId: string): Promise<UserStats> {
    const [byState, byCategory, byTier, byHour, bySeason, totals, published, pioneer, media] =
      await Promise.all([
        this.dataSource.query<{ code: string; destinations: string }[]>(
          `
          SELECT s.code, COUNT(DISTINCT c.destination_id) AS destinations
            FROM check_ins c
            JOIN destinations d ON d.id = c.destination_id
            JOIN states s ON s.id = d.state_id
           WHERE c.user_id = $1 AND c.status = 'approved'
           GROUP BY s.code
          `,
          [userId],
        ),
        this.dataSource.query<{ slug: string; destinations: string }[]>(
          `
          SELECT cat.slug, COUNT(DISTINCT c.destination_id) AS destinations
            FROM check_ins c
            JOIN destination_categories dc ON dc.destination_id = c.destination_id
            JOIN categories cat ON cat.id = dc.category_id
           WHERE c.user_id = $1 AND c.status = 'approved'
           GROUP BY cat.slug
          `,
          [userId],
        ),
        this.dataSource.query<{ tier: number; destinations: string }[]>(
          `
          SELECT d.tier, COUNT(DISTINCT c.destination_id) AS destinations
            FROM check_ins c
            JOIN destinations d ON d.id = c.destination_id
           WHERE c.user_id = $1 AND c.status = 'approved'
           GROUP BY d.tier
          `,
          [userId],
        ),
        this.dataSource.query<{ hour: number; check_ins: string }[]>(
          `
          SELECT EXTRACT(HOUR FROM c.captured_at AT TIME ZONE 'Asia/Kolkata')::int AS hour,
                 COUNT(*) AS check_ins
            FROM check_ins c
           WHERE c.user_id = $1 AND c.status = 'approved'
           GROUP BY hour
          `,
          [userId],
        ),
        /*
         * Seasons are a separate query rather than another grouping column: a
         * destination can list several seasons, and unnesting them alongside the
         * hour tally would multiply every row and inflate both counts.
         */
        this.dataSource.query<{ season: string; check_ins: string }[]>(
          `
          SELECT season::text AS season, COUNT(DISTINCT c.id) AS check_ins
            FROM check_ins c
            JOIN destinations d ON d.id = c.destination_id
            JOIN LATERAL unnest(d.best_season) AS season ON true
           WHERE c.user_id = $1 AND c.status = 'approved'
           GROUP BY season
          `,
          [userId],
        ),
        this.dataSource.query<{ count: string }[]>(
          `SELECT COUNT(*) AS count FROM check_ins WHERE user_id = $1 AND status = 'approved'`,
          [userId],
        ),
        this.dataSource.query<{ code: string; published: string; is_live: boolean }[]>(
          `
          SELECT s.code, s.is_live,
                 COUNT(d.id) FILTER (WHERE d.status = 'published') AS published
            FROM states s
            LEFT JOIN destinations d ON d.state_id = s.id
           GROUP BY s.code, s.is_live
          `,
        ),
        this.dataSource.query<{ count: string }[]>(
          `SELECT COUNT(*) AS count FROM destinations WHERE pioneer_user_id = $1`,
          [userId],
        ),
        this.dataSource.query<{ count: string }[]>(
          `
          SELECT COUNT(*) AS count FROM media
           WHERE uploaded_by = $1 AND status = 'approved' AND owner_type = 'destination'
          `,
          [userId],
        ),
      ]);

    const perState = new Map(
      byState.map((row) => [row.code, Number.parseInt(row.destinations, 10)]),
    );
    const statePublished = new Map<string, number>();
    let liveStateCount = 0;
    for (const row of published) {
      statePublished.set(row.code, Number.parseInt(row.published, 10));
      if (row.is_live) liveStateCount += 1;
    }

    const perHour = new Map(byHour.map((row) => [row.hour, Number.parseInt(row.check_ins, 10)]));
    const perSeason = new Map(
      bySeason.map((row) => [row.season, Number.parseInt(row.check_ins, 10)]),
    );
    const perTier = new Map(
      byTier.map((row) => [Number(row.tier), Number.parseInt(row.destinations, 10)]),
    );

    return {
      approvedCheckIns: Number.parseInt(totals[0]?.count ?? '0', 10),
      perState,
      statePublished,
      distinctLiveStates: [...perState.keys()].filter((code) => {
        const row = published.find((entry) => entry.code === code);
        return row?.is_live ?? false;
      }).length,
      liveStateCount,
      perCategory: new Map(
        byCategory.map((row) => [row.slug, Number.parseInt(row.destinations, 10)]),
      ),
      perTier,
      isPioneer: Number.parseInt(pioneer[0]?.count ?? '0', 10) > 0,
      perHour,
      perSeason,
      acceptedMedia: Number.parseInt(media[0]?.count ?? '0', 10),
    };
  }
}
