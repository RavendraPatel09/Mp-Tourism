/**
 * Domain types for YatraGo.
 *
 * Mirrors the entities in PRD §7 and the response shapes in PRD §8. This is the
 * single source of truth shared by the public site, the admin dashboard and the
 * mock API. When Member B publishes the OpenAPI spec, regenerate this file from
 * it — nothing else in the app should redeclare these shapes.
 */

/* ------------------------------------------------------------------ roles */

export type Role =
  | "guest"
  | "explorer"
  | "verified_explorer"
  | "local_guide"
  | "partner"
  | "moderator"
  | "state_admin"
  | "super_admin";

/* ----------------------------------------------------------- geography */

export interface StateSummary {
  id: string;
  name: string;
  code: string;
  type: "state" | "ut";
  /** Live in the MVP pilot, or listed but not yet curated. */
  status: "live" | "coming_soon";
  destinationCount: number;
  heroMedia?: string;
  tagline?: string;
  description?: string;
  center?: LatLng;
}

export interface District {
  id: string;
  stateId: string;
  stateCode: string;
  name: string;
  destinationCount: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/* ---------------------------------------------------------- categories */

export interface Category {
  id: string;
  name: string;
  slug: string;
  /** lucide-react icon name, resolved in the UI. */
  icon: string;
  description?: string;
}

/* -------------------------------------------------------- destinations */

/**
 * Tier is inverted against popularity — the lower the footfall, the higher the
 * points. See PRD Appendix A. Recomputed quarterly by the platform.
 */
export type Tier = 1 | 2 | 3 | 4;

export type Difficulty = "easy" | "moderate" | "challenging" | "strenuous";

export type Season =
  | "winter"
  | "summer"
  | "monsoon"
  | "post_monsoon"
  | "year_round";

export type CrowdLevel = "low" | "moderate" | "high" | "at_capacity";

export type DestinationStatus = "draft" | "in_review" | "published" | "suppressed";

export interface AccessibilityFlags {
  wheelchair: boolean;
  seniorFriendly: boolean;
  childFriendly: boolean;
  notes?: string;
}

export interface ThingToDo {
  id: string;
  title: string;
  description?: string;
  durationMin: number;
  orderIndex: number;
}

export interface ItineraryStop {
  id: string;
  day: number;
  orderIndex: number;
  startTime: string;
  activity: string;
  durationMin: number;
  travelNotes?: string;
}

export interface Itinerary {
  id: string;
  title: string;
  totalDurationMin: number;
  dayCount: number;
  stops: ItineraryStop[];
}

export interface EntryFee {
  label: string;
  amountInr: number;
  note?: string;
}

export interface Timing {
  label: string;
  value: string;
}

export interface DestinationInfo {
  timings: Timing[];
  entryFees: EntryFee[];
  bestTimeOfDay?: string;
  photographyRules?: string;
  dressCode?: string;
  guideAvailability?: string;
  facilities: {
    parking: boolean;
    washrooms: boolean;
    food: boolean;
    drinkingWater: boolean;
    networkCoverage: "none" | "patchy" | "good";
    nearestAtmKm?: number;
    nearestHospitalKm?: number;
  };
  howToReach: string;
  lastMileNotes?: string;
  officialUrl?: string;
  emergencyContacts: { label: string; number: string }[];
  /** Genuine safety flags — PRD §11 requires these to be surfaced, not buried. */
  hazards: string[];
}

export interface Media {
  id: string;
  url: string;
  thumbUrl?: string;
  caption?: string;
  source: "official" | "community";
  /** Licence/attribution is mandatory for every image — TEAM_PLAN content rule. */
  attribution: string;
  licence: string;
  /** Origin file page, so a credit can link back to the source. */
  sourceUrl?: string;
  width: number;
  height: number;
}

export interface DestinationSummary {
  id: string;
  slug: string;
  name: string;
  stateCode: string;
  stateName: string;
  district: string;
  shortDescription: string;
  tier: Tier;
  basePoints: number;
  categories: string[];
  location: LatLng;
  minDurationMin: number;
  recommendedDurationMin: number;
  difficulty: Difficulty;
  bestSeasons: Season[];
  avgBudgetInr: number;
  crowdLevel: CrowdLevel;
  isEcoSensitive: boolean;
  accessibility: AccessibilityFlags;
  rating: number;
  reviewCount: number;
  checkInCount: number;
  heroImage: Media;
  /** Present only when the query was a `near=` search. */
  distanceKm?: number;
}

export interface Destination extends DestinationSummary {
  story: string;
  whyGo: string;
  status: DestinationStatus;
  geofenceRadiusM: number;
  geofencePolygon?: LatLng[];
  gallery: Media[];
  thingsToDo: ThingToDo[];
  itinerary: Itinerary;
  info: DestinationInfo;
  /** Why this destination is worth the points it is worth. Shown to users. */
  pointsRationale: string;
  publishedAt?: string;
  updatedAt: string;
}

/* -------------------------------------------------------------- circuits */

export interface Circuit {
  id: string;
  slug: string;
  name: string;
  stateCode: string;
  description: string;
  dayCount: number;
  heroImage: Media;
  destinationSlugs: string[];
  totalPoints: number;
  totalDistanceKm: number;
}

/* --------------------------------------------------------------- reviews */

export interface Review {
  id: string;
  destinationSlug: string;
  username: string;
  displayName: string;
  avatarColor: string;
  rating: number;
  body: string;
  /** The structured "go before 9am" field — PRD F9. */
  tip?: string;
  createdAt: string;
  helpfulCount: number;
  /** Reviews are check-in gated (PRD F9), so this is always set on a live review. */
  verifiedCheckIn: boolean;
}

/* ---------------------------------------------------------- gamification */

export type LevelName =
  | "Explorer"
  | "Wanderer"
  | "Pathfinder"
  | "Trailblazer"
  | "Voyager"
  | "Legend";

export interface Badge {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  group: "geographic" | "thematic" | "behavioural" | "contribution";
  earnedAt?: string;
}

export interface UserProfile {
  username: string;
  displayName: string;
  avatarColor: string;
  homeState: string;
  level: number;
  levelName: LevelName;
  totalPoints: number;
  pointsToNextLevel: number;
  joinedAt: string;
  statesVisited: string[];
  stats: {
    checkIns: number;
    destinations: number;
    tier34CheckIns: number;
    photosAccepted: number;
    reviews: number;
    pioneerCount: number;
  };
  badges: Badge[];
  recentCheckIns: CheckInSummary[];
}

export interface CheckInSummary {
  id: string;
  destinationSlug: string;
  destinationName: string;
  stateCode: string;
  tier: Tier;
  pointsAwarded: number;
  status: CheckInStatus;
  capturedAt: string;
  photoUrl: string;
}

export type CheckInStatus = "pending" | "approved" | "rejected";

export interface LeaderboardEntry {
  rank: number;
  username: string;
  displayName: string;
  avatarColor: string;
  stateCode: string;
  level: number;
  levelName: LevelName;
  points: number;
  checkIns: number;
  /** Share of this explorer's check-ins at Tier 3+4 — the product's whole point. */
  tier34Share: number;
  isCurrentUser?: boolean;
}

export type ChallengeScope = "national" | "state";
export type ChallengeStatus = "upcoming" | "active" | "ended";

export interface Challenge {
  id: string;
  slug: string;
  title: string;
  description: string;
  scope: ChallengeScope;
  stateCode?: string;
  type: "circuit" | "discovery" | "seasonal" | "government";
  multiplier: number;
  rewardPoints: number;
  startsAt: string;
  endsAt: string;
  status: ChallengeStatus;
  heroImage: Media;
  destinationSlugs: string[];
  /** e.g. "Visit 5 of 7" — completion does not require every stop. */
  requiredCount: number;
  participantCount: number;
  completedCount: number;
}

/* -------------------------------------------------- moderation / admin */

export interface VerificationSignal {
  key:
    | "geofence"
    | "timestamp"
    | "mock_location"
    | "phash_duplicate"
    | "velocity"
    | "device_integrity"
    | "scene_match";
  label: string;
  status: "pass" | "fail" | "warn" | "skipped";
  detail: string;
}

export interface ModerationItem {
  id: string;
  checkInId: string;
  destinationSlug: string;
  destinationName: string;
  stateCode: string;
  tier: Tier;
  username: string;
  userTrustScore: number;
  userCheckInCount: number;
  userRejectionCount: number;
  submittedAt: string;
  capturedAt: string;
  photoUrl: string;
  referencePhotos: string[];
  deviceLocation: LatLng;
  destinationLocation: LatLng;
  accuracyM: number;
  geofenceRadiusM: number;
  distanceFromCentreM: number;
  pointsAtStake: number;
  signals: VerificationSignal[];
  /** Hours remaining against the <12h manual-review SLA (PRD §9). */
  slaHoursRemaining: number;
  status: "pending" | "approved" | "rejected";
}

export interface AuditLogEntry {
  id: string;
  actor: string;
  actorRole: Role;
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  ip: string;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  role: Role;
  stateCode: string;
  trustScore: number;
  totalPoints: number;
  checkIns: number;
  rejectedCheckIns: number;
  isPhoneVerified: boolean;
  status: "active" | "warned" | "suspended" | "banned";
  joinedAt: string;
}

/* ------------------------------------------------------------ analytics */

export interface FootfallPoint {
  date: string;
  checkIns: number;
  tier12: number;
  tier34: number;
}

export interface DistrictFootfall {
  district: string;
  checkIns: number;
  tier34Share: number;
  destinations: number;
}

export interface CategoryFootfall {
  category: string;
  checkIns: number;
}

export interface OriginFlow {
  originState: string;
  visitors: number;
}

export interface SeasonalityPoint {
  month: string;
  checkIns: number;
}

export interface CampaignLift {
  destination: string;
  before: number;
  after: number;
  liftPct: number;
}

export interface AnalyticsSummary {
  totalCheckIns: number;
  tier34Share: number;
  tier34Target: number;
  uniqueDestinationsVisited: number;
  publishedDestinations: number;
  activeExplorers: number;
  pendingModeration: number;
  avgReviewHours: number;
  footfall: FootfallPoint[];
  byDistrict: DistrictFootfall[];
  byCategory: CategoryFootfall[];
  originFlows: OriginFlow[];
  seasonality: SeasonalityPoint[];
  campaignLift: CampaignLift[];
}

/* ------------------------------------------------------------ transport */

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiError {
  error: { code: string; message: string };
}

/** Query shape for GET /v1/destinations — mirrors PRD §8 exactly. */
export interface DestinationQuery {
  state?: string;
  district?: string;
  categories?: string[];
  duration?: "2h" | "half_day" | "full_day" | "multi_day";
  difficulty?: Difficulty[];
  tier?: Tier[];
  season?: Season;
  accessible?: boolean;
  near?: LatLng;
  radius?: number;
  q?: string;
  sort?: "recommended" | "points" | "rating" | "distance" | "duration";
  page?: number;
  pageSize?: number;
}
