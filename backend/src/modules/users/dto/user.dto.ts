import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ minLength: 3, maxLength: 32 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @Length(3, 32)
  @Matches(/^[a-z0-9_]+$/)
  username?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  homeStateId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  avatarMediaId?: string;

  @ApiPropertyOptional({ description: 'Expo/FCM push token. Cleared by sending an empty string.' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  pushToken?: string;

  @ApiPropertyOptional({
    description: 'PRD §11 privacy control. Takes effect on live boards immediately.',
  })
  @IsOptional()
  @IsBoolean()
  hideFromLeaderboards?: boolean;
}

export class AdminListUsersDto {
  @ApiPropertyOptional({ description: 'Matches username, phone or email.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ description: 'Only users at or below this trust score.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  maxTrustScore?: number;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}

export class SaveDestinationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  destinationId!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
