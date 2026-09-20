import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  BudgetBand,
  CrowdLevel,
  DestinationStatus,
  Difficulty,
  Season,
} from 'src/common/constants/enums';

export class ThingToDoInputDto {
  @ApiProperty({ maxLength: 200, example: 'Climb to the Baradari for the valley view' })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ minimum: 5, maximum: 1440 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(1440)
  durationMin?: number;
}

export class GeofenceInputDto {
  @ApiPropertyOptional({
    description:
      'GeoJSON Polygon ring as [[lng, lat], ...]. Optional — most destinations only ' +
      'need a pin plus a radius, and the CMS should default to that.',
    example: [
      [77.41, 23.25],
      [77.42, 23.25],
      [77.42, 23.26],
      [77.41, 23.26],
      [77.41, 23.25],
    ],
  })
  @IsOptional()
  @IsArray()
  ring?: [number, number][];

  @ApiPropertyOptional({
    minimum: 50,
    maximum: 5000,
    default: 300,
    description: 'Used when no polygon is drawn. 100 m for a temple, 5 km for a national park.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(50)
  @Max(5000)
  radiusM?: number;
}

export class CreateDestinationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  stateId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  districtId?: string;

  @ApiProperty({ maxLength: 160 })
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({
    isArray: true,
    type: String,
    description: 'Alternate and regional-language spellings. These drive typo-tolerant search.',
    example: ['Khajurao', 'खजुराहो'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  aliases?: string[];

  @ApiProperty({ description: 'The "why go" paragraph.' })
  @IsString()
  @MaxLength(4000)
  description!: string;

  @ApiPropertyOptional({ description: 'Longer historical or cultural context.' })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  story?: string;

  @ApiProperty({ example: 23.2599 })
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @ApiProperty({ example: 77.4126 })
  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @ApiPropertyOptional({ type: GeofenceInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => GeofenceInputDto)
  geofence?: GeofenceInputDto;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 4,
    default: 3,
    description:
      'Platform-controlled, not state-controlled (PRD §15 Q6): a state board that ' +
      'could set its own tiers could inflate its own footfall numbers.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  tier?: number;

  @ApiPropertyOptional({ isArray: true, type: String, description: 'Category slugs.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  categorySlugs?: string[];

  @ApiPropertyOptional({ enum: Season, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(Season, { each: true })
  bestSeason?: Season[];

  @ApiPropertyOptional({ description: 'Only worth visiting in the rains.' })
  @IsOptional()
  @IsBoolean()
  isMonsoonOnly?: boolean;

  @ApiPropertyOptional({ minimum: 15, maximum: 4320, default: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(4320)
  minDurationMin?: number;

  @ApiPropertyOptional({ minimum: 15, maximum: 4320, default: 120 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(4320)
  recommendedDurationMin?: number;

  @ApiPropertyOptional({ enum: Difficulty })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @ApiPropertyOptional({ enum: BudgetBand })
  @IsOptional()
  @IsEnum(BudgetBand)
  avgBudget?: BudgetBand;

  @ApiPropertyOptional({
    description: 'Flags such as `{ wheelchair: true, senior_friendly: true }`.',
  })
  @IsOptional()
  @IsObject()
  accessibilityFlags?: Record<string, boolean>;

  @ApiPropertyOptional({ enum: CrowdLevel })
  @IsOptional()
  @IsEnum(CrowdLevel)
  crowdLevel?: CrowdLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEcoSensitive?: boolean;

  @ApiPropertyOptional({
    isArray: true,
    type: String,
    description: 'Genuine hazards. Legally the most important field on this form.',
    example: ['Stream crossing impassable in July–August'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hazards?: string[];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  heroMediaId?: string;

  @ApiPropertyOptional({ description: 'Official annual footfall, used by the tier recompute.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  annualVisitors?: number;

  @ApiPropertyOptional({ type: [ThingToDoInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ThingToDoInputDto)
  thingsToDo?: ThingToDoInputDto[];

  @ApiPropertyOptional({
    description: 'The `destination_info` payload — timings, fees, facilities.',
  })
  @IsOptional()
  @IsObject()
  info?: Record<string, unknown>;
}

export class UpdateDestinationDto extends CreateDestinationDto {
  @ApiPropertyOptional({ enum: DestinationStatus })
  @IsOptional()
  @IsEnum(DestinationStatus)
  status?: DestinationStatus;

  @ApiPropertyOptional({ description: 'Temporarily hide from lists without unpublishing (F21).' })
  @IsOptional()
  @IsBoolean()
  isPromotionSuppressed?: boolean;
}

export class AdminListDestinationsDto {
  @ApiPropertyOptional({ enum: DestinationStatus })
  @IsOptional()
  @IsEnum(DestinationStatus)
  status?: DestinationStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  stateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

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
