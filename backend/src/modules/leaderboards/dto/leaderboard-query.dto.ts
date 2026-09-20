import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { LeaderboardPeriod, LeaderboardScope } from 'src/common/constants/enums';

/**
 * Offset pagination here, not cursor: a leaderboard is a ranking, ranks are
 * dense integers, and "page 3" is a meaningful thing for a user to ask for.
 */
export class LeaderboardQueryDto {
  @ApiPropertyOptional({ enum: LeaderboardScope, default: LeaderboardScope.NATIONAL })
  @IsOptional()
  @IsEnum(LeaderboardScope)
  scope: LeaderboardScope = LeaderboardScope.NATIONAL;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'State or district id. Required unless scope is national.',
  })
  @IsOptional()
  @IsUUID()
  scopeId?: string;

  @ApiPropertyOptional({ enum: LeaderboardPeriod, default: LeaderboardPeriod.MONTH })
  @IsOptional()
  @IsEnum(LeaderboardPeriod)
  period: LeaderboardPeriod = LeaderboardPeriod.MONTH;

  @ApiPropertyOptional({ default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @ApiPropertyOptional({ default: 0, maximum: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5000)
  offset = 0;
}
