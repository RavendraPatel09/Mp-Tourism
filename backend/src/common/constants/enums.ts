export enum DestinationStatus {
  DRAFT = 'draft',
  IN_REVIEW = 'in_review',
  PUBLISHED = 'published',
  UNPUBLISHED = 'unpublished',
}

export enum Difficulty {
  EASY = 'easy',
  MODERATE = 'moderate',
  HARD = 'hard',
  STRENUOUS = 'strenuous',
}

export enum Season {
  WINTER = 'winter',
  SUMMER = 'summer',
  MONSOON = 'monsoon',
  POST_MONSOON = 'post_monsoon',
  ALL_YEAR = 'all_year',
}

export enum CrowdLevel {
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  AT_CAPACITY = 'at_capacity',
}

export enum BudgetBand {
  FREE = 'free',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum CheckInStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum RejectionReason {
  OUTSIDE_GEOFENCE = 'outside_geofence',
  STALE_CAPTURE = 'stale_capture',
  MOCK_LOCATION = 'mock_location',
  DUPLICATE_PHOTO = 'duplicate_photo',
  IMPOSSIBLE_VELOCITY = 'impossible_velocity',
  COOLDOWN_ACTIVE = 'cooldown_active',
  DAILY_CAP_REACHED = 'daily_cap_reached',
  MEDIA_MISSING = 'media_missing',
  NOT_IN_APP_CAMERA = 'not_in_app_camera',
  POLICY_VIOLATION = 'policy_violation',
  MODERATOR_REJECTED = 'moderator_rejected',
}

export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
}

export enum MediaSource {
  OFFICIAL = 'official',
  COMMUNITY = 'community',
  CHECK_IN = 'check_in',
}

export enum MediaOwnerType {
  DESTINATION = 'destination',
  CHECK_IN = 'check_in',
  REVIEW = 'review',
  STATE = 'state',
  USER = 'user',
  CIRCUIT = 'circuit',
  CHALLENGE = 'challenge',
}

export enum MediaStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum ReviewStatus {
  PUBLISHED = 'published',
  HIDDEN = 'hidden',
  REMOVED = 'removed',
}

export enum ChallengeScope {
  NATIONAL = 'national',
  STATE = 'state',
}

export enum ChallengeType {
  CIRCUIT = 'circuit',
  DISCOVERY = 'discovery',
  SEASONAL = 'seasonal',
  CAMPAIGN = 'campaign',
}

export enum ChallengeStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ENDED = 'ended',
  ARCHIVED = 'archived',
}

export enum LeaderboardScope {
  NATIONAL = 'national',
  STATE = 'state',
  DISTRICT = 'district',
}

export enum LeaderboardPeriod {
  MONTH = 'month',
  ALL = 'all',
}

export enum ReportTargetType {
  REVIEW = 'review',
  MEDIA = 'media',
  PROFILE = 'profile',
  CHECK_IN = 'check_in',
}

export enum ReportStatus {
  OPEN = 'open',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

export enum ModerationAction {
  APPROVE = 'approve',
  REJECT = 'reject',
  HIDE = 'hide',
  WARN = 'warn',
  REVERSE_POINTS = 'reverse_points',
  SUSPEND_LEADERBOARD = 'suspend_leaderboard',
  BAN = 'ban',
  DISMISS_REPORT = 'dismiss_report',
}

export enum EnforcementAction {
  WARN = 'warn',
  REVERSE_POINTS = 'reverse_points',
  SUSPEND_LEADERBOARD = 'suspend_leaderboard',
  BAN = 'ban',
  REINSTATE = 'reinstate',
}
