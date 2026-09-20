import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  UpdateDateColumn,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserRole, UserStatus } from 'src/common/constants/roles.enum';
import { State } from './geo.entity';

@Entity('users')
export class User extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20, nullable: true })
  phone!: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true, select: false })
  passwordHash!: string | null;

  @Column({ name: 'oauth_provider', type: 'varchar', length: 32, nullable: true })
  oauthProvider!: string | null;

  @Column({ name: 'oauth_subject', type: 'varchar', length: 255, nullable: true })
  oauthSubject!: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.EXPLORER })
  role!: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status!: UserStatus;

  /**
   * State admins are scoped to one state. Null for every other role; the state
   * scope guard treats null on a STATE_ADMIN as "no access" rather than "all".
   */
  @Column({ name: 'managed_state_id', type: 'uuid', nullable: true })
  managedStateId!: string | null;

  @ManyToOne(() => State, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'managed_state_id' })
  managedState?: State | null;

  /** Under-18 accounts: restricted profile, no public leaderboard (PRD §11). */
  @Column({ name: 'is_minor', type: 'boolean', default: false })
  isMinor!: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  /*
   * No inverse `profile` relation here on purpose. `emitDecoratorMetadata`
   * evaluates the property's type eagerly, and a reference to a class declared
   * further down this file throws at import time. Load the profile through its
   * own repository — which every caller here already does.
   */
}

@Entity('user_profiles')
export class UserProfile {
  @Column({ name: 'user_id', type: 'uuid', primary: true })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32 })
  username!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 80, nullable: true })
  displayName!: string | null;

  @Column({ name: 'avatar_media_id', type: 'uuid', nullable: true })
  avatarMediaId!: string | null;

  @Column({ type: 'text', nullable: true })
  bio!: string | null;

  @Column({ name: 'home_state_id', type: 'uuid', nullable: true })
  homeStateId!: string | null;

  @Column({ type: 'int', default: 1 })
  level!: number;

  /**
   * Denormalised running balance. The ledger is authoritative; this column is a
   * cache kept in the same transaction as the ledger insert so it can never
   * drift without a bug in one place only.
   */
  @Column({ name: 'total_points', type: 'int', default: 0 })
  totalPoints!: number;

  /** 0–100. Drives auto-approval routing in the verification pipeline. */
  @Column({ name: 'trust_score', type: 'int', default: 40 })
  trustScore!: number;

  @Column({ name: 'is_phone_verified', type: 'boolean', default: false })
  isPhoneVerified!: boolean;

  /** PRD §11 — "hide my profile from leaderboards" toggle. */
  @Column({ name: 'hide_from_leaderboards', type: 'boolean', default: false })
  hideFromLeaderboards!: boolean;

  @Column({ name: 'push_token', type: 'varchar', length: 255, nullable: true })
  pushToken!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity('refresh_tokens')
@Index(['userId', 'revokedAt'])
export class RefreshToken extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** SHA-256 of the token. The raw token never touches the database. */
  @Index({ unique: true })
  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash!: string;

  /**
   * Rotation family. On refresh we revoke the presented token and issue a child
   * in the same family; replay of a revoked token kills the whole family.
   */
  @Column({ name: 'family_id', type: 'uuid' })
  familyId!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'revoked_reason', type: 'varchar', length: 64, nullable: true })
  revokedReason!: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  userAgent!: string | null;

  @Column({ type: 'inet', nullable: true })
  ip!: string | null;
}

/** PRD §5.3 F19 — device fingerprinting with device-to-account limits. */
@Entity('devices')
@Index(['fingerprint'])
export class Device extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 128 })
  fingerprint!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  platform!: string | null;

  @Column({ name: 'os_version', type: 'varchar', length: 32, nullable: true })
  osVersion!: string | null;

  @Column({ name: 'is_rooted', type: 'boolean', default: false })
  isRooted!: boolean;

  @Column({ name: 'is_emulator', type: 'boolean', default: false })
  isEmulator!: boolean;

  @Column({ name: 'last_seen_at', type: 'timestamptz', default: () => 'now()' })
  lastSeenAt!: Date;
}
