import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Audit, CurrentUser, Roles } from 'src/common/decorators/auth.decorators';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from 'src/common/constants/roles.enum';
import { AdminDestinationsService } from './admin-destinations.service';
import {
  AdminListDestinationsDto,
  CreateDestinationDto,
  UpdateDestinationDto,
} from './dto/admin-destination.dto';

@ApiTags('admin/destinations')
@ApiBearerAuth()
@Controller('admin/destinations')
@UseGuards(RolesGuard)
@Roles(UserRole.STATE_ADMIN, UserRole.SUPER_ADMIN)
export class AdminDestinationsController {
  constructor(private readonly admin: AdminDestinationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List destinations for the CMS',
    description: 'Includes drafts. A State Admin sees only their own state.',
  })
  list(@Query() query: AdminListDestinationsDto, @Req() request: Request) {
    return this.admin.list(query, this.stateScope(request));
  }

  @Post()
  @Audit('destination.create', 'destination')
  @ApiOperation({
    summary: 'Create a destination',
    description:
      'Created as a draft. Geofence is optional — pass `geofence.radiusM` for the ' +
      'pin-and-radius case, which covers roughly nine out of ten destinations, and ' +
      '`geofence.ring` only where a drawn boundary genuinely matters.',
  })
  create(
    @Body() dto: CreateDestinationDto,
    @CurrentUser('id') actorId: string,
    @Req() request: Request,
  ) {
    return this.admin.create(dto, actorId, this.stateScope(request));
  }

  @Patch(':id')
  @Audit('destination.update', 'destination')
  @ApiOperation({ summary: 'Update a destination' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDestinationDto,
    @CurrentUser('id') actorId: string,
    @Req() request: Request,
  ) {
    return this.admin.update(id, dto, actorId, this.stateScope(request));
  }

  @Post(':id/publish')
  @Audit('destination.publish', 'destination')
  @ApiOperation({
    summary: 'Publish a destination',
    description:
      'Refuses with 422 and a `missing` list until the listing has a description, ' +
      'a hero image, a district, at least three things to do, timings and how to ' +
      'reach. A published page is a first impression for a place that has never ' +
      'had one.',
  })
  @ApiResponse({ status: 422, description: 'Publish requirements unmet; see `details.missing`.' })
  publish(@Param('id') id: string, @CurrentUser('id') actorId: string, @Req() request: Request) {
    return this.admin.publish(id, actorId, this.stateScope(request));
  }

  @Post(':id/unpublish')
  @Audit('destination.unpublish', 'destination')
  @ApiOperation({ summary: 'Take a destination offline' })
  unpublish(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser('id') actorId: string,
    @Req() request: Request,
  ) {
    return this.admin.unpublish(id, actorId, this.stateScope(request), body?.reason);
  }

  @Delete(':id')
  @Audit('destination.delete', 'destination')
  @ApiOperation({
    summary: 'Delete a draft destination',
    description:
      'Only possible while the destination has no check-ins — footfall history is ' +
      'the product’s reason to exist and is not deletable through the CMS.',
  })
  remove(@Param('id') id: string, @CurrentUser('id') actorId: string, @Req() request: Request) {
    return this.admin.remove(id, actorId, this.stateScope(request));
  }

  private stateScope(request: Request): string | null {
    return (request as Request & { stateScope?: string | null }).stateScope ?? null;
  }
}
