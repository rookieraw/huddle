import { DomainError } from '@huddle/shared-kernel';
import { RefreshToken } from '../../domain/refresh-token.entity';
import { InMemoryRefreshTokenRepository } from '../../test-support/in-memory-refresh-token.repository';
import { LogoutUseCase } from './logout.use-case';

describe('LogoutUseCase', () => {
  it('revokes the presented token when it belongs to the requesting user', async () => {
    const repository = new InMemoryRefreshTokenRepository();
    const { refreshToken, rawToken } = RefreshToken.issue('user-123');
    await repository.save(refreshToken);
    const useCase = new LogoutUseCase(repository);

    await useCase.execute('user-123', rawToken);

    const persisted = await repository.findByTokenHash(
      RefreshToken.hashToken(rawToken),
    );
    expect(persisted?.isRevoked()).toBe(true);
  });

  it('calls repository.save even when the token was already revoked', async () => {
    const repository = new InMemoryRefreshTokenRepository();
    const saveSpy = jest.spyOn(repository, 'save');
    const { refreshToken, rawToken } = RefreshToken.issue('user-123');
    refreshToken.revoke();
    await repository.save(refreshToken);
    saveSpy.mockClear();
    const useCase = new LogoutUseCase(repository);

    await useCase.execute('user-123', rawToken);

    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it('revokes an already-expired token — logout does not require the token to still be valid', async () => {
    const repository = new InMemoryRefreshTokenRepository();
    const expiredToken = RefreshToken.reconstitute({
      id: 'expired-token-id',
      userId: 'user-123',
      tokenHash: RefreshToken.hashToken('some-raw-token'),
      expiresAt: new Date('2020-01-01T00:00:00.000Z'),
      createdAt: new Date('2019-12-25T00:00:00.000Z'),
      revokedAt: null,
    });
    await repository.save(expiredToken);
    const useCase = new LogoutUseCase(repository);

    await useCase.execute('user-123', 'some-raw-token');

    const persisted = await repository.findByTokenHash(
      RefreshToken.hashToken('some-raw-token'),
    );
    expect(persisted?.isRevoked()).toBe(true);
  });

  it('rejects when the presented token belongs to a different user', async () => {
    const repository = new InMemoryRefreshTokenRepository();
    const { refreshToken, rawToken } = RefreshToken.issue('user-123');
    await repository.save(refreshToken);
    const useCase = new LogoutUseCase(repository);

    await expect(useCase.execute('someone-else', rawToken)).rejects.toThrow(
      DomainError,
    );

    const persisted = await repository.findByTokenHash(
      RefreshToken.hashToken(rawToken),
    );
    expect(persisted?.isRevoked()).toBe(false);
  });

  it('succeeds as a no-op when the token does not exist (idempotent logout)', async () => {
    const repository = new InMemoryRefreshTokenRepository();
    const useCase = new LogoutUseCase(repository);

    await expect(
      useCase.execute('user-123', 'never-issued-token'),
    ).resolves.toBeUndefined();
  });

  it('does not revoke the user other refresh tokens', async () => {
    const repository = new InMemoryRefreshTokenRepository();
    const { refreshToken: tokenA, rawToken: rawA } =
      RefreshToken.issue('user-123');
    const { refreshToken: tokenB } = RefreshToken.issue('user-123');
    await repository.save(tokenA);
    await repository.save(tokenB);
    const useCase = new LogoutUseCase(repository);

    await useCase.execute('user-123', rawA);

    const allTokens = await repository.findAllByUserId('user-123');
    const other = allTokens.find(
      (token) => token.getTokenHash() === tokenB.getTokenHash(),
    );
    expect(other?.isRevoked()).toBe(false);
  });
});
