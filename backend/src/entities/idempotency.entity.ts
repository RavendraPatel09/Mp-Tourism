import { Column, Entity, Index } from 'typeorm';

/**
 * Backs the `Idempotency-Key` header on POST /check-ins and POST /rewards/:id/redeem
 * (PRD §8 conventions).
 *
 * The flow is: INSERT the key first and let the unique index decide the race. A
 * duplicate insert means someone is already handling this request — either we
 * return the stored response, or we tell the client to retry if the first
 * attempt is still in flight. There is deliberately no read-then-write, because
 * that is exactly the window that double-awards points.
 */
@Entity('idempotency_records')
@Index(['userId', 'key'], { unique: true })
@Index(['createdAt'])
export class IdempotencyRecord {
  @Column({ type: 'uuid', primary: true, generated: 'uuid' })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 128 })
  key!: string;

  /** Endpoint the key was used against; reusing a key elsewhere is a 422. */
  @Column({ type: 'varchar', length: 120 })
  endpoint!: string;

  /** SHA-256 of the request body, so a reused key with new content is caught. */
  @Column({ name: 'request_hash', type: 'varchar', length: 64 })
  requestHash!: string;

  @Column({ name: 'response_status', type: 'int', nullable: true })
  responseStatus!: number | null;

  @Column({ name: 'response_body', type: 'jsonb', nullable: true })
  responseBody!: Record<string, unknown> | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}
