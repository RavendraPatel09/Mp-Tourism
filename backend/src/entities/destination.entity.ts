import {
  Column,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { BaseEntity, GeoPoint, GeoPolygon } from './base.entity';
import { Category, District, State } from './geo.entity';
import {
  BudgetBand,
  CrowdLevel,
  DestinationStatus,
  Difficulty,
  Season,
} from 'src/common/constants/enums';
import { DestinationTier } from 'src/common/constants/points';

@Entity('destinations')
@Index(['stateId', 'status'])
@Index(['tier'])
export class Destination extends BaseEntity {
  @Column({ name: 'state_id', type: 'uuid' })
  stateId!: string;

  @ManyToOne(() => State, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'state_id' })
  state?: State;

  @Column({ name: 'district_id', type: 'uuid', nullable: true })
  districtId!: string | null;

  @ManyToOne(() => District, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'district_id' })
  district?: District | null;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 200 })
  slug!: string;

  /** Alternate spellings and regional-language names, for typo-tolerant search. */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  aliases!: string[];

  /** The "why go" paragraph. */
  @Column({ type: 'text' })
  description!: string;

  /** Longer historical / cultural context. */
  @Column({ type: 'text', nullable: true })
  story!: string | null;

  @Column({ type: 'geometry', spatialFeatureType: 'Point', srid: 4326 })
  location!: GeoPoint;

  /**
   * Optional drawn boundary. Most destinations only get a pin plus a radius —
   * the geofence check falls back to `geofence_radius_m` when this is null.
   */
  @Column({ type: 'geometry', spatialFeatureType: 'Polygon', srid: 4326, nullable: true })
  geofence!: GeoPolygon | null;

  @Column({ name: 'geofence_radius_m', type: 'int', default: 300 })
  geofenceRadiusM!: number;

  @Column({ type: 'smallint', default: DestinationTier.LESSER_KNOWN })
  tier!: DestinationTier;

  /** Set when the quarterly tier recompute last touched this row. */
  @Column({ name: 'tier_reviewed_at', type: 'timestamptz', nullable: true })
  tierReviewedAt!: Date | null;

  @Column({ type: 'enum', enum: DestinationStatus, default: DestinationStatus.DRAFT })
  status!: DestinationStatus;

  @Column({ name: 'best_season', type: 'enum', enum: Season, array: true, default: () => "'{}'" })
  bestSeason!: Season[];

  /** True for sites only worth visiting in the rains — drives the monsoon multiplier. */
  @Column({ name: 'is_monsoon_only', type: 'boolean', default: false })
  isMonsoonOnly!: boolean;

  @Column({ name: 'min_duration_min', type: 'int', default: 60 })
  minDurationMin!: number;

  @Column({ name: 'recommended_duration_min', type: 'int', default: 120 })
  recommendedDurationMin!: number;

  @Column({ type: 'enum', enum: Difficulty, default: Difficulty.EASY })
  difficulty!: Difficulty;

  @Column({ name: 'avg_budget', type: 'enum', enum: BudgetBand, default: BudgetBand.LOW })
  avgBudget!: BudgetBand;

  /**
   * `{ wheelchair, senior_friendly, child_friendly, accessible_parking, ... }`.
   * Flags rather than columns because the list grows with every state board.
   */
  @Column({ name: 'accessibility_flags', type: 'jsonb', default: () => "'{}'" })
  accessibilityFlags!: Record<string, boolean>;

  @Column({ name: 'crowd_level', type: 'enum', enum: CrowdLevel, default: CrowdLevel.LOW })
  crowdLevel!: CrowdLevel;

  @Column({ name: 'is_eco_sensitive', type: 'boolean', default: false })
  isEcoSensitive!: boolean;

  /** State admins can mute a stressed site without unpublishing it (PRD F21). */
  @Column({ name: 'is_promotion_suppressed', type: 'boolean', default: false })
  isPromotionSuppressed!: boolean;

  /** Documented hazards: monsoon crossings, wildlife zones, official advisories. */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  hazards!: string[];

  @Column({ name: 'hero_media_id', type: 'uuid', nullable: true })
  heroMediaId!: string | null;

  @Column({ name: 'annual_visitors', type: 'int', nullable: true })
  annualVisitors!: number | null;

  /** Denormalised aggregates, refreshed by scheduled jobs. */
  @Column({ name: 'check_in_count', type: 'int', default: 0 })
  checkInCount!: number;

  @Column({ name: 'review_count', type: 'int', default: 0 })
  reviewCount!: number;

  @Column({ name: 'rating_avg', type: 'numeric', precision: 3, scale: 2, nullable: true })
  ratingAvg!: string | null;

  /** Null until the first approved check-in; awards the Pioneer bonus exactly once. */
  @Column({ name: 'pioneer_user_id', type: 'uuid', nullable: true })
  pioneerUserId!: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @ManyToMany(() => Category, { cascade: false })
  @JoinTable({
    name: 'destination_categories',
    joinColumn: { name: 'destination_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'category_id', referencedColumnName: 'id' },
  })
  categories?: Category[];

  /*
   * `info` has no inverse relation here: `emitDecoratorMetadata` evaluates a
   * property's declared type eagerly, so pointing at a class defined further
   * down this file throws at import time. DestinationsService loads it through
   * its own repository.
   */

  @OneToMany(() => ThingToDo, (thing) => thing.destination)
  thingsToDo?: ThingToDo[];
}

@Entity('destination_info')
export class DestinationInfo {
  @Column({ name: 'destination_id', type: 'uuid', primary: true })
  destinationId!: string;

  @OneToOne(() => Destination, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'destination_id' })
  destination?: Destination;

  /** `{ mon: { open: '09:00', close: '17:00' }, ..., closed_days: ['tue'], notes }`. */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  timings!: Record<string, unknown>;

  /** `{ indian_adult: 25, foreign_adult: 300, child: 0, camera: 25, currency: 'INR' }`. */
  @Column({ name: 'entry_fees', type: 'jsonb', default: () => "'{}'" })
  entryFees!: Record<string, unknown>;

  /** Photography rules, dress code, drone policy — free text, shown as bullets. */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  rules!: string[];

  /** `{ washroom: true, food: false, atm: false, network: 'patchy', guide: true }`. */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  facilities!: Record<string, unknown>;

  @Column({ name: 'how_to_reach', type: 'text', nullable: true })
  howToReach!: string | null;

  @Column({ name: 'last_mile_notes', type: 'text', nullable: true })
  lastMileNotes!: string | null;

  @Column({ type: 'text', nullable: true })
  parking!: string | null;

  @Column({ name: 'best_time_of_day', type: 'varchar', length: 120, nullable: true })
  bestTimeOfDay!: string | null;

  @Column({ name: 'official_url', type: 'varchar', length: 500, nullable: true })
  officialUrl!: string | null;

  /** `{ police: '100', hospital: { name, phone, distance_km }, forest_office: ... }`. */
  @Column({ name: 'emergency_contacts', type: 'jsonb', default: () => "'{}'" })
  emergencyContacts!: Record<string, unknown>;

  @Column({ name: 'leave_no_trace_tips', type: 'text', array: true, default: () => "'{}'" })
  leaveNoTraceTips!: string[];
}

@Entity('things_to_do')
@Index(['destinationId', 'orderIndex'])
export class ThingToDo extends BaseEntity {
  @Column({ name: 'destination_id', type: 'uuid' })
  destinationId!: string;

  @ManyToOne(() => Destination, (destination) => destination.thingsToDo, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'destination_id' })
  destination?: Destination;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'duration_min', type: 'int', nullable: true })
  durationMin!: number | null;

  @Column({ name: 'order_index', type: 'int', default: 0 })
  orderIndex!: number;
}
