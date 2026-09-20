import { Controller, Get, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Roles } from 'src/common/decorators/auth.decorators';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from 'src/common/constants/roles.enum';
import { AnalyticsService } from './analytics.service';
import { FootfallQueryDto, IntegrityQueryDto } from './dto/analytics.dto';

@ApiTags('admin/analytics')
@ApiBearerAuth()
@Controller('admin/analytics')
@UseGuards(RolesGuard)
@Roles(UserRole.STATE_ADMIN, UserRole.SUPER_ADMIN)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('footfall')
  @ApiOperation({
    summary: 'Verified footfall over time',
    description:
      'Approved check-ins only — the only footfall figure the platform can stand ' +
      'behind. A State Admin’s state is forced from the token, not the query.',
  })
  footfall(@Query() query: FootfallQueryDto, @Req() request: Request) {
    return this.analytics.footfall(query, this.stateScope(request));
  }

  @Get('redistribution')
  @ApiOperation({
    summary: 'The headline KPI',
    description:
      'Tier-3+4 share of verified check-ins (PRD §9 target ≥ 35%), plus the Gini ' +
      'coefficient of footfall across destinations. The share can improve while ' +
      'concentration gets worse, so both are reported.',
  })
  redistribution(@Query() query: FootfallQueryDto, @Req() request: Request) {
    return this.analytics.redistribution(query, this.stateScope(request));
  }

  @Get('top-destinations')
  @ApiOperation({ summary: 'Top and rising destinations against the prior window' })
  topDestinations(@Query() query: FootfallQueryDto, @Req() request: Request) {
    return this.analytics.topDestinations(query, this.stateScope(request));
  }

  @Get('visitor-origins')
  @ApiOperation({ summary: 'Visitors by home state' })
  origins(@Query() query: FootfallQueryDto, @Req() request: Request) {
    return this.analytics.visitorOrigins(query, this.stateScope(request));
  }

  @Get('seasonality')
  @ApiOperation({ summary: 'Check-ins by month of year' })
  seasonality(@Query('stateId') stateId: string | undefined, @Req() request: Request) {
    return this.analytics.seasonality(this.stateScope(request), stateId);
  }

  @Get('campaigns/:challengeId/lift')
  @ApiOperation({
    summary: 'Campaign lift',
    description:
      'Footfall at a challenge’s destinations during its window against the ' +
      'equivalent window immediately before. `lift` is null when the prior ' +
      'window had no check-ins, rather than reporting an infinite improvement.',
  })
  lift(@Param('challengeId') challengeId: string) {
    return this.analytics.campaignLift(challengeId);
  }

  @Get('integrity')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Verification integrity metrics',
    description: 'Auto-approval rate, median review time and reversal count against PRD targets.',
  })
  integrity(@Query() query: IntegrityQueryDto) {
    return this.analytics.integrity(query.days);
  }

  @Get('footfall.csv')
  @ApiProduces('text/csv')
  @ApiOperation({
    summary: 'Footfall as CSV',
    description:
      'The export a tourism department actually uses — it ends up in a report, ' +
      'not in a browser.',
  })
  async footfallCsv(
    @Query() query: FootfallQueryDto,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const rows = await this.analytics.footfall(query, this.stateScope(request));

    const header = 'bucket,check_ins,unique_users,tier34_check_ins,tier34_share';
    const body = rows
      .map((row) =>
        [
          new Date(row.bucket).toISOString(),
          row.checkIns,
          row.uniqueUsers,
          row.tier34CheckIns,
          row.tier34Share,
        ].join(','),
      )
      .join('\n');

    response
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader(
        'Content-Disposition',
        `attachment; filename="footfall-${query.from}-${query.to}.csv"`,
      )
      .send(`${header}\n${body}\n`);
  }

  private stateScope(request: Request): string | null {
    return (request as Request & { stateScope?: string | null }).stateScope ?? null;
  }
}
