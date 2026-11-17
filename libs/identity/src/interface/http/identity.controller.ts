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
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DomainError } from '@huddle/shared-kernel';
import { User } from '../../domain/user.entity';
import { RegisterUserUseCase } from '../../application/use-cases/register-user.use-case';
import { LoginUserUseCase } from '../../application/use-cases/login-user.use-case';
import { VerifyEmailUseCase } from '../../application/use-cases/verify-email.use-case';
import { RefreshTokenUseCase } from '../../application/use-cases/refresh-token.use-case';
import { IssueAuthTokensUseCase } from '../../application/use-cases/issue-auth-tokens.use-case';
import { LogoutUseCase } from '../../application/use-cases/logout.use-case';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { AuthTokensDto } from './dto/auth-tokens.dto';
import { RegisteredUserDto } from './dto/registered-user.dto';
import { VerifiedUserDto } from './dto/verified-user.dto';
import {
  ApiIdentityErrorResponses,
  UNEXPECTED_FAILURE,
  VALIDATION_FAILURE,
} from './identity-error-responses.decorator';
import { GoogleAuthGuard } from '../../infrastructure/passport/google-auth.guard';
import { GithubAuthGuard } from '../../infrastructure/passport/github-auth.guard';
import { JwtAuthGuard } from '../../infrastructure/passport/jwt-auth.guard';
import { AuthenticatedUser } from '../../infrastructure/passport/jwt.strategy';

@Controller('auth')
export class IdentityController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUserUseCase: LoginUserUseCase,
    private readonly verifyEmailUseCase: VerifyEmailUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly issueAuthTokensUseCase: IssueAuthTokensUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly jwtService: JwtService,
  ) {}

  @Post('register')
  @ApiTags('Authentication')
  @ApiOperation({
    description:
      'Transitional: the response includes the verification token, which real email delivery will replace.',
  })
  @ApiCreatedResponse({
    type: RegisteredUserDto,
    description: 'The account is created and awaits email verification.',
  })
  @ApiIdentityErrorResponses({
    400: VALIDATION_FAILURE,
    409: 'The email is already registered.',
    500: UNEXPECTED_FAILURE,
  })
  async register(@Body() dto: RegisterUserDto) {
    try {
      const { user } = await this.registerUserUseCase.execute(
        dto.email,
        dto.password,
        dto.displayName,
      );
      return {
        id: user.id,
        email: user.getEmail(),
        displayName: user.getDisplayName(),
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
  @ApiTags('Authentication')
  @ApiOkResponse({
    type: AuthTokensDto,
    description: 'The credentials are valid, and a token pair is issued.',
  })
  @ApiIdentityErrorResponses({
    400: VALIDATION_FAILURE,
    401: 'The email or password is invalid, or the email is not verified.',
    500: UNEXPECTED_FAILURE,
  })
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginUserDto) {
    try {
      const user = await this.loginUserUseCase.execute(dto.email, dto.password);
      return await this.issueAuthTokensUseCase.execute(user);
    } catch (error) {
      if (error instanceof DomainError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }

  @Post('refresh')
  @ApiTags('Authentication')
  @ApiOkResponse({
    type: AuthTokensDto,
    description:
      'The refresh token is rotated, and a new token pair is issued.',
  })
  @ApiIdentityErrorResponses({
    400: VALIDATION_FAILURE,
    401: 'The refresh token is missing, unknown, expired or revoked.',
    500: UNEXPECTED_FAILURE,
  })
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    try {
      return await this.refreshTokenUseCase.execute(dto.refreshToken);
    } catch (error) {
      if (error instanceof DomainError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }

  @Post('logout')
  @ApiTags('Authentication')
  @ApiBearerAuth()
  @ApiNoContentResponse({
    description:
      'The refresh token is revoked, or was already unknown. The response has no content.',
  })
  @ApiIdentityErrorResponses({
    400: VALIDATION_FAILURE,
    401: 'The access token is invalid or missing, or the refresh token belongs to another user.',
    500: UNEXPECTED_FAILURE,
  })
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async logout(@Req() req: Request, @Body() dto: LogoutDto): Promise<void> {
    const user = req.user as AuthenticatedUser;
    try {
      await this.logoutUseCase.execute(user.id, dto.refreshToken);
    } catch (error) {
      if (error instanceof DomainError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }

  @Get('verify')
  @ApiTags('Authentication')
  @ApiOkResponse({
    type: VerifiedUserDto,
    description: 'The email address is verified.',
  })
  @ApiIdentityErrorResponses({
    400: 'The verification token is invalid or expired.',
    500: UNEXPECTED_FAILURE,
  })
  @ApiQuery({
    name: 'token',
    required: true,
    description:
      'The verification token returned by registration. It is single-purpose and time-bounded. Treat it as a secret.',
    schema: { type: 'string' },
  })
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
  @ApiTags('OAuth')
  @ApiOperation({
    description:
      'A browser redirect into the Google authorization flow, performed by the guard before the handler runs. A documentation client cannot complete it: the provider takes over from the redirect.',
  })
  @ApiResponse({
    status: 302,
    description: 'The browser is redirected to the Google authorization flow.',
    headers: {
      Location: {
        description: 'The provider authorization location for the browser.',
        schema: { type: 'string' },
      },
    },
  })
  @UseGuards(GoogleAuthGuard)
  googleLogin() {
    // Guard redirects to Google's consent screen; this body never runs.
  }

  @Get('oauth/google/callback')
  @ApiTags('OAuth')
  @ApiOperation({
    description:
      'A provider callback: Google redirects the browser back here after authorization, and the response is the token pair as JSON. A documentation client cannot complete it, because the provider supplies the authorization result.',
  })
  @ApiOkResponse({
    type: AuthTokensDto,
    description:
      'The provider authentication is verified, and a token pair is issued.',
  })
  @ApiIdentityErrorResponses({
    401: 'The provider authentication failed, or the provider email cannot be safely linked.',
    500: UNEXPECTED_FAILURE,
  })
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: Request) {
    return this.issueAuthTokensUseCase.execute(req.user as User);
  }

  @Get('oauth/github')
  @ApiTags('OAuth')
  @ApiOperation({
    description:
      'A browser redirect into the GitHub authorization flow, performed by the guard before the handler runs. A documentation client cannot complete it: the provider takes over from the redirect.',
  })
  @ApiResponse({
    status: 302,
    description: 'The browser is redirected to the GitHub authorization flow.',
    headers: {
      Location: {
        description: 'The provider authorization location for the browser.',
        schema: { type: 'string' },
      },
    },
  })
  @UseGuards(GithubAuthGuard)
  githubLogin() {
    // Guard redirects to GitHub's consent screen; this body never runs.
  }

  @Get('oauth/github/callback')
  @ApiTags('OAuth')
  @ApiOperation({
    description:
      'A provider callback: GitHub redirects the browser back here after authorization, and the response is the token pair as JSON. A documentation client cannot complete it, because the provider supplies the authorization result.',
  })
  @ApiOkResponse({
    type: AuthTokensDto,
    description:
      'The provider authentication is verified, and a token pair is issued.',
  })
  @ApiIdentityErrorResponses({
    401: 'The provider authentication failed, or the provider email cannot be safely linked.',
    500: UNEXPECTED_FAILURE,
  })
  @UseGuards(GithubAuthGuard)
  async githubCallback(@Req() req: Request) {
    return this.issueAuthTokensUseCase.execute(req.user as User);
  }
}
