import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Indian mobile numbers in E.164. Normalised on the way in so `+919876543210`,
 * `9876543210` and `09876543210` are the same account rather than three.
 */
const normalisePhone = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const digits = value.replace(/[^\d]/g, '').replace(/^0+/, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return value.trim();
};

export class SendOtpDto {
  @ApiProperty({ example: '+919876543210', description: 'E.164. Bare 10-digit input is accepted.' })
  @Transform(({ value }) => normalisePhone(value))
  @Matches(/^\+91[6-9]\d{9}$/, { message: 'phone must be a valid Indian mobile number' })
  phone!: string;
}

export class VerifyOtpDto extends SendOtpDto {
  @ApiProperty({ example: '481920' })
  @IsString()
  @Length(6, 6)
  code!: string;

  @ApiPropertyOptional({
    description: 'Stable per-install identifier. Feeds device-to-account limits.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceFingerprint?: string;

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

  @ApiPropertyOptional({ description: 'Client-detected root/jailbreak state.' })
  @IsOptional()
  @IsBoolean()
  isRooted?: boolean;

  @ApiPropertyOptional({ description: 'Client-detected emulator state.' })
  @IsOptional()
  @IsBoolean()
  isEmulator?: boolean;
}

export class RegisterDto {
  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @Transform(({ value }) => normalisePhone(value))
  @Matches(/^\+91[6-9]\d{9}$/, { message: 'phone must be a valid Indian mobile number' })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ minLength: 10, description: 'Required when registering with email.' })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  password?: string;

  @ApiProperty({ example: 'aarav_rides', minLength: 3, maxLength: 32 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @Length(3, 32)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'username may contain lowercase letters, digits and underscores only',
  })
  username!: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;
}

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  password!: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @Length(10, 200)
  refreshToken!: string;
}

export class CheckUsernameDto {
  @ApiProperty({ example: 'aarav_rides' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @Length(3, 32)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'username may contain lowercase letters, digits and underscores only',
  })
  username!: string;
}
