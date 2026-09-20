import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CheckIn, UserProfile, VerificationSignal } from 'src/entities';
import { CheckInStatus, RejectionReason } from 'src/common/constants/enums';
import { MediaService } from '../media/media.service';
import { CheckInsService } from '../check-ins/check-ins.service';

interface VerificationConfig {
  captureWindowSeconds: number;
  maxAccuracyM: number;
  impossibleVelocityKmh: number;
  phashDistanceThreshold: number;
  trustAutoApproveThreshold: number;
  auditSampleRate: number;
}

export type VerificationDecision = 'approved' | 'rejected' | 'manual_review' | 'skipped';

export interface VerificationOutcome {
  checkInId: string;
  decision: VerificationDecision;
  score: number;
  reasons: string[];
  rejectionReason?: RejectionReason;
}

/** How much each failed signal takes off a 100-point confidence score. */
const PENALTIES = {
  MOCK_LOCATION: 100,
  DUPLICATE_PHOTO: 100,
  EMULATOR: 60,
  ROOTED: 25,
  IMPOSSIBLE_VELOCITY: 70,
  POOR_ACCURACY: 30,
  NEAR_DUPLICATE: 35,
  STALE_CAPTURE: 40,
  MANY_ACCOUNTS_ON_DEVICE: 40,
  PHASH_UNAVAILABLE: 20,
} as const;

/**
 * The verification pipeline (PRD §5.3 F18), layers 3–7. Layers 1 and 2 —
 * in-app-camera and geofence — are enforced synchronously at submit, because a
 * user standing at a fort deserves an instant answer.
 *
 * Two rules shape everything here:
 *
 *  1. **Auto-reject only on proof, never on suspicion.** A duplicate photo and
 *     a mock-location flag are proof. A fast journey, a rooted phone and a bad
 *     GPS fix are suspicion, and suspicion goes to a human. Wrongly rejecting a
 *     genuine visitor who drove four hours to a Tier-4 site loses a user
 *     permanently; a moderator spending thirty seconds on it costs almost
 *     nothing.
 *  2. **Fail closed.** If a signal cannot be computed, the check-in goes to
 *     review rather than sailing through.
 */
@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);
  private readonly config: VerificationConfig;

  constructor(
    private readonly dataSource: DataSource,
    configService: ConfigService,
    private readonly media: MediaService,
    private readonly checkInsService: CheckInsService,
    @InjectRepository(CheckIn) private readonly checkIns: Repository<CheckIn>,
    @InjectRepository(VerificationSignal)
    private readonly signals: Repository<VerificationSignal>,
  ) {
    this.config = configService.getOrThrow<VerificationConfig>('checkIn');
  }

  async verify(checkInId: string): Promise<VerificationOutcome> {
    const checkIn = await this.checkIns.findOne({
      where: { id: checkInId },
      relations: { destination: true },
    });

    if (!checkIn) {
      return { checkInId, decision: 'skipped', score: 0, reasons: ['check_in_not_found'] };
    }
    if (checkIn.status !== CheckInStatus.PENDING) {
      // A moderator got there first, or this job is a redelivery.
      return { checkInId, decision: 'skipped', score: 0, reasons: ['already_decided'] };
    }

    const existing = await this.signals.findOne({ where: { checkInId } });
    const profile = await this.dataSource
      .getRepository(UserProfile)
      .findOne({ where: { userId: checkIn.userId } });

    const reasons: string[] = [];
    let score = 100;
    let hardReject: RejectionReason | null = null;

    // ---- layer 3: time window (server time is authoritative) ----
    const captureLagSeconds = Math.round(
      (checkIn.submittedAt.getTime() - checkIn.capturedAt.getTime()) / 1000,
    );
    const timePass = captureLagSeconds <= this.config.captureWindowSeconds;
    if (!timePass) {
      score -= PENALTIES.STALE_CAPTURE;
      reasons.push('stale_capture');
    }

    // ---- layer 4: spoof detection ----
    const attestation = (existing?.raw?.attestation ?? {}) as {
      isMockLocation?: boolean;
      isRooted?: boolean;
      isEmulator?: boolean;
    };

    if (attestation.isMockLocation === true) {
      // The device itself says the location was faked. Nothing to weigh up.
      hardReject = RejectionReason.MOCK_LOCATION;
      score -= PENALTIES.MOCK_LOCATION;
      reasons.push('mock_location');
    }
    if (attestation.isEmulator === true) {
      score -= PENALTIES.EMULATOR;
      reasons.push('emulator');
    }
    if (attestation.isRooted === true) {
      score -= PENALTIES.ROOTED;
      reasons.push('rooted_device');
    }

    const accuracyM = checkIn.accuracyM ? Number.parseFloat(checkIn.accuracyM) : null;
    if (accuracyM !== null && accuracyM > this.config.maxAccuracyM) {
      score -= PENALTIES.POOR_ACCURACY;
      reasons.push('poor_gps_accuracy');
    }

    const deviceAccounts = await this.countAccountsOnDevice(checkIn.deviceFingerprint);
    if (deviceAccounts > 3) {
      score -= PENALTIES.MANY_ACCOUNTS_ON_DEVICE;
      reasons.push('many_accounts_on_device');
    }

    // ---- layer 4b: impossible velocity against the previous approved check-in ----
    const velocity = await this.computeVelocity(checkIn);
    if (velocity && velocity.kmh > this.config.impossibleVelocityKmh) {
      /*
       * Not an auto-reject. Bhopal to Leh in 40 minutes is impossible, but the
       * same arithmetic flags a genuine domestic flight plus a taxi, and the
       * cost of being wrong here is a real traveller losing points they earned.
       */
      score -= PENALTIES.IMPOSSIBLE_VELOCITY;
      reasons.push('impossible_velocity');
    }

    // ---- layer 5: perceptual-hash duplicate check ----
    let phash: string | null = null;
    let duplicate: { mediaId: string; distance: number } | null = null;

    if (checkIn.mediaId) {
      try {
        const processed = await this.media.processUploaded(checkIn.mediaId);
        phash = processed.phash;
      } catch (error) {
        this.logger.warn(`Media processing failed for ${checkIn.mediaId}: ${String(error)}`);
      }

      if (phash) {
        duplicate = await this.media.findDuplicate(
          phash,
          checkIn.userId,
          this.config.phashDistanceThreshold,
          checkIn.mediaId,
        );
        if (duplicate) {
          if (duplicate.distance <= 2) {
            // Effectively the same file. A re-upload or a screenshot.
            hardReject = RejectionReason.DUPLICATE_PHOTO;
            score -= PENALTIES.DUPLICATE_PHOTO;
            reasons.push('duplicate_photo');
          } else {
            // Similar but not identical — could be two shots of the same arch.
            score -= PENALTIES.NEAR_DUPLICATE;
            reasons.push('near_duplicate_photo');
          }
        }
      } else {
        score -= PENALTIES.PHASH_UNAVAILABLE;
        reasons.push('phash_unavailable');
      }
    } else {
      hardReject = RejectionReason.MEDIA_MISSING;
      reasons.push('media_missing');
    }

    score = Math.max(0, Math.min(100, score));

    await this.persistSignals(checkIn, {
      timePass,
      captureLagSeconds,
      phashMatchMediaId: duplicate?.mediaId ?? null,
      phashDistance: duplicate?.distance ?? null,
      velocityKmh: velocity?.kmh ?? null,
      previousCheckInId: velocity?.previousCheckInId ?? null,
      trustScoreAtSubmit: profile?.trustScore ?? null,
      reasons,
      score,
    });

    // ---- layers 6–7: routing ----
    if (hardReject) {
      await this.checkInsService.reject(
        checkIn.id,
        hardReject,
        `Automated verification: ${reasons.join(', ')}`,
      );
      return { checkInId, decision: 'rejected', score, reasons, rejectionReason: hardReject };
    }

    const trustScore = profile?.trustScore ?? 0;
    const clean = reasons.length === 0;
    const trusted = trustScore >= this.config.trustAutoApproveThreshold;

    if (clean && trusted) {
      /*
       * Random audit of auto-approvals (PRD F18.8). The sample is what keeps
       * the auto-approval rate honest — without it, a fraud pattern that scores
       * clean is never seen by anyone.
       */
      const audit = Math.random() < this.config.auditSampleRate;
      if (audit) await this.checkInsService.markAuditSample(checkIn.id);

      await this.checkInsService.approve(checkIn.id, { verificationScore: score });
      return { checkInId, decision: 'approved', score, reasons };
    }

    await this.checkInsService.routeToReview(checkIn.id, score);
    return {
      checkInId,
      decision: 'manual_review',
      score,
      reasons: reasons.length ? reasons : ['trust_score_below_threshold'],
    };
  }

  /**
   * Straight-line speed since the user's previous approved check-in. Great-circle
   * distance, not road distance, so it under-reports real travel — which is the
   * right direction for a fraud signal: it only fires when even the impossible
   * shortcut would not have been fast enough.
   */
  private async computeVelocity(
    checkIn: CheckIn,
  ): Promise<{ kmh: number; previousCheckInId: string } | null> {
    const rows = await this.dataSource.query<
      { id: string; captured_at: Date; distance_m: string }[]
    >(
      `
      SELECT previous.id,
             previous.captured_at,
             ST_Distance(previous.device_point::geography, current.device_point::geography)
               AS distance_m
        FROM check_ins current
        JOIN check_ins previous
          ON previous.user_id = current.user_id
         AND previous.status = 'approved'
         AND previous.captured_at < current.captured_at
       WHERE current.id = $1
       ORDER BY previous.captured_at DESC
       LIMIT 1
      `,
      [checkIn.id],
    );

    const previous = rows[0];
    if (!previous) return null;

    const hours =
      (checkIn.capturedAt.getTime() - new Date(previous.captured_at).getTime()) / 3_600_000;
    // Two check-ins inside a minute of each other say nothing useful about speed.
    if (hours <= 1 / 60) return null;

    const km = Number.parseFloat(previous.distance_m) / 1000;
    return { kmh: km / hours, previousCheckInId: previous.id };
  }

  private async countAccountsOnDevice(fingerprint: string | null): Promise<number> {
    if (!fingerprint) return 0;
    const rows = await this.dataSource.query<{ count: string }[]>(
      `SELECT COUNT(DISTINCT user_id) AS count FROM devices WHERE fingerprint = $1`,
      [fingerprint],
    );
    return Number.parseInt(rows[0]?.count ?? '0', 10);
  }

  private async persistSignals(
    checkIn: CheckIn,
    data: {
      timePass: boolean;
      captureLagSeconds: number;
      phashMatchMediaId: string | null;
      phashDistance: number | null;
      velocityKmh: number | null;
      previousCheckInId: string | null;
      trustScoreAtSubmit: number | null;
      reasons: string[];
      score: number;
    },
  ): Promise<void> {
    /*
     * The signals row is created at submit with the geofence result, so this is
     * an upsert on the primary key. Every field lands in one place because the
     * moderation console renders this row verbatim — a moderator deciding in
     * thirty seconds cannot go hunting across five tables.
     */
    await this.dataSource.query(
      `
      UPDATE verification_signals
         SET time_pass = $2,
             capture_lag_seconds = $3,
             phash_match_media_id = $4,
             phash_distance = $5,
             velocity_kmh = $6,
             previous_check_in_id = $7,
             trust_score_at_submit = $8,
             raw = raw || $9::jsonb
       WHERE check_in_id = $1
      `,
      [
        checkIn.id,
        data.timePass,
        data.captureLagSeconds,
        data.phashMatchMediaId,
        data.phashDistance,
        data.velocityKmh?.toFixed(2) ?? null,
        data.previousCheckInId,
        data.trustScoreAtSubmit,
        JSON.stringify({ reasons: data.reasons, score: data.score, verifiedAt: new Date() }),
      ],
    );
  }
}
