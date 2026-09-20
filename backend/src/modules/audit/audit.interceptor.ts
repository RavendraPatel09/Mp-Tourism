import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { AUDIT_KEY, AuthenticatedUser } from 'src/common/decorators/auth.decorators';
import { AuditService } from './audit.service';

/**
 * Applied globally. Two jobs:
 *
 *  1. Write an audit row for any handler marked `@Audit(action, entity)`.
 *  2. Shout in the logs when an admin write is *not* marked, because "every
 *     admin action recorded" (PRD F27) is a promise made to a government
 *     customer, and a handler someone forgot to annotate is how it gets broken.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);
  private static readonly MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<{ action: string; entity: string } | undefined>(
      AUDIT_KEY,
      context.getHandler(),
    );
    const request = context.switchToHttp().getRequest<Request>();

    if (!meta) {
      if (AuditInterceptor.MUTATING.has(request.method) && request.path.includes(`/admin/`)) {
        this.logger.warn(
          `Unaudited admin write: ${request.method} ${request.path} — add @Audit() to the handler.`,
        );
      }
      return next.handle();
    }

    const user = (request as Request & { user?: AuthenticatedUser }).user;

    return next.handle().pipe(
      tap((result) => {
        const entityId =
          (request.params?.id as string | undefined) ??
          (result as { id?: string } | undefined)?.id ??
          null;

        void this.audit.record({
          actorId: user?.id ?? null,
          actorRole: user?.role ?? null,
          action: meta.action,
          entity: meta.entity,
          entityId,
          /*
           * `before` is the responsibility of the service that owns the row —
           * only it can read the pre-image inside its own transaction. Services
           * that need a diff call AuditService.record directly; the interceptor
           * records the request payload, which is enough for "who changed what".
           */
          after: this.payload(request),
          ip: request.ip ?? null,
          userAgent: request.headers['user-agent'] ?? null,
          requestId: (request.headers['x-request-id'] as string) ?? null,
        });
      }),
    );
  }

  private payload(request: Request): Record<string, unknown> | null {
    const body = request.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    return Object.keys(body).length ? body : null;
  }
}
