import { randomUUID } from 'node:crypto';
import { DomainError } from '@huddle/shared-kernel';
import { PasswordHash } from './value-objects/password-hash.vo';
import { UserCreatedEvent } from './events/user-created.event';
import { UserVerifiedEvent } from './events/user-verified.event';

export class User {
  private constructor(
    public readonly id: string,
    private email: string,
    private passwordHash: PasswordHash | null,
    private emailVerified: boolean,
    private readonly createdAt: Date,
    private readonly oauthProvider: string | null,
  ) {}

  static async register(
    email: string,
    plainPassword: string,
  ): Promise<{ user: User; event: UserCreatedEvent }> {
    const hash = await PasswordHash.fromPlainText(plainPassword);
    const user = new User(randomUUID(), email, hash, false, new Date(), null);
    return { user, event: new UserCreatedEvent(user.id, user.email) };
  }

  static registerViaOAuth(
    email: string,
    provider: 'google' | 'github',
  ): { user: User; event: UserCreatedEvent } {
    const user = new User(
      randomUUID(),
      email,
      null,
      true,
      new Date(),
      provider,
    );
    return { user, event: new UserCreatedEvent(user.id, user.email) };
  }

  verifyEmail(): UserVerifiedEvent {
    if (this.emailVerified) {
      throw new DomainError('Email already verified');
    }
    this.emailVerified = true;
    return new UserVerifiedEvent(this.id);
  }

  async verifyPassword(plainPassword: string): Promise<boolean> {
    if (!this.passwordHash) {
      return false;
    }
    return this.passwordHash.verify(plainPassword);
  }

  isEmailVerified(): boolean {
    return this.emailVerified;
  }

  getOAuthProvider(): string | null {
    return this.oauthProvider;
  }
}
