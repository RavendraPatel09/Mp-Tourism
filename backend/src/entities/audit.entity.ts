import { Column, Entity, Index } from 'typeorm';

/**
 * Append-only. Non-negotiable for government deployments (PRD §5.4 F27), so the
 * migration revokes UPDATE and DELETE on this table from the application role —
 * the API physically cannot rewrite its own history.
 */
@Entity('audit_logs')
@Index(['actorId', 'createdAt'])
@Index(['entity', 'entityId'])
@Index(['createdAt'])
export class AuditLog {
  @Column({ type: 'uuid', primary: true, generated: 'uuid' })
  id!: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId!: string | null;

  @Column({ name: 'actor_role', type: 'varchar', length: 32, nullable: true })
  actorRole!: string | null;

  /** `POST /v1/admin/destinations`-style route id, not a free-text sentence. */
  @Column({ type: 'varchar', length: 120 })
  action!: string;

  @Column({ type: 'varchar', length: 64 })
  entity!: string;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  before!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  after!: Record<string, unknown> | null;

  @Column({ type: 'inet', nullable: true })
  ip!: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  userAgent!: string | null;

  @Column({ name: 'request_id', type: 'varchar', length: 64, nullable: true })
  requestId!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}
