import { AnalyticsEvent } from './analytics.entity';
import { AuditLog } from './audit.entity';
import { Badge, UserBadge } from './badge.entity';
import { Challenge, ChallengeProgress } from './challenge.entity';
import { CheckIn, VerificationSignal } from './check-in.entity';
import { Destination, DestinationInfo, ThingToDo } from './destination.entity';
import { Category, District, State } from './geo.entity';
import { IdempotencyRecord } from './idempotency.entity';
import { Circuit, CircuitDestination, Itinerary, ItineraryStop } from './itinerary.entity';
import { LeaderboardSnapshot } from './leaderboard.entity';
import { SavedList, SavedPlace } from './list.entity';
import { Media } from './media.entity';
import { ModerationActionRecord, Report } from './moderation.entity';
import { PointsLedgerEntry } from './points.entity';
import { Review } from './review.entity';
import { Device, RefreshToken, User, UserProfile } from './user.entity';

export * from './analytics.entity';
export * from './audit.entity';
export * from './badge.entity';
export * from './base.entity';
export * from './challenge.entity';
export * from './check-in.entity';
export * from './destination.entity';
export * from './geo.entity';
export * from './idempotency.entity';
export * from './itinerary.entity';
export * from './leaderboard.entity';
export * from './list.entity';
export * from './media.entity';
export * from './moderation.entity';
export * from './points.entity';
export * from './review.entity';
export * from './user.entity';

/** Registered with TypeORM in one place so a new entity is never silently absent. */
export const ALL_ENTITIES = [
  AnalyticsEvent,
  AuditLog,
  Badge,
  Category,
  Challenge,
  ChallengeProgress,
  CheckIn,
  Circuit,
  CircuitDestination,
  Destination,
  DestinationInfo,
  Device,
  District,
  IdempotencyRecord,
  Itinerary,
  ItineraryStop,
  LeaderboardSnapshot,
  Media,
  ModerationActionRecord,
  PointsLedgerEntry,
  RefreshToken,
  Report,
  Review,
  SavedList,
  SavedPlace,
  State,
  ThingToDo,
  User,
  UserBadge,
  UserProfile,
  VerificationSignal,
];
