import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CheckIn, Media, ModerationActionRecord, Report, Review, User } from 'src/entities';
import {
  CheckInStatus,
  MediaOwnerType,
  MediaStatus,
  ModerationAction,
  RejectionReason,
  ReportStatus,
  ReportTargetType,
  ReviewStatus,
} from 'src/common/constants/enums';
import { UserStatus } from 'src/common/constants/roles.enum';
import { NotFoundException, UnprocessableException } from 'src/common/exceptions/app-exceptions';
import { CheckInsService } from '../check-ins/check-ins.service';
import { MediaService } from '../media/media.service';
import { LeaderboardsService } from '../leaderboards/leaderboards.service';
import { AuditService } from '../audit/audit.service';
import { DecideDto, EnforceDto, ModerationQueueDto } from './dto/moderation.dto';

export interface QueueItem {
  checkInId: string;
  submittedAt: Date;
  /** Hours the item has been waiting. The console sorts and colours on this. */
  ageHours: number;
  isAuditSample: boolean;
  verificationScore: number | null;
  user: {
    id: string;
    username: string;
    trustScore: number;
    level: number;
    approvedCheckIns: number;
    rejectedCheckIns: number;
  };
  destination: {
    id: string;
    name: string;
    slug: string;
    tier: number;
    lat: number;
    lng: number;
  };
  submission: {
    photoUrl: string | null;
    lat: number;
    lng: number;
    accuracyM: number | null;
    capturedAt: Date;
  };
  /** Official gallery images for the same destination, for side-by-side comparison. */
  referencePhotoUrls: string[];
  signals: Record<string, unknown>;
}

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly checkIns: CheckInsService,
    private readonly media: MediaService,
    private readonly leaderboards: LeaderboardsService,
    private readonly audit: AuditService,
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    @InjectRepository(ModerationActionRecord)
    private readonly actions: Repository<ModerationActionRecord>,
  ) {}

  /**
   * The photo queue.
   *
   * Everything a moderator needs to decide is assembled in this one response —
   * the submission, the reference gallery, the GPS pair, every automated signal
   * and the user's own history. The console is used for hours at a stretch, and
   * a second request per item is a second of dead time on every decision.
   *
   * Oldest first, audit samples interleaved: the SLA is measured on the oldest
   * item, so that is what has to be on top.
   */
  async queue(query: ModerationQueueDto, stateScope: string | null): Promise<QueueItem[]> {
    const rows = await this.dataSource.query<RawQueueRow[]>(
      `
      SELECT c.id                       AS check_in_id,
             c.submitted_at,
             c.captured_at,
             c.is_audit_sample,
             c.verification_score,
             c.accuracy_m,
             ST_Y(c.device_point::geometry) AS submission_lat,
             ST_X(c.device_point::geometry) AS submission_lng,
             m.storage_key              AS photo_key,
             u.id                       AS user_id,
             p.username,
             p.trust_score,
             p.level,
             (SELECT COUNT(*) FROM check_ins h
               WHERE h.user_id = u.id AND h.status = 'approved') AS approved_count,
             (SELECT COUNT(*) FROM check_ins h
               WHERE h.user_id = u.id AND h.status = 'rejected') AS rejected_count,
             d.id                       AS destination_id,
             d.name                     AS destination_name,
             d.slug                     AS destination_slug,
             d.tier,
             ST_Y(d.location::geometry) AS destination_lat,
             ST_X(d.location::geometry) AS destination_lng,
             to_jsonb(vs.*) - 'check_in_id' AS signals,
             -- LIMIT has to sit inside a subquery; array_agg cannot take one.
             (SELECT COALESCE(array_agg(refs.storage_key), '{}')
                FROM (SELECT rm.storage_key
                        FROM media rm
                       WHERE rm.owner_type = $4
                         AND rm.owner_id = d.id
                         AND rm.status = $5
                         AND rm.source = 'official'
                       ORDER BY rm.created_at
                       LIMIT 6) AS refs) AS reference_keys
        FROM check_ins c
        JOIN users u ON u.id = c.user_id
        JOIN user_profiles p ON p.user_id = u.id
        JOIN destinations d ON d.id = c.destination_id
        LEFT JOIN media m ON m.id = c.media_id
        LEFT JOIN verification_signals vs ON vs.check_in_id = c.id
       WHERE c.status = $1
         AND c.needs_review = true
         AND ($2::uuid IS NULL OR d.state_id = $2::uuid)
       ORDER BY c.submitted_at ASC
       LIMIT $3
      `,
      [
        CheckInStatus.PENDING,
        stateScope,
        query.limit,
        MediaOwnerType.DESTINATION,
        MediaStatus.APPROVED,
      ],
    );

    const now = Date.now();
    return rows.map((row) => ({
      checkInId: row.check_in_id,
      submittedAt: row.submitted_at,
      ageHours: Number(((now - new Date(row.submitted_at).getTime()) / 3_600_000).toFixed(1)),
      isAuditSample: row.is_audit_sample,
      verificationScore: row.verification_score,
      user: {
        id: row.user_id,
        username: row.username,
        trustScore: row.trust_score,
        level: row.level,
        approvedCheckIns: Number.parseInt(row.approved_count, 10),
        rejectedCheckIns: Number.parseInt(row.rejected_count, 10),
      },
      destination: {
        id: row.destination_id,
        name: row.destination_name,
        slug: row.destination_slug,
        tier: row.tier,
        lat: Number(row.destination_lat),
        lng: Number(row.destination_lng),
      },
      submission: {
        photoUrl: row.photo_key ? this.media.publicUrl(row.photo_key) : null,
        lat: Number(row.submission_lat),
        lng: Number(row.submission_lng),
        accuracyM: row.accuracy_m !== null ? Number.parseFloat(row.accuracy_m) : null,
        capturedAt: row.captured_at,
      },
      referencePhotoUrls: (row.reference_keys ?? []).map((key) => this.media.publicUrl(key)),
      signals: row.signals ?? {},
    }));
  }

  /** Waiting time and volume, for the SLA tile on the console. */
  async queueStats(stateScope: string | null) {
    const rows = await this.dataSource.query<
      { pending: string; oldest_hours: string | null; audit_samples: string }[]
    >(
      `
      SELECT COUNT(*) AS pending,
             MAX(EXTRACT(EPOCH FROM (now() - c.submitted_at)) / 3600) AS oldest_hours,
             COUNT(*) FILTER (WHERE c.is_audit_sample) AS audit_samples
        FROM check_ins c
        JOIN destinations d ON d.id = c.destination_id
       WHERE c.status = 'pending' AND c.needs_review = true
         AND ($1::uuid IS NULL OR d.state_id = $1::uuid)
      `,
      [stateScope],
    );

    const row = rows[0];
    return {
      pending: Number.parseInt(row?.pending ?? '0', 10),
      oldestWaitingHours: row?.oldest_hours ? Number(Number(row.oldest_hours).toFixed(1)) : 0,
      auditSamples: Number.parseInt(row?.audit_samples ?? '0', 10),
      /** PRD §9 integrity target. Surfaced so the team sees the breach, not the report. */
      slaHours: 12,
    };
  }

  /**
   * One decision endpoint for the whole queue, so the console can bind `A` and
   * `R` to it and nothing else.
   */
  async decide(
    checkInId: string,
    dto: DecideDto,
    moderatorId: string,
    stateScope: string | null,
  ): Promise<{ checkInId: string; decision: string; pointsAwarded: number }> {
    const checkIn = await this.dataSource.getRepository(CheckIn).findOne({
      where: { id: checkInId },
      relations: { destination: true },
    });
    if (!checkIn) throw new NotFoundException('No such check-in.');

    if (stateScope && checkIn.destination?.stateId !== stateScope) {
      throw new NotFoundException('No such check-in.');
    }
    if (checkIn.status !== CheckInStatus.PENDING && dto.approve) {
      throw new UnprocessableException(
        `That check-in is already ${checkIn.status}.`,
        'already_decided',
      );
    }

    let pointsAwarded = 0;

    if (dto.approve) {
      const outcome = await this.checkIns.approve(checkInId, { moderatorId });
      pointsAwarded = outcome?.pointsAwarded ?? 0;

      if (checkIn.mediaId && dto.promoteToGallery) {
        /*
         * Promoting a community photo into the destination gallery is what the
         * +25 "quality photo" award is for. The media's owner moves from the
         * check-in to the destination so it shows on the detail page.
         */
        await this.media.approve(checkIn.mediaId, checkIn.destinationId);
        await this.dataSource
          .getRepository(Media)
          .update({ id: checkIn.mediaId }, { ownerType: MediaOwnerType.DESTINATION });
      }
    } else {
      await this.checkIns.reject(
        checkInId,
        dto.rejectionReason ?? RejectionReason.MODERATOR_REJECTED,
        dto.note,
        moderatorId,
      );
    }

    await this.recordAction({
      moderatorId,
      targetType: 'check_in',
      targetId: checkInId,
      action: dto.approve ? ModerationAction.APPROVE : ModerationAction.REJECT,
      reason: dto.note ?? null,
    });

    return {
      checkInId,
      decision: dto.approve ? 'approved' : 'rejected',
      pointsAwarded,
    };
  }

  /** Bulk decisions, for a queue full of the same obvious pattern. */
  async decideBulk(
    checkInIds: string[],
    dto: DecideDto,
    moderatorId: string,
    stateScope: string | null,
  ) {
    const results: { checkInId: string; ok: boolean; error?: string }[] = [];

    for (const checkInId of checkInIds) {
      try {
        await this.decide(checkInId, dto, moderatorId, stateScope);
        results.push({ checkInId, ok: true });
      } catch (error) {
        // One bad id must not abandon the rest of the batch.
        results.push({
          checkInId,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { processed: results.length, succeeded: results.filter((r) => r.ok).length, results };
  }

  async listReports(status: ReportStatus, limit: number) {
    return this.reports.find({
      where: { status },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  async resolveReport(
    reportId: string,
    moderatorId: string,
    action: 'uphold' | 'dismiss',
    note?: string,
  ) {
    const report = await this.reports.findOne({ where: { id: reportId } });
    if (!report) throw new NotFoundException('No such report.');

    if (action === 'uphold') {
      // Upholding hides the content; removing it entirely is a separate action.
      if (report.targetType === ReportTargetType.REVIEW) {
        await this.dataSource
          .getRepository(Review)
          .update({ id: report.targetId }, { status: ReviewStatus.HIDDEN });
      } else if (report.targetType === ReportTargetType.MEDIA) {
        await this.media.reject(report.targetId);
      }
    }

    await this.reports.update(reportId, {
      status: action === 'uphold' ? ReportStatus.RESOLVED : ReportStatus.DISMISSED,
      resolvedBy: moderatorId,
      resolvedAt: new Date(),
      resolutionNote: note ?? null,
    });

    await this.recordAction({
      moderatorId,
      targetType: report.targetType,
      targetId: report.targetId,
      action: action === 'uphold' ? ModerationAction.HIDE : ModerationAction.DISMISS_REPORT,
      reason: note ?? null,
    });

    return { reportId, status: action === 'uphold' ? 'resolved' : 'dismissed' };
  }

  /**
   * Graduated enforcement (PRD §5.3 F19): warning → points reversal →
   * leaderboard suspension → ban. Each step is recorded so an appeal has
   * something to read, and a ban revokes sessions rather than waiting for the
   * access token to expire.
   */
  async enforce(userId: string, dto: EnforceDto, moderatorId: string) {
    const users = this.dataSource.getRepository(User);
    const user = await users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('No such user.');

    switch (dto.action) {
      case 'warn':
        await users.update(userId, { status: UserStatus.WARNED });
        break;

      case 'reverse_points': {
        if (!dto.checkInId) {
          throw new UnprocessableException(
            'reverse_points needs the check-in to reverse.',
            'missing_check_in',
          );
        }
        await this.checkIns.reject(
          dto.checkInId,
          RejectionReason.POLICY_VIOLATION,
          dto.reason,
          moderatorId,
        );
        break;
      }

      case 'suspend_leaderboard':
        await users.update(userId, { status: UserStatus.LEADERBOARD_SUSPENDED });
        await this.leaderboards.exclude(userId);
        break;

      case 'ban':
        await users.update(userId, { status: UserStatus.BANNED });
        await this.leaderboards.exclude(userId);
        await this.dataSource.query(
          `UPDATE refresh_tokens SET revoked_at = now(), revoked_reason = 'banned'
            WHERE user_id = $1 AND revoked_at IS NULL`,
          [userId],
        );
        break;

      case 'reinstate':
        await users.update(userId, { status: UserStatus.ACTIVE });
        await this.leaderboards.include(userId);
        break;
    }

    await this.recordAction({
      moderatorId,
      targetType: 'user',
      targetId: userId,
      action: dto.action as ModerationAction,
      reason: dto.reason,
    });

    await this.audit.record({
      actorId: moderatorId,
      action: `user.enforce.${dto.action}`,
      entity: 'user',
      entityId: userId,
      before: { status: user.status },
      after: { action: dto.action, reason: dto.reason },
    });

    this.logger.warn(`Enforcement ${dto.action} applied to user ${userId}: ${dto.reason}`);
    return { userId, action: dto.action };
  }

  async userHistory(userId: string) {
    return this.actions.find({
      where: { targetType: 'user', targetId: userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  private async recordAction(params: {
    moderatorId: string;
    targetType: string;
    targetId: string;
    action: ModerationAction;
    reason: string | null;
  }): Promise<void> {
    await this.actions.insert({
      moderatorId: params.moderatorId,
      targetType: params.targetType,
      targetId: params.targetId,
      action: params.action,
      reason: params.reason,
    });
  }
}

interface RawQueueRow {
  check_in_id: string;
  submitted_at: Date;
  captured_at: Date;
  is_audit_sample: boolean;
  verification_score: number | null;
  accuracy_m: string | null;
  submission_lat: number;
  submission_lng: number;
  photo_key: string | null;
  user_id: string;
  username: string;
  trust_score: number;
  level: number;
  approved_count: string;
  rejected_count: string;
  destination_id: string;
  destination_name: string;
  destination_slug: string;
  tier: number;
  destination_lat: number;
  destination_lng: number;
  signals: Record<string, unknown> | null;
  reference_keys: string[] | null;
}
