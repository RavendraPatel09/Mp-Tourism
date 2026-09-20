import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY, OPTIONAL_AUTH_KEY } from '../decorators/auth.decorators';

/**
 * Applied globally. Endpoints opt out with `@Public()` (guests welcome) or
 * `@OptionalAuth()` (token honoured if sent, never required). Defaulting to
 * "locked" means a new endpoint cannot leak by omission.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest<TUser>(err: Error | null, user: TUser, _info: unknown, context: ExecutionContext) {
    const optional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (optional) return user ?? (undefined as unknown as TUser);
    if (err || !user) throw err ?? new UnauthorizedException('Authentication required');
    return user;
  }
}
