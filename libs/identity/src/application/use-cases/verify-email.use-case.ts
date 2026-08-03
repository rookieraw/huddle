import { DomainError } from '@huddle/shared-kernel';
import { User } from '../../domain/user.entity';
import { UserRepository } from '../ports/user.repository.port';

export class VerifyEmailUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(token: string): Promise<User> {
    const user = await this.userRepository.findByVerificationToken(token);
    if (!user) {
      throw new DomainError('Invalid or expired verification token');
    }

    user.verifyEmail();
    await this.userRepository.save(user);

    return user;
  }
}
