import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/auth.decorators';
import { BadgesService } from './badges.service';

@ApiTags('gamification')
@ApiBearerAuth()
@Controller('me/badges')
export class BadgesController {
  constructor(private readonly badges: BadgesService) {}

  @Get()
  @ApiOperation({
    summary: 'The badge wall',
    description:
      'Returns every active badge, earned or not — the locked ones are the ' +
      'roadmap and the client is expected to show them greyed out.',
  })
  list(@CurrentUser('id') userId: string) {
    return this.badges.listForUser(userId);
  }
}
