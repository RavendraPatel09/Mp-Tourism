import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Device attestation. Every field here is a *claim* by the client, and the
 * verification pipeline treats it as such — a rooted device can lie about all
 * of it. It is still worth collecting: an honest client that reports
 * `isMockLocation: true` saves a moderator's time, and a client that reports
 * clean values while the server-side signals disagree is itself a signal.
 */
export class DeviceAttestationDto {
  @ApiPropertyOptional({ description: 'Android mock-location API result.' })
  @IsOptional()
  @IsBoolean()
  isMockLocation?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRooted?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEmulator?: boolean;

  @ApiPropertyOptional({ description: 'Stable per-install identifier.' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  fingerprint?: string;

  @ApiPropertyOptional({ example: 'android' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  platform?: string;

  @ApiPropertyOptional({ example: '14' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  osVersion?: string;
}

export class CreateCheckInDto {
  @ApiProperty({ format: 'uuid', description: 'Destination id or slug resolved by the client.' })
  @IsUUID()
  destinationId!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'Media created via POST /media/uploads with `capturedInApp: true`. A gallery ' +
      'image is rejected — in-app camera only (PRD F18.1).',
  })
  @IsUUID()
  mediaId!: string;

  @ApiProperty({ example: 23.2599 })
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @ApiProperty({ example: 77.4126 })
  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @ApiProperty({
    format: 'date-time',
    description: 'When the photo was taken. Server time is authoritative for the window check.',
  })
  @IsISO8601()
  capturedAt!: string;

  @ApiProperty({
    description:
      'GPS horizontal accuracy in metres. Reported honestly this widens the ' +
      'geofence tolerance in your favour; a wildly optimistic value that ' +
      'disagrees with the fix is treated as a signal.',
    example: 12.5,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10_000)
  accuracyM!: number;

  @ApiPropertyOptional({ type: DeviceAttestationDto })
  @IsOptional()
  device?: DeviceAttestationDto;
}
