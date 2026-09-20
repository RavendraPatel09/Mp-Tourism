import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { RefreshToken, User } from 'src/entities';
import { UnauthorizedException } from 'src/common/exceptions/app-exceptions';
import { UserRole } from 'src/common/constants/roles.enum';

export interface JwtPayload {
  sub: string;
  role: UserRole;
  /** State admins only; the roles guard turns this into a query scope. */
  st: string | null;
  pv: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

interface AuthConfig {
  accessSecret: string;
  accessTtl: string;
  refreshSecret: string;
  refreshTtl: string;
}

export interface TokenContext {
  userAgent?: string | null;
  ip?: string | null;
}

@Injectable()
export class TokenService {
  private readonly config: AuthConfig;

  constructor(
    private readonly jwt: JwtService,
    configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
  ) {
    this.config = configService.getOrThrow<AuthConfig>('auth');
  }

  async issue(user: User, isPhoneVerified: boolean, ctx: TokenContext = {}): Promise<TokenPair> {
    return this.mint(user, isPhoneVerified, randomUUID(), ctx);
  }

  /**
   * Rotating refresh, with reuse detection.
   *
   * Each refresh revokes the presented token and issues a sibling in the same
   * family. Presenting an already-revoked token means the token leaked and is
   * being replayed, so the entire family is revoked and the user has to log in
   * again — noisier than silently issuing a new pair, and the only way to end a
   * session an attacker is also holding.
   */
  async rotate(presented: string, ctx: TokenContext = {}): Promise<TokenPair> {
    const tokenHash = this.hash(presented);
    const existing = await this.refreshTokens.findOne({
      where: { tokenHash },
      relations: { user: true },
    });

    if (!existing) {
      throw new UnauthorizedException('Refresh token is not recognised.', 'refresh_invalid');
    }

    if (existing.revokedAt) {
      await this.revokeFamily(existing.familyId, 'reuse_detected');
      throw new UnauthorizedException(
        'That refresh token was already used. All sessions have been signed out.',
        'refresh_reused',
      );
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token has expired.', 'refresh_expired');
    }

    const user = existing.user;
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Account is no longer active.', 'account_inactive');
    }

    await this.refreshTokens.update(existing.id, {
      revokedAt: new Date(),
      revokedReason: 'rotated',
    });

    const profileVerified = await this.refreshTokens.manager.query<
      { is_phone_verified: boolean }[]
    >(`SELECT is_phone_verified FROM user_profiles WHERE user_id = $1`, [user.id]);

    return this.mint(user, profileVerified[0]?.is_phone_verified ?? false, existing.familyId, ctx);
  }

  async revoke(presented: string): Promise<void> {
    await this.refreshTokens.update(
      { tokenHash: this.hash(presented), revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: 'logout' },
    );
  }

  async revokeAllForUser(userId: string, reason: string): Promise<void> {
    await this.refreshTokens.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: reason },
    );
  }

  /** Housekeeping for the nightly job; expired rows have no forensic value. */
  async pruneExpired(): Promise<number> {
    const result = await this.refreshTokens.delete({ expiresAt: LessThan(new Date()) });
    return result.affected ?? 0;
  }

  private async mint(
    user: User,
    isPhoneVerified: boolean,
    familyId: string,
    ctx: TokenContext,
  ): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      st: user.managedStateId,
      pv: isPhoneVerified,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.accessSecret,
      expiresIn: this.config.accessTtl,
    });

    /*
     * The refresh token is opaque random bytes, not a JWT. There is nothing to
     * read from it and nothing to verify offline — every refresh must hit the
     * database anyway to check revocation, so signing it would buy nothing.
     */
    const refreshToken = randomBytes(48).toString('base64url');
    await this.refreshTokens.insert({
      userId: user.id,
      tokenHash: this.hash(refreshToken),
      familyId,
      expiresAt: new Date(Date.now() + this.ttlMs(this.config.refreshTtl)),
      userAgent: ctx.userAgent?.slice(0, 255) ?? null,
      ip: ctx.ip ?? null,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: Math.floor(this.ttlMs(this.config.accessTtl) / 1000),
      tokenType: 'Bearer',
    };
  }

  private async revokeFamily(familyId: string, reason: string): Promise<void> {
    await this.refreshTokens.update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: reason },
    );
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Accepts the `15m` / `30d` forms used in config. */
  private ttlMs(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl.trim());
    if (!match) throw new Error(`Unsupported TTL format: ${ttl}`);
    const value = Number.parseInt(match[1], 10);
    const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]]!;
    return value * unit;
  }
}
