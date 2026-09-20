import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { Public } from 'src/common/decorators/auth.decorators';
import { AuthService } from './auth.service';
import {
  CheckUsernameDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  SendOtpDto,
  VerifyOtpDto,
} from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/send')
  @Public()
  @HttpCode(HttpStatus.OK)
  /** Tight limit: SMS costs money and this endpoint is the obvious thing to abuse. */
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @ApiOperation({
    summary: 'Send a login OTP',
    description:
      'Rate limited per IP and per number. In development the code is returned as ' +
      '`devCode` so the mobile team can test without SMS delivery.',
  })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.auth.sendOtp(dto.phone);
  }

  @Post('otp/verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @ApiOperation({
    summary: 'Verify an OTP and sign in',
    description:
      'Creates the account if the number is new. `user.isNew` tells the client ' +
      'whether to run the username-and-home-state onboarding step.',
  })
  @ApiResponse({ status: 200, description: 'Access + refresh token pair.' })
  verifyOtp(@Body() dto: VerifyOtpDto, @Req() request: Request) {
    return this.auth.verifyOtp(dto, this.context(request));
  }

  @Post('register')
  @Public()
  @ApiOperation({
    summary: 'Register with email and password',
    description: 'Secondary path, used for admin and dashboard accounts.',
  })
  register(@Body() dto: RegisterDto, @Req() request: Request) {
    return this.auth.register(dto, this.context(request));
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 300_000 } })
  @ApiOperation({ summary: 'Sign in with email and password' })
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.auth.login(dto, this.context(request));
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange a refresh token for a new pair',
    description:
      'Refresh tokens rotate: the presented token is revoked. Presenting a ' +
      'revoked token signs out every session in that family — treat a 401 with ' +
      '`refresh_reused` as "force the user to log in again".',
  })
  refresh(@Body() dto: RefreshDto, @Req() request: Request) {
    return this.auth.refresh(dto.refreshToken, this.context(request));
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a refresh token' })
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken);
  }

  @Get('username-available')
  @Public()
  @ApiOperation({ summary: 'Check whether a username can be claimed' })
  async usernameAvailable(@Query() dto: CheckUsernameDto) {
    return { username: dto.username, available: await this.auth.isUsernameAvailable(dto.username) };
  }

  private context(request: Request) {
    return {
      userAgent: request.headers['user-agent'] ?? null,
      ip: request.ip ?? null,
    };
  }
}
