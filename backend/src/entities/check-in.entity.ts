import { Column, Entity, Index, JoinColumn, ManyToOne, OneToOne } from 'typeorm';
import { BaseEntity, GeoPoint } from './base.entity';
import { CheckInStatus, RejectionReason } from 'src/common/constants/enums';
import { Destination } from './destination.entity';
import { User } from './user.entity';
import { Media } from './media.entity';

/**
 * The hinge entity. It gates reviews, feeds the points ledger, drives challenge
 * progress, and is the atomic unit of every footfall query.
 *
 * Integrity rules that live in the schema, not in code:
 *  - one non-rejected check-in per (user, destination, local_day)
 *  - `idempotency_key` unique per user, so a retried submit returns the original
 */
@Entity('check_ins')
@Index(['userId', 'status'])
@Index(['destinationId', 'status'])
@Index(['submittedAt'])
export class CheckIn extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'destination_id', type: 'uuid' })
  destinationId!: string;

  @ManyToOne(() => Destination, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'destination_id' })
  destination?: Destination;

  /** Client-reported capture time. Never trusted on its own — see `submitted_at`. */
  @Column({ name: 'captured_at', type: 'timestamptz' })
  capturedAt!: Date;

  /** Server time at receipt. Authoritative for the time-window check. */
  @Column({ name: 'submitted_at', type: 'timestamptz', default: () => 'now()' })
  submittedAt!: Date;

  /**
   * `captured_at` in IST, stored as a plain date. Backs the one-per-day unique
   * index; IST rather than UTC so a 2 a.m. check-in doesn't count as yesterday.
   */
  @Column({ name: 'local_day', type: 'date' })
  localDay!: string;

  /**
   * Raw fix, used for verification only. PRD §11 keeps precise location out of
   * anything public; the API never returns these fields to another user.
   */
  @Column({ name: 'device_point', type: 'geometry', spatialFeatureType: 'Point', srid: 4326 })
  devicePoint!: GeoPoint;

  @Column({ name: 'accuracy_m', type: 'numeric', precision: 8, scale: 2, nullable: true })
  accuracyM!: string | null;

  @Column({ name: 'media_id', type: 'uuid', nullable: true })
  mediaId!: string | null;

  @ManyToOne(() => Media, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'media_id' })
  media?: Media | null;

  @Column({ type: 'enum', enum: CheckInStatus, default: CheckInStatus.PENDING })
  status!: CheckInStatus;

  /** 0–100 confidence from the automated pipeline. Null until the job runs. */
  @Column({ name: 'verification_score', type: 'int', nullable: true })
  verificationScore!: number | null;

  /** Mirrors the ledger. Kept for cheap history queries; the ledger is truth. */
  @Column({ name: 'points_awarded', type: 'int', default: 0 })
  pointsAwarded!: number;

  @Column({
    name: 'rejection_reason',
    type: 'enum',
    enum: RejectionReason,
    nullable: true,
  })
  rejectionReason!: RejectionReason | null;

  @Column({ name: 'rejection_note', type: 'text', nullable: true })
  rejectionNote!: string | null;

  /** True when the pipeline sent this to a human rather than deciding itself. */
  @Column({ name: 'needs_review', type: 'boolean', default: false })
  needsReview!: boolean;

  /** Set when the row was pulled in as a random audit of an auto-approval. */
  @Column({ name: 'is_audit_sample', type: 'boolean', default: false })
  isAuditSample!: boolean;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy!: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 128 })
  idempotencyKey!: string;

  @Column({ name: 'device_fingerprint', type: 'varchar', length: 128, nullable: true })
  deviceFingerprint!: string | null;

  /** Multiplier actually applied, recorded so an award can be explained later. */
  @Column({ name: 'applied_multiplier', type: 'numeric', precision: 4, scale: 2, default: 1 })
  appliedMultiplier!: string;

  /*
   * No inverse `signals` relation: `emitDecoratorMetadata` would evaluate
   * VerificationSignal eagerly, and it is declared below. The verification
   * service and the moderation queue both read it through its own repository.
   */
}

/** One row per check-in holding every automated signal, for moderator display. */
@Entity('verification_signals')
export class VerificationSignal {
  @Column({ name: 'check_in_id', type: 'uuid', primary: true })
  checkInId!: string;

  @OneToOne(() => CheckIn, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'check_in_id' })
  checkIn?: CheckIn;

  @Column({ name: 'geo_pass', type: 'boolean', nullable: true })
  geoPass!: boolean | null;

  /** Metres from the fence edge. Negative means comfortably inside. */
  @Column({ name: 'geo_distance_m', type: 'numeric', precision: 10, scale: 2, nullable: true })
  geoDistanceM!: string | null;

  @Column({ name: 'time_pass', type: 'boolean', nullable: true })
  timePass!: boolean | null;

  @Column({ name: 'capture_lag_seconds', type: 'int', nullable: true })
  captureLagSeconds!: number | null;

  @Column({ name: 'mock_location', type: 'boolean', nullable: true })
  mockLocation!: boolean | null;

  @Column({ name: 'is_rooted', type: 'boolean', nullable: true })
  isRooted!: boolean | null;

  @Column({ name: 'is_emulator', type: 'boolean', nullable: true })
  isEmulator!: boolean | null;

  @Column({ name: 'device_fingerprint', type: 'varchar', length: 128, nullable: true })
  deviceFingerprint!: string | null;

  @Column({ name: 'phash_match_media_id', type: 'uuid', nullable: true })
  phashMatchMediaId!: string | null;

  @Column({ name: 'phash_distance', type: 'int', nullable: true })
  phashDistance!: number | null;

  /** Phase 2 (ML scene match). Always null at MVP; the column exists so the
   *  moderation console and its queries don't change when the model ships. */
  @Column({ name: 'scene_match_score', type: 'numeric', precision: 5, scale: 4, nullable: true })
  sceneMatchScore!: string | null;

  @Column({ name: 'velocity_kmh', type: 'numeric', precision: 10, scale: 2, nullable: true })
  velocityKmh!: string | null;

  @Column({ name: 'previous_check_in_id', type: 'uuid', nullable: true })
  previousCheckInId!: string | null;

  @Column({ name: 'trust_score_at_submit', type: 'int', nullable: true })
  trustScoreAtSubmit!: number | null;

  /** Everything else the client attested to, verbatim, for forensics. */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  raw!: Record<string, unknown>;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}
