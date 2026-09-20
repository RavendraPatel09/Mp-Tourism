import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, OptionalAuth, Public } from 'src/common/decorators/auth.decorators';
import { ChallengesService } from './challenges.service';
import { ListChallengesDto } from './dto/challenge.dto';

@ApiTags('gamification')
@Controller('challenges')
export class ChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List challenges' })
  list(@Query() query: ListChallengesDto) {
    return this.challenges.list(query);
  }

  @Get(':idOrSlug')
  @Public()
  @ApiOperation({
    summary: 'Challenge detail',
    description:
      'Includes the participating destinations, except for open-ended discovery ' +
      'challenges ("any 3 Tier-4 sites"), where the list would be the whole catalogue.',
  })
  detail(@Param('idOrSlug') idOrSlug: string) {
    return this.challenges.detail(idOrSlug);
  }

  @Get(':idOrSlug/progress')
  @OptionalAuth()
  @ApiOperation({
    summary: 'The requesting user’s progress',
    description: 'Returns zero progress for a guest rather than failing.',
  })
  progress(@Param('idOrSlug') idOrSlug: string, @CurrentUser('id') userId?: string) {
    return this.challenges.progressFor(idOrSlug, userId ?? '');
  }
}
