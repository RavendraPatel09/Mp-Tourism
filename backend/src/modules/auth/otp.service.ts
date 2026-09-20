import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  TooManyRequestsException,
} from 'src/common/exceptions/app-exceptions';
import { createHash, randomInt } from 'node:crypto';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

interface OtpConfig {
  otpTtlSeconds: number;
  otpMaxAttempts: number;
  otpResendCooldownSeconds: number;
  otpProvider: 'dev' | 'msg91';
  msg91AuthKey: string;
  msg91TemplateId: string;
}

export interface OtpSendResult {
  /** Seconds until another send is allowed. */
  retryAfterSeconds: number;
  expiresInSeconds: number;
  /** Only populated when OTP_PROVIDER=dev, so the app team can test without SMS. */
  devCode?: string;
}

/**
 * OTP lives in Redis, never in Postgres: it is short-lived, high-write, and
 * must disappear on expiry rather than sit around as a credential. Only the
 * hash is stored, so a Redis dump does not hand over live codes.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly config: OtpConfig;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    configService: ConfigService,
  ) {
    this.config = configService.getOrThrow<OtpConfig>('auth');
  }

  async send(phone: string): Promise<OtpSendResult> {
    const cooldownKey = this.cooldownKey(phone);
    const remaining = await this.redis.ttl(cooldownKey);
    if (remaining > 0) {
      throw new TooManyRequestsException(
        `Another code can be requested in ${remaining}s.`,
        'otp_cooldown',
      );
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.redis
      .multi()
      .set(this.codeKey(phone), this.hash(phone, code), 'EX', this.config.otpTtlSeconds)
      .set(this.attemptsKey(phone), '0', 'EX', this.config.otpTtlSeconds)
      .set(cooldownKey, '1', 'EX', this.config.otpResendCooldownSeconds)
      .exec();

    await this.deliver(phone, code);

    return {
      retryAfterSeconds: this.config.otpResendCooldownSeconds,
      expiresInSeconds: this.config.otpTtlSeconds,
      devCode: this.config.otpProvider === 'dev' ? code : undefined,
    };
  }

  /**
   * Consumes the code on success so it cannot be replayed. Attempts are counted
   * against the code, not the phone, so a fresh send resets the budget but a
   * brute-force against one code cannot outrun `otpMaxAttempts`.
   */
  async verify(phone: string, code: string): Promise<void> {
    const stored = await this.redis.get(this.codeKey(phone));
    if (!stored) {
      throw new BadRequestException('That code has expired. Request a new one.', 'otp_expired');
    }

    const attempts = await this.redis.incr(this.attemptsKey(phone));
    if (attempts > this.config.otpMaxAttempts) {
      await this.redis.del(this.codeKey(phone), this.attemptsKey(phone));
      throw new TooManyRequestsException(
        'Too many incorrect attempts. Request a new code.',
        'otp_attempts_exhausted',
      );
    }

    if (stored !== this.hash(phone, code)) {
      throw new BadRequestException('That code is not correct.', 'otp_invalid');
    }

    await this.redis.del(this.codeKey(phone), this.attemptsKey(phone));
  }

  private async deliver(phone: string, code: string): Promise<void> {
    if (this.config.otpProvider === 'dev') {
      this.logger.warn(`[dev] OTP for ${this.maskPhone(phone)} is ${code}`);
      return;
    }

    /*
     * MSG91 is the intended DLT-registered sender for India. Left unimplemented
     * on purpose until the template is approved — failing loudly beats silently
     * "sending" nothing in staging.
     */
    throw new Error(
      `OTP provider "${this.config.otpProvider}" is configured but not implemented. ` +
        'Add the MSG91 transactional-SMS call before enabling it.',
    );
  }

  /** Salted with the phone number so the same code for two users differs at rest. */
  private hash(phone: string, code: string): string {
    return createHash('sha256').update(`${phone}:${code}`).digest('hex');
  }

  private maskPhone(phone: string): string {
    return phone.replace(/\d(?=\d{2})/g, '*');
  }

  private codeKey = (phone: string) => `otp:code:${phone}`;
  private attemptsKey = (phone: string) => `otp:attempts:${phone}`;
  private cooldownKey = (phone: string) => `otp:cooldown:${phone}`;
}
