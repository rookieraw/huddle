import { DomainError } from '@huddle/shared-kernel';
import { User } from '../../domain/user.entity';
import { UserRepository } from '../ports/user.repository.port';
import { OAuthLoginUseCase } from './oauth-login.use-case';

class InMemoryUserRepository implements UserRepository {
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

describe('OAuthLoginUseCase', () => {
  it('registers a brand-new user when neither provider nor email match', async () => {
    const repository = new InMemoryUserRepository();
    const useCase = new OAuthLoginUseCase(repository);

    const user = await useCase.execute({
      provider: 'google',
      providerId: 'google-sub-123',
      email: 'ada@example.com',
      emailVerifiedByProvider: true,
    });

    expect(user.getEmail()).toBe('ada@example.com');
    expect(user.getOAuthProviderId('google')).toBe('google-sub-123');
    expect(user.isEmailVerified()).toBe(true);
  });

  it('persists the newly registered user', async () => {
    const repository = new InMemoryUserRepository();
    const useCase = new OAuthLoginUseCase(repository);

    const user = await useCase.execute({
      provider: 'google',
      providerId: 'google-sub-123',
      email: 'ada@example.com',
      emailVerifiedByProvider: true,
    });

    await expect(repository.findByEmail('ada@example.com')).resolves.toBe(user);
  });

  it('returns the existing user on a repeat login with the same provider identity', async () => {
    const repository = new InMemoryUserRepository();
    const useCase = new OAuthLoginUseCase(repository);
    const firstLogin = await useCase.execute({
      provider: 'google',
      providerId: 'google-sub-123',
      email: 'ada@example.com',
      emailVerifiedByProvider: true,
    });

    const secondLogin = await useCase.execute({
      provider: 'google',
      providerId: 'google-sub-123',
      email: 'ada@example.com',
      emailVerifiedByProvider: true,
    });

    expect(secondLogin.id).toBe(firstLogin.id);
  });

  it('does not write anything when the provider identity already matches', async () => {
    const repository = new InMemoryUserRepository();
    const useCase = new OAuthLoginUseCase(repository);
    await useCase.execute({
      provider: 'google',
      providerId: 'google-sub-123',
      email: 'ada@example.com',
      emailVerifiedByProvider: true,
    });
    const saveSpy = jest.spyOn(repository, 'save');

    await useCase.execute({
      provider: 'google',
      providerId: 'google-sub-123',
      email: 'ada@example.com',
      emailVerifiedByProvider: true,
    });

    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('links the provider to an existing password-based account with a verified-matching email', async () => {
    const repository = new InMemoryUserRepository();
    const { user: existing } = await User.register(
      'ada@example.com',
      'correct-horse-battery',
    );
    existing.verifyEmail(); // account must already be verified for linking to be trustworthy
    await repository.save(existing);
    const useCase = new OAuthLoginUseCase(repository);

    const user = await useCase.execute({
      provider: 'google',
      providerId: 'google-sub-123',
      email: 'ada@example.com',
      emailVerifiedByProvider: true,
    });

    expect(user.id).toBe(existing.id);
    expect(user.getOAuthProviderId('google')).toBe('google-sub-123');
    expect(user.getPasswordHash()).not.toBeNull();
  });

  it('links a second provider to an account that already has one linked', async () => {
    const repository = new InMemoryUserRepository();
    const { user: existing } = User.registerViaOAuth(
      'ada@example.com',
      'google',
      'google-sub-123',
    );
    await repository.save(existing);
    const useCase = new OAuthLoginUseCase(repository);

    const user = await useCase.execute({
      provider: 'github',
      providerId: 'github-id-456',
      email: 'ada@example.com',
      emailVerifiedByProvider: true,
    });

    expect(user.id).toBe(existing.id);
    expect(user.getOAuthProviderId('google')).toBe('google-sub-123');
    expect(user.getOAuthProviderId('github')).toBe('github-id-456');
  });

  it('rejects linking when the provider does not assert the email is verified', async () => {
    const repository = new InMemoryUserRepository();
    const { user: existing } = await User.register(
      'ada@example.com',
      'correct-horse-battery',
    );
    await repository.save(existing);
    const useCase = new OAuthLoginUseCase(repository);

    await expect(
      useCase.execute({
        provider: 'google',
        providerId: 'google-sub-123',
        email: 'ada@example.com',
        emailVerifiedByProvider: false,
      }),
    ).rejects.toThrow(DomainError);
  });

  it('rejects linking when the existing account itself has never been verified, even if the provider asserts a verified email', async () => {
    const repository = new InMemoryUserRepository();
    const { user: existing } = await User.register(
      'ada@example.com',
      'correct-horse-battery',
    );
    // deliberately not verified — guards against pre-hijacking: an attacker
    // registering a victim's email with a password they never verify
    await repository.save(existing);
    const useCase = new OAuthLoginUseCase(repository);

    await expect(
      useCase.execute({
        provider: 'google',
        providerId: 'google-sub-123',
        email: 'ada@example.com',
        emailVerifiedByProvider: true,
      }),
    ).rejects.toThrow(DomainError);
  });

  it('does not modify the existing account when rejecting a link to an unverified account', async () => {
    const repository = new InMemoryUserRepository();
    const { user: existing } = await User.register(
      'ada@example.com',
      'correct-horse-battery',
    );
    await repository.save(existing);
    const useCase = new OAuthLoginUseCase(repository);

    await useCase
      .execute({
        provider: 'google',
        providerId: 'google-sub-123',
        email: 'ada@example.com',
        emailVerifiedByProvider: true,
      })
      .catch(() => {});

    expect(existing.getOAuthProviderId('google')).toBeNull();
  });

  it('does not modify the existing account when rejecting an unverified-email link attempt', async () => {
    const repository = new InMemoryUserRepository();
    const { user: existing } = await User.register(
      'ada@example.com',
      'correct-horse-battery',
    );
    await repository.save(existing);
    const useCase = new OAuthLoginUseCase(repository);

    await useCase
      .execute({
        provider: 'google',
        providerId: 'google-sub-123',
        email: 'ada@example.com',
        emailVerifiedByProvider: false,
      })
      .catch(() => {});

    expect(existing.getOAuthProviderId('google')).toBeNull();
  });

  it('propagates the conflict error when the matched email account has the same provider linked to a different providerId', async () => {
    const repository = new InMemoryUserRepository();
    const { user: existing } = User.registerViaOAuth(
      'ada@example.com',
      'google',
      'google-sub-old',
    );
    await repository.save(existing);
    const useCase = new OAuthLoginUseCase(repository);

    await expect(
      useCase.execute({
        provider: 'google',
        providerId: 'google-sub-new',
        email: 'ada@example.com',
        emailVerifiedByProvider: true,
      }),
    ).rejects.toThrow(DomainError);
  });
});
