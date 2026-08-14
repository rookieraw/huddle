import { randomUUID } from 'node:crypto';
import { DomainError } from '@huddle/shared-kernel';
import { PasswordHash } from './value-objects/password-hash.vo';
import { DisplayName } from './value-objects/display-name.vo';
import { UserCreatedEvent } from './events/user-created.event';
import { UserVerifiedEvent } from './events/user-verified.event';

export type OAuthProviderName = 'google' | 'github';

export interface LinkedOAuthProvider {
  provider: OAuthProviderName;
  providerId: string;
}

export class User {
  private constructor(
    public readonly id: string,
    private email: string,
    private passwordHash: PasswordHash | null,
    private emailVerified: boolean,
    private readonly createdAt: Date,
    private oauthProviders: LinkedOAuthProvider[],
    private verificationToken: string | null,
    private verificationTokenExpiresAt: Date | null,
    private displayName: DisplayName,
  ) {}

  static async register(
    email: string,
    plainPassword: string,
    displayName: DisplayName,
  ): Promise<{ user: User; event: UserCreatedEvent }> {
    const hash = await PasswordHash.fromPlainText(plainPassword);
    const verificationTokenExpiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    );
    const user = new User(
      randomUUID(),
      email,
      hash,
      false,
      new Date(),
      [],
      randomUUID(),
      verificationTokenExpiresAt,
      displayName,
    );
    return { user, event: new UserCreatedEvent(user.id, user.email) };
  }

  static registerViaOAuth(
    email: string,
    provider: OAuthProviderName,
    providerId: string,
    displayName?: DisplayName,
  ): { user: User; event: UserCreatedEvent } {
    const id = randomUUID();
    const resolvedDisplayName =
      displayName ?? DisplayName.create(`User-${id.slice(0, 8)}`);

    const user = new User(
      id,
      email,
      null,
      true,
      new Date(),
      [{ provider, providerId }],
      null,
      null,
      resolvedDisplayName,
    );
    return { user, event: new UserCreatedEvent(user.id, user.email) };
  }

  static reconstitute(data: {
    id: string;
    email: string;
    passwordHash: string | null;
    emailVerified: boolean;
    createdAt: Date;
    oauthProviders: LinkedOAuthProvider[];
    verificationToken: string | null;
    verificationTokenExpiresAt: Date | null;
    displayName: string;
  }): User {
    return new User(
      data.id,
      data.email,
      data.passwordHash ? PasswordHash.fromHash(data.passwordHash) : null,
      data.emailVerified,
      data.createdAt,
      data.oauthProviders,
      data.verificationToken,
      data.verificationTokenExpiresAt,
      DisplayName.fromPersisted(data.displayName),
    );
  }

  verifyEmail(): UserVerifiedEvent {
    if (this.emailVerified) {
      throw new DomainError('Email already verified');
    }
    if (
      !this.verificationTokenExpiresAt ||
      this.verificationTokenExpiresAt.getTime() < Date.now()
    ) {
      throw new DomainError('Verification token has expired');
    }
    this.emailVerified = true;
    this.verificationToken = null;
    this.verificationTokenExpiresAt = null;
    return new UserVerifiedEvent(this.id);
  }

  async verifyPassword(plainPassword: string): Promise<boolean> {
    if (!this.passwordHash) {
      return false;
    }
    return this.passwordHash.verify(plainPassword);
  }

  linkOAuthProvider(provider: OAuthProviderName, providerId: string): void {
    const existing = this.oauthProviders.find((p) => p.provider === provider);

    if (existing) {
      if (existing.providerId !== providerId) {
        throw new DomainError(
          `Provider ${provider} is already linked to a different account`,
        );
      }
      return; // idempotent re-link
    }

    this.oauthProviders.push({ provider, providerId });
  }

  unlinkOAuthProvider(provider: OAuthProviderName): void {
    const existing = this.oauthProviders.find((p) => p.provider === provider);
    if (!existing) {
      throw new DomainError(`Provider ${provider} is not linked`);
    }

    const wouldHaveNoAuthMethod =
      !this.passwordHash && this.oauthProviders.length === 1;
    if (wouldHaveNoAuthMethod) {
      throw new DomainError(
        'Cannot unlink the last remaining authentication method',
      );
    }

    this.oauthProviders = this.oauthProviders.filter(
      (p) => p.provider !== provider,
    );
  }

  getEmail(): string {
    return this.email;
  }

  getPasswordHash(): PasswordHash | null {
    return this.passwordHash;
  }

  isEmailVerified(): boolean {
    return this.emailVerified;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getOAuthProviders(): LinkedOAuthProvider[] {
    return [...this.oauthProviders];
  }

  getOAuthProviderId(provider: OAuthProviderName): string | null {
    return (
      this.oauthProviders.find((p) => p.provider === provider)?.providerId ??
      null
    );
  }

  getVerificationToken(): string | null {
    return this.verificationToken;
  }

  getVerificationTokenExpiresAt(): Date | null {
    return this.verificationTokenExpiresAt;
  }

  getDisplayName(): string {
    return this.displayName.value;
  }
}
