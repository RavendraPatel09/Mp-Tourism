import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from 'src/common/decorators/auth.decorators';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/user.dto';

@ApiTags('me')
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me/profile')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Your own profile',
    description:
      'Includes `stateProgress`, which backs the India map that fills in as you ' +
      'travel, and `stats.offbeatShare` — your personal version of the platform’s ' +
      'headline metric.',
  })
  me(@CurrentUser('id') userId: string) {
    return this.users.myProfile(userId);
  }

  @Patch('me/profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update your profile' })
  update(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(userId, dto);
  }

  @Delete('me')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Close your account',
    description:
      'DPDP Act compliant: identifiers are cleared immediately, sessions are ' +
      'revoked, and remaining personal data is purged within 30 days. Check-in ' +
      'history is anonymised rather than deleted, so district footfall already ' +
      'reported to a tourism board stays accurate.',
  })
  deleteAccount(@CurrentUser('id') userId: string) {
    return this.users.requestDeletion(userId);
  }

  @Get('users/:username')
  @Public()
  @ApiOperation({
    summary: 'Public profile',
    description:
      'Never exposes coordinates or precise timestamps. Under-18 accounts return a ' +
      'restricted view.',
  })
  publicProfile(@Param('username') username: string) {
    return this.users.publicProfile(username);
  }
}
