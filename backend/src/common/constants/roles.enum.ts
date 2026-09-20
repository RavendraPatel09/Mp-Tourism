/** PRD §4.2. Ordered loosely by privilege, but checks are explicit, not ordinal. */
export enum UserRole {
  EXPLORER = 'explorer',
  VERIFIED_EXPLORER = 'verified_explorer',
  LOCAL_GUIDE = 'local_guide',
  PARTNER = 'partner',
  MODERATOR = 'moderator',
  STATE_ADMIN = 'state_admin',
  SUPER_ADMIN = 'super_admin',
}

/** Roles that may reach anything under `/v1/admin`. */
export const ADMIN_ROLES: UserRole[] = [
  UserRole.MODERATOR,
  UserRole.STATE_ADMIN,
  UserRole.SUPER_ADMIN,
];

/** Roles whose data access is scoped to `users.managed_state_id`. */
export const STATE_SCOPED_ROLES: UserRole[] = [UserRole.STATE_ADMIN];

export enum UserStatus {
  ACTIVE = 'active',
  WARNED = 'warned',
  LEADERBOARD_SUSPENDED = 'leaderboard_suspended',
  BANNED = 'banned',
  DELETED = 'deleted',
}
