import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

/** Criteria shapes the badge engine knows how to evaluate (PRD §5.2 F13). */
export type BadgeCriteria =
  /** N approved check-ins anywhere. */
  | { kind: 'check_in_count'; count: number }
  /** N distinct destinations inside one state (`state_code` omitted = any state). */
  | { kind: 'state_destinations'; count: number; state_code?: string }
  /** A share of a state's published destinations, e.g. 0.8 for Completionist. */
  | { kind: 'state_completion'; ratio: number; state_code?: string }
  /** A check-in in every live state and UT. */
  | { kind: 'all_states' }
  /** N distinct destinations in a category. */
  | { kind: 'category_count'; category_slug: string; count: number }
  /** N distinct destinations at a given tier or rarer. */
  | { kind: 'tier_count'; min_tier: number; count: number }
  /** First-ever approved check-in at any destination. */
  | { kind: 'pioneer' }
  /** N check-ins captured within an hour range, IST. */
  | { kind: 'time_of_day'; from_hour: number; to_hour: number; count: number }
  /** N check-ins during the monsoon season. */
  | { kind: 'season_count'; season: string; count: number }
  /** N accepted community photos. */
  | { kind: 'accepted_media'; count: number };

@Entity('badges')
export class Badge extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  icon!: string | null;

  @Column({ type: 'jsonb' })
  criteria!: BadgeCriteria;

  /** bronze | silver | gold — display weight on the badge wall, not difficulty. */
  @Column({ type: 'varchar', length: 16, default: 'bronze' })
  tier!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}

@Entity('user_badges')
@Index(['userId', 'badgeId'], { unique: true })
export class UserBadge {
  @Column({ type: 'uuid', primary: true, generated: 'uuid' })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'badge_id', type: 'uuid' })
  badgeId!: string;

  @ManyToOne(() => Badge, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'badge_id' })
  badge?: Badge;

  /** The check-in (or media) that tipped the criteria over. */
  @Column({ name: 'ref_id', type: 'uuid', nullable: true })
  refId!: string | null;

  @Column({ name: 'earned_at', type: 'timestamptz', default: () => 'now()' })
  earnedAt!: Date;
}
