import type { User } from '../../domain/user.entity';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserProfileProjection {
  userId: string;
  displayName: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findByVerificationToken(token: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  findProfilesByIds(userIds: string[]): Promise<UserProfileProjection[]>;
  findByOAuthProvider(
    provider: 'google' | 'github',
    providerId: string,
  ): Promise<User | null>;
  save(user: User): Promise<void>;
}
