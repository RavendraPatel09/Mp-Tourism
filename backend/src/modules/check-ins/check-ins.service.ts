import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError, Repository } from 'typeorm';
import { CheckIn, Destination, Media, VerificationSignal } from 'src/entities';
import { CheckInStatus, MediaStatus, RejectionReason } from 'src/common/constants/enums';
import {
  DestinationTier,
  MULTIPLIERS,
  NEW_DESTINATION_WINDOW_DAYS,
  PointsReason,
  PointsRefType,
  REASON_POINTS,
  TIER_BASE_POINTS,
} from 'src/common/constants/points';
import {
  ConflictException,
  NotFoundException,
  UnprocessableException,
} from 'src/common/exceptions/app-exceptions';
import { Paginated, decodeCursor, encodeCursor, paginate } from 'src/common/dto/pagination.dto';
import { PointsService } from '../points/points.service';
import { BadgesService } from '../badges/badges.service';
import { ChallengesService } from '../challenges/challenges.service';
import { LeaderboardsService } from '../leaderboards/leaderboards.service';
import { MediaService } from '../media/media.service';
import { VerificationQueue } from '../verification/verification.queue';
import { CreateCheckInDto } from './dto/check-in.dto';

interface CheckInConfig {
  captureWindowSeconds: number;
  gpsAccuracyCeilingM: number;
  maxAccuracyM: number;
  perDayCap: number;
  destinationCooldownHours: number;
}

export interface CheckInResult {
  id: string;
  status: CheckInStatus;
  destinationId: string;
  destinationName: string;
  /** What this will pay if it verifies. Present while pending, so the app can show it. */
  estimatedPoints: number;
  pointsAwarded: number;
  appliedMultiplier: number;
  needsReview: boolean;
  rejectionReason: RejectionReason | null;
  submittedAt: Date;
  /** True when this submission was a replay of an earlier one. */
  deduplicated: boolean;
}

export interface ApprovalOutcome {
  pointsAwarded: number;
  pioneerBonus: number;
  appliedMultiplier: number;
  newBadges: string[];
  completedChallenges: string[];
  balanceAfter: number;
  level: number;
}

const PG_UNIQUE_VIOLATION = '23505';

/**
 * Check-in: the atomic action the whole product is built around.
 *
 * Submission is split deliberately:
 *
 *  - **Synchronous** — everything the user must be told instantly and that is
 *    cheap to decide: is the media real and in-app, is the fix inside the fence,
 *    is the capture recent, is the cooldown clear. Being told "you're not close
 *    enough" four seconds later, after walking away, is a terrible experience.
 *  - **Asynchronous** — everything that needs I/O or history: perceptual hash
 *    against the corpus, impossible-velocity against previous check-ins, trust
 *    routing. These run in the verification worker.
 *
 * The row is created before the async work starts, so the app can show
 * "submitted" immediately and resolve points when the job lands.
 */
@Injectable()
export class CheckInsService {
  private readonly logger = new Logger(CheckInsService.name);
  private readonly config: CheckInConfig;

  constructor(
    private readonly dataSource: DataSource,
    configService: ConfigService,
    private readonly points: PointsService,
    private readonly badges: BadgesService,
    private readonly challenges: ChallengesService,
    private readonly leaderboards: LeaderboardsService,
    private readonly mediaService: MediaService,
    private readonly verificationQueue: VerificationQueue,
    @InjectRepository(CheckIn) private readonly checkIns: Repository<CheckIn>,
    @InjectRepository(Destination) private readonly destinations: Repository<Destination>,
    @InjectRepository(Media) private readonly media: Repository<Media>,
  ) {
    this.config = configService.getOrThrow<CheckInConfig>('checkIn');
  }

  async submit(
    userId: string,
    dto: CreateCheckInDto,
    idempotencyKey: string,
  ): Promise<CheckInResult> {
    /*
     * An idempotent replay is answered before anything else happens. The mobile
     * client retries on timeout at the edge of coverage, which is exactly when
     * a check-in is most likely to be submitted twice.
     */
    const replay = await this.checkIns.findOne({
      where: { userId, idempotencyKey },
      relations: { destination: true },
    });
    if (replay) return this.toResult(replay, replay.destination?.name ?? '', true);

    const destination = await this.destinations.findOne({ where: { id: dto.destinationId } });
    if (!destination) throw new NotFoundException('No such destination.');

    const capturedAt = new Date(dto.capturedAt);
    await this.assertMediaUsable(dto.mediaId, userId);
    this.assertCaptureWindow(capturedAt);
    await this.assertCooldown(userId, destination.id);
    await this.assertDailyCap(userId);

    const geo = await this.checkGeofence(destination.id, dto.lat, dto.lng, dto.accuracyM);
    if (!geo.inside) {
      /*
       * Rejected without creating a row. A submission that never reached the
       * place is not a moderation case, and recording it would fill the
       * one-per-day index with noise that blocks the user's real attempt.
       */
      throw new UnprocessableException(
        `You need to be at ${destination.name} to check in. You are about ` +
          `${Math.round(geo.distanceM)} m outside the area.`,
        'outside_geofence',
        { distanceM: Math.round(geo.distanceM), toleranceM: geo.toleranceM },
      );
    }

    const estimatedPoints = await this.estimatePoints(destination, capturedAt);

    let created: CheckIn;
    try {
      created = await this.checkIns.save(
        this.checkIns.create({
          userId,
          destinationId: destination.id,
          capturedAt,
          submittedAt: new Date(),
          localDay: this.istDay(capturedAt),
          devicePoint: { type: 'Point', coordinates: [dto.lng, dto.lat] },
          accuracyM: dto.accuracyM.toFixed(2),
          mediaId: dto.mediaId,
          status: CheckInStatus.PENDING,
          idempotencyKey,
          deviceFingerprint: dto.device?.fingerprint ?? null,
          /** Unusable fix: accept the submission but never auto-approve it. */
          needsReview: dto.accuracyM > this.config.maxAccuracyM,
        }),
      );
    } catch (error) {
      throw this.translateInsertFailure(error, destination.name);
    }

    await this.dataSource.getRepository(VerificationSignal).insert({
      checkInId: created.id,
      geoPass: true,
      geoDistanceM: geo.distanceM.toFixed(2),
      deviceFingerprint: dto.device?.fingerprint ?? null,
      mockLocation: dto.device?.isMockLocation ?? null,
      isRooted: dto.device?.isRooted ?? null,
      isEmulator: dto.device?.isEmulator ?? null,
      raw: { attestation: dto.device ?? {}, accuracyM: dto.accuracyM },
    });

    await this.verificationQueue.enqueue(created.id);

    return {
      ...this.toResult(created, destination.name, false),
      estimatedPoints,
    };
  }

  /**
   * Approves a check-in and pays for it. Called by the verification worker on a
   * clean result, and by a moderator approving from the queue.
   *
   * The whole payout is one transaction: the status change, the check-in award,
   * the Pioneer bonus and the destination counter either all land or none do.
   * Badges, challenges and the leaderboard run afterwards — they are derived
   * state, and holding a transaction open across them would serialise every
   * approval behind the slowest badge query.
   */
  async approve(
    checkInId: string,
    options: { moderatorId?: string; verificationScore?: number } = {},
  ): Promise<ApprovalOutcome | null> {
    const outcome = await this.dataSource.transaction(async (manager) => {
      const checkIn = await manager
        .createQueryBuilder(CheckIn, 'checkIn')
        .setLock('pessimistic_write')
        .where('checkIn.id = :checkInId', { checkInId })
        .getOne();

      if (!checkIn) throw new NotFoundException('No such check-in.');
      // Already decided — a retried job or a second moderator click.
      if (checkIn.status !== CheckInStatus.PENDING) return null;

      const destination = await manager.findOneOrFail(Destination, {
        where: { id: checkIn.destinationId },
      });

      const multiplier = await this.resolveMultiplier(destination, checkIn.capturedAt);
      const basePoints = TIER_BASE_POINTS[destination.tier as DestinationTier];
      const points = Math.floor(basePoints * multiplier);

      const award = await this.points.award(
        {
          userId: checkIn.userId,
          delta: points,
          reason: PointsReason.CHECK_IN,
          refType: PointsRefType.CHECK_IN,
          refId: checkIn.id,
          stateId: destination.stateId,
          districtId: destination.districtId,
          note: `Verified check-in at ${destination.name}`,
        },
        manager,
      );

      /*
       * Pioneer: the first verified visitor to a destination. Claimed with a
       * conditional UPDATE rather than a read-then-write, so two simultaneous
       * first check-ins cannot both win it.
       */
      let pioneerBonus = 0;
      const claimed = await manager.query<{ id: string }[]>(
        `UPDATE destinations SET pioneer_user_id = $1
          WHERE id = $2 AND pioneer_user_id IS NULL
          RETURNING id`,
        [checkIn.userId, destination.id],
      );
      if (claimed.length) {
        const bonus = REASON_POINTS[PointsReason.PIONEER_BONUS]!;
        const bonusAward = await this.points.award(
          {
            userId: checkIn.userId,
            delta: bonus,
            reason: PointsReason.PIONEER_BONUS,
            refType: PointsRefType.CHECK_IN,
            refId: checkIn.id,
            stateId: destination.stateId,
            districtId: destination.districtId,
            note: `First verified check-in at ${destination.name}`,
          },
          manager,
        );
        if (bonusAward.applied) pioneerBonus = bonus;
      }

      await manager.update(
        CheckIn,
        { id: checkIn.id },
        {
          status: CheckInStatus.APPROVED,
          pointsAwarded: points + pioneerBonus,
          appliedMultiplier: multiplier.toFixed(2),
          verificationScore: options.verificationScore ?? null,
          needsReview: false,
          reviewedBy: options.moderatorId ?? null,
          reviewedAt: options.moderatorId ? new Date() : null,
        },
      );

      await manager.increment(Destination, { id: destination.id }, 'checkInCount', 1);

      if (checkIn.mediaId) {
        await manager.update(Media, { id: checkIn.mediaId }, { status: MediaStatus.APPROVED });
      }

      // A clean verified check-in earns a little trust, capped at 100.
      await manager.query(
        `UPDATE user_profiles SET trust_score = LEAST(trust_score + 2, 100) WHERE user_id = $1`,
        [checkIn.userId],
      );

      return {
        checkIn,
        destination,
        points,
        pioneerBonus,
        multiplier,
        balanceAfter: award.balanceAfter + pioneerBonus,
        level: award.level,
      };
    });

    if (!outcome) return null;

    // ---- derived state, outside the transaction ----
    const [newBadges, challengeAdvance] = await Promise.all([
      this.badges.evaluateForUser(outcome.checkIn.userId, outcome.checkIn.id),
      this.challenges.advanceForCheckIn({
        userId: outcome.checkIn.userId,
        destinationId: outcome.destination.id,
        capturedAt: outcome.checkIn.capturedAt,
        stateId: outcome.destination.stateId,
        districtId: outcome.destination.districtId,
      }),
    ]);

    await this.leaderboards.applyDelta({
      userId: outcome.checkIn.userId,
      points: outcome.points + outcome.pioneerBonus,
      stateId: outcome.destination.stateId,
      districtId: outcome.destination.districtId,
    });

    this.logger.log(
      `Approved check-in ${outcome.checkIn.id}: +${outcome.points + outcome.pioneerBonus} pts ` +
        `(×${outcome.multiplier}) at ${outcome.destination.name}`,
    );

    return {
      pointsAwarded: outcome.points + outcome.pioneerBonus,
      pioneerBonus: outcome.pioneerBonus,
      appliedMultiplier: outcome.multiplier,
      newBadges: newBadges.map((badge) => badge.code),
      completedChallenges: challengeAdvance.completed.map((entry) => entry.title),
      balanceAfter: outcome.balanceAfter,
      level: outcome.level,
    };
  }

  async reject(
    checkInId: string,
    reason: RejectionReason,
    note?: string,
    moderatorId?: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const checkIn = await manager
        .createQueryBuilder(CheckIn, 'checkIn')
        .setLock('pessimistic_write')
        .where('checkIn.id = :checkInId', { checkInId })
        .getOne();

      if (!checkIn) throw new NotFoundException('No such check-in.');

      /*
       * Rejecting an approved check-in has to claw the points back, not just
       * flip a flag. This is the audit-sample path: an auto-approval later found
       * to be fraudulent.
       */
      if (checkIn.status === CheckInStatus.APPROVED) {
        await this.reverseAwardsFor(manager, checkIn.id, moderatorId ?? null, note ?? reason);
        await manager.decrement(Destination, { id: checkIn.destinationId }, 'checkInCount', 1);
      }

      await manager.update(
        CheckIn,
        { id: checkIn.id },
        {
          status: CheckInStatus.REJECTED,
          rejectionReason: reason,
          rejectionNote: note ?? null,
          pointsAwarded: 0,
          needsReview: false,
          reviewedBy: moderatorId ?? null,
          reviewedAt: new Date(),
        },
      );

      if (checkIn.mediaId) {
        await manager.update(Media, { id: checkIn.mediaId }, { status: MediaStatus.REJECTED });
      }

      // Rejections cost trust, and cost it faster than approvals earn it.
      await manager.query(
        `UPDATE user_profiles SET trust_score = GREATEST(trust_score - 10, 0) WHERE user_id = $1`,
        [checkIn.userId],
      );
    });

    this.logger.warn(`Rejected check-in ${checkInId}: ${reason}`);
  }

  /** Marks a check-in as needing a human, with the reason surfaced in the queue. */
  async routeToReview(checkInId: string, verificationScore: number): Promise<void> {
    await this.checkIns.update(
      { id: checkInId, status: CheckInStatus.PENDING },
      { needsReview: true, verificationScore },
    );
  }

  async markAuditSample(checkInId: string): Promise<void> {
    await this.checkIns.update({ id: checkInId }, { isAuditSample: true });
  }

  async findOne(checkInId: string, userId?: string) {
    const checkIn = await this.checkIns.findOne({
      where: { id: checkInId },
      relations: { destination: true, media: true },
    });
    if (!checkIn) throw new NotFoundException('No such check-in.');
    if (userId && checkIn.userId !== userId) {
      // Not 403: a user has no business learning that someone else's id exists.
      throw new NotFoundException('No such check-in.');
    }

    return {
      id: checkIn.id,
      status: checkIn.status,
      destination: checkIn.destination
        ? {
            id: checkIn.destination.id,
            slug: checkIn.destination.slug,
            name: checkIn.destination.name,
            tier: checkIn.destination.tier,
          }
        : null,
      capturedAt: checkIn.capturedAt,
      submittedAt: checkIn.submittedAt,
      pointsAwarded: checkIn.pointsAwarded,
      appliedMultiplier: Number.parseFloat(checkIn.appliedMultiplier),
      needsReview: checkIn.needsReview,
      rejectionReason: checkIn.rejectionReason,
      rejectionNote: checkIn.rejectionNote,
      photoUrl: checkIn.media ? this.mediaService.publicUrl(checkIn.media.storageKey) : null,
    };
  }

  async listForUser(userId: string, limit: number, cursor?: string): Promise<Paginated<unknown>> {
    const qb = this.checkIns
      .createQueryBuilder('checkIn')
      .leftJoinAndSelect('checkIn.destination', 'destination')
      .leftJoinAndSelect('checkIn.media', 'media')
      .where('checkIn.user_id = :userId', { userId })
      .orderBy('checkIn.submitted_at', 'DESC')
      .addOrderBy('checkIn.id', 'DESC');

    const decoded = decodeCursor<{ submittedAt: string; id: string }>(cursor);
    if (decoded) {
      qb.andWhere('(checkIn.submitted_at, checkIn.id) < (:submittedAt, :id)', decoded);
    }

    const rows = await qb.take(limit + 1).getMany();
    const page = paginate(rows, limit, (row) =>
      encodeCursor({ submittedAt: row.submittedAt.toISOString(), id: row.id }),
    );

    return {
      ...page,
      data: page.data.map((checkIn) => ({
        id: checkIn.id,
        status: checkIn.status,
        destination: checkIn.destination
          ? {
              id: checkIn.destination.id,
              slug: checkIn.destination.slug,
              name: checkIn.destination.name,
              tier: checkIn.destination.tier,
            }
          : null,
        capturedAt: checkIn.capturedAt,
        pointsAwarded: checkIn.pointsAwarded,
        photoThumbUrl: checkIn.media?.thumbKey
          ? this.mediaService.publicUrl(checkIn.media.thumbKey)
          : null,
      })),
    };
  }

  /**
   * Geofence containment, with GPS error accounted for.
   *
   * The rule is *intersection*, not point-in-polygon: if the accuracy circle
   * around the reported fix overlaps the fence, the user is inside as far as we
   * can tell. Demanding an exact containment would reject honest visitors
   * standing 15 m from a boundary under a tree canopy, which is most of them at
   * a forested Tier-4 site. Accuracy is clamped so a client cannot claim a
   * 5 km error and check in from the next district.
   */
  async checkGeofence(
    destinationId: string,
    lat: number,
    lng: number,
    accuracyM: number,
  ): Promise<{ inside: boolean; distanceM: number; toleranceM: number }> {
    const tolerance = Math.min(accuracyM, this.config.gpsAccuracyCeilingM);

    const rows = await this.dataSource.query<{ distance_m: string; inside: boolean }[]>(
      `
      SELECT
        CASE
          WHEN d.geofence IS NOT NULL
            THEN ST_Distance(d.geofence::geography, point.geom::geography)
          ELSE GREATEST(
            ST_Distance(d.location::geography, point.geom::geography) - d.geofence_radius_m,
            0
          )
        END AS distance_m,
        CASE
          WHEN d.geofence IS NOT NULL
            THEN ST_DWithin(d.geofence::geography, point.geom::geography, $4)
          ELSE ST_DWithin(
            d.location::geography, point.geom::geography, d.geofence_radius_m + $4
          )
        END AS inside
      FROM destinations d
      CROSS JOIN (SELECT ST_SetSRID(ST_MakePoint($2, $3), 4326) AS geom) AS point
      WHERE d.id = $1
      `,
      [destinationId, lng, lat, tolerance],
    );

    const row = rows[0];
    if (!row) throw new NotFoundException('No such destination.');

    return {
      inside: row.inside,
      distanceM: Number.parseFloat(row.distance_m),
      toleranceM: tolerance,
    };
  }

  /**
   * Multiplier resolution.
   *
   * **Deliberate deviation from PRD §5.2 F11:** the PRD lists four multipliers
   * (off-season ×1.5, monsoon-site-in-season ×1.5, active challenge ×2, new
   * destination ×2) without saying how they combine. Multiplied together they
   * reach ×9, which turns one lucky check-in into a bigger prize than a month of
   * honest travel and makes any leaderboard impossible to explain. We take the
   * single highest applicable multiplier instead. Flagged for the team — if
   * stacking is wanted, it should be capped explicitly rather than by accident.
   */
  private async resolveMultiplier(destination: Destination, at: Date): Promise<number> {
    const candidates: number[] = [1];

    if (destination.publishedAt) {
      const ageDays = (at.getTime() - destination.publishedAt.getTime()) / 86_400_000;
      if (ageDays >= 0 && ageDays <= NEW_DESTINATION_WINDOW_DAYS) {
        candidates.push(MULTIPLIERS.NEW_DESTINATION);
      }
    }

    const season = this.seasonFor(at);
    if (destination.isMonsoonOnly && season === 'monsoon') {
      candidates.push(MULTIPLIERS.MONSOON_SITE_IN_SEASON);
    } else if (
      destination.bestSeason.length &&
      !destination.bestSeason.includes('all_year' as never) &&
      !destination.bestSeason.includes(season as never)
    ) {
      // Visiting outside the recommended season — harder, so worth more.
      candidates.push(MULTIPLIERS.OFF_SEASON);
    }

    candidates.push(await this.challenges.activeMultiplierFor(destination.id, at));

    return Math.max(...candidates);
  }

  /** What a pending check-in will pay, so the app can show it before verification. */
  private async estimatePoints(destination: Destination, at: Date): Promise<number> {
    const multiplier = await this.resolveMultiplier(destination, at);
    const base = TIER_BASE_POINTS[destination.tier as DestinationTier];
    const pioneer = destination.pioneerUserId ? 0 : REASON_POINTS[PointsReason.PIONEER_BONUS]!;
    return Math.floor(base * multiplier) + pioneer;
  }

  private async reverseAwardsFor(
    manager: EntityManager,
    checkInId: string,
    moderatorId: string | null,
    reason: string,
  ): Promise<void> {
    const entries = await manager.query<{ id: string }[]>(
      `
      SELECT id FROM points_ledger
       WHERE ref_type = 'check_in' AND ref_id = $1
         AND reason_code <> 'reversal' AND reversed_by IS NULL
      `,
      [checkInId],
    );

    for (const entry of entries) {
      await this.points.reverse(entry.id, moderatorId, reason, manager);
    }
  }

  private async assertMediaUsable(mediaId: string, userId: string): Promise<void> {
    const media = await this.media.findOne({ where: { id: mediaId } });
    if (!media) throw new NotFoundException('Unknown media id.');
    if (media.uploadedBy !== userId) {
      throw new UnprocessableException('That photo belongs to another account.', 'media_not_yours');
    }
    if (!media.capturedInApp) {
      throw new UnprocessableException(
        'Check-in photos must be taken with the in-app camera.',
        'not_in_app_camera',
      );
    }
    if (!media.isUploaded) {
      throw new UnprocessableException(
        'That photo has not finished uploading.',
        'upload_incomplete',
      );
    }

    const existing = await this.checkIns.count({ where: { mediaId } });
    if (existing > 0) {
      throw new ConflictException(
        'That photo has already been used for a check-in.',
        'media_already_used',
      );
    }
  }

  private assertCaptureWindow(capturedAt: Date): void {
    const ageSeconds = (Date.now() - capturedAt.getTime()) / 1000;

    if (ageSeconds > this.config.captureWindowSeconds) {
      throw new UnprocessableException(
        'That photo is too old. Take a fresh one at the destination.',
        'stale_capture',
        { ageSeconds: Math.round(ageSeconds), maxSeconds: this.config.captureWindowSeconds },
      );
    }

    /*
     * A capture time in the future means a wrong device clock or a tampered
     * payload. 120 s of slack absorbs genuine clock drift; beyond that the
     * client is told to fix its clock rather than being silently trusted.
     */
    if (ageSeconds < -120) {
      throw new UnprocessableException(
        'Your device clock looks wrong. Check the date and time and try again.',
        'clock_skew',
      );
    }
  }

  private async assertCooldown(userId: string, destinationId: string): Promise<void> {
    const rows = await this.checkIns.query<{ submitted_at: Date }[]>(
      `
      SELECT submitted_at FROM check_ins
       WHERE user_id = $1 AND destination_id = $2 AND status <> 'rejected'
         AND submitted_at > now() - ($3 || ' hours')::interval
       ORDER BY submitted_at DESC LIMIT 1
      `,
      [userId, destinationId, this.config.destinationCooldownHours],
    );

    if (rows.length) {
      const nextAllowed = new Date(
        rows[0].submitted_at.getTime() + this.config.destinationCooldownHours * 3_600_000,
      );
      throw new ConflictException(
        `You have already checked in here today. You can check in again after ` +
          `${nextAllowed.toISOString()}.`,
        'cooldown_active',
        { nextAllowedAt: nextAllowed.toISOString() },
      );
    }
  }

  private async assertDailyCap(userId: string): Promise<void> {
    const rows = await this.checkIns.query<{ count: string }[]>(
      `
      SELECT COUNT(*) AS count FROM check_ins
       WHERE user_id = $1 AND status <> 'rejected'
         AND local_day = (now() AT TIME ZONE 'Asia/Kolkata')::date
      `,
      [userId],
    );

    if (Number.parseInt(rows[0]?.count ?? '0', 10) >= this.config.perDayCap) {
      throw new ConflictException(
        `That is ${this.config.perDayCap} check-ins today — the daily limit. ` +
          'It resets at midnight IST.',
        'daily_cap_reached',
      );
    }
  }

  /**
   * The one-per-day unique index is the real guard against double-awarding, so
   * its violation has to become a clear message rather than a 500. Racing
   * submissions land here even when every check above passed.
   */
  private translateInsertFailure(error: unknown, destinationName: string): Error {
    if (error instanceof QueryFailedError) {
      const driverError = error.driverError as { code?: string; constraint?: string };
      if (driverError?.code === PG_UNIQUE_VIOLATION) {
        if (driverError.constraint === 'uq_check_ins_user_destination_day') {
          return new ConflictException(
            `You have already checked in at ${destinationName} today.`,
            'already_checked_in',
          );
        }
        if (driverError.constraint === 'uq_check_ins_user_idempotency') {
          return new ConflictException(
            'That check-in is already being processed.',
            'submission_in_flight',
          );
        }
      }
    }
    return error instanceof Error ? error : new Error(String(error));
  }

  private toResult(
    checkIn: CheckIn,
    destinationName: string,
    deduplicated: boolean,
  ): CheckInResult {
    return {
      id: checkIn.id,
      status: checkIn.status,
      destinationId: checkIn.destinationId,
      destinationName,
      estimatedPoints: checkIn.pointsAwarded,
      pointsAwarded: checkIn.pointsAwarded,
      appliedMultiplier: Number.parseFloat(checkIn.appliedMultiplier),
      needsReview: checkIn.needsReview,
      rejectionReason: checkIn.rejectionReason,
      submittedAt: checkIn.submittedAt,
      deduplicated,
    };
  }

  /** IST calendar day of a timestamp, as `YYYY-MM-DD`. */
  private istDay(at: Date): string {
    return new Date(at.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  }

  private seasonFor(at: Date): string {
    const month = new Date(at.getTime() + 5.5 * 3600 * 1000).getUTCMonth() + 1;
    if (month >= 11 || month <= 2) return 'winter';
    if (month >= 3 && month <= 5) return 'summer';
    if (month >= 6 && month <= 9) return 'monsoon';
    return 'post_monsoon';
  }
}
