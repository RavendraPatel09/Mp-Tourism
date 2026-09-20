import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User, UserProfile } from 'src/entities';
import { levelForPoints } from 'src/common/constants/points';
import { ConflictException, NotFoundException } from 'src/common/exceptions/app-exceptions';
import { MediaService } from '../media/media.service';
import { LeaderboardsService } from '../leaderboards/leaderboards.service';
import { UpdateProfileDto } from './dto/user.dto';

export interface StateProgress {
  stateCode: string;
  stateName: string;
  destinationsVisited: number;
  destinationsPublished: number;
  /** 0–1. Drives the India map that fills in as you travel. */
  completion: number;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly media: MediaService,
    private readonly leaderboards: LeaderboardsService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserProfile) private readonly profiles: Repository<UserProfile>,
  ) {}

  async myProfile(userId: string) {
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('No profile for that user.');

    const user = await this.users.findOne({ where: { id: userId } });
    const level = levelForPoints(profile.totalPoints);

    const [stats, stateProgress] = await Promise.all([
      this.stats(userId),
      this.stateProgress(userId),
    ]);

    return {
      userId,
      username: profile.username,
      displayName: profile.displayName,
      bio: profile.bio,
      avatarUrl: profile.avatarMediaId
        ? await this.media.publicUrlForId(profile.avatarMediaId)
        : null,
      homeStateId: profile.homeStateId,
      level: level.level,
      levelName: level.name,
      totalPoints: profile.totalPoints,
      trustScore: profile.trustScore,
      isPhoneVerified: profile.isPhoneVerified,
      hideFromLeaderboards: profile.hideFromLeaderboards,
      phone: user?.phone ?? null,
      email: user?.email ?? null,
      role: user?.role,
      status: user?.status,
      stats,
      stateProgress,
    };
  }

  /**
   * The public profile. PRD §11 is explicit that this must never expose raw
   * coordinates or minute-level timestamps — so it returns destinations visited
   * and nothing about when or exactly where. A profile hidden from leaderboards
   * is still viewable by username; opting out of ranking is not opting out of
   * having a profile.
   */
  async publicProfile(username: string) {
    const profile = await this.profiles.findOne({ where: { username } });
    if (!profile) throw new NotFoundException('No such user.');

    const user = await this.users.findOne({ where: { id: profile.userId } });
    if (!user || user.deletedAt) throw new NotFoundException('No such user.');

    // Under-18 accounts get restricted profiles (PRD §11).
    if (user.isMinor) {
      return {
        username: profile.username,
        displayName: profile.displayName,
        level: profile.level,
        isRestricted: true,
      };
    }

    const level = levelForPoints(profile.totalPoints);
    const [stats, stateProgress, badges] = await Promise.all([
      this.stats(profile.userId),
      this.stateProgress(profile.userId),
      this.dataSource.query<{ code: string; name: string; icon: string | null; earned_at: Date }[]>(
        `
        SELECT b.code, b.name, b.icon, ub.earned_at
          FROM user_badges ub
          JOIN badges b ON b.id = ub.badge_id
         WHERE ub.user_id = $1
         ORDER BY ub.earned_at DESC
        `,
        [profile.userId],
      ),
    ]);

    return {
      username: profile.username,
      displayName: profile.displayName,
      bio: profile.bio,
      avatarUrl: profile.avatarMediaId
        ? await this.media.publicUrlForId(profile.avatarMediaId)
        : null,
      level: level.level,
      levelName: level.name,
      totalPoints: profile.totalPoints,
      memberSince: profile.createdAt,
      stats,
      stateProgress,
      badges,
      isRestricted: false,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.username) {
      const taken = await this.profiles.findOne({ where: { username: dto.username } });
      if (taken && taken.userId !== userId) {
        throw new ConflictException('That username is taken.', 'username_taken');
      }
    }

    await this.profiles.update(
      { userId },
      {
        ...(dto.username ? { username: dto.username } : {}),
        ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
        ...(dto.homeStateId !== undefined ? { homeStateId: dto.homeStateId } : {}),
        ...(dto.avatarMediaId !== undefined ? { avatarMediaId: dto.avatarMediaId } : {}),
        ...(dto.pushToken !== undefined ? { pushToken: dto.pushToken } : {}),
        ...(dto.hideFromLeaderboards !== undefined
          ? { hideFromLeaderboards: dto.hideFromLeaderboards }
          : {}),
      },
    );

    /*
     * Opting out has to take effect on the live boards immediately, not at the
     * next nightly rebuild — it is a privacy control, and a privacy control
     * that applies tomorrow is not one.
     */
    if (dto.hideFromLeaderboards === true) {
      await this.leaderboards.exclude(userId);
    } else if (dto.hideFromLeaderboards === false) {
      await this.leaderboards.include(userId);
    }

    return this.myProfile(userId);
  }

  /**
   * Account deletion under the DPDP Act (PRD §11): 30 days, and the check-in
   * history is anonymised rather than erased. Footfall counts a district has
   * already reported to a tourism board cannot retroactively change because one
   * user left, and the row no longer identifies anybody once it is detached.
   */
  async requestDeletion(userId: string) {
    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        User,
        { id: userId },
        {
          deletedAt: new Date(),
          phone: null,
          email: null,
          passwordHash: null,
          oauthProvider: null,
          oauthSubject: null,
        },
      );
      await manager.update(
        UserProfile,
        { userId },
        {
          username: `deleted_${userId.replace(/-/g, '').slice(0, 12)}`,
          displayName: null,
          bio: null,
          avatarMediaId: null,
          pushToken: null,
          hideFromLeaderboards: true,
        },
      );
      await manager.query(
        `UPDATE refresh_tokens SET revoked_at = now(), revoked_reason = 'account_deleted'
          WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId],
      );
    });

    await this.leaderboards.exclude(userId);

    return {
      status: 'scheduled',
      message: 'Your account is closed. Remaining personal data is purged within 30 days.',
    };
  }

  private async stats(userId: string) {
    const rows = await this.dataSource.query<
      {
        approved: string;
        pending: string;
        distinct_destinations: string;
        distinct_states: string;
        tier34: string;
        reviews: string;
      }[]
    >(
      `
      SELECT
        COUNT(*) FILTER (WHERE c.status = 'approved')                  AS approved,
        COUNT(*) FILTER (WHERE c.status = 'pending')                   AS pending,
        COUNT(DISTINCT c.destination_id) FILTER (WHERE c.status = 'approved')
                                                                       AS distinct_destinations,
        COUNT(DISTINCT d.state_id) FILTER (WHERE c.status = 'approved') AS distinct_states,
        COUNT(*) FILTER (WHERE c.status = 'approved' AND d.tier >= 3)  AS tier34,
        (SELECT COUNT(*) FROM reviews r WHERE r.user_id = $1 AND r.status = 'published') AS reviews
        FROM check_ins c
        JOIN destinations d ON d.id = c.destination_id
       WHERE c.user_id = $1
      `,
      [userId],
    );

    const row = rows[0];
    const approved = Number.parseInt(row?.approved ?? '0', 10);
    const tier34 = Number.parseInt(row?.tier34 ?? '0', 10);

    return {
      approvedCheckIns: approved,
      pendingCheckIns: Number.parseInt(row?.pending ?? '0', 10),
      destinationsVisited: Number.parseInt(row?.distinct_destinations ?? '0', 10),
      statesVisited: Number.parseInt(row?.distinct_states ?? '0', 10),
      /** The user-facing mirror of the platform's headline KPI. */
      offbeatShare: approved ? Number((tier34 / approved).toFixed(2)) : 0,
      reviewsWritten: Number.parseInt(row?.reviews ?? '0', 10),
    };
  }

  /** Backs the India map on the profile — the retention artifact (PRD F17). */
  private async stateProgress(userId: string): Promise<StateProgress[]> {
    const rows = await this.dataSource.query<
      { code: string; name: string; visited: string; published: string }[]
    >(
      `
      SELECT s.code, s.name,
             COUNT(DISTINCT c.destination_id) FILTER (WHERE c.status = 'approved') AS visited,
             COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'published')            AS published
        FROM states s
        LEFT JOIN destinations d ON d.state_id = s.id
        LEFT JOIN check_ins c ON c.destination_id = d.id AND c.user_id = $1
       WHERE s.is_live = true
       GROUP BY s.code, s.name
       ORDER BY s.name
      `,
      [userId],
    );

    return rows.map((row) => {
      const visited = Number.parseInt(row.visited, 10);
      const published = Number.parseInt(row.published, 10);
      return {
        stateCode: row.code,
        stateName: row.name,
        destinationsVisited: visited,
        destinationsPublished: published,
        completion: published ? Number((visited / published).toFixed(3)) : 0,
      };
    });
  }
}
