import { Column, Entity, Index } from 'typeorm';

/**
 * Raw event sink. PostHog is the product analytics system of record (PRD §13);
 * this table exists so server-side events survive a PostHog outage and so the
 * admin footfall queries can join events against destinations in one database.
 *
 * This is the fastest-growing table in the schema. It is intentionally not
 * partitioned at MVP volume; revisit once it passes ~50M rows.
 */
@Entity('analytics_events')
@Index(['event', 'createdAt'])
@Index(['userId', 'createdAt'])
export class AnalyticsEvent {
  @Column({ type: 'uuid', primary: true, generated: 'uuid' })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar', length: 80 })
  event!: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  properties!: Record<string, unknown>;

  @Column({ name: 'session_id', type: 'varchar', length: 64, nullable: true })
  sessionId!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}
