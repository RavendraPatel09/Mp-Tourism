import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from 'src/entities';
import { jsonb } from 'src/common/db/jsonb';
import {
  CursorPaginationDto,
  Paginated,
  decodeCursor,
  encodeCursor,
  paginate,
} from 'src/common/dto/pagination.dto';

export interface AuditEntry {
  actorId: string | null;
  actorRole?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export interface AuditQuery extends CursorPaginationDto {
  actorId?: string;
  entity?: string;
  entityId?: string;
  action?: string;
  from?: string;
  to?: string;
}

/** Keys we never copy into an audit diff, however they arrive. */
const REDACTED_KEYS = new Set([
  'password',
  'passwordHash',
  'password_hash',
  'token',
  'accessToken',
  'refreshToken',
  'otp',
  'code',
  'authorization',
]);

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  /**
   * Writes one immutable audit row. Deliberately swallows its own failures: an
   * audit write must never be the reason a legitimate admin action 500s. It
   * logs loudly instead, and the missing row shows up in the daily audit-gap
   * check rather than as a user-facing error.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.repo.insert({
        actorId: entry.actorId,
        actorRole: entry.actorRole ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        before: jsonb(this.redact(entry.before)),
        after: jsonb(this.redact(entry.after)),
        ip: entry.ip ?? null,
        userAgent: entry.userAgent?.slice(0, 255) ?? null,
        requestId: entry.requestId ?? null,
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit log for ${entry.action} on ${entry.entity}:${entry.entityId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async list(query: AuditQuery): Promise<Paginated<AuditLog>> {
    const qb = this.repo
      .createQueryBuilder('log')
      .orderBy('log.created_at', 'DESC')
      .addOrderBy('log.id', 'DESC');

    if (query.actorId) qb.andWhere('log.actor_id = :actorId', { actorId: query.actorId });
    if (query.entity) qb.andWhere('log.entity = :entity', { entity: query.entity });
    if (query.entityId) qb.andWhere('log.entity_id = :entityId', { entityId: query.entityId });
    if (query.action) qb.andWhere('log.action ILIKE :action', { action: `%${query.action}%` });
    if (query.from) qb.andWhere('log.created_at >= :from', { from: query.from });
    if (query.to) qb.andWhere('log.created_at <= :to', { to: query.to });

    const cursor = decodeCursor<{ createdAt: string; id: string }>(query.cursor);
    if (cursor) {
      qb.andWhere('(log.created_at, log.id) < (:createdAt, :id)', cursor);
    }

    const rows = await qb.take(query.limit + 1).getMany();
    return paginate(rows, query.limit, (row) =>
      encodeCursor({ createdAt: row.createdAt.toISOString(), id: row.id }),
    );
  }

  private redact(value: Record<string, unknown> | null | undefined) {
    if (!value) return null;
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      output[key] = REDACTED_KEYS.has(key) ? '[redacted]' : entry;
    }
    return output;
  }
}
