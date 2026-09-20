import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { PointsReason, PointsRefType } from 'src/common/constants/points';
import { User } from './user.entity';

/**
 * Append-only ledger. Financial-grade rules, because the leaderboard is the
 * product's trust surface:
 *
 *  - rows are never updated or deleted; a mistake is corrected by a REVERSAL row
 *  - every row names its source (`ref_type` + `ref_id`) so any balance can be
 *    explained back to the action that caused it
 *  - `(user_id, reason_code, ref_type, ref_id)` is unique, which is what makes
 *    double-awarding impossible even if a worker runs the same job twice
 *  - `balance_after` is written inside the same transaction as the profile
 *    update, under a row lock on the user, so the sequence is always consistent
 */
@Entity('points_ledger')
@Index(['userId', 'createdAt'])
@Index(['refType', 'refId'])
export class PointsLedgerEntry {
  @Column({ type: 'uuid', primary: true, generated: 'uuid' })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** Signed. Negative only for reversals and moderator debits. */
  @Column({ type: 'int' })
  delta!: number;

  @Column({ name: 'reason_code', type: 'enum', enum: PointsReason })
  reasonCode!: PointsReason;

  @Column({ name: 'ref_type', type: 'enum', enum: PointsRefType })
  refType!: PointsRefType;

  @Column({ name: 'ref_id', type: 'uuid', nullable: true })
  refId!: string | null;

  @Column({ name: 'balance_after', type: 'int' })
  balanceAfter!: number;

  /**
   * Points that count toward leaderboards. Differs from `delta` when the daily
   * cap clips an award: the user keeps the points, the board does not see them.
   */
  @Column({ name: 'leaderboard_delta', type: 'int' })
  leaderboardDelta!: number;

  /** Denormalised for state/district leaderboards without joining check-ins. */
  @Column({ name: 'state_id', type: 'uuid', nullable: true })
  stateId!: string | null;

  @Column({ name: 'district_id', type: 'uuid', nullable: true })
  districtId!: string | null;

  /** Set on the original row when a reversal cancels it. */
  @Column({ name: 'reversed_by', type: 'uuid', nullable: true })
  reversedBy!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}
