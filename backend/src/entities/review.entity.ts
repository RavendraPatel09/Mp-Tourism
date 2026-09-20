import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ReviewStatus } from 'src/common/constants/enums';
import { Destination } from './destination.entity';
import { CheckIn } from './check-in.entity';
import { User } from './user.entity';

/**
 * Check-in gated (PRD §5.1 F9): `check_in_id` is NOT NULL and must reference an
 * approved check-in by the same user at the same destination. One review per
 * user per destination, enforced by a unique index.
 */
@Entity('reviews')
@Index(['destinationId', 'status'])
@Index(['userId', 'destinationId'], { unique: true })
export class Review extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'destination_id', type: 'uuid' })
  destinationId!: string;

  @ManyToOne(() => Destination, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'destination_id' })
  destination?: Destination;

  @Column({ name: 'check_in_id', type: 'uuid' })
  checkInId!: string;

  @ManyToOne(() => CheckIn, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'check_in_id' })
  checkIn?: CheckIn;

  @Column({ type: 'smallint' })
  rating!: number;

  @Column({ type: 'text', nullable: true })
  body!: string | null;

  /** The structured one-liner: "Go before 9 am to avoid tour buses". */
  @Column({ type: 'varchar', length: 300, nullable: true })
  tip!: string | null;

  @Column({ name: 'media_id', type: 'uuid', nullable: true })
  mediaId!: string | null;

  @Column({ type: 'enum', enum: ReviewStatus, default: ReviewStatus.PUBLISHED })
  status!: ReviewStatus;

  @Column({ name: 'helpful_count', type: 'int', default: 0 })
  helpfulCount!: number;

  /** True once the +15 detailed-review award has been paid, so edits can't re-earn it. */
  @Column({ name: 'points_awarded', type: 'int', default: 0 })
  pointsAwarded!: number;
}
