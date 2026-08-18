import { User } from '../domain/user.entity';
import type {
  UserProfileProjection,
  UserRepository,
} from '../application/ports/user.repository.port';

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

  async findProfilesByIds(userIds: string[]): Promise<UserProfileProjection[]> {
    const requestedUserIds = new Set(userIds);

    return [...this.usersByEmail.values()]
      .filter((user) => requestedUserIds.has(user.id))
      .map((user) => ({
        userId: user.id,
        displayName: user.getDisplayName(),
      }));
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
