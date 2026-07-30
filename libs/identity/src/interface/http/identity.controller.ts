import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { DomainError } from '@huddle/shared-kernel';
import { User } from '../../domain/user.entity';
import { RegisterUserUseCase } from '../../application/use-cases/register-user.use-case';
import { LoginUserUseCase } from '../../application/use-cases/login-user.use-case';
import { VerifyEmailUseCase } from '../../application/use-cases/verify-email.use-case';
import { IssueRefreshTokenUseCase } from '../../application/use-cases/issue-refresh-token.use-case';
import { RefreshTokenUseCase } from '../../application/use-cases/refresh-token.use-case';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { GoogleAuthGuard } from '../../infrastructure/passport/google-auth.guard';
import { GithubAuthGuard } from '../../infrastructure/passport/github-auth.guard';

@Controller('auth')
export class IdentityController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUserUseCase: LoginUserUseCase,
    private readonly verifyEmailUseCase: VerifyEmailUseCase,
    private readonly issueRefreshTokenUseCase: IssueRefreshTokenUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly jwtService: JwtService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterUserDto) {
    try {
      const { user } = await this.registerUserUseCase.execute(
        dto.email,
        dto.password,
      );
      return {
        id: user.id,
        email: user.getEmail(),
        // TODO: remove once real email delivery exists — stands in for the
        // verification link that would be sent to the user's inbox.
        verificationToken: user.getVerificationToken(),
      };
    } catch (error) {
      if (error instanceof DomainError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginUserDto) {
    try {
      const user = await this.loginUserUseCase.execute(dto.email, dto.password);
      return await this.issueTokens(user);
    } catch (error) {
      if (error instanceof DomainError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    try {
      const { refreshToken, rawToken } = await this.refreshTokenUseCase.execute(
        dto.refreshToken,
      );
      const accessToken = await this.jwtService.signAsync({
        sub: refreshToken.getUserId(),
      });
      return { accessToken, refreshToken: rawToken };
    } catch (error) {
      if (error instanceof DomainError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }

  @Get('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Query('token') token: string) {
    try {
      const user = await this.verifyEmailUseCase.execute(token);
      return { id: user.id, email: user.getEmail(), verified: true };
    } catch (error) {
      if (error instanceof DomainError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Get('oauth/google')
  @UseGuards(GoogleAuthGuard)
  googleLogin() {
    // Guard redirects to Google's consent screen; this body never runs.
  }

  @Get('oauth/google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: Request) {
    return this.issueTokens(req.user as User);
  }

  @Get('oauth/github')
  @UseGuards(GithubAuthGuard)
  githubLogin() {
    // Guard redirects to GitHub's consent screen; this body never runs.
  }

  @Get('oauth/github/callback')
  @UseGuards(GithubAuthGuard)
  async githubCallback(@Req() req: Request) {
    return this.issueTokens(req.user as User);
  }

  private async issueTokens(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.getEmail(),
    });
    const { rawToken: refreshToken } =
      await this.issueRefreshTokenUseCase.execute(user.id);
    return { accessToken, refreshToken };
  }
}
