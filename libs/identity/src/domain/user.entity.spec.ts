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

    it('has no OAuth provider for a password-registered user', async () => {
      const { user } = await User.register(
        'ada@example.com',
        'correct-horse-battery',
      );

      expect(user.getOAuthProvider()).toBeNull();
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
  });

  describe('registerViaOAuth', () => {
    it('creates a user with no password hash and a pre-verified email', () => {
      const { user } = User.registerViaOAuth(
        'ada@example.com',
        'google',
        'google-sub-123',
      );

      expect(user.isEmailVerified()).toBe(true);
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

      expect(user.getOAuthProvider()).toBe('google');
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

  describe('getOAuthProviderId', () => {
    it('returns null for a password-registered user', async () => {
      const { user } = await User.register(
        'ada@example.com',
        'correct-horse-battery',
      );

      expect(user.getOAuthProviderId()).toBeNull();
    });

    it('returns the external provider id for an OAuth-registered user', () => {
      const { user } = User.registerViaOAuth(
        'ada@example.com',
        'google',
        'google-sub-123',
      );

      expect(user.getOAuthProviderId()).toBe('google-sub-123');
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
        oauthProvider: null,
        oauthProviderId: null,
      });

      expect(user.id).toBe('existing-id');
      expect(user.getEmail()).toBe('ada@example.com');
      expect(user.isEmailVerified()).toBe(true);
      expect(user.getPasswordHash()?.value).toBe(persistedHash);
    });

    it('rebuilds an OAuth-based user with no password hash', () => {
      const user = User.reconstitute({
        id: 'existing-id',
        email: 'ada@example.com',
        passwordHash: null,
        emailVerified: true,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        oauthProvider: 'google',
        oauthProviderId: 'google-sub-123',
      });

      expect(user.getPasswordHash()).toBeNull();
      expect(user.getOAuthProvider()).toBe('google');
      expect(user.getOAuthProviderId()).toBe('google-sub-123');
    });
  });
});
