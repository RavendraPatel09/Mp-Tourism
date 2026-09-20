import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { Public } from 'src/common/decorators/auth.decorators';
import { REDIS_CLIENT } from '../redis/redis.module';

@ApiTags('ops')
@Controller('health')
@Public()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Liveness only — no dependency checks. A load balancer must not take the
   * process out of rotation because Redis blinked; that is what readiness is for.
   */
  @Get()
  @ApiOperation({ summary: 'Liveness' })
  live() {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness',
    description: 'Checks Postgres and Redis. Used as the deployment gate.',
  })
  ready() {
    return this.health.check([
      () => this.db.pingCheck('postgres', { timeout: 2000 }),
      async () => {
        const started = Date.now();
        const pong = await this.redis.ping();
        return {
          redis: {
            status: pong === 'PONG' ? 'up' : 'down',
            responseTimeMs: Date.now() - started,
          },
        };
      },
      /** PostGIS is a hard dependency — geofencing is the product, not a feature. */
      async () => {
        const rows = await this.dataSource.query<{ version: string }[]>(
          `SELECT PostGIS_Version() AS version`,
        );
        return { postgis: { status: 'up', version: rows[0]?.version ?? 'unknown' } };
      },
    ]);
  }
}
