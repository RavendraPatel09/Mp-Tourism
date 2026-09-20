import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/auth.decorators';
import { UserRole } from 'src/common/constants/roles.enum';
import { AuditService } from './audit.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@ApiTags('admin/audit')
@ApiBearerAuth()
@Controller('admin/audit-logs')
@UseGuards(RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({
    summary: 'Query the audit log',
    description:
      'Super admin only. The log is append-only at the database level, so this is the ' +
      'only way it can be read and there is no way for the API to alter it.',
  })
  list(@Query() query: AuditLogQueryDto) {
    return this.audit.list(query);
  }
}
