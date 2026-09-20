import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { MediaOwnerType, MediaSource, MediaStatus, MediaType } from 'src/common/constants/enums';

@Entity('media')
@Index(['ownerType', 'ownerId'])
@Index(['phash'])
export class Media extends BaseEntity {
  @Column({ name: 'owner_type', type: 'enum', enum: MediaOwnerType })
  ownerType!: MediaOwnerType;

  /** Nullable because a check-in photo is uploaded before the check-in row exists. */
  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId!: string | null;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy!: string | null;

  /** Object key in the bucket. Public URLs are derived, never stored. */
  @Column({ name: 'storage_key', type: 'varchar', length: 500 })
  storageKey!: string;

  @Column({ name: 'thumb_key', type: 'varchar', length: 500, nullable: true })
  thumbKey!: string | null;

  @Column({ type: 'enum', enum: MediaType, default: MediaType.IMAGE })
  type!: MediaType;

  @Column({ type: 'enum', enum: MediaSource, default: MediaSource.COMMUNITY })
  source!: MediaSource;

  /**
   * 64-bit perceptual hash as 16 hex chars. Compared by Hamming distance, so it
   * cannot be indexed usefully for lookup — see MediaService.findDuplicates for
   * the narrowing strategy.
   */
  @Column({ type: 'varchar', length: 32, nullable: true })
  phash!: string | null;

  /**
   * Original EXIF, retained privately for verification and audit. Public copies
   * are served stripped (PRD §11).
   */
  @Column({ type: 'jsonb', nullable: true })
  exif!: Record<string, unknown> | null;

  @Column({ type: 'int', nullable: true })
  width!: number | null;

  @Column({ type: 'int', nullable: true })
  height!: number | null;

  @Column({ name: 'bytes', type: 'int', nullable: true })
  bytes!: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  mime!: string | null;

  @Column({ type: 'enum', enum: MediaStatus, default: MediaStatus.PENDING })
  status!: MediaStatus;

  @Column({ type: 'varchar', length: 300, nullable: true })
  caption!: string | null;

  /** Licence / photographer credit. Required for anything sourced from a board. */
  @Column({ type: 'varchar', length: 300, nullable: true })
  attribution!: string | null;

  /** True once the upload has been finalised (bytes present in the bucket). */
  @Column({ name: 'is_uploaded', type: 'boolean', default: false })
  isUploaded!: boolean;

  /**
   * False when the client used the gallery instead of the in-app camera. Such
   * media can join a destination gallery but can never score a check-in.
   */
  @Column({ name: 'captured_in_app', type: 'boolean', default: false })
  capturedInApp!: boolean;
}
