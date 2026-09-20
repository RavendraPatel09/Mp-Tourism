import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { Roles } from 'src/common/decorators/auth.decorators';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from 'src/common/constants/roles.enum';
import { AdminListUsersDto } from './dto/user.dto';

@ApiTags('admin/users')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(RolesGuard)
@Roles(UserRole.MODERATOR, UserRole.SUPER_ADMIN)
export class AdminUsersController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({
    summary: 'Search users',
    description:
      'For the moderation console. `maxTrustScore` is the useful filter — it ' +
      'surfaces the accounts worth looking at rather than the newest ones.',
  })
  async list(@Query() query: AdminListUsersDto) {
    const rows = await this.dataSource.query<Record<string, unknown>[]>(
      `
      SELECT u.id, u.phone, u.email, u.role, u.status, u.created_at, u.last_login_at,
             p.username, p.level, p.total_points, p.trust_score, p.is_phone_verified,
             (SELECT COUNT(*) FROM check_ins c
               WHERE c.user_id = u.id AND c.status = 'approved') AS approved_check_ins,
             (SELECT COUNT(*) FROM check_ins c
               WHERE c.user_id = u.id AND c.status = 'rejected') AS rejected_check_ins,
             (SELECT COUNT(DISTINCT d.fingerprint) FROM devices d WHERE d.user_id = u.id)
               AS device_count
        FROM users u
        JOIN user_profiles p ON p.user_id = u.id
       WHERE u.deleted_at IS NULL
         AND ($1::text IS NULL OR p.username ILIKE $1 OR u.phone ILIKE $1 OR u.email ILIKE $1)
         AND ($2::int IS NULL OR p.trust_score <= $2::int)
       ORDER BY p.trust_score ASC, u.created_at DESC
       LIMIT $3 OFFSET $4
      `,
      [query.q ? `%${query.q}%` : null, query.maxTrustScore ?? null, query.limit, query.offset],
    );

    return { data: rows, limit: query.limit, offset: query.offset };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'User detail for moderation',
    description:
      'Includes the accounts sharing each of this user’s devices — the collusion ' +
      'signal a moderator actually needs when a leaderboard looks wrong.',
  })
  async detail(@Param('id') id: string) {
    const [user, checkIns, devices, ledger] = await Promise.all([
      this.dataSource.query(
        `SELECT u.id, u.phone, u.email, u.role, u.status, u.created_at, u.is_minor,
                p.username, p.display_name, p.level, p.total_points, p.trust_score
           FROM users u JOIN user_profiles p ON p.user_id = u.id WHERE u.id = $1`,
        [id],
      ),
      this.dataSource.query(
        `SELECT c.id, c.status, c.captured_at, c.points_awarded, c.rejection_reason,
                d.name AS destination_name, d.tier
           FROM check_ins c JOIN destinations d ON d.id = c.destination_id
          WHERE c.user_id = $1 ORDER BY c.captured_at DESC LIMIT 50`,
        [id],
      ),
      this.dataSource.query(
        `SELECT dv.fingerprint, dv.platform, dv.is_rooted, dv.is_emulator, dv.last_seen_at,
                (SELECT COUNT(DISTINCT other.user_id) FROM devices other
                  WHERE other.fingerprint = dv.fingerprint) AS accounts_on_device
           FROM devices dv WHERE dv.user_id = $1`,
        [id],
      ),
      this.dataSource.query(
        `SELECT id, delta, reason_code, ref_type, ref_id, balance_after, created_at, note
           FROM points_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [id],
      ),
    ]);

    return { user: user[0] ?? null, recentCheckIns: checkIns, devices, ledger };
  }
}
