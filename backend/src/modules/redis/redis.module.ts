import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
}

/**
 * One shared connection for caching, OTP storage and leaderboard sorted sets.
 * BullMQ gets its own connections (it needs blocking commands, which would
 * starve everything else sharing a client).
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redis = config.getOrThrow<RedisConfig>('redis');
        return new Redis({
          host: redis.host,
          port: redis.port,
          password: redis.password,
          db: redis.db,
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          /** Redis being down must degrade features, not take the API down. */
          lazyConnect: false,
          retryStrategy: (attempt) => Math.min(attempt * 200, 3000),
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(private readonly moduleRef: ModuleRef) {}

  async onApplicationShutdown(): Promise<void> {
    const client = this.moduleRef.get<Redis>(REDIS_CLIENT, { strict: false });
    await client?.quit().catch(() => undefined);
  }
}
