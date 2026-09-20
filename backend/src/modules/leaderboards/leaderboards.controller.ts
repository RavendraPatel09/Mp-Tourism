import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, OptionalAuth } from 'src/common/decorators/auth.decorators';
import { LeaderboardsService } from './leaderboards.service';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';

@ApiTags('gamification')
@Controller('leaderboards')
export class LeaderboardsController {
  constructor(private readonly leaderboards: LeaderboardsService) {}

  @Get()
  @OptionalAuth()
  @ApiOperation({
    summary: 'Leaderboard page',
    description:
      'Served from Redis sorted sets, never computed from the ledger on request. ' +
      'When authenticated, `me` carries the requester’s own rank even if it falls ' +
      'outside the returned page, so the client can pin it. `source: "snapshot"` ' +
      'means Redis was cold and the durable copy was used.',
  })
  board(@Query() query: LeaderboardQueryDto, @CurrentUser('id') userId?: string) {
    return this.leaderboards.getBoard({
      scope: query.scope,
      scopeId: query.scopeId ?? null,
      period: query.period,
      limit: query.limit,
      offset: query.offset,
      requesterId: userId,
    });
  }
}
