import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CheckIn, Review } from 'src/entities';
import { CheckInStatus, ReviewStatus } from 'src/common/constants/enums';
import { PointsReason, PointsRefType, REASON_POINTS } from 'src/common/constants/points';
import {
  ForbiddenException,
  NotFoundException,
  UnprocessableException,
} from 'src/common/exceptions/app-exceptions';
import { Paginated, decodeCursor, encodeCursor, paginate } from 'src/common/dto/pagination.dto';
import { PointsService } from '../points/points.service';
import { MediaService } from '../media/media.service';
import { CreateReviewDto, UpdateReviewDto } from './dto/review.dto';

/** PRD §5.2 F11: "detailed review (≥ 100 chars, with photo)" earns the bonus. */
const DETAILED_REVIEW_MIN_CHARS = 100;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly points: PointsService,
    private readonly media: MediaService,
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
  ) {}

  /**
   * Check-in gated (PRD F9). The gate is not a nicety: it is the reason a
   * review on this platform means more than one on a travel blog, and it is
   * enforced by a NOT NULL foreign key to an approved check-in rather than by
   * this method alone.
   */
  async create(userId: string, dto: CreateReviewDto) {
    const checkIn = await this.dataSource.getRepository(CheckIn).findOne({
      where: {
        userId,
        destinationId: dto.destinationId,
        status: CheckInStatus.APPROVED,
      },
      order: { capturedAt: 'DESC' },
    });

    if (!checkIn) {
      throw new ForbiddenException(
        'Reviews are only open to people who have a verified check-in here.',
        'check_in_required',
      );
    }

    const existing = await this.reviews.findOne({
      where: { userId, destinationId: dto.destinationId },
    });
    if (existing) {
      throw new UnprocessableException(
        'You have already reviewed this destination. Edit that review instead.',
        'already_reviewed',
        { reviewId: existing.id },
      );
    }

    const review = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.getRepository(Review).save(
        manager.getRepository(Review).create({
          userId,
          destinationId: dto.destinationId,
          checkInId: checkIn.id,
          rating: dto.rating,
          body: dto.body ?? null,
          tip: dto.tip ?? null,
          mediaId: dto.mediaId ?? null,
          status: ReviewStatus.PUBLISHED,
        }),
      );

      if (this.qualifiesForBonus(dto)) {
        const bonus = REASON_POINTS[PointsReason.DETAILED_REVIEW]!;
        const award = await this.points.award(
          {
            userId,
            delta: bonus,
            reason: PointsReason.DETAILED_REVIEW,
            refType: PointsRefType.REVIEW,
            refId: saved.id,
            note: 'Detailed review with photo',
          },
          manager,
        );
        if (award.applied) {
          await manager.update(Review, { id: saved.id }, { pointsAwarded: bonus });
        }
      }

      await this.refreshDestinationRating(manager, dto.destinationId);
      return saved;
    });

    return this.findOne(review.id);
  }

  /**
   * Editing never re-earns the bonus — `points_awarded` on the row is the
   * record that it was already paid, so padding a review to 100 characters
   * after the fact does nothing.
   */
  async update(reviewId: string, userId: string, dto: UpdateReviewDto) {
    const review = await this.reviews.findOne({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('No such review.');
    if (review.userId !== userId) throw new ForbiddenException('That review is not yours.');

    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        Review,
        { id: reviewId },
        {
          ...(dto.rating !== undefined ? { rating: dto.rating } : {}),
          ...(dto.body !== undefined ? { body: dto.body } : {}),
          ...(dto.tip !== undefined ? { tip: dto.tip } : {}),
          ...(dto.mediaId !== undefined ? { mediaId: dto.mediaId } : {}),
        },
      );
      if (dto.rating !== undefined) {
        await this.refreshDestinationRating(manager, review.destinationId);
      }
    });

    return this.findOne(reviewId);
  }

  async remove(reviewId: string, userId: string): Promise<void> {
    const review = await this.reviews.findOne({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('No such review.');
    if (review.userId !== userId) throw new ForbiddenException('That review is not yours.');

    await this.dataSource.transaction(async (manager) => {
      /*
       * Soft removal. A hard delete would orphan the +15 ledger entry, and the
       * ledger's rule is that every entry points at something real.
       */
      await manager.update(Review, { id: reviewId }, { status: ReviewStatus.REMOVED });
      await this.refreshDestinationRating(manager, review.destinationId);
    });
  }

  async listForDestination(
    destinationId: string,
    limit: number,
    cursor?: string,
  ): Promise<Paginated<unknown>> {
    const qb = this.reviews
      .createQueryBuilder('review')
      .innerJoin('user_profiles', 'profile', 'profile.user_id = review.user_id')
      .select([
        'review.id AS id',
        'review.rating AS rating',
        'review.body AS body',
        'review.tip AS tip',
        'review.helpful_count AS "helpfulCount"',
        'review.created_at AS "createdAt"',
        'profile.username AS username',
        'profile.display_name AS "displayName"',
        'profile.level AS level',
      ])
      .addSelect(`(SELECT m.storage_key FROM media m WHERE m.id = review.media_id)`, 'photoKey')
      .where('review.destination_id = :destinationId', { destinationId })
      .andWhere('review.status = :published', { published: ReviewStatus.PUBLISHED })
      .orderBy('review.created_at', 'DESC')
      .addOrderBy('review.id', 'DESC');

    const decoded = decodeCursor<{ createdAt: string; id: string }>(cursor);
    if (decoded) {
      qb.andWhere('(review.created_at, review.id) < (:createdAt, :id)', decoded);
    }

    const rows = await qb.limit(limit + 1).getRawMany<{
      id: string;
      rating: number;
      body: string | null;
      tip: string | null;
      helpfulCount: number;
      createdAt: Date;
      username: string;
      displayName: string | null;
      level: number;
      photoKey: string | null;
    }>();

    const page = paginate(rows, limit, (row) =>
      encodeCursor({ createdAt: new Date(row.createdAt).toISOString(), id: row.id }),
    );

    return {
      ...page,
      data: page.data.map((row) => ({
        id: row.id,
        rating: row.rating,
        body: row.body,
        tip: row.tip,
        helpfulCount: row.helpfulCount,
        createdAt: row.createdAt,
        author: { username: row.username, displayName: row.displayName, level: row.level },
        photoUrl: row.photoKey ? this.media.publicUrl(row.photoKey) : null,
        /** Always true — the schema cannot hold a review without a check-in. */
        isVerifiedVisitor: true,
      })),
    };
  }

  async findOne(reviewId: string) {
    const review = await this.reviews.findOne({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('No such review.');
    return {
      id: review.id,
      destinationId: review.destinationId,
      rating: review.rating,
      body: review.body,
      tip: review.tip,
      status: review.status,
      pointsAwarded: review.pointsAwarded,
      createdAt: review.createdAt,
      photoUrl: review.mediaId ? await this.media.publicUrlForId(review.mediaId) : null,
    };
  }

  private qualifiesForBonus(dto: CreateReviewDto): boolean {
    return Boolean(dto.mediaId) && (dto.body?.trim().length ?? 0) >= DETAILED_REVIEW_MIN_CHARS;
  }

  /**
   * Recomputed rather than incremented. An average maintained by increments
   * drifts the moment one update is missed, and the destination card shows this
   * number on every list row.
   */
  private async refreshDestinationRating(
    manager: { query: (sql: string, params: unknown[]) => Promise<unknown> },
    destinationId: string,
  ): Promise<void> {
    await manager.query(
      `
      UPDATE destinations d
         SET rating_avg = stats.avg_rating,
             review_count = stats.review_count
        FROM (
          SELECT ROUND(AVG(rating)::numeric, 2) AS avg_rating,
                 COUNT(*) AS review_count
            FROM reviews
           WHERE destination_id = $1 AND status = 'published'
        ) AS stats
       WHERE d.id = $1
      `,
      [destinationId],
    );
  }
}
