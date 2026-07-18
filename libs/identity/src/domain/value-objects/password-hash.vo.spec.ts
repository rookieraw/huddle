import { PasswordHash } from './password-hash.vo';

describe('PasswordHash', () => {
  describe('create', () => {
    it('creates a PasswordHash from a valid plaintext password', async () => {
      const passwordHash = await PasswordHash.fromPlainText(
        'correct-horse-battery',
      );

      expect(passwordHash).toBeInstanceOf(PasswordHash);
      expect(passwordHash.value).toMatch(/^\$argon2id\$/);
    });

    it('rejects a password shorter than 8 characters', async () => {
      await expect(PasswordHash.fromPlainText('short')).rejects.toThrow(
        'Password must be at least 8 characters',
      );
    });

    it('produces a different hash each time, even for the same password', async () => {
      const first = await PasswordHash.fromPlainText('correct-horse-battery');
      const second = await PasswordHash.fromPlainText('correct-horse-battery');

      expect(first.value).not.toBe(second.value);
    });
  });

  describe('fromHash', () => {
    it('reconstructs a PasswordHash from an existing hash string without validation', () => {
      const existingHash =
        '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$c29tZWhhc2g';

      const passwordHash = PasswordHash.fromHash(existingHash);

      expect(passwordHash.value).toBe(existingHash);
    });
  });

  describe('verify', () => {
    it('returns true when the plaintext matches the hash', async () => {
      const passwordHash = await PasswordHash.fromPlainText(
        'correct-horse-battery',
      );

      await expect(passwordHash.verify('correct-horse-battery')).resolves.toBe(
        true,
      );
    });

    it('returns false when the plaintext does not match the hash', async () => {
      const passwordHash = await PasswordHash.fromPlainText(
        'correct-horse-battery',
      );

      await expect(passwordHash.verify('wrong-password')).resolves.toBe(false);
    });
  });
});
