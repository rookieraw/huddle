import { DomainError } from '@huddle/shared-kernel';
import { User } from './user.entity';
import { PasswordHash } from './value-objects/password-hash.vo';

describe('User', () => {
  describe('register', () => {
    it('creates a user with a hashed password and unverified email', async () => {
      const { user } = await User.register(
        'ada@example.com',
        'correct-horse-battery',
      );

      expect(user.isEmailVerified()).toBe(false);
    });

    it('has no linked OAuth providers for a password-registered user', async () => {
      const { user } = await User.register(
        'ada@example.com',
        'correct-horse-battery',
      );

      expect(user.getOAuthProviders()).toEqual([]);
    });

    it('assigns a unique id to each registered user', async () => {
      const { user: first } = await User.register(
        'ada@example.com',
        'correct-horse-battery',
      );
      const { user: second } = await User.register(
        'grace@example.com',
        'correct-horse-battery',
      );

      expect(first.id).not.toBe(second.id);
    });

    it('returns a UserCreatedEvent carrying the new user id and email', async () => {
      const { user, event } = await User.register(
        'ada@example.com',
        'correct-horse-battery',
      );

      expect(event.userId).toBe(user.id);
      expect(event.email).toBe('ada@example.com');
    });

    it('propagates the password-too-short rule from PasswordHash', async () => {
      await expect(User.register('ada@example.com', 'short')).rejects.toThrow(
        DomainError,
      );
    });

    it('returns the email the user registered with', async () => {
      const { user } = await User.register(
        'ada@example.com',
        'correct-horse-battery',
      );

      expect(user.getEmail()).toBe('ada@example.com');
    });

    it('generates a verification token that expires in 24 hours', async () => {
      const { user } = await User.register(
        'ada@example.com',
        'correct-horse-battery',
      );

      expect(user.getVerificationToken()).not.toBeNull();
      const expiresAt = user.getVerificationTokenExpiresAt();
      expect(expiresAt).not.toBeNull();
      expect(expiresAt!.getTime()).toBeGreaterThan(Date.now());
      expect(expiresAt!.getTime()).toBeLessThanOrEqual(
        Date.now() + 24 * 60 * 60 * 1000,
      );
    });
  });

  describe('registerViaOAuth', () => {
    it('creates a user with no password hash and a pre-verified email', () => {
      const { user } = User.registerViaOAuth(
        'ada@example.com',
        'google',
        'google-sub-123',
      );

      expect(user.isEmailVerified()).toBe(true);
      expect(user.getPasswordHash()).toBeNull();
    });

    it('returns a UserCreatedEvent carrying the new user id and email', () => {
      const { user, event } = User.registerViaOAuth(
        'ada@example.com',
        'github',
        'github-id-456',
      );

      expect(event.userId).toBe(user.id);
      expect(event.email).toBe('ada@example.com');
    });

    it('records which OAuth provider was used', () => {
      const { user } = User.registerViaOAuth(
        'ada@example.com',
        'google',
        'google-sub-123',
      );

      expect(user.getOAuthProviders()).toEqual([
        { provider: 'google', providerId: 'google-sub-123' },
      ]);
    });

    it('has no verification token, since OAuth accounts are pre-verified', () => {
      const { user } = User.registerViaOAuth(
        'ada@example.com',
        'google',
        'google-sub-123',
      );

      expect(user.getVerificationToken()).toBeNull();
      expect(user.getVerificationTokenExpiresAt()).toBeNull();
    });
  });

  describe('getOAuthProviderId', () => {
    it('returns null for a provider that is not linked', async () => {
      const { user } = await User.register(
        'ada@example.com',
        'correct-horse-battery',
      );

      expect(user.getOAuthProviderId('google')).toBeNull();
    });

    it('returns the external provider id for a linked provider', () => {
      const { user } = User.registerViaOAuth(
        'ada@example.com',
        'google',
        'google-sub-123',
      );

      expect(user.getOAuthProviderId('google')).toBe('google-sub-123');
      expect(user.getOAuthProviderId('github')).toBeNull();
    });
  });

  describe('linkOAuthProvider', () => {
    it('attaches an OAuth provider to a password-registered user', async () => {
      const { user } = await User.register(
        'ada@example.com',
        'correct-horse-battery',
      );

      user.linkOAuthProvider('google', 'google-sub-123');

      expect(user.getOAuthProviderId('google')).toBe('google-sub-123');
    });

    it('does not affect the existing password hash', async () => {
      const { user } = await User.register(
        'ada@example.com',
        'correct-horse-battery',
      );
      const originalHash = user.getPasswordHash();

      user.linkOAuthProvider('google', 'google-sub-123');

      expect(user.getPasswordHash()).toBe(originalHash);
    });

    it('allows linking a second, different provider', () => {
      const { user } = User.registerViaOAuth(
        'ada@example.com',
        'google',
        'google-sub-123',
      );

      user.linkOAuthProvider('github', 'github-id-456');

      expect(user.getOAuthProviders()).toEqual([
        { provider: 'google', providerId: 'google-sub-123' },
        { provider: 'github', providerId: 'github-id-456' },
      ]);
    });

    it('is idempotent when re-linking the same provider and providerId', () => {
      const { user } = User.registerViaOAuth(
        'ada@example.com',
        'google',
        'google-sub-123',
      );

      expect(() =>
        user.linkOAuthProvider('google', 'google-sub-123'),
      ).not.toThrow();
      expect(user.getOAuthProviders()).toHaveLength(1);
    });

    it('throws DomainError when the same provider is already linked to a different providerId', () => {
      const { user } = User.registerViaOAuth(
        'ada@example.com',
        'google',
        'google-sub-123',
      );

      expect(() => user.linkOAuthProvider('google', 'google-sub-999')).toThrow(
        DomainError,
      );
    });
  });

  describe('unlinkOAuthProvider', () => {
    it('removes a linked provider', () => {
      const { user } = User.registerViaOAuth(
        'ada@example.com',
        'google',
        'google-sub-123',
      );
      user.linkOAuthProvider('github', 'github-id-456');

      user.unlinkOAuthProvider('google');

      expect(user.getOAuthProviders()).toEqual([
        { provider: 'github', providerId: 'github-id-456' },
      ]);
    });

    it('throws DomainError when the provider is not linked', async () => {
      const { user } = await User.register(
        'ada@example.com',
        'correct-horse-battery',
      );

      expect(() => user.unlinkOAuthProvider('google')).toThrow(DomainError);
    });

    it('throws DomainError when it would remove the last authentication method', () => {
      const { user } = User.registerViaOAuth(
        'ada@example.com',
        'google',
        'google-sub-123',
      );

      expect(() => user.unlinkOAuthProvider('google')).toThrow(DomainError);
    });

    it('allows unlinking a provider when a password still exists', async () => {
      const { user } = await User.register(
        'ada@example.com',
        'correct-horse-battery',
      );
      user.linkOAuthProvider('google', 'google-sub-123');

      expect(() => user.unlinkOAuthProvider('google')).not.toThrow();
    });
  });

  describe('reconstitute', () => {
    it('rebuilds a password-based user from persisted data without re-validating', () => {
      const persistedHash =
        '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$c29tZWhhc2g';

      const user = User.reconstitute({
        id: 'existing-id',
        email: 'ada@example.com',
        passwordHash: persistedHash,
        emailVerified: true,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        oauthProviders: [],
        verificationToken: null,
        verificationTokenExpiresAt: null,
      });

      expect(user.id).toBe('existing-id');
      expect(user.getEmail()).toBe('ada@example.com');
      expect(user.isEmailVerified()).toBe(true);
      expect(user.getPasswordHash()?.value).toBe(persistedHash);
    });

    it('rebuilds a user with multiple linked OAuth providers', () => {
      const user = User.reconstitute({
        id: 'existing-id',
        email: 'ada@example.com',
        passwordHash: null,
        emailVerified: true,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        oauthProviders: [
          { provider: 'google', providerId: 'google-sub-123' },
          { provider: 'github', providerId: 'github-id-456' },
        ],
        verificationToken: null,
        verificationTokenExpiresAt: null,
      });

      expect(user.getPasswordHash()).toBeNull();
      expect(user.getOAuthProviderId('google')).toBe('google-sub-123');
      expect(user.getOAuthProviderId('github')).toBe('github-id-456');
    });
  });

  describe('verifyEmail', () => {
    it('marks a password-registered user as verified', async () => {
      const { user } = await User.register(
        'ada@example.com',
        'correct-horse-battery',
      );

      user.verifyEmail();

      expect(user.isEmailVerified()).toBe(true);
    });

    it('returns a UserVerifiedEvent carrying the user id', async () => {
      const { user } = await User.register(
        'ada@example.com',
        'correct-horse-battery',
      );

      const event = user.verifyEmail();

      expect(event.userId).toBe(user.id);
    });

    it('throws DomainError when the email is already verified', () => {
      const { user } = User.registerViaOAuth(
        'ada@example.com',
        'google',
        'google-sub-123',
      );

      expect(() => user.verifyEmail()).toThrow(DomainError);
    });

    it('throws DomainError when the verification window has passed', () => {
      const user = User.reconstitute({
        id: 'existing-id',
        email: 'ada@example.com',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$c29tZWhhc2g',
        emailVerified: false,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        oauthProviders: [],
        verificationToken: 'some-token',
        verificationTokenExpiresAt: new Date('2024-01-02T00:00:00.000Z'),
      });

      expect(() => user.verifyEmail()).toThrow(DomainError);
    });
  });

  describe('verifyPassword', () => {
    it('returns true for the correct password', async () => {
      const { user } = await User.register(
        'ada@example.com',
        'correct-horse-battery',
      );

      await expect(user.verifyPassword('correct-horse-battery')).resolves.toBe(
        true,
      );
    });

    it('returns false for an incorrect password', async () => {
      const { user } = await User.register(
        'ada@example.com',
        'correct-horse-battery',
      );

      await expect(user.verifyPassword('wrong-password')).resolves.toBe(false);
    });

    it('returns false for an OAuth-only account regardless of input', async () => {
      const { user } = User.registerViaOAuth(
        'ada@example.com',
        'google',
        'google-sub-123',
      );

      await expect(user.verifyPassword('anything')).resolves.toBe(false);
    });
  });

  describe('getPasswordHash', () => {
    it('returns null for an OAuth-only user', () => {
      const { user } = User.registerViaOAuth(
        'ada@example.com',
        'google',
        'google-sub-123',
      );

      expect(user.getPasswordHash()).toBeNull();
    });

    it('returns the PasswordHash for a password-registered user', async () => {
      const { user } = await User.register(
        'ada@example.com',
        'correct-horse-battery',
      );

      expect(user.getPasswordHash()).toBeInstanceOf(PasswordHash);
    });
  });

  describe('getCreatedAt', () => {
    it('returns the registration timestamp', async () => {
      const before = Date.now();
      const { user } = await User.register(
        'ada@example.com',
        'correct-horse-battery',
      );
      const after = Date.now();

      expect(user.getCreatedAt().getTime()).toBeGreaterThanOrEqual(before);
      expect(user.getCreatedAt().getTime()).toBeLessThanOrEqual(after);
    });
  });
});
