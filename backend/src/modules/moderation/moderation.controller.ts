import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Audit, CurrentUser, Roles } from 'src/common/decorators/auth.decorators';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from 'src/common/constants/roles.enum';
import { ModerationService } from './moderation.service';
import {
  BulkDecideDto,
  DecideDto,
  EnforceDto,
  ListReportsDto,
  ModerationQueueDto,
  ResolveReportDto,
} from './dto/moderation.dto';

@ApiTags('admin/moderation')
@ApiBearerAuth()
@Controller('admin/moderation')
@UseGuards(RolesGuard)
@Roles(UserRole.MODERATOR, UserRole.STATE_ADMIN, UserRole.SUPER_ADMIN)
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get('queue')
  @ApiOperation({
    summary: 'The photo moderation queue',
    description:
      'Each item carries everything needed to decide: the submission, the official ' +
      'reference gallery, both GPS points, every automated signal and the user’s ' +
      'approval history. Oldest first, because the SLA is measured on the oldest item.\n\n' +
      'State Admins see only their own state; Moderators and Super Admins see all.',
  })
  queue(@Query() query: ModerationQueueDto, @Req() request: Request) {
    return this.moderation.queue(query, this.stateScope(request));
  }

  @Get('queue/stats')
  @ApiOperation({ summary: 'Queue depth and oldest waiting time' })
  stats(@Req() request: Request) {
    return this.moderation.queueStats(this.stateScope(request));
  }

  @Post(':checkInId/decide')
  @Audit('moderation.decide', 'check_in')
  @ApiOperation({
    summary: 'Approve or reject a check-in',
    description:
      'Approving pays the points and closes the item. Rejecting an already-approved ' +
      'check-in reverses the award through the ledger — the points-audit path.',
  })
  decide(
    @Param('checkInId') checkInId: string,
    @Body() dto: DecideDto,
    @CurrentUser('id') moderatorId: string,
    @Req() request: Request,
  ) {
    return this.moderation.decide(checkInId, dto, moderatorId, this.stateScope(request));
  }

  @Post('decide-bulk')
  @Audit('moderation.decide_bulk', 'check_in')
  @ApiOperation({
    summary: 'Apply one decision to many check-ins',
    description: 'Per-item results; one failure does not abandon the batch.',
  })
  decideBulk(
    @Body() dto: BulkDecideDto,
    @CurrentUser('id') moderatorId: string,
    @Req() request: Request,
  ) {
    return this.moderation.decideBulk(dto.checkInIds, dto, moderatorId, this.stateScope(request));
  }

  @Get('reports')
  @ApiOperation({ summary: 'The user-report queue' })
  reports(@Query() query: ListReportsDto) {
    return this.moderation.listReports(query.status, query.limit);
  }

  @Post('reports/:reportId/resolve')
  @Audit('moderation.resolve_report', 'report')
  @ApiOperation({ summary: 'Uphold or dismiss a report' })
  resolveReport(
    @Param('reportId') reportId: string,
    @Body() dto: ResolveReportDto,
    @CurrentUser('id') moderatorId: string,
  ) {
    return this.moderation.resolveReport(reportId, moderatorId, dto.action, dto.note);
  }

  @Post('users/:userId/enforce')
  @Roles(UserRole.MODERATOR, UserRole.SUPER_ADMIN)
  @Audit('user.enforce', 'user')
  @ApiOperation({
    summary: 'Apply an enforcement action',
    description:
      'Graduated: warn → reverse points → suspend from leaderboards → ban. A ban ' +
      'also revokes every refresh token, so it takes effect immediately rather ' +
      'than when the access token expires.',
  })
  enforce(
    @Param('userId') userId: string,
    @Body() dto: EnforceDto,
    @CurrentUser('id') moderatorId: string,
  ) {
    return this.moderation.enforce(userId, dto, moderatorId);
  }

  @Get('users/:userId/history')
  @ApiOperation({ summary: 'Moderation history for a user' })
  history(@Param('userId') userId: string) {
    return this.moderation.userHistory(userId);
  }

  private stateScope(request: Request): string | null {
    return (request as Request & { stateScope?: string | null }).stateScope ?? null;
  }
}
