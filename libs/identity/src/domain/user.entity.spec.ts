import { DomainError } from '@huddle/shared-kernel';
import { User } from './user.entity';

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
  });

  describe('registerViaOAuth', () => {
    it('creates a user with no password hash and a pre-verified email', () => {
      const { user } = User.registerViaOAuth('ada@example.com', 'google');

      expect(user.isEmailVerified()).toBe(true);
    });

    it('returns a UserCreatedEvent carrying the new user id and email', () => {
      const { user, event } = User.registerViaOAuth(
        'ada@example.com',
        'github',
      );

      expect(event.userId).toBe(user.id);
      expect(event.email).toBe('ada@example.com');
    });

    it('records which OAuth provider was used', () => {
      const { user } = User.registerViaOAuth('ada@example.com', 'google');

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
      const { user } = User.registerViaOAuth('ada@example.com', 'google');

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
      const { user } = User.registerViaOAuth('ada@example.com', 'google');

      await expect(user.verifyPassword('anything')).resolves.toBe(false);
    });
  });
});
