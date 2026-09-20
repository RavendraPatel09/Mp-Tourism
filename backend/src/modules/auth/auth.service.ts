import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Device, SavedList, User, UserProfile } from 'src/entities';
import { UserRole, UserStatus } from 'src/common/constants/roles.enum';
import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  UnprocessableException,
} from 'src/common/exceptions/app-exceptions';
import { OtpService, OtpSendResult } from './otp.service';
import { TokenContext, TokenPair, TokenService } from './token.service';
import { PasswordService } from './password.service';
import { LoginDto, RegisterDto, VerifyOtpDto } from './dto/auth.dto';

export interface AuthSession extends TokenPair {
  user: {
    id: string;
    role: UserRole;
    username: string | null;
    isPhoneVerified: boolean;
    isNew: boolean;
  };
}

/** A device fingerprint seen on more accounts than this is almost always farming. */
const MAX_ACCOUNTS_PER_DEVICE = 3;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly passwords: PasswordService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserProfile) private readonly profiles: Repository<UserProfile>,
    @InjectRepository(Device) private readonly devices: Repository<Device>,
  ) {}

  sendOtp(phone: string): Promise<OtpSendResult> {
    return this.otp.send(phone);
  }

  /**
   * Verify-and-enter. A phone number that has never been seen becomes an account
   * here rather than in a separate register call, because the app's onboarding
   * has no reason to distinguish the two — the client only needs to know whether
   * to ask for a username next (`user.isNew`).
   */
  async verifyOtp(dto: VerifyOtpDto, ctx: TokenContext): Promise<AuthSession> {
    await this.otp.verify(dto.phone, dto.code);

    let isNew = false;
    let user = await this.users.findOne({ where: { phone: dto.phone } });

    if (user) {
      this.assertNotBanned(user);
    } else {
      isNew = true;
      user = await this.createPhoneUser(dto.phone);
    }

    // Phone verification is the whole point of the OTP; record it once.
    await this.profiles.update({ userId: user.id }, { isPhoneVerified: true });
    await this.users.update(user.id, { lastLoginAt: new Date() });

    if (dto.deviceFingerprint) {
      await this.registerDevice(user.id, dto);
    }

    const profile = await this.profiles.findOne({ where: { userId: user.id } });
    const pair = await this.tokens.issue(user, true, ctx);

    return {
      ...pair,
      user: {
        id: user.id,
        role: user.role,
        username: profile?.username ?? null,
        isPhoneVerified: true,
        isNew,
      },
    };
  }

  /**
   * Email/password registration, for admin and dashboard accounts. Explorers
   * come in through OTP; this path exists so Member C's admin login does not
   * depend on SMS delivery.
   */
  async register(dto: RegisterDto, ctx: TokenContext): Promise<AuthSession> {
    if (!dto.phone && !dto.email) {
      throw new UnprocessableException('Provide a phone number or an email address.');
    }
    if (dto.email && !dto.password) {
      throw new UnprocessableException('A password is required when registering with email.');
    }

    const created = await this.dataSource.transaction(async (manager) => {
      const existing = await manager.getRepository(User).findOne({
        where: [
          ...(dto.phone ? [{ phone: dto.phone }] : []),
          ...(dto.email ? [{ email: dto.email }] : []),
        ],
      });
      if (existing) {
        throw new ConflictException(
          'An account already exists for those details.',
          'account_exists',
        );
      }

      const takenUsername = await manager
        .getRepository(UserProfile)
        .findOne({ where: { username: dto.username } });
      if (takenUsername) {
        throw new ConflictException('That username is taken.', 'username_taken');
      }

      const user = await manager.getRepository(User).save(
        manager.getRepository(User).create({
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          passwordHash: dto.password ? await this.passwords.hash(dto.password) : null,
          role: UserRole.EXPLORER,
          status: UserStatus.ACTIVE,
        }),
      );

      await manager.getRepository(UserProfile).insert({
        userId: user.id,
        username: dto.username,
        displayName: dto.displayName ?? null,
      });

      await manager
        .getRepository(SavedList)
        .insert({ userId: user.id, name: 'Want to visit', isDefault: true });

      return user;
    });

    const pair = await this.tokens.issue(created, false, ctx);
    return {
      ...pair,
      user: {
        id: created.id,
        role: created.role,
        username: dto.username,
        isPhoneVerified: false,
        isNew: true,
      },
    };
  }

  async login(dto: LoginDto, ctx: TokenContext): Promise<AuthSession> {
    const user = await this.users.findOne({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        managedStateId: true,
        passwordHash: true,
        deletedAt: true,
      },
    });

    /*
     * Same error and roughly the same work whether the account exists or not,
     * so the endpoint cannot be used to enumerate registered email addresses.
     */
    const hash = user?.passwordHash ?? (await this.dummyHash());
    const ok = await this.passwords.verify(dto.password, hash);

    if (!user || !user.passwordHash || !ok || user.deletedAt) {
      throw new UnauthorizedException('Those credentials are not correct.', 'credentials_invalid');
    }
    this.assertNotBanned(user);

    await this.users.update(user.id, { lastLoginAt: new Date() });
    const profile = await this.profiles.findOne({ where: { userId: user.id } });
    const pair = await this.tokens.issue(user, profile?.isPhoneVerified ?? false, ctx);

    return {
      ...pair,
      user: {
        id: user.id,
        role: user.role,
        username: profile?.username ?? null,
        isPhoneVerified: profile?.isPhoneVerified ?? false,
        isNew: false,
      },
    };
  }

  refresh(refreshToken: string, ctx: TokenContext): Promise<TokenPair> {
    return this.tokens.rotate(refreshToken, ctx);
  }

  logout(refreshToken: string): Promise<void> {
    return this.tokens.revoke(refreshToken);
  }

  async isUsernameAvailable(username: string): Promise<boolean> {
    const count = await this.profiles.count({ where: { username } });
    return count === 0;
  }

  private async createPhoneUser(phone: string): Promise<User> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager
        .getRepository(User)
        .save(manager.getRepository(User).create({ phone, role: UserRole.EXPLORER }));

      /*
       * A placeholder username keeps the NOT NULL + UNIQUE contract while the
       * app collects a real one during onboarding. The `explorer_` prefix is
       * reserved so a user cannot claim someone else's placeholder.
       */
      await manager.getRepository(UserProfile).insert({
        userId: user.id,
        username: `explorer_${user.id.replace(/-/g, '').slice(0, 12)}`,
        isPhoneVerified: true,
      });

      await manager
        .getRepository(SavedList)
        .insert({ userId: user.id, name: 'Want to visit', isDefault: true });

      return user;
    });
  }

  /**
   * PRD §5.3 F19 — device-to-account limits. Recorded rather than blocked at
   * signup: a shared family phone is legitimate, so the signal belongs in the
   * moderation console next to the check-in, not in a hard signup rejection.
   */
  private async registerDevice(userId: string, dto: VerifyOtpDto): Promise<void> {
    const fingerprint = dto.deviceFingerprint!;
    await this.devices
      .createQueryBuilder()
      .insert()
      .values({
        userId,
        fingerprint,
        platform: dto.platform ?? null,
        osVersion: dto.osVersion ?? null,
        isRooted: dto.isRooted ?? false,
        isEmulator: dto.isEmulator ?? false,
        lastSeenAt: new Date(),
      })
      .orUpdate(
        ['platform', 'os_version', 'is_rooted', 'is_emulator', 'last_seen_at'],
        ['user_id', 'fingerprint'],
      )
      .execute();

    const accounts = await this.devices
      .createQueryBuilder('device')
      .select('COUNT(DISTINCT device.user_id)', 'count')
      .where('device.fingerprint = :fingerprint', { fingerprint })
      .getRawOne<{ count: string }>();

    const distinctAccounts = Number.parseInt(accounts?.count ?? '0', 10);
    if (distinctAccounts > MAX_ACCOUNTS_PER_DEVICE) {
      this.logger.warn(
        `Device ${fingerprint.slice(0, 12)}… is now linked to ${distinctAccounts} accounts ` +
          `(limit ${MAX_ACCOUNTS_PER_DEVICE}). Check-ins from it will be routed to manual review.`,
      );
    }
  }

  private assertNotBanned(user: Pick<User, 'status'>): void {
    if (user.status === UserStatus.BANNED) {
      throw new ForbiddenException('This account has been banned.', 'account_banned');
    }
  }

  /** Burn the same CPU on a missing account as on a real one. */
  private dummyHash(): Promise<string> {
    return this.passwords.hash('not-a-real-password');
  }
}
