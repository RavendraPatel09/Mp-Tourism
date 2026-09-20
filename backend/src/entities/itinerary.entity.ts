import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Destination } from './destination.entity';
import { DestinationStatus } from 'src/common/constants/enums';

/** Editorially built multi-day route. Also acts as a challenge container (PRD F4). */
@Entity('circuits')
export class Circuit extends BaseEntity {
  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 200 })
  slug!: string;

  @Column({ name: 'state_id', type: 'uuid', nullable: true })
  stateId!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'day_count', type: 'int', default: 1 })
  dayCount!: number;

  @Column({ name: 'hero_media_id', type: 'uuid', nullable: true })
  heroMediaId!: string | null;

  @Column({ type: 'enum', enum: DestinationStatus, default: DestinationStatus.DRAFT })
  status!: DestinationStatus;

  @OneToMany(() => CircuitDestination, (item) => item.circuit)
  destinations?: CircuitDestination[];
}

@Entity('circuit_destinations')
@Index(['circuitId', 'orderIndex'])
export class CircuitDestination {
  @Column({ name: 'circuit_id', type: 'uuid', primary: true })
  circuitId!: string;

  @Column({ name: 'destination_id', type: 'uuid', primary: true })
  destinationId!: string;

  @ManyToOne(() => Circuit, (circuit) => circuit.destinations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'circuit_id' })
  circuit?: Circuit;

  @ManyToOne(() => Destination, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'destination_id' })
  destination?: Destination;

  @Column({ name: 'order_index', type: 'int', default: 0 })
  orderIndex!: number;
}

/**
 * Attached to either a destination (the hour-by-hour plan for the site and its
 * immediate cluster) or a circuit (the multi-day route). Exactly one of the two
 * foreign keys is set — enforced by a check constraint in the migration.
 */
@Entity('itineraries')
export class Itinerary extends BaseEntity {
  @Column({ name: 'destination_id', type: 'uuid', nullable: true })
  destinationId!: string | null;

  @ManyToOne(() => Destination, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'destination_id' })
  destination?: Destination | null;

  @Column({ name: 'circuit_id', type: 'uuid', nullable: true })
  circuitId!: string | null;

  @ManyToOne(() => Circuit, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'circuit_id' })
  circuit?: Circuit | null;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ name: 'total_duration_min', type: 'int', nullable: true })
  totalDurationMin!: number | null;

  @Column({ name: 'day_count', type: 'int', default: 1 })
  dayCount!: number;

  @OneToMany(() => ItineraryStop, (stop) => stop.itinerary)
  stops?: ItineraryStop[];
}

@Entity('itinerary_stops')
@Index(['itineraryId', 'day', 'orderIndex'])
export class ItineraryStop extends BaseEntity {
  @Column({ name: 'itinerary_id', type: 'uuid' })
  itineraryId!: string;

  @ManyToOne(() => Itinerary, (itinerary) => itinerary.stops, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'itinerary_id' })
  itinerary?: Itinerary;

  @Column({ type: 'int', default: 1 })
  day!: number;

  @Column({ name: 'order_index', type: 'int', default: 0 })
  orderIndex!: number;

  @Column({ name: 'destination_id', type: 'uuid', nullable: true })
  destinationId!: string | null;

  @Column({ type: 'varchar', length: 300 })
  activity!: string;

  /** Wall-clock suggestion like `06:30`, not a timestamp — the plan is date-free. */
  @Column({ name: 'start_time', type: 'time', nullable: true })
  startTime!: string | null;

  @Column({ name: 'duration_min', type: 'int', nullable: true })
  durationMin!: number | null;

  @Column({ name: 'travel_notes', type: 'text', nullable: true })
  travelNotes!: string | null;
}
