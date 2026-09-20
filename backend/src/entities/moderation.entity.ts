import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import {
  ModerationAction as ModerationActionKind,
  ReportStatus,
  ReportTargetType,
} from 'src/common/constants/enums';

@Entity('reports')
@Index(['status', 'createdAt'])
@Index(['targetType', 'targetId'])
export class Report extends BaseEntity {
  @Column({ name: 'reporter_id', type: 'uuid' })
  reporterId!: string;

  @Column({ name: 'target_type', type: 'enum', enum: ReportTargetType })
  targetType!: ReportTargetType;

  @Column({ name: 'target_id', type: 'uuid' })
  targetId!: string;

  @Column({ type: 'varchar', length: 64 })
  reason!: string;

  @Column({ type: 'text', nullable: true })
  detail!: string | null;

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.OPEN })
  status!: ReportStatus;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy!: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @Column({ name: 'resolution_note', type: 'text', nullable: true })
  resolutionNote!: string | null;
}

/** Immutable record of what a moderator did and why. Feeds the appeal process. */
@Entity('moderation_actions')
@Index(['targetType', 'targetId'])
@Index(['moderatorId', 'createdAt'])
export class ModerationActionRecord {
  @Column({ type: 'uuid', primary: true, generated: 'uuid' })
  id!: string;

  @Column({ name: 'moderator_id', type: 'uuid' })
  moderatorId!: string;

  @Column({ name: 'target_type', type: 'varchar', length: 32 })
  targetType!: string;

  @Column({ name: 'target_id', type: 'uuid' })
  targetId!: string;

  @Column({ type: 'enum', enum: ModerationActionKind })
  action!: ModerationActionKind;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  /** Set when a user appealed and the decision was overturned. */
  @Column({ name: 'overturned_at', type: 'timestamptz', nullable: true })
  overturnedAt!: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}
