import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsISO8601, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export enum Granularity {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export class FootfallQueryDto {
  @ApiProperty({ format: 'date-time', example: '2026-01-01T00:00:00Z' })
  @IsISO8601()
  from!: string;

  @ApiProperty({ format: 'date-time', example: '2026-04-01T00:00:00Z' })
  @IsISO8601()
  to!: string;

  @ApiPropertyOptional({ enum: Granularity, default: Granularity.DAY })
  @IsOptional()
  @IsEnum(Granularity)
  granularity: Granularity = Granularity.DAY;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Ignored for a State Admin, whose own state is forced from the token.',
  })
  @IsOptional()
  @IsUUID()
  stateId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  districtId?: string;
}

export class IntegrityQueryDto {
  @ApiPropertyOptional({ default: 30, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days = 30;
}
