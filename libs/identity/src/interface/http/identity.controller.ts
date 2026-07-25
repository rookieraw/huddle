import {
  Body,
  ConflictException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DomainError } from '@huddle/shared-kernel';
import { RegisterUserUseCase } from '../../application/use-cases/register-user.use-case';
import { LoginUserUseCase } from '../../application/use-cases/login-user.use-case';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';

@Controller('auth')
export class IdentityController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUserUseCase: LoginUserUseCase,
    private readonly jwtService: JwtService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterUserDto) {
    try {
      const { user } = await this.registerUserUseCase.execute(
        dto.email,
        dto.password,
      );
      return { id: user.id, email: user.getEmail() };
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
}
