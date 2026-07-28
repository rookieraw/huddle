import { RefreshToken } from './refresh-token.entity';

describe('RefreshToken', () => {
  afterEach(() => {
    jest.useRealTimers();
  });
  describe('issue', () => {
    it('returns a raw token distinct from the stored hash', () => {
      const { refreshToken, rawToken } = RefreshToken.issue('user-id-1');

      expect(rawToken).toEqual(expect.any(String));
      expect(refreshToken.getTokenHash()).not.toBe(rawToken);
    });

    it('assigns a unique id to each issued token', () => {
      const first = RefreshToken.issue('user-id-1');
      const second = RefreshToken.issue('user-id-1');

      expect(first.refreshToken.id).not.toBe(second.refreshToken.id);
    });

    it('associates the token with the given user id', () => {
      const { refreshToken } = RefreshToken.issue('user-id-1');

      expect(refreshToken.getUserId()).toBe('user-id-1');
    });

    it('expires 7 days from now by default', () => {
      const now = new Date();
      jest.useFakeTimers();
      jest.setSystemTime(now);

      const { refreshToken } = RefreshToken.issue('user-id-1');

      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(refreshToken.getExpiresAt().getTime()).toBe(
        now.getTime() + sevenDaysMs,
      );
    });

    it('is not revoked when first issued', () => {
      const { refreshToken } = RefreshToken.issue('user-id-1');

      expect(refreshToken.isRevoked()).toBe(false);
    });
  });

  describe('isExpired', () => {
    it('returns false for a freshly issued token', () => {
      const { refreshToken } = RefreshToken.issue('user-id-1');

      expect(refreshToken.isExpired()).toBe(false);
    });

    it('returns true for a token reconstituted with a past expiry', () => {
      const refreshToken = RefreshToken.reconstitute({
        id: 'existing-id',
        userId: 'user-id-1',
        tokenHash: 'some-hash',
        expiresAt: new Date('2020-01-01T00:00:00.000Z'),
        createdAt: new Date('2019-12-25T00:00:00.000Z'),
        revokedAt: null,
      });

      expect(refreshToken.isExpired()).toBe(true);
    });
  });

  describe('revoke', () => {
    it('marks the token as revoked', () => {
      const { refreshToken } = RefreshToken.issue('user-id-1');

      refreshToken.revoke();

      expect(refreshToken.isRevoked()).toBe(true);
    });

    it('is idempotent — revoking twice does not throw', () => {
      const { refreshToken } = RefreshToken.issue('user-id-1');

      refreshToken.revoke();

      expect(() => refreshToken.revoke()).not.toThrow();
      expect(refreshToken.isRevoked()).toBe(true);
    });

    it('exposes the exact revocation timestamp', () => {
      const { refreshToken } = RefreshToken.issue('user-id-1');
      const now = new Date();
      jest.useFakeTimers();
      jest.setSystemTime(now);

      refreshToken.revoke();

      expect(refreshToken.getRevokedAt()).toStrictEqual(now);
    });
  });

  describe('reconstitute', () => {
    it('rebuilds a token from persisted data without regenerating anything', () => {
      const refreshToken = RefreshToken.reconstitute({
        id: 'existing-id',
        userId: 'user-id-1',
        tokenHash: 'persisted-hash',
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        revokedAt: null,
      });

      expect(refreshToken.id).toBe('existing-id');
      expect(refreshToken.getUserId()).toBe('user-id-1');
      expect(refreshToken.getTokenHash()).toBe('persisted-hash');
      expect(refreshToken.isRevoked()).toBe(false);
    });

    it('rebuilds an already-revoked token correctly', () => {
      const refreshToken = RefreshToken.reconstitute({
        id: 'existing-id',
        userId: 'user-id-1',
        tokenHash: 'persisted-hash',
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        revokedAt: new Date('2024-06-01T00:00:00.000Z'),
      });

      expect(refreshToken.isRevoked()).toBe(true);
    });

    it('exposes a revokedAt loaded from persisted data', () => {
      const revokedAt = new Date('2024-06-01T00:00:00.000Z');
      const refreshToken = RefreshToken.reconstitute({
        id: 'existing-id',
        userId: 'user-id-1',
        tokenHash: 'persisted-hash',
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        revokedAt,
      });

      expect(refreshToken.getRevokedAt()).toBe(revokedAt);
    });
  });
});
