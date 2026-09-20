import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CursorPaginationDto } from 'src/common/dto/pagination.dto';
import { BudgetBand, Difficulty, Season } from 'src/common/constants/enums';

/** Time-available buckets from the filter sheet (PRD F2), in minutes. */
export enum DurationBucket {
  UPTO_2H = 'upto_2h',
  HALF_DAY = 'half_day',
  FULL_DAY = 'full_day',
  MULTI_DAY = 'multi_day',
}

export const DURATION_BUCKET_MAX_MIN: Record<DurationBucket, number> = {
  [DurationBucket.UPTO_2H]: 120,
  [DurationBucket.HALF_DAY]: 300,
  [DurationBucket.FULL_DAY]: 600,
  [DurationBucket.MULTI_DAY]: 100_000,
};

export enum DestinationSort {
  /** Default. Rarity first, so the long tail surfaces without the user asking. */
  RECOMMENDED = 'recommended',
  DISTANCE = 'distance',
  POINTS = 'points',
  RATING = 'rating',
  NEWEST = 'newest',
  NAME = 'name',
}

const csvToArray = ({ value }: { value: unknown }): unknown => {
  if (typeof value === 'string')
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  return value;
};

const toBool = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes'].includes(String(value).toLowerCase());
};

export class ListDestinationsDto extends CursorPaginationDto {
  @ApiPropertyOptional({ example: 'MP', description: 'State code. Cheaper than passing an id.' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsString()
  @MaxLength(8)
  state?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  district?: string;

  @ApiPropertyOptional({
    isArray: true,
    type: String,
    description: 'Category slugs, comma-separated. Matches ANY of them.',
    example: 'waterfalls,forts',
  })
  @IsOptional()
  @Transform(csvToArray)
  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({ enum: DurationBucket, description: 'How much time the user has.' })
  @IsOptional()
  @IsEnum(DurationBucket)
  duration?: DurationBucket;

  @ApiPropertyOptional({ enum: Difficulty, isArray: true })
  @IsOptional()
  @Transform(csvToArray)
  @IsArray()
  @IsEnum(Difficulty, { each: true })
  difficulty?: Difficulty[];

  @ApiPropertyOptional({ enum: BudgetBand, isArray: true })
  @IsOptional()
  @Transform(csvToArray)
  @IsArray()
  @IsEnum(BudgetBand, { each: true })
  budget?: BudgetBand[];

  @ApiPropertyOptional({ isArray: true, type: Number, example: '3,4' })
  @IsOptional()
  @Transform(({ value }) => {
    const parsed = csvToArray({ value });
    return Array.isArray(parsed)
      ? parsed.map((entry) => Number.parseInt(String(entry), 10))
      : parsed;
  })
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(4, { each: true })
  tier?: number[];

  @ApiPropertyOptional({ enum: Season })
  @IsOptional()
  @IsEnum(Season)
  season?: Season;

  @ApiPropertyOptional({ example: 23.2599, description: 'Required together with `lng`.' })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ example: 77.4126 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ default: 50, maximum: 500, description: 'Kilometres. Needs lat/lng.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  radiusKm = 50;

  @ApiPropertyOptional({ description: 'Wheelchair / senior / child friendly flags.' })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  accessibleOnly?: boolean;

  @ApiPropertyOptional({ enum: DestinationSort, default: DestinationSort.RECOMMENDED })
  @IsOptional()
  @IsEnum(DestinationSort)
  sort: DestinationSort = DestinationSort.RECOMMENDED;
}

export class NearbyDestinationsDto {
  @ApiPropertyOptional({ default: 50, maximum: 200, description: 'Kilometres.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  radiusKm = 50;

  @ApiPropertyOptional({ default: 10, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;
}

/**
 * Search is intentionally not paginated. Results are ranked by relevance, and
 * relevance past the first couple of dozen hits is noise — a user who does not
 * see what they wanted types a different query rather than paging.
 */
export class SearchDto {
  @ApiPropertyOptional({ example: 'khajurao', description: 'Typo tolerant; matches aliases too.' })
  @IsString()
  @MaxLength(120)
  q!: string;

  @ApiPropertyOptional({ example: 'MP' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsString()
  @MaxLength(8)
  state?: string;

  @ApiPropertyOptional({ default: 25, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 25;
}
