import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device, RefreshToken, SavedList, User, UserProfile } from 'src/entities';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';
import { JwtStrategy } from './jwt.strategy';
import { PasswordService } from './password.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserProfile, RefreshToken, Device, SavedList]),
    PassportModule,
    /** Secrets are passed per-sign call in TokenService, not registered here. */
    JwtModule.register({}),
  ],
  providers: [AuthService, OtpService, TokenService, JwtStrategy, PasswordService],
  controllers: [AuthController],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
