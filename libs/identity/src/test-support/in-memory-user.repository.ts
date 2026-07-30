import { User } from '../domain/user.entity';
import { UserRepository } from '../application/ports/user.repository.port';

export class InMemoryUserRepository implements UserRepository {
  private readonly usersByEmail = new Map<string, User>();

  async findByEmail(email: string): Promise<User | null> {
    return this.usersByEmail.get(email) ?? null;
  }

  async findByVerificationToken(token: string): Promise<User | null> {
    for (const user of this.usersByEmail.values()) {
      if (user.getVerificationToken() === token) {
        return user;
      }
    }
    return null;
  }

  async findById(id: string): Promise<User | null> {
    for (const user of this.usersByEmail.values()) {
      if (user.id === id) {
        return user;
      }
    }
    return null;
  }

  async findByOAuthProvider(
    provider: 'google' | 'github',
    providerId: string,
  ): Promise<User | null> {
    for (const user of this.usersByEmail.values()) {
      if (user.getOAuthProviderId(provider) === providerId) {
        return user;
      }
    }
    return null;
  }

  async save(user: User): Promise<void> {
    this.usersByEmail.set(user.getEmail(), user);
  }
}
