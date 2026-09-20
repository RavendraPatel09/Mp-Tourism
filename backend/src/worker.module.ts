import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { configuration } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './modules/redis/redis.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CheckInsModule } from './modules/check-ins/check-ins.module';
import { LeaderboardsModule } from './modules/leaderboards/leaderboards.module';
import { VerificationModule } from './modules/verification/verification.module';
import { VerificationProcessor } from './modules/verification/verification.processor';
import { JobsService } from './modules/jobs/jobs.service';

/**
 * The worker application. Same code, same database, no HTTP listener.
 *
 * Kept separate from `AppModule` on purpose:
 *  - image decoding and perceptual hashing are CPU-bound and would add latency
 *    to every API request sharing the event loop
 *  - the crons must run exactly once, which is impossible if every API replica
 *    also has them
 *  - the two can be scaled independently: a launch-day traffic spike needs more
 *    API containers, a moderation backlog needs more workers
 */
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
          transport:
            config.get<string>('app.env') === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
        },
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
      }),
    }),

    ScheduleModule.forRoot(),

    DatabaseModule,
    RedisModule,
    AuditModule,
    AuthModule,
    CheckInsModule,
    LeaderboardsModule,
    VerificationModule,
  ],
  providers: [VerificationProcessor, JobsService],
})
export class WorkerModule {}
