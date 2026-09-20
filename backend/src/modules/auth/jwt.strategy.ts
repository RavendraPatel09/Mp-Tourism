import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/entities';
import { UserStatus } from 'src/common/constants/roles.enum';
import { AuthenticatedUser } from 'src/common/decorators/auth.decorators';
import { UnauthorizedException } from 'src/common/exceptions/app-exceptions';
import { JwtPayload } from './token.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('auth.accessSecret'),
    });
  }

  /**
   * The token is trusted for identity but not for status: a ban has to take
   * effect before the 15-minute access token expires, so every authenticated
   * request checks the account is still live. One indexed primary-key lookup,
   * and it is the difference between "banned" meaning now and meaning soon.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.users.findOne({
      where: { id: payload.sub },
      select: { id: true, role: true, status: true, managedStateId: true, deletedAt: true },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Account no longer exists.', 'account_deleted');
    }
    if (user.status === UserStatus.BANNED) {
      throw new UnauthorizedException('This account has been banned.', 'account_banned');
    }

    return {
      id: user.id,
      /** Role comes from the database, not the token, so a demotion is immediate. */
      role: user.role,
      managedStateId: user.managedStateId,
      isPhoneVerified: payload.pv,
    };
  }
}
