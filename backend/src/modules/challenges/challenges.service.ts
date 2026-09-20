import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  Challenge,
  ChallengeCriteria,
  ChallengeProgress,
  ChallengeProgressState,
  Destination,
} from 'src/entities';
import { ChallengeStatus } from 'src/common/constants/enums';
import { PointsReason, PointsRefType } from 'src/common/constants/points';
import { NotFoundException } from 'src/common/exceptions/app-exceptions';
import { PointsService } from '../points/points.service';
import { ListChallengesDto } from './dto/challenge.dto';

export interface ChallengeCompletion {
  challengeId: string;
  title: string;
  rewardPoints: number;
  pointsApplied: boolean;
}

export interface ChallengeAdvance {
  updated: { challengeId: string; completed: number; required: number }[];
  completed: ChallengeCompletion[];
  /** Highest multiplier among the challenges this check-in participates in. */
  multiplier: number;
}

@Injectable()
export class ChallengesService {
  private readonly logger = new Logger(ChallengesService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly points: PointsService,
    @InjectRepository(Challenge) private readonly challenges: Repository<Challenge>,
    @InjectRepository(ChallengeProgress) private readonly progress: Repository<ChallengeProgress>,
    @InjectRepository(Destination) private readonly destinations: Repository<Destination>,
  ) {}

  async list(query: ListChallengesDto) {
    const qb = this.challenges
      .createQueryBuilder('challenge')
      .where('challenge.status != :draft', { draft: ChallengeStatus.DRAFT })
      .orderBy('challenge.ends_at', 'ASC');

    if (query.active) {
      qb.andWhere('challenge.status = :active', { active: ChallengeStatus.ACTIVE })
        .andWhere('challenge.starts_at <= now()')
        .andWhere('challenge.ends_at > now()');
    }
    if (query.scope) qb.andWhere('challenge.scope = :scope', { scope: query.scope });
    if (query.stateId) {
      // National challenges are relevant to every state, so they always match.
      qb.andWhere(`(challenge.state_id = :stateId OR challenge.scope = 'national')`, {
        stateId: query.stateId,
      });
    }

    return qb.take(50).getMany();
  }

  async detail(idOrSlug: string) {
    const challenge = await this.findChallenge(idOrSlug);
    const destinations = await this.participatingDestinations(challenge);

    return {
      ...challenge,
      destinations: destinations.map((destination) => ({
        id: destination.id,
        slug: destination.slug,
        name: destination.name,
        tier: destination.tier,
      })),
    };
  }

  async progressFor(idOrSlug: string, userId: string) {
    const challenge = await this.findChallenge(idOrSlug);
    const row = await this.progress.findOne({
      where: { challengeId: challenge.id, userId },
    });

    const required = await this.requiredCount(challenge.criteria);
    const state: ChallengeProgressState = row?.progress ?? { visited: [], required, completed: 0 };

    return {
      challengeId: challenge.id,
      title: challenge.title,
      required,
      completed: state.completed,
      visitedDestinationIds: state.visited,
      completedAt: row?.completedAt ?? null,
      pointsAwarded: row?.pointsAwarded ?? 0,
      endsAt: challenge.endsAt,
      multiplier: Number.parseFloat(challenge.multiplier),
    };
  }

  /**
   * Multiplier lookup for the points engine, resolved before the award is
   * computed. Returns the single highest active multiplier rather than a product
   * of them: two overlapping 2× campaigns should not silently become 4×, which
   * is the kind of thing that only shows up as an unexplainable leaderboard.
   */
  async activeMultiplierFor(destinationId: string, at: Date): Promise<number> {
    const rows = await this.dataSource.query<{ multiplier: string }[]>(
      `
      SELECT c.multiplier
        FROM challenges c
       WHERE c.status = 'active'
         AND c.starts_at <= $2 AND c.ends_at > $2
         AND (
           (c.criteria ->> 'kind' = 'visit_set'
             AND c.criteria -> 'destination_ids' ? $1)
           OR (c.criteria ->> 'kind' = 'tier_count'
             AND EXISTS (SELECT 1 FROM destinations d
                          WHERE d.id = $1::uuid
                            AND d.tier >= (c.criteria ->> 'min_tier')::int))
           OR (c.criteria ->> 'kind' = 'circuit'
             AND EXISTS (SELECT 1 FROM circuit_destinations cd
                          WHERE cd.destination_id = $1::uuid
                            AND cd.circuit_id = (c.criteria ->> 'circuit_id')::uuid))
           OR (c.criteria ->> 'kind' = 'category_count'
             AND EXISTS (SELECT 1 FROM destination_categories dc
                          JOIN categories cat ON cat.id = dc.category_id
                         WHERE dc.destination_id = $1::uuid
                           AND cat.slug = c.criteria ->> 'category_slug'))
         )
       ORDER BY c.multiplier DESC
       LIMIT 1
      `,
      [destinationId, at],
    );

    return rows.length ? Number.parseFloat(rows[0].multiplier) : 1;
  }

  /**
   * Advances every challenge this approved check-in counts toward, and pays out
   * any that just completed.
   *
   * Progress is stored as the set of destinations visited, not as a counter, so
   * re-running this for the same check-in cannot inflate it — a repeat visit to
   * the same destination is already in the set. That is what makes the whole
   * path safe to retry.
   */
  async advanceForCheckIn(params: {
    userId: string;
    destinationId: string;
    capturedAt: Date;
    stateId: string;
    districtId: string | null;
  }): Promise<ChallengeAdvance> {
    const active = await this.challenges
      .createQueryBuilder('challenge')
      .where('challenge.status = :active', { active: ChallengeStatus.ACTIVE })
      .andWhere('challenge.starts_at <= :at', { at: params.capturedAt })
      .andWhere('challenge.ends_at > :at', { at: params.capturedAt })
      .andWhere(`(challenge.state_id = :stateId OR challenge.scope = 'national')`, {
        stateId: params.stateId,
      })
      .getMany();

    const advance: ChallengeAdvance = { updated: [], completed: [], multiplier: 1 };

    for (const challenge of active) {
      const participating = await this.destinationParticipates(challenge, params.destinationId);
      if (!participating) continue;

      advance.multiplier = Math.max(advance.multiplier, Number.parseFloat(challenge.multiplier));

      const outcome = await this.dataSource.transaction((manager) =>
        this.advanceOne(manager, challenge, params),
      );

      advance.updated.push({
        challengeId: challenge.id,
        completed: outcome.completed,
        required: outcome.required,
      });
      if (outcome.completion) advance.completed.push(outcome.completion);
    }

    return advance;
  }

  private async advanceOne(
    manager: EntityManager,
    challenge: Challenge,
    params: { userId: string; destinationId: string; stateId: string; districtId: string | null },
  ): Promise<{ completed: number; required: number; completion: ChallengeCompletion | null }> {
    const required = await this.requiredCount(challenge.criteria);

    // Lock the user's row for this challenge so two check-ins cannot both complete it.
    let row = await manager
      .createQueryBuilder(ChallengeProgress, 'progress')
      .setLock('pessimistic_write')
      .where('progress.user_id = :userId AND progress.challenge_id = :challengeId', {
        userId: params.userId,
        challengeId: challenge.id,
      })
      .getOne();

    if (!row) {
      await manager.query(
        `
        INSERT INTO challenge_progress (user_id, challenge_id, progress)
        VALUES ($1, $2, $3::jsonb)
        ON CONFLICT (user_id, challenge_id) DO NOTHING
        `,
        [
          params.userId,
          challenge.id,
          JSON.stringify({ visited: [], required, completed: 0 } satisfies ChallengeProgressState),
        ],
      );
      row = await manager
        .createQueryBuilder(ChallengeProgress, 'progress')
        .setLock('pessimistic_write')
        .where('progress.user_id = :userId AND progress.challenge_id = :challengeId', {
          userId: params.userId,
          challengeId: challenge.id,
        })
        .getOneOrFail();
    }

    const visited = new Set(row.progress?.visited ?? []);
    visited.add(params.destinationId);

    const state: ChallengeProgressState = {
      visited: [...visited],
      required,
      completed: visited.size,
    };

    const justCompleted = !row.completedAt && state.completed >= required;
    await manager.update(
      ChallengeProgress,
      { id: row.id },
      {
        progress: state,
        completedAt: justCompleted ? new Date() : row.completedAt,
        updatedAt: new Date(),
      },
    );

    if (!justCompleted) {
      return { completed: state.completed, required, completion: null };
    }

    /*
     * The reward is paid inside this transaction, keyed on the challenge id, so
     * the ledger's unique index is what guarantees a challenge pays out once —
     * even if two final check-ins arrive at the same moment.
     */
    const award = await this.points.award(
      {
        userId: params.userId,
        delta: challenge.rewardPoints,
        reason: PointsReason.CHALLENGE_COMPLETED,
        refType: PointsRefType.CHALLENGE,
        refId: challenge.id,
        stateId: params.stateId,
        districtId: params.districtId,
        note: `Completed challenge: ${challenge.title}`,
      },
      manager,
    );

    if (award.applied) {
      await manager.update(
        ChallengeProgress,
        { id: row.id },
        { pointsAwarded: challenge.rewardPoints },
      );
      this.logger.log(
        `User ${params.userId} completed challenge "${challenge.title}" (+${challenge.rewardPoints})`,
      );
    }

    return {
      completed: state.completed,
      required,
      completion: {
        challengeId: challenge.id,
        title: challenge.title,
        rewardPoints: challenge.rewardPoints,
        pointsApplied: award.applied,
      },
    };
  }

  private async destinationParticipates(
    challenge: Challenge,
    destinationId: string,
  ): Promise<boolean> {
    const criteria = challenge.criteria;
    switch (criteria.kind) {
      case 'visit_set':
        return criteria.destination_ids.includes(destinationId);

      case 'tier_count': {
        const destination = await this.destinations.findOne({
          where: { id: destinationId },
          select: { id: true, tier: true },
        });
        return (destination?.tier ?? 0) >= criteria.min_tier;
      }

      case 'circuit': {
        const rows = await this.dataSource.query<{ exists: boolean }[]>(
          `SELECT true AS exists FROM circuit_destinations
            WHERE circuit_id = $1 AND destination_id = $2 LIMIT 1`,
          [criteria.circuit_id, destinationId],
        );
        return rows.length > 0;
      }

      case 'category_count': {
        const rows = await this.dataSource.query<{ exists: boolean }[]>(
          `SELECT true AS exists FROM destination_categories dc
             JOIN categories c ON c.id = dc.category_id
            WHERE dc.destination_id = $1 AND c.slug = $2 LIMIT 1`,
          [destinationId, criteria.category_slug],
        );
        return rows.length > 0;
      }

      default:
        return false;
    }
  }

  private async participatingDestinations(challenge: Challenge): Promise<Destination[]> {
    const criteria = challenge.criteria;
    switch (criteria.kind) {
      case 'visit_set':
        return criteria.destination_ids.length
          ? this.destinations
              .createQueryBuilder('d')
              .where('d.id = ANY(:ids)', { ids: criteria.destination_ids })
              .getMany()
          : [];

      case 'circuit':
        return this.destinations
          .createQueryBuilder('d')
          .innerJoin('circuit_destinations', 'cd', 'cd.destination_id = d.id')
          .where('cd.circuit_id = :circuitId', { circuitId: criteria.circuit_id })
          .orderBy('cd.order_index', 'ASC')
          .getMany();

      case 'category_count':
        return this.destinations
          .createQueryBuilder('d')
          .innerJoin('destination_categories', 'dc', 'dc.destination_id = d.id')
          .innerJoin('categories', 'c', 'c.id = dc.category_id')
          .where('c.slug = :slug', { slug: criteria.category_slug })
          .andWhere(challenge.stateId ? 'd.state_id = :stateId' : 'true', {
            stateId: challenge.stateId,
          })
          .limit(200)
          .getMany();

      case 'tier_count':
        /*
         * Open-ended by design: a discovery challenge ("3 Tier-4 destinations
         * this month") has no fixed list, and enumerating every qualifying site
         * would turn the challenge card into a 400-item list.
         */
        return [];

      default:
        return [];
    }
  }

  /**
   * How many destinations the user has to reach. A circuit challenge has no
   * `required` field of its own — it means "every stop", so the number comes
   * from the circuit. Returning 0 here would mark the challenge complete on the
   * first check-in, which is why this is async rather than a lookup table.
   */
  private async requiredCount(criteria: ChallengeCriteria): Promise<number> {
    switch (criteria.kind) {
      case 'visit_set':
      case 'tier_count':
      case 'category_count':
        return criteria.required;

      case 'circuit': {
        const rows = await this.dataSource.query<{ count: string }[]>(
          `SELECT COUNT(*) AS count FROM circuit_destinations WHERE circuit_id = $1`,
          [criteria.circuit_id],
        );
        const stops = Number.parseInt(rows[0]?.count ?? '0', 10);
        // A circuit with no stops must never auto-complete.
        return stops > 0 ? stops : Number.MAX_SAFE_INTEGER;
      }

      default:
        return Number.MAX_SAFE_INTEGER;
    }
  }

  private async findChallenge(idOrSlug: string): Promise<Challenge> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const challenge = await this.challenges.findOne({
      where: isUuid ? { id: idOrSlug } : { slug: idOrSlug },
    });
    if (!challenge) throw new NotFoundException('No such challenge.');
    return challenge;
  }
}
