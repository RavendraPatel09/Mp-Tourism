import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity, GeoPolygon } from './base.entity';

@Entity('states')
export class State extends BaseEntity {
  @Column({ type: 'varchar', length: 80 })
  name!: string;

  /** ISO 3166-2:IN subdivision code without the `IN-` prefix, e.g. `MP`. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 8 })
  code!: string;

  @Column({ type: 'varchar', length: 8, default: 'state' })
  type!: 'state' | 'ut';

  @Column({ type: 'geometry', spatialFeatureType: 'MultiPolygon', srid: 4326, nullable: true })
  geometry!: GeoPolygon | null;

  @Column({ name: 'hero_media_id', type: 'uuid', nullable: true })
  heroMediaId!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /** MVP ships one pilot state; the rest exist for the picker but list nothing. */
  @Column({ name: 'is_live', type: 'boolean', default: false })
  isLive!: boolean;

  @OneToMany(() => District, (district) => district.state)
  districts?: District[];
}

@Entity('districts')
@Index(['stateId', 'name'], { unique: true })
export class District extends BaseEntity {
  @Column({ name: 'state_id', type: 'uuid' })
  stateId!: string;

  @ManyToOne(() => State, (state) => state.districts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'state_id' })
  state?: State;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ type: 'varchar', length: 100 })
  slug!: string;

  @Column({ type: 'geometry', spatialFeatureType: 'MultiPolygon', srid: 4326, nullable: true })
  geometry!: GeoPolygon | null;
}

@Entity('categories')
export class Category extends BaseEntity {
  @Column({ type: 'varchar', length: 60 })
  name!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 60 })
  slug!: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  icon!: string | null;

  @Column({ name: 'order_index', type: 'int', default: 0 })
  orderIndex!: number;
}
