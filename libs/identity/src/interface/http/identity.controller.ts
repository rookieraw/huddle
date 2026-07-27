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
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DomainError } from '@huddle/shared-kernel';
import { RegisterUserUseCase } from '../../application/use-cases/register-user.use-case';
import { LoginUserUseCase } from '../../application/use-cases/login-user.use-case';
import { VerifyEmailUseCase } from '../../application/use-cases/verify-email.use-case';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';

@Controller('auth')
export class IdentityController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUserUseCase: LoginUserUseCase,
    private readonly verifyEmailUseCase: VerifyEmailUseCase,
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
      const accessToken = await this.jwtService.signAsync({
        sub: user.id,
        email: user.getEmail(),
      });
      return { accessToken };
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
}
