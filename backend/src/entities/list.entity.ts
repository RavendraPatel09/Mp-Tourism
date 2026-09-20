import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Destination } from './destination.entity';

/**
 * MVP ships a single flat "Want to visit" list per user (TEAM_PLAN cuts custom
 * lists to Phase 2). The table already models many lists per user so that
 * turning the feature on later is a UI change, not a migration.
 */
@Entity('lists')
@Index(['userId', 'isDefault'])
export class SavedList extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 80, default: 'Want to visit' })
  name!: string;

  @Column({ name: 'is_default', type: 'boolean', default: true })
  isDefault!: boolean;
}

@Entity('saved_places')
@Index(['listId', 'destinationId'], { unique: true })
export class SavedPlace {
  @Column({ name: 'list_id', type: 'uuid', primary: true })
  listId!: string;

  @Column({ name: 'destination_id', type: 'uuid', primary: true })
  destinationId!: string;

  @ManyToOne(() => SavedList, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'list_id' })
  list?: SavedList;

  @ManyToOne(() => Destination, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'destination_id' })
  destination?: Destination;

  /** Denormalised so "is this saved?" needs no join back through lists. */
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'added_at', type: 'timestamptz', default: () => 'now()' })
  addedAt!: Date;
}
