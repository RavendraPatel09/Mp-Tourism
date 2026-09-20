import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ChallengeScope, ChallengeStatus, ChallengeType } from 'src/common/constants/enums';

export class ListChallengesDto {
  @ApiPropertyOptional({ enum: ChallengeScope })
  @IsOptional()
  @IsEnum(ChallengeScope)
  scope?: ChallengeScope;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  stateId?: string;

  @ApiPropertyOptional({ default: true, description: 'Only challenges open right now.' })
  @IsOptional()
  @Transform(({ value }) => value === undefined || ['1', 'true', 'yes', true].includes(value))
  @IsBoolean()
  active = true;
}

export class CreateChallengeDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  description!: string;

  @ApiProperty({ enum: ChallengeScope })
  @IsEnum(ChallengeScope)
  scope!: ChallengeScope;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Required for state-scoped challenges. Ignored for a State Admin, whose own ' +
      'state is forced from the token.',
  })
  @IsOptional()
  @IsUUID()
  stateId?: string;

  @ApiProperty({ enum: ChallengeType })
  @IsEnum(ChallengeType)
  type!: ChallengeType;

  @ApiProperty({
    description:
      'One of the criteria shapes the engine understands: ' +
      '`{kind:"visit_set",destination_ids:[...],required:n}`, ' +
      '`{kind:"tier_count",min_tier:n,required:n}`, ' +
      '`{kind:"circuit",circuit_id:"..."}` or ' +
      '`{kind:"category_count",category_slug:"...",required:n}`.',
    example: { kind: 'tier_count', min_tier: 4, required: 3 },
  })
  @IsObject()
  criteria!: Record<string, unknown>;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  multiplier = 1;

  @ApiProperty({ format: 'date-time' })
  @IsISO8601()
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  @IsISO8601()
  endsAt!: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 5000, default: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5000)
  rewardPoints = 200;

  @ApiPropertyOptional({ enum: ChallengeStatus, default: ChallengeStatus.DRAFT })
  @IsOptional()
  @IsEnum(ChallengeStatus)
  status?: ChallengeStatus;
}
