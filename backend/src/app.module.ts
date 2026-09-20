import { MiddlewareConsumer, Module, NestModule, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE, Reflector } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { configuration } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './modules/redis/redis.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { AuditService } from './modules/audit/audit.service';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuthModule } from './modules/auth/auth.module';
import { GeoModule } from './modules/geo/geo.module';
import { MediaModule } from './modules/media/media.module';
import { DestinationsModule } from './modules/destinations/destinations.module';
import { PointsModule } from './modules/points/points.module';
import { BadgesModule } from './modules/badges/badges.module';
import { ChallengesModule } from './modules/challenges/challenges.module';
import { LeaderboardsModule } from './modules/leaderboards/leaderboards.module';
import { CheckInsModule } from './modules/check-ins/check-ins.module';
import { VerificationModule } from './modules/verification/verification.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { UsersModule } from './modules/users/users.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      cache: true,
    }),

    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('app.logLevel') ?? 'info',
          /** Correlates an audit row, an error response and a log line. */
          genReqId: (request) => (request.headers['x-request-id'] as string) ?? randomUUID(),
          transport:
            config.get<string>('app.env') === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.password',
              'req.body.code',
              'req.body.refreshToken',
              /*
               * Precise coordinates are personal data under the DPDP Act and
               * must not end up in a log aggregator (PRD §11).
               */
              'req.body.lat',
              'req.body.lng',
            ],
            censor: '[redacted]',
          },
          autoLogging: {
            ignore: (request) => request.url === '/v1/health',
          },
        },
      }),
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.getOrThrow<number>('throttle.ttlSeconds') * 1000,
            limit: config.getOrThrow<number>('throttle.limit'),
          },
        ],
      }),
    }),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.getOrThrow<string>('redis.host'),
          port: config.getOrThrow<number>('redis.port'),
          password: config.get<string>('redis.password'),
          db: config.getOrThrow<number>('redis.db'),
        },
        defaultJobOptions: { removeOnComplete: { age: 86_400, count: 1000 } },
      }),
    }),

    DatabaseModule,
    RedisModule,
    AuditModule,

    AuthModule,
    GeoModule,
    MediaModule,
    DestinationsModule,
    PointsModule,
    BadgesModule,
    ChallengesModule,
    LeaderboardsModule,
    CheckInsModule,
    VerificationModule,
    ModerationModule,
    ReviewsModule,
    UsersModule,
    AnalyticsModule,
    HealthModule,
  ],
  providers: [
    /**
     * Authentication is on by default, everywhere. Endpoints opt out with
     * `@Public()` or `@OptionalAuth()`, so a new endpoint that forgets to think
     * about auth fails closed instead of leaking.
     */
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          whitelist: true,
          /** Unknown fields are an error, not silently dropped — the contract is frozen. */
          forbidNonWhitelisted: true,
          transform: true,
          transformOptions: { enableImplicitConversion: false },
        }),
    },

    { provide: APP_FILTER, useClass: AllExceptionsFilter },

    {
      provide: APP_INTERCEPTOR,
      inject: [Reflector, AuditService],
      useFactory: (reflector: Reflector, audit: AuditService) =>
        new AuditInterceptor(reflector, audit),
    },
  ],
})
export class AppModule implements NestModule {
  configure(_consumer: MiddlewareConsumer): void {
    // Helmet and CORS are applied in `main.ts`, before routing.
  }
}
