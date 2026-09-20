import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { MediaOwnerType, MediaSource } from 'src/common/constants/enums';

export class CreateUploadTicketDto {
  @ApiProperty({ enum: MediaOwnerType, example: MediaOwnerType.CHECK_IN })
  @IsEnum(MediaOwnerType)
  ownerType!: MediaOwnerType;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Omitted for check-in photos — the check-in row does not exist yet, and the ' +
      'check-in endpoint attaches the media itself.',
  })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiProperty({
    example: 'image/jpeg',
    enum: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
  })
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
  mime!: string;

  @ApiProperty({
    description:
      'True only when the frame came from the in-app camera. A gallery pick can ' +
      'join a destination gallery but can never score a check-in (PRD F18.1), so ' +
      'the client must report this honestly — the server treats false as final.',
  })
  @IsBoolean()
  capturedInApp!: boolean;

  @ApiPropertyOptional({ enum: MediaSource })
  @IsOptional()
  @IsEnum(MediaSource)
  source?: MediaSource;
}

export class FinaliseUploadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  mediaId!: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  caption?: string;
}
