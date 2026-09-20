import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser, ROLES_KEY } from '../decorators/auth.decorators';
import { STATE_SCOPED_ROLES, UserRole } from '../constants/roles.enum';

/**
 * Role check plus the state-scope rule that government deployments depend on:
 * a State Admin's token is only valid for their own state, and a State Admin
 * with no `managedStateId` is treated as having no access rather than all.
 *
 * Endpoints that operate on state-owned data read `request.stateScope` and must
 * apply it to their query — the guard cannot filter rows on their behalf.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) throw new ForbiddenException('Authentication required');

    if (!required.includes(user.role)) {
      throw new ForbiddenException(`Requires one of: ${required.join(', ')}`);
    }

    if (STATE_SCOPED_ROLES.includes(user.role)) {
      if (!user.managedStateId) {
        throw new ForbiddenException('State admin account has no state assigned');
      }
      request.stateScope = user.managedStateId;
    } else {
      request.stateScope = null;
    }

    return true;
  }
}
