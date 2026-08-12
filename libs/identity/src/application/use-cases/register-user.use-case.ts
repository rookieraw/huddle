import { DomainError } from '@huddle/shared-kernel';
import { User } from '../../domain/user.entity';
import { DisplayName } from '../../domain/value-objects/display-name.vo';
import { UserCreatedEvent } from '../../domain/events/user-created.event';
import { UserRepository } from '../ports/user.repository.port';

export class RegisterUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(
    email: string,
    plainPassword: string,
    displayName: string,
  ): Promise<{ user: User; event: UserCreatedEvent }> {
    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new DomainError('Email already registered');
    }

    const { user, event } = await User.register(
      email,
      plainPassword,
      DisplayName.create(displayName),
    );
    await this.userRepository.save(user);

    return { user, event };
  }
}
