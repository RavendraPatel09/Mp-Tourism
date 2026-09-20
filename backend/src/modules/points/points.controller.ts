import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/auth.decorators';
import { CursorPaginationDto } from 'src/common/dto/pagination.dto';
import { PointsService } from './points.service';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me/points')
export class PointsController {
  constructor(private readonly points: PointsService) {}

  @Get()
  @ApiOperation({
    summary: 'Points balance, level and progress',
  })
  balance(@CurrentUser('id') userId: string) {
    return this.points.balance(userId);
  }

  @Get('ledger')
  @ApiOperation({
    summary: 'Points history',
    description:
      'Every entry names the action that produced it, including reversals, so a ' +
      'user can always see why a balance changed.',
  })
  ledger(@CurrentUser('id') userId: string, @Query() query: CursorPaginationDto) {
    return this.points.history(userId, query.limit, query.cursor);
  }
}
