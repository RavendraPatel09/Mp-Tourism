import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_ENTITIES } from 'src/entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const db = config.getOrThrow<{
          host: string;
          port: number;
          username: string;
          password: string;
          database: string;
          ssl: boolean;
          logging: boolean;
        }>('database');

        return {
          type: 'postgres' as const,
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.database,
          ssl: db.ssl ? { rejectUnauthorized: false } : false,
          entities: ALL_ENTITIES,
          synchronize: false,
          logging: db.logging ? (['query', 'error'] as const) : (['error'] as const),
          /** Keep a headroom pool; the verification worker uses its own. */
          poolSize: 20,
          extra: {
            statement_timeout: 10_000,
            idle_in_transaction_session_timeout: 15_000,
          },
        };
      },
    }),
  ],
})
export class DatabaseModule {}
