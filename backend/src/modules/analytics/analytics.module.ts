import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

/**
 * Read-only reporting over the same database. No repositories registered — every
 * query here is a hand-written aggregate, because these are the queries that
 * need EXPLAIN attention and an ORM abstraction over them hides the cost.
 */
@Module({
  providers: [AnalyticsService],
  controllers: [AnalyticsController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
