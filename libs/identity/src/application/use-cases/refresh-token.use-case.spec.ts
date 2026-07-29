import { RefreshToken } from '../../domain/refresh-token.entity';
import { RefreshTokenRepository } from '../ports/refresh-token.repository.port';
import { RefreshTokenUseCase } from './refresh-token.use-case';
import { DomainError } from '@huddle/shared-kernel';

class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  private readonly tokensByHash = new Map<string, RefreshToken>();

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.tokensByHash.get(tokenHash) ?? null;
  }

  async findAllByUserId(userId: string): Promise<RefreshToken[]> {
    return [...this.tokensByHash.values()].filter(
      (token) => token.getUserId() === userId,
    );
  }

  async save(refreshToken: RefreshToken): Promise<void> {
    this.tokensByHash.set(refreshToken.getTokenHash(), refreshToken);
  }
}

describe('RefreshTokenUseCase', () => {
  it('rejects a raw token that does not match any stored hash', async () => {
    const repository = new InMemoryRefreshTokenRepository();
    const useCase = new RefreshTokenUseCase(repository);

    await expect(useCase.execute('never-issued-token')).rejects.toThrow(
      DomainError,
    );
  });

  it('rejects a token that has expired', async () => {
    const repository = new InMemoryRefreshTokenRepository();
    const { refreshToken, rawToken } = RefreshToken.issue('user-123');
    const expiredToken = RefreshToken.reconstitute({
      id: refreshToken.id,
      userId: refreshToken.getUserId(),
      tokenHash: refreshToken.getTokenHash(),
      expiresAt: new Date('2020-01-01T00:00:00.000Z'),
      createdAt: refreshToken.getCreatedAt(),
      revokedAt: null,
    });
    await repository.save(expiredToken);
    const useCase = new RefreshTokenUseCase(repository);

    await expect(useCase.execute(rawToken)).rejects.toThrow(DomainError);
    await expect(useCase.execute(rawToken)).rejects.toThrow(
      'Invalid refresh token',
    );
  });

  it('revokes all of the user tokens when a revoked token is presented (reuse detection)', async () => {
    const repository = new InMemoryRefreshTokenRepository();

    const { refreshToken: revokedToken, rawToken: revokedRawToken } =
      RefreshToken.issue('user-123');
    revokedToken.revoke();
    await repository.save(revokedToken);

    const { refreshToken: otherActiveToken } = RefreshToken.issue('user-123');
    await repository.save(otherActiveToken);

    const useCase = new RefreshTokenUseCase(repository);

    await expect(useCase.execute(revokedRawToken)).rejects.toThrow(
      'Invalid refresh token',
    );

    const allTokens = await repository.findAllByUserId('user-123');
    expect(allTokens.every((token) => token.isRevoked())).toBe(true);
  });

  it('rotates a valid token: revokes the old one and issues a new one', async () => {
    const repository = new InMemoryRefreshTokenRepository();
    const { refreshToken: oldToken, rawToken: oldRawToken } =
      RefreshToken.issue('user-123');
    await repository.save(oldToken);

    const useCase = new RefreshTokenUseCase(repository);

    const { refreshToken: newToken, rawToken: newRawToken } =
      await useCase.execute(oldRawToken);

    expect(newRawToken).not.toBe(oldRawToken);
    expect(newToken.getUserId()).toBe('user-123');
    expect(newToken.isRevoked()).toBe(false);

    const persistedOld = await repository.findByTokenHash(
      RefreshToken.hashToken(oldRawToken),
    );
    expect(persistedOld?.isRevoked()).toBe(true);

    const persistedNew = await repository.findByTokenHash(
      RefreshToken.hashToken(newRawToken),
    );
    expect(persistedNew).not.toBeNull();
    expect(persistedNew?.isRevoked()).toBe(false);
  });
});
