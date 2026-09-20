import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Throttle } from '@nestjs/throttler';
import { Report } from 'src/entities';
import { CurrentUser } from 'src/common/decorators/auth.decorators';
import { ConflictException } from 'src/common/exceptions/app-exceptions';
import { QueryFailedError } from 'typeorm';
import { CreateReportDto } from './dto/moderation.dto';

@ApiTags('user-content')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(@InjectRepository(Report) private readonly reports: Repository<Report>) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @ApiOperation({
    summary: 'Report a review, photo, profile or check-in',
    description:
      'One report per user per target — a second report from the same account is a ' +
      '409, not a second vote. Volume is not evidence.',
  })
  async create(@Body() dto: CreateReportDto, @CurrentUser('id') userId: string) {
    try {
      const report = await this.reports.save(
        this.reports.create({
          reporterId: userId,
          targetType: dto.targetType,
          targetId: dto.targetId,
          reason: dto.reason,
          detail: dto.detail ?? null,
        }),
      );
      return { id: report.id, status: report.status };
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      ) {
        throw new ConflictException('You have already reported this.', 'already_reported');
      }
      throw error;
    }
  }
}
