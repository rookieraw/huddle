import { Body, ConflictException, Controller, Post } from '@nestjs/common';
import { DomainError } from '@huddle/shared-kernel';
import { RegisterUserUseCase } from '../../application/use-cases/register-user.use-case';
import { RegisterUserDto } from './dto/register-user.dto';

@Controller('auth')
export class IdentityController {
  constructor(private readonly registerUserUseCase: RegisterUserUseCase) {}

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
}
