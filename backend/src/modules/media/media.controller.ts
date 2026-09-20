import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/auth.decorators';
import { MediaService } from './media.service';
import { CreateUploadTicketDto, FinaliseUploadDto } from './dto/media.dto';

@ApiTags('media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('uploads')
  @ApiOperation({
    summary: 'Request a signed upload URL',
    description:
      'Returns a URL to PUT the image bytes to directly. The API never receives ' +
      'the image itself. Flow: request ticket → PUT bytes to `uploadUrl` with the ' +
      '`requiredHeaders` → POST /media/uploads/finalise → reference `mediaId` in ' +
      'the check-in or review.',
  })
  createTicket(@Body() dto: CreateUploadTicketDto, @CurrentUser('id') userId: string) {
    return this.media.createUploadTicket({
      userId,
      ownerType: dto.ownerType,
      ownerId: dto.ownerId,
      mime: dto.mime,
      capturedInApp: dto.capturedInApp,
      source: dto.source,
    });
  }

  @Post('uploads/finalise')
  @ApiOperation({
    summary: 'Confirm an upload landed',
    description:
      'Verifies the object exists in storage and records its size. Thumbnailing ' +
      'and perceptual hashing happen asynchronously afterwards.',
  })
  async finalise(@Body() dto: FinaliseUploadDto, @CurrentUser('id') userId: string) {
    const media = await this.media.finalise(dto.mediaId, userId);
    return { mediaId: media.id, isUploaded: media.isUploaded, bytes: media.bytes };
  }
}
