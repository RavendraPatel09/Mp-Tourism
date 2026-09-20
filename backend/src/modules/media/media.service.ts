import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { Media } from 'src/entities';
import { MediaOwnerType, MediaSource, MediaStatus, MediaType } from 'src/common/constants/enums';
import { NotFoundException, UnprocessableException } from 'src/common/exceptions/app-exceptions';
import { jsonb } from 'src/common/db/jsonb';

interface MediaConfig {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  publicBaseUrl: string;
  uploadUrlTtlSeconds: number;
  maxBytes: number;
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
const THUMB_WIDTH = 480;

export interface UploadTicket {
  mediaId: string;
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
  maxBytes: number;
  requiredHeaders: Record<string, string>;
}

export interface DuplicateMatch {
  mediaId: string;
  distance: number;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly config: MediaConfig;
  private readonly s3: S3Client;

  constructor(
    configService: ConfigService,
    @InjectRepository(Media) private readonly media: Repository<Media>,
  ) {
    this.config = configService.getOrThrow<MediaConfig>('media');
    this.s3 = new S3Client({
      region: this.config.region,
      endpoint: this.config.endpoint,
      forcePathStyle: this.config.forcePathStyle,
      credentials: this.config.accessKeyId
        ? {
            accessKeyId: this.config.accessKeyId,
            secretAccessKey: this.config.secretAccessKey,
          }
        : undefined,
    });
  }

  /**
   * Two-phase upload: the client PUTs straight to object storage with a signed
   * URL, then tells us the key is live. Photos from a Tier-4 destination arrive
   * over 3G at the edge of coverage — proxying them through the API would tie up
   * a Node process for the length of a slow mobile upload, and a failed retry
   * would have to resend the bytes through us a second time.
   */
  async createUploadTicket(params: {
    userId: string;
    ownerType: MediaOwnerType;
    ownerId?: string | null;
    mime: string;
    capturedInApp: boolean;
    source?: MediaSource;
  }): Promise<UploadTicket> {
    if (!ALLOWED_MIME.has(params.mime)) {
      throw new UnprocessableException(
        `Unsupported image type: ${params.mime}`,
        'unsupported_media_type',
      );
    }

    const mediaId = randomUUID();
    const extension = params.mime.split('/')[1].replace('jpeg', 'jpg');
    const storageKey = `${params.ownerType}/${this.datePrefix()}/${mediaId}.${extension}`;

    await this.media.insert({
      id: mediaId,
      ownerType: params.ownerType,
      ownerId: params.ownerId ?? null,
      uploadedBy: params.userId,
      storageKey,
      type: MediaType.IMAGE,
      source: params.source ?? MediaSource.COMMUNITY,
      mime: params.mime,
      status: MediaStatus.PENDING,
      isUploaded: false,
      capturedInApp: params.capturedInApp,
    });

    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: storageKey,
        ContentType: params.mime,
      }),
      { expiresIn: this.config.uploadUrlTtlSeconds },
    );

    return {
      mediaId,
      uploadUrl,
      storageKey,
      expiresInSeconds: this.config.uploadUrlTtlSeconds,
      maxBytes: this.config.maxBytes,
      requiredHeaders: { 'Content-Type': params.mime },
    };
  }

  /**
   * Confirms the object exists and records its size. Called before a check-in
   * is accepted, so a client cannot submit a check-in pointing at a key it never
   * actually uploaded.
   */
  async finalise(mediaId: string, userId: string): Promise<Media> {
    const media = await this.media.findOne({ where: { id: mediaId, uploadedBy: userId } });
    if (!media) throw new NotFoundException('Unknown media id.');
    if (media.isUploaded) return media;

    const head = await this.s3
      .send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: media.storageKey }))
      .catch(() => null);

    if (!head) {
      throw new UnprocessableException(
        'The upload has not arrived in storage yet.',
        'upload_incomplete',
      );
    }
    if ((head.ContentLength ?? 0) > this.config.maxBytes) {
      throw new UnprocessableException('That image is too large.', 'media_too_large');
    }

    await this.media.update(mediaId, { isUploaded: true, bytes: head.ContentLength ?? null });
    return { ...media, isUploaded: true, bytes: head.ContentLength ?? null };
  }

  /**
   * Derivative generation, run in the verification worker rather than on the
   * request path. Produces the thumbnail, records dimensions, keeps the original
   * EXIF privately and strips it from the public derivative (PRD §11).
   */
  async processUploaded(mediaId: string): Promise<{ phash: string | null }> {
    const media = await this.media.findOneBy({ id: mediaId });
    if (!media) throw new NotFoundException('Unknown media id.');

    const original = await this.download(media.storageKey);
    const image = sharp(original, { failOn: 'error' });
    const metadata = await image.metadata();

    const thumbKey = media.storageKey.replace(/(\.[a-z0-9]+)$/i, '_thumb.webp');
    const thumbnail = await sharp(original)
      .rotate()
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      /* No `withMetadata()`: the public derivative must not carry EXIF GPS. */
      .webp({ quality: 82 })
      .toBuffer();

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: thumbKey,
        Body: thumbnail,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    const phash = await this.perceptualHash(original);

    await this.media.update(mediaId, {
      thumbKey,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      exif: jsonb(this.extractExif(metadata)),
      phash,
      isUploaded: true,
    });

    return { phash };
  }

  /**
   * Nearest perceptual-hash neighbour within `threshold` Hamming distance.
   *
   * pHash cannot be indexed for similarity, so this does the comparison in
   * Postgres over the candidate set rather than pulling every hash into Node.
   * The candidate set is narrowed to the user's own history plus recent
   * platform-wide uploads — a screenshot-of-a-screenshot is almost always
   * either the user's own earlier photo or something posted recently.
   */
  async findDuplicate(
    phash: string,
    userId: string,
    threshold: number,
    excludeMediaId?: string,
  ): Promise<DuplicateMatch | null> {
    const rows = await this.media.query<{ id: string; distance: string }[]>(
      `
      WITH candidates AS (
        SELECT id, phash FROM media
         WHERE phash IS NOT NULL
           AND ($3::uuid IS NULL OR id <> $3::uuid)
           AND (uploaded_by = $2::uuid OR created_at > now() - interval '90 days')
         ORDER BY created_at DESC
         LIMIT 20000
      )
      SELECT id,
             /*
              * Hamming distance between the two 64-bit hashes. The 'x' || hex
              * form is the standard way to get a bit string out of hex text;
              * '#' is XOR on bit strings and bit_count is its population count.
              */
             bit_count(
               ('x' || lpad(phash, 16, '0'))::bit(64)
               # ('x' || lpad($1::text, 16, '0'))::bit(64)
             ) AS distance
        FROM candidates
       ORDER BY distance ASC
       LIMIT 1
      `,
      [phash, userId, excludeMediaId ?? null],
    );

    const best = rows[0];
    if (!best) return null;
    const distance = Number.parseInt(best.distance, 10);
    return distance <= threshold ? { mediaId: best.id, distance } : null;
  }

  async approve(mediaId: string, ownerId?: string): Promise<void> {
    await this.media.update(mediaId, {
      status: MediaStatus.APPROVED,
      ...(ownerId ? { ownerId } : {}),
    });
  }

  async reject(mediaId: string): Promise<void> {
    await this.media.update(mediaId, { status: MediaStatus.REJECTED });
  }

  publicUrl(storageKey: string): string {
    return `${this.config.publicBaseUrl.replace(/\/$/, '')}/${storageKey}`;
  }

  async publicUrlForId(mediaId: string): Promise<string | null> {
    const media = await this.media.findOne({
      where: { id: mediaId },
      select: { id: true, storageKey: true },
    });
    return media ? this.publicUrl(media.storageKey) : null;
  }

  /** Moderators need the untouched original, including its EXIF. */
  signedOriginalUrl(storageKey: string): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.config.bucket, Key: storageKey }),
      { expiresIn: 600 },
    );
  }

  private async download(storageKey: string): Promise<Buffer> {
    const result = await this.s3.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: storageKey }),
    );
    const chunks: Buffer[] = [];
    for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  /**
   * 64-bit average hash: downscale to 8×8 greyscale, then one bit per pixel for
   * "brighter than the mean". Resilient to re-encoding, resizing and mild crops,
   * which is exactly the family of "same photo, submitted twice" we care about.
   * Computed here rather than through a wrapper library so the bit order is
   * ours and stays stable across dependency upgrades.
   */
  private async perceptualHash(buffer: Buffer): Promise<string | null> {
    try {
      const pixels = await sharp(buffer).greyscale().resize(8, 8, { fit: 'fill' }).raw().toBuffer();

      const mean = pixels.reduce((sum, value) => sum + value, 0) / pixels.length;
      let bits = '';
      for (const value of pixels) bits += value >= mean ? '1' : '0';

      return BigInt(`0b${bits}`).toString(16).padStart(16, '0');
    } catch (error) {
      this.logger.warn(
        `pHash failed; the check-in will be routed to manual review: ${String(error)}`,
      );
      return null;
    }
  }

  /** Only the fields verification and audit actually use. */
  private extractExif(metadata: sharp.Metadata): Record<string, unknown> | null {
    if (!metadata.exif) return null;
    return {
      hasExif: true,
      bytes: metadata.exif.length,
      orientation: metadata.orientation ?? null,
      format: metadata.format,
      /*
       * Raw EXIF is kept as base64 rather than parsed: the verification pipeline
       * treats the device's own claims as untrusted anyway, and a moderator who
       * needs the real GPS tag opens the signed original.
       */
      raw: metadata.exif.toString('base64'),
    };
  }

  private datePrefix(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  }
}
