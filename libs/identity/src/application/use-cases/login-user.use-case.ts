import { DomainError } from '@huddle/shared-kernel';
import { User } from '../../domain/user.entity';
import { UserRepository } from '../ports/user.repository.port';

export class LoginUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(email: string, plainPassword: string): Promise<User> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new DomainError('Invalid email or password');
    }

    const isPasswordValid = await user.verifyPassword(plainPassword);
    if (!isPasswordValid) {
      throw new DomainError('Invalid email or password');
    }

    if (!user.isEmailVerified()) {
      throw new DomainError('Email not verified');
    }

    return user;
  }
}
