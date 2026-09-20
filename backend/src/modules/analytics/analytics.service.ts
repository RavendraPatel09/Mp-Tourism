import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FootfallQueryDto, Granularity } from './dto/analytics.dto';

/**
 * The analytics a tourism officer actually asks for (PRD F25).
 *
 * Every number here comes from approved check-ins, because that is the only
 * footfall figure the platform can stand behind. Pending and rejected
 * submissions are excluded everywhere — a dashboard that counts unverified
 * check-ins is a dashboard no board will sign a contract against.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly dataSource: DataSource) {}

  async footfall(query: FootfallQueryDto, stateScope: string | null) {
    const bucket = this.truncFor(query.granularity);
    const stateId = stateScope ?? query.stateId ?? null;

    const rows = await this.dataSource.query<
      { bucket: Date; check_ins: string; unique_users: string; tier34: string }[]
    >(
      `
      SELECT date_trunc($1, c.captured_at AT TIME ZONE 'Asia/Kolkata') AS bucket,
             COUNT(*)                               AS check_ins,
             COUNT(DISTINCT c.user_id)              AS unique_users,
             COUNT(*) FILTER (WHERE d.tier >= 3)    AS tier34
        FROM check_ins c
        JOIN destinations d ON d.id = c.destination_id
       WHERE c.status = 'approved'
         AND c.captured_at >= $2 AND c.captured_at < $3
         AND ($4::uuid IS NULL OR d.state_id = $4::uuid)
         AND ($5::uuid IS NULL OR d.district_id = $5::uuid)
       GROUP BY bucket
       ORDER BY bucket
      `,
      [bucket, query.from, query.to, stateId, query.districtId ?? null],
    );

    return rows.map((row) => {
      const checkIns = Number.parseInt(row.check_ins, 10);
      const tier34 = Number.parseInt(row.tier34, 10);
      return {
        bucket: row.bucket,
        checkIns,
        uniqueUsers: Number.parseInt(row.unique_users, 10),
        tier34CheckIns: tier34,
        tier34Share: checkIns ? Number((tier34 / checkIns).toFixed(3)) : 0,
      };
    });
  }

  /**
   * The headline KPI: what share of verified check-ins land at lesser-known
   * sites (PRD §9, target ≥ 35%). Also returns the Gini coefficient of footfall
   * across destinations, which is the honest measure of whether visitors are
   * genuinely spreading out or just clustering onto a new set of favourites.
   */
  async redistribution(query: FootfallQueryDto, stateScope: string | null) {
    const stateId = stateScope ?? query.stateId ?? null;

    const [shares, perDestination] = await Promise.all([
      this.dataSource.query<{ tier: number; check_ins: string }[]>(
        `
        SELECT d.tier, COUNT(*) AS check_ins
          FROM check_ins c
          JOIN destinations d ON d.id = c.destination_id
         WHERE c.status = 'approved'
           AND c.captured_at >= $1 AND c.captured_at < $2
           AND ($3::uuid IS NULL OR d.state_id = $3::uuid)
         GROUP BY d.tier
         ORDER BY d.tier
        `,
        [query.from, query.to, stateId],
      ),
      this.dataSource.query<{ check_ins: string }[]>(
        `
        SELECT COUNT(*) AS check_ins
          FROM check_ins c
          JOIN destinations d ON d.id = c.destination_id
         WHERE c.status = 'approved'
           AND c.captured_at >= $1 AND c.captured_at < $2
           AND ($3::uuid IS NULL OR d.state_id = $3::uuid)
         GROUP BY d.id
        `,
        [query.from, query.to, stateId],
      ),
    ]);

    const byTier = Object.fromEntries(
      shares.map((row) => [row.tier, Number.parseInt(row.check_ins, 10)]),
    );
    const total = Object.values(byTier).reduce((sum, count) => sum + count, 0);
    const tier34 = (byTier[3] ?? 0) + (byTier[4] ?? 0);

    const activeDestinations = await this.dataSource.query<{ count: string }[]>(
      `
      SELECT COUNT(DISTINCT c.destination_id) AS count
        FROM check_ins c
        JOIN destinations d ON d.id = c.destination_id
       WHERE c.status = 'approved'
         AND c.captured_at >= $1 AND c.captured_at < $2
         AND ($3::uuid IS NULL OR d.state_id = $3::uuid)
      `,
      [query.from, query.to, stateId],
    );

    return {
      window: { from: query.from, to: query.to },
      totalCheckIns: total,
      byTier,
      tier34CheckIns: tier34,
      /** The number in the board deck. Target ≥ 0.35. */
      tier34Share: total ? Number((tier34 / total).toFixed(3)) : 0,
      destinationsWithCheckIns: Number.parseInt(activeDestinations[0]?.count ?? '0', 10),
      footfallGini: this.gini(perDestination.map((row) => Number.parseInt(row.check_ins, 10))),
    };
  }

  /** Top destinations by verified footfall, with movement against the prior window. */
  async topDestinations(query: FootfallQueryDto, stateScope: string | null) {
    const stateId = stateScope ?? query.stateId ?? null;
    const windowMs = new Date(query.to).getTime() - new Date(query.from).getTime();
    const priorFrom = new Date(new Date(query.from).getTime() - windowMs).toISOString();

    return this.dataSource.query(
      `
      SELECT d.id, d.name, d.slug, d.tier,
             s.code AS state_code,
             dist.name AS district_name,
             COUNT(*) FILTER (
               WHERE c.captured_at >= $1 AND c.captured_at < $2
             ) AS check_ins,
             COUNT(*) FILTER (
               WHERE c.captured_at >= $4 AND c.captured_at < $1
             ) AS prior_check_ins
        FROM check_ins c
        JOIN destinations d ON d.id = c.destination_id
        JOIN states s ON s.id = d.state_id
        LEFT JOIN districts dist ON dist.id = d.district_id
       WHERE c.status = 'approved'
         AND c.captured_at >= $4 AND c.captured_at < $2
         AND ($3::uuid IS NULL OR d.state_id = $3::uuid)
       GROUP BY d.id, d.name, d.slug, d.tier, s.code, dist.name
      HAVING COUNT(*) FILTER (WHERE c.captured_at >= $1 AND c.captured_at < $2) > 0
       ORDER BY check_ins DESC
       LIMIT 50
      `,
      [query.from, query.to, stateId, priorFrom],
    );
  }

  /**
   * Where visitors come from, by their home state. The flow map a board wants
   * when deciding which market to advertise in.
   */
  async visitorOrigins(query: FootfallQueryDto, stateScope: string | null) {
    const stateId = stateScope ?? query.stateId ?? null;

    return this.dataSource.query(
      `
      SELECT COALESCE(home.code, 'unknown') AS origin_state,
             COALESCE(home.name, 'Not stated') AS origin_state_name,
             COUNT(*) AS check_ins,
             COUNT(DISTINCT c.user_id) AS visitors
        FROM check_ins c
        JOIN destinations d ON d.id = c.destination_id
        JOIN user_profiles p ON p.user_id = c.user_id
        LEFT JOIN states home ON home.id = p.home_state_id
       WHERE c.status = 'approved'
         AND c.captured_at >= $1 AND c.captured_at < $2
         AND ($3::uuid IS NULL OR d.state_id = $3::uuid)
       GROUP BY home.code, home.name
       ORDER BY check_ins DESC
      `,
      [query.from, query.to, stateId],
    );
  }

  /** Month-by-month curve, for planning the season a district promotes. */
  async seasonality(stateScope: string | null, stateId?: string) {
    return this.dataSource.query(
      `
      SELECT EXTRACT(MONTH FROM c.captured_at AT TIME ZONE 'Asia/Kolkata')::int AS month,
             COUNT(*) AS check_ins,
             COUNT(DISTINCT c.destination_id) AS destinations
        FROM check_ins c
        JOIN destinations d ON d.id = c.destination_id
       WHERE c.status = 'approved'
         AND ($1::uuid IS NULL OR d.state_id = $1::uuid)
       GROUP BY month
       ORDER BY month
      `,
      [stateScope ?? stateId ?? null],
    );
  }

  /**
   * Campaign lift: footfall at a challenge's destinations during its window,
   * against the equivalent window immediately before it. This is the number a
   * campaign report is built on, so it compares like with like — same length of
   * window, same set of destinations.
   */
  async campaignLift(challengeId: string) {
    const rows = await this.dataSource.query<
      { during: string; before: string; destinations: string }[]
    >(
      `
      WITH challenge AS (
        SELECT id, starts_at, ends_at,
               (ends_at - starts_at) AS duration,
               criteria
          FROM challenges WHERE id = $1
      ),
      participating AS (
        SELECT d.id
          FROM destinations d, challenge ch
         WHERE (ch.criteria ->> 'kind' = 'visit_set'
                AND ch.criteria -> 'destination_ids' ? d.id::text)
            OR (ch.criteria ->> 'kind' = 'tier_count'
                AND d.tier >= (ch.criteria ->> 'min_tier')::int)
            OR (ch.criteria ->> 'kind' = 'circuit'
                AND EXISTS (SELECT 1 FROM circuit_destinations cd
                             WHERE cd.destination_id = d.id
                               AND cd.circuit_id = (ch.criteria ->> 'circuit_id')::uuid))
      )
      SELECT
        COUNT(*) FILTER (
          WHERE c.captured_at >= ch.starts_at AND c.captured_at < ch.ends_at
        ) AS during,
        COUNT(*) FILTER (
          WHERE c.captured_at >= ch.starts_at - ch.duration AND c.captured_at < ch.starts_at
        ) AS before,
        (SELECT COUNT(*) FROM participating) AS destinations
        FROM check_ins c
        JOIN participating p ON p.id = c.destination_id
        CROSS JOIN challenge ch
       WHERE c.status = 'approved'
      `,
      [challengeId],
    );

    const row = rows[0];
    const during = Number.parseInt(row?.during ?? '0', 10);
    const before = Number.parseInt(row?.before ?? '0', 10);

    return {
      challengeId,
      participatingDestinations: Number.parseInt(row?.destinations ?? '0', 10),
      checkInsDuring: during,
      checkInsBefore: before,
      /** Null rather than infinity when the prior window was empty — a real case. */
      lift: before > 0 ? Number((during / before).toFixed(2)) : null,
      absoluteChange: during - before,
    };
  }

  /** Integrity dashboard (PRD §9): auto-approval rate, SLA, fraud rate. */
  async integrity(days: number) {
    const rows = await this.dataSource.query<
      {
        total: string;
        auto_approved: string;
        manual: string;
        rejected: string;
        reversed: string;
        median_review_hours: string | null;
      }[]
    >(
      `
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE status = 'approved' AND reviewed_by IS NULL)
               AS auto_approved,
             COUNT(*) FILTER (WHERE reviewed_by IS NOT NULL) AS manual,
             COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
             (SELECT COUNT(*) FROM points_ledger
               WHERE reason_code = 'reversal'
                 AND created_at > now() - ($1 || ' days')::interval) AS reversed,
             PERCENTILE_CONT(0.5) WITHIN GROUP (
               ORDER BY EXTRACT(EPOCH FROM (reviewed_at - submitted_at)) / 3600
             ) FILTER (WHERE reviewed_at IS NOT NULL) AS median_review_hours
        FROM check_ins
       WHERE submitted_at > now() - ($1 || ' days')::interval
      `,
      [days],
    );

    const row = rows[0];
    const total = Number.parseInt(row?.total ?? '0', 10);
    const autoApproved = Number.parseInt(row?.auto_approved ?? '0', 10);
    const rejected = Number.parseInt(row?.rejected ?? '0', 10);

    return {
      windowDays: days,
      totalSubmissions: total,
      autoApprovalRate: total ? Number((autoApproved / total).toFixed(3)) : 0,
      manualReviews: Number.parseInt(row?.manual ?? '0', 10),
      rejectionRate: total ? Number((rejected / total).toFixed(3)) : 0,
      pointsReversals: Number.parseInt(row?.reversed ?? '0', 10),
      medianReviewHours: row?.median_review_hours
        ? Number(Number(row.median_review_hours).toFixed(1))
        : null,
      targets: { autoApprovalRate: 0.75, medianReviewHours: 12, rejectionRate: 0.02 },
    };
  }

  /**
   * Gini coefficient of footfall across destinations. 0 means every destination
   * gets equal visitors; 1 means one destination gets everything. The
   * redistribution goal is a declining trend, and this is the single number
   * that shows it — the tier share can improve while concentration inside the
   * lower tiers gets worse.
   */
  private gini(values: number[]): number {
    if (values.length < 2) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const total = sorted.reduce((sum, value) => sum + value, 0);
    if (total === 0) return 0;

    let weighted = 0;
    sorted.forEach((value, index) => {
      weighted += (index + 1) * value;
    });

    const n = sorted.length;
    return Number(((2 * weighted) / (n * total) - (n + 1) / n).toFixed(3));
  }

  private truncFor(granularity: Granularity): string {
    return { day: 'day', week: 'week', month: 'month' }[granularity];
  }
}
