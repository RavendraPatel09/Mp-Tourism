import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RejectionReason, ReportStatus, ReportTargetType } from 'src/common/constants/enums';

export class ModerationQueueDto {
  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;
}

export class DecideDto {
  @ApiProperty({ description: 'true approves and pays out; false rejects.' })
  @IsBoolean()
  approve!: boolean;

  @ApiPropertyOptional({
    enum: RejectionReason,
    description: 'Required in spirit when rejecting; defaults to `moderator_rejected`.',
  })
  @IsOptional()
  @IsEnum(RejectionReason)
  rejectionReason?: RejectionReason;

  @ApiPropertyOptional({
    maxLength: 500,
    description: 'Shown to the user on a rejection, so write it for them, not for the log.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({
    description:
      'Promote the submitted photo into the destination gallery. Only meaningful ' +
      'together with approve.',
  })
  @IsOptional()
  @IsBoolean()
  promoteToGallery?: boolean;
}

export class BulkDecideDto extends DecideDto {
  @ApiProperty({ isArray: true, type: String, format: 'uuid', maxItems: 100 })
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  checkInIds!: string[];
}

export class ListReportsDto {
  @ApiPropertyOptional({ enum: ReportStatus, default: ReportStatus.OPEN })
  @IsOptional()
  @IsEnum(ReportStatus)
  status: ReportStatus = ReportStatus.OPEN;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;
}

export class ResolveReportDto {
  @ApiProperty({ enum: ['uphold', 'dismiss'] })
  @IsIn(['uphold', 'dismiss'])
  action!: 'uphold' | 'dismiss';

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class EnforceDto {
  @ApiProperty({
    enum: ['warn', 'reverse_points', 'suspend_leaderboard', 'ban', 'reinstate'],
    description: 'Graduated enforcement. Skipping steps is allowed but recorded.',
  })
  @IsIn(['warn', 'reverse_points', 'suspend_leaderboard', 'ban', 'reinstate'])
  action!: 'warn' | 'reverse_points' | 'suspend_leaderboard' | 'ban' | 'reinstate';

  @ApiProperty({
    maxLength: 500,
    description: 'Mandatory. An enforcement action with no stated reason cannot be appealed.',
  })
  @IsString()
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Required for `reverse_points`.' })
  @IsOptional()
  @IsUUID()
  checkInId?: string;
}

export class CreateReportDto {
  @ApiProperty({ enum: ReportTargetType })
  @IsEnum(ReportTargetType)
  targetType!: ReportTargetType;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  targetId!: string;

  @ApiProperty({
    example: 'not_at_location',
    description: 'Short machine-readable reason code chosen by the client from a fixed list.',
  })
  @IsString()
  @MaxLength(64)
  reason!: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  detail?: string;
}
