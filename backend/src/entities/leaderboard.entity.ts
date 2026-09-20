import { Column, Entity, Index } from 'typeorm';
import { LeaderboardPeriod, LeaderboardScope } from 'src/common/constants/enums';

/**
 * Materialised board, refreshed on a schedule. Live ranks are served from Redis
 * sorted sets; this table is the durable fallback and the source for historical
 * boards. Never computed live from `points_ledger` on the request path.
 */
@Entity('leaderboard_snapshots')
@Index(['scope', 'scopeId', 'period', 'periodKey', 'rank'])
@Index(['scope', 'scopeId', 'period', 'periodKey', 'userId'], { unique: true })
export class LeaderboardSnapshot {
  @Column({ type: 'uuid', primary: true, generated: 'uuid' })
  id!: string;

  @Column({ type: 'enum', enum: LeaderboardScope })
  scope!: LeaderboardScope;

  /** State or district id. Null for the national board. */
  @Column({ name: 'scope_id', type: 'uuid', nullable: true })
  scopeId!: string | null;

  @Column({ type: 'enum', enum: LeaderboardPeriod })
  period!: LeaderboardPeriod;

  /** `2026-09` for a monthly board, `all` for all-time. */
  @Column({ name: 'period_key', type: 'varchar', length: 16 })
  periodKey!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'int' })
  rank!: number;

  @Column({ type: 'int' })
  points!: number;

  @Column({ name: 'computed_at', type: 'timestamptz', default: () => 'now()' })
  computedAt!: Date;
}
