import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { VerificationService } from './verification.service';
import { CheckIn, VerificationSignal } from 'src/entities';
import { CheckInStatus, RejectionReason } from 'src/common/constants/enums';
import { MediaService } from '../media/media.service';
import { CheckInsService } from '../check-ins/check-ins.service';

/**
 * Routing tests for the verification pipeline.
 *
 * The rule under test throughout: **auto-reject only on proof, auto-approve
 * only when clean and trusted, and send everything else to a human.** Getting
 * this wrong in either direction is expensive — a false rejection loses a
 * traveller who drove four hours to a Tier-4 site, and a false approval that
 * nobody samples lets a fraud pattern become the leaderboard.
 */

const CONFIG = {
  captureWindowSeconds: 600,
  maxAccuracyM: 500,
  impossibleVelocityKmh: 900,
  phashDistanceThreshold: 6,
  trustAutoApproveThreshold: 60,
  auditSampleRate: 0.05,
};

interface Scenario {
  attestation?: { isMockLocation?: boolean; isRooted?: boolean; isEmulator?: boolean };
  trustScore?: number;
  accuracyM?: number;
  captureLagSeconds?: number;
  phash?: string | null;
  duplicate?: { mediaId: string; distance: number } | null;
  velocityKmh?: number | null;
  deviceAccounts?: number;
  mediaId?: string | null;
  status?: CheckInStatus;
}

function setup(scenario: Scenario = {}) {
  const capturedAt = new Date(Date.now() - (scenario.captureLagSeconds ?? 60) * 1000);

  const checkIn: Partial<CheckIn> = {
    id: 'check-in-1',
    userId: 'user-1',
    destinationId: 'dest-1',
    capturedAt,
    submittedAt: new Date(),
    accuracyM: String(scenario.accuracyM ?? 12),
    mediaId: scenario.mediaId === undefined ? 'media-1' : scenario.mediaId,
    status: scenario.status ?? CheckInStatus.PENDING,
    deviceFingerprint: 'fp-1',
  };

  const approve = jest.fn().mockResolvedValue({ pointsAwarded: 150 });
  const reject = jest.fn().mockResolvedValue(undefined);
  const routeToReview = jest.fn().mockResolvedValue(undefined);
  const markAuditSample = jest.fn().mockResolvedValue(undefined);

  const checkInsService = {
    approve,
    reject,
    routeToReview,
    markAuditSample,
  } as unknown as CheckInsService;

  const media = {
    processUploaded: jest.fn().mockResolvedValue({
      phash: scenario.phash === undefined ? 'abcdef0123456789' : scenario.phash,
    }),
    findDuplicate: jest.fn().mockResolvedValue(scenario.duplicate ?? null),
  } as unknown as MediaService;

  const dataSource = {
    getRepository: () => ({
      findOne: async () => ({ userId: 'user-1', trustScore: scenario.trustScore ?? 80 }),
    }),
    query: async (sql: string) => {
      if (sql.includes('COUNT(DISTINCT user_id)')) {
        return [{ count: String(scenario.deviceAccounts ?? 1) }];
      }
      if (sql.includes('ST_Distance')) {
        if (scenario.velocityKmh == null) return [];
        // Two hours apart, at whatever speed the scenario asks for.
        return [
          {
            id: 'previous-check-in',
            captured_at: new Date(capturedAt.getTime() - 2 * 3_600_000),
            distance_m: String(scenario.velocityKmh * 2 * 1000),
          },
        ];
      }
      return [];
    },
  } as unknown as DataSource;

  const checkIns = {
    findOne: async () => (checkIn.id ? { ...checkIn, destination: { id: 'dest-1' } } : null),
  } as unknown as Repository<CheckIn>;

  const signals = {
    findOne: async () => ({
      checkInId: 'check-in-1',
      raw: { attestation: scenario.attestation ?? {} },
    }),
  } as unknown as Repository<VerificationSignal>;

  const config = {
    getOrThrow: () => CONFIG,
  } as unknown as ConfigService;

  const service = new VerificationService(
    dataSource,
    config,
    media,
    checkInsService,
    checkIns,
    signals,
  );

  return { service, approve, reject, routeToReview, markAuditSample };
}

describe('VerificationService', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('auto-approval', () => {
    it('approves a clean submission from a trusted user', async () => {
      const { service, approve } = setup({ trustScore: 80 });

      const outcome = await service.verify('check-in-1');

      expect(outcome.decision).toBe('approved');
      expect(outcome.score).toBe(100);
      expect(approve).toHaveBeenCalledWith('check-in-1', { verificationScore: 100 });
    });

    it('sends a clean submission from an untrusted user to a human', async () => {
      const { service, routeToReview, approve } = setup({ trustScore: 40 });

      const outcome = await service.verify('check-in-1');

      expect(outcome.decision).toBe('manual_review');
      expect(outcome.reasons).toContain('trust_score_below_threshold');
      expect(approve).not.toHaveBeenCalled();
      expect(routeToReview).toHaveBeenCalled();
    });

    it('pulls a sample of auto-approvals into the manual queue as an audit', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.01); // below the 0.05 sample rate
      const { service, markAuditSample, approve } = setup({ trustScore: 80 });

      await service.verify('check-in-1');

      expect(markAuditSample).toHaveBeenCalledWith('check-in-1');
      // Still approved: the sample is a later check, not a block on the points.
      expect(approve).toHaveBeenCalled();
    });

    it('does not sample most auto-approvals', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.9);
      const { service, markAuditSample } = setup({ trustScore: 80 });

      await service.verify('check-in-1');

      expect(markAuditSample).not.toHaveBeenCalled();
    });
  });

  describe('hard rejections — proof, not suspicion', () => {
    it('rejects when the device reports a mocked location', async () => {
      const { service, reject } = setup({ attestation: { isMockLocation: true } });

      const outcome = await service.verify('check-in-1');

      expect(outcome.decision).toBe('rejected');
      expect(outcome.rejectionReason).toBe(RejectionReason.MOCK_LOCATION);
      expect(reject).toHaveBeenCalledWith(
        'check-in-1',
        RejectionReason.MOCK_LOCATION,
        expect.stringContaining('mock_location'),
      );
    });

    it('rejects a photo that is effectively the same file as another', async () => {
      const { service, reject } = setup({ duplicate: { mediaId: 'media-old', distance: 1 } });

      const outcome = await service.verify('check-in-1');

      expect(outcome.decision).toBe('rejected');
      expect(outcome.rejectionReason).toBe(RejectionReason.DUPLICATE_PHOTO);
      expect(reject).toHaveBeenCalled();
    });

    it('rejects a check-in with no photo at all', async () => {
      const { service, reject } = setup({ mediaId: null });

      const outcome = await service.verify('check-in-1');

      expect(outcome.decision).toBe('rejected');
      expect(outcome.rejectionReason).toBe(RejectionReason.MEDIA_MISSING);
      expect(reject).toHaveBeenCalled();
    });
  });

  describe('suspicion goes to a human, never to an auto-reject', () => {
    it('reviews a merely similar photo rather than rejecting it', async () => {
      // Two shots of the same carved arch are similar without being the same photo.
      const { service, reject, routeToReview } = setup({
        duplicate: { mediaId: 'media-old', distance: 5 },
      });

      const outcome = await service.verify('check-in-1');

      expect(outcome.decision).toBe('manual_review');
      expect(outcome.reasons).toContain('near_duplicate_photo');
      expect(reject).not.toHaveBeenCalled();
      expect(routeToReview).toHaveBeenCalled();
    });

    it('reviews an impossible-looking journey instead of rejecting a possible flight', async () => {
      const { service, reject, routeToReview } = setup({ velocityKmh: 1400 });

      const outcome = await service.verify('check-in-1');

      expect(outcome.decision).toBe('manual_review');
      expect(outcome.reasons).toContain('impossible_velocity');
      expect(reject).not.toHaveBeenCalled();
      expect(routeToReview).toHaveBeenCalled();
    });

    it('does not flag a plausible road journey', async () => {
      const { service } = setup({ velocityKmh: 70 });

      const outcome = await service.verify('check-in-1');

      expect(outcome.reasons).not.toContain('impossible_velocity');
      expect(outcome.decision).toBe('approved');
    });

    it('reviews a rooted device without rejecting it', async () => {
      const { service, reject, routeToReview } = setup({ attestation: { isRooted: true } });

      const outcome = await service.verify('check-in-1');

      expect(outcome.decision).toBe('manual_review');
      expect(outcome.reasons).toContain('rooted_device');
      expect(reject).not.toHaveBeenCalled();
      expect(routeToReview).toHaveBeenCalled();
    });

    it('reviews an emulator submission', async () => {
      const { service } = setup({ attestation: { isEmulator: true } });

      const outcome = await service.verify('check-in-1');

      expect(outcome.decision).toBe('manual_review');
      expect(outcome.reasons).toContain('emulator');
    });

    it('reviews an unusable GPS fix', async () => {
      const { service } = setup({ accuracyM: 900 });

      const outcome = await service.verify('check-in-1');

      expect(outcome.decision).toBe('manual_review');
      expect(outcome.reasons).toContain('poor_gps_accuracy');
    });

    it('reviews a stale capture', async () => {
      const { service } = setup({ captureLagSeconds: 3600 });

      const outcome = await service.verify('check-in-1');

      expect(outcome.decision).toBe('manual_review');
      expect(outcome.reasons).toContain('stale_capture');
    });

    it('reviews a device shared across many accounts', async () => {
      const { service } = setup({ deviceAccounts: 7 });

      const outcome = await service.verify('check-in-1');

      expect(outcome.decision).toBe('manual_review');
      expect(outcome.reasons).toContain('many_accounts_on_device');
    });
  });

  describe('fails closed', () => {
    it('reviews rather than approves when the perceptual hash cannot be computed', async () => {
      const { service, approve, routeToReview } = setup({ phash: null, trustScore: 95 });

      const outcome = await service.verify('check-in-1');

      expect(outcome.decision).toBe('manual_review');
      expect(outcome.reasons).toContain('phash_unavailable');
      expect(approve).not.toHaveBeenCalled();
      expect(routeToReview).toHaveBeenCalled();
    });

    it('never scores below zero', async () => {
      const { service } = setup({
        attestation: { isEmulator: true, isRooted: true },
        accuracyM: 900,
        captureLagSeconds: 7200,
        velocityKmh: 5000,
        deviceAccounts: 9,
      });

      const outcome = await service.verify('check-in-1');

      expect(outcome.score).toBeGreaterThanOrEqual(0);
      expect(outcome.score).toBeLessThanOrEqual(100);
    });
  });

  describe('idempotence', () => {
    it('skips a check-in a moderator already decided', async () => {
      const { service, approve, reject, routeToReview } = setup({
        status: CheckInStatus.APPROVED,
      });

      const outcome = await service.verify('check-in-1');

      expect(outcome.decision).toBe('skipped');
      expect(outcome.reasons).toContain('already_decided');
      expect(approve).not.toHaveBeenCalled();
      expect(reject).not.toHaveBeenCalled();
      expect(routeToReview).not.toHaveBeenCalled();
    });
  });
});
