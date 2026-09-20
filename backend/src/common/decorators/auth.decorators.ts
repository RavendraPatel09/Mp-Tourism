import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '../constants/roles.enum';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const OPTIONAL_AUTH_KEY = 'auth:optional';
export const ROLES_KEY = 'auth:roles';
export const AUDIT_KEY = 'audit:action';

/** No token required. Guest browsing (PRD §4.2) relies on this. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Token parsed if present, ignored if absent. Used on discovery endpoints that
 * personalise (is-saved flags, points preview) but must still serve guests.
 */
export const OptionalAuth = () => SetMetadata(OPTIONAL_AUTH_KEY, true);

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Marks a write endpoint for audit logging. Every admin mutation carries this;
 * the interceptor refuses to let an admin write go unlogged (see AuditInterceptor).
 */
export const Audit = (action: string, entity: string) => SetMetadata(AUDIT_KEY, { action, entity });

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  /** Present only for state admins. */
  managedStateId: string | null;
  isPhoneVerified: boolean;
}

export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) return undefined;
    return field ? user[field] : user;
  },
);

/** Raw `Idempotency-Key` header, required on POST /check-ins (PRD §8). */
export const IdempotencyKey = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.headers['idempotency-key'] as string | undefined;
});
