import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ChallengeScope, ChallengeStatus, ChallengeType } from 'src/common/constants/enums';
import { User } from './user.entity';

/** Criteria shapes the challenge engine knows how to evaluate (PRD §5.2 F15). */
export type ChallengeCriteria =
  /** Visit `required` of the listed destinations. */
  | { kind: 'visit_set'; destination_ids: string[]; required: number }
  /** Visit `required` destinations at `min_tier` or rarer. */
  | { kind: 'tier_count'; min_tier: number; required: number }
  /** Complete every stop on a circuit. */
  | { kind: 'circuit'; circuit_id: string }
  /** Visit `required` destinations in a category. */
  | { kind: 'category_count'; category_slug: string; required: number };

@Entity('challenges')
@Index(['status', 'startsAt', 'endsAt'])
export class Challenge extends BaseEntity {
  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 240 })
  slug!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'enum', enum: ChallengeScope, default: ChallengeScope.STATE })
  scope!: ChallengeScope;

  @Column({ name: 'state_id', type: 'uuid', nullable: true })
  stateId!: string | null;

  @Column({ type: 'enum', enum: ChallengeType, default: ChallengeType.DISCOVERY })
  type!: ChallengeType;

  @Column({ type: 'jsonb' })
  criteria!: ChallengeCriteria;

  /** Applied to check-ins at participating destinations while the window is open. */
  @Column({ type: 'numeric', precision: 4, scale: 2, default: 1 })
  multiplier!: string;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt!: Date;

  @Column({ name: 'ends_at', type: 'timestamptz' })
  endsAt!: Date;

  /** One-off award on completion. PRD range is 200–1000. */
  @Column({ name: 'reward_points', type: 'int', default: 200 })
  rewardPoints!: number;

  @Column({ name: 'hero_media_id', type: 'uuid', nullable: true })
  heroMediaId!: string | null;

  @Column({ type: 'enum', enum: ChallengeStatus, default: ChallengeStatus.DRAFT })
  status!: ChallengeStatus;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator?: User | null;
}

/** Progress payload, shaped to match the criteria kind it belongs to. */
export interface ChallengeProgressState {
  /** Destination ids that already count. Deduplicated by the engine. */
  visited: string[];
  required: number;
  /** Convenience mirror of `visited.length`, so clients don't have to count. */
  completed: number;
}

@Entity('challenge_progress')
@Index(['userId', 'challengeId'], { unique: true })
export class ChallengeProgress {
  @Column({ type: 'uuid', primary: true, generated: 'uuid' })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'challenge_id', type: 'uuid' })
  challengeId!: string;

  @ManyToOne(() => Challenge, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'challenge_id' })
  challenge?: Challenge;

  @Column({ type: 'jsonb', default: () => `'{"visited":[],"required":0,"completed":0}'` })
  progress!: ChallengeProgressState;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'points_awarded', type: 'int', default: 0 })
  pointsAwarded!: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
