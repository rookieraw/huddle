import { DomainError } from '@huddle/shared-kernel';
import { User } from '../../domain/user.entity';
import { RefreshToken } from '../../domain/refresh-token.entity';
import { InMemoryUserRepository } from '../../test-support/in-memory-user.repository';
import { InMemoryRefreshTokenRepository } from '../../test-support/in-memory-refresh-token.repository';
import { FakeTokenIssuer } from '../../test-support/fake-token-issuer';
import { IssueRefreshTokenUseCase } from './issue-refresh-token.use-case';
import { IssueAuthTokensUseCase } from './issue-auth-tokens.use-case';
import { RefreshTokenUseCase } from './refresh-token.use-case';

function buildUseCase(refreshTokenRepository: InMemoryRefreshTokenRepository) {
  const userRepository = new InMemoryUserRepository();
  const tokenIssuer = new FakeTokenIssuer();
  const issueAuthTokensUseCase = new IssueAuthTokensUseCase(
    tokenIssuer,
    new IssueRefreshTokenUseCase(refreshTokenRepository),
  );
  const useCase = new RefreshTokenUseCase(
    refreshTokenRepository,
    userRepository,
    issueAuthTokensUseCase,
  );
  return { useCase, userRepository, tokenIssuer };
}

describe('RefreshTokenUseCase', () => {
  it('rejects a raw token that does not match any stored hash', async () => {
    const { useCase } = buildUseCase(new InMemoryRefreshTokenRepository());

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
    const { useCase } = buildUseCase(repository);

    const attempt = useCase.execute(rawToken);
    await expect(attempt).rejects.toThrow(DomainError);
    await expect(attempt).rejects.toThrow('Invalid refresh token');
  });

  it('revokes all of the user tokens when a revoked token is presented (reuse detection)', async () => {
    const repository = new InMemoryRefreshTokenRepository();
    const { refreshToken: revokedToken, rawToken: revokedRawToken } =
      RefreshToken.issue('user-123');
    revokedToken.revoke();
    await repository.save(revokedToken);

    const { refreshToken: otherActiveToken } = RefreshToken.issue('user-123');
    await repository.save(otherActiveToken);

    const { useCase } = buildUseCase(repository);

    const attempt = useCase.execute(revokedRawToken);
    await expect(attempt).rejects.toThrow(DomainError);
    await expect(attempt).rejects.toThrow('Invalid refresh token');

    const allTokens = await repository.findAllByUserId('user-123');
    expect(allTokens.every((token) => token.isRevoked())).toBe(true);
  });

  it('rejects a valid, unexpired token whose user no longer exists', async () => {
    const repository = new InMemoryRefreshTokenRepository();
    const { refreshToken, rawToken } = RefreshToken.issue('ghost-user-id');
    await repository.save(refreshToken);
    const { useCase } = buildUseCase(repository);

    const attempt = useCase.execute(rawToken);
    await expect(attempt).rejects.toThrow(DomainError);
    await expect(attempt).rejects.toThrow('Invalid refresh token');
  });

  it('rotates a valid token: revokes the old one, persists a new one under the same user', async () => {
    const repository = new InMemoryRefreshTokenRepository();
    const { user } = await User.register('ada@example.com', 'password123');
    user.verifyEmail();
    const { useCase, userRepository } = buildUseCase(repository);
    await userRepository.save(user);
    const { refreshToken: oldToken, rawToken: oldRawToken } =
      RefreshToken.issue(user.id);
    await repository.save(oldToken);

    const { accessToken, refreshToken: newRawToken } =
      await useCase.execute(oldRawToken);

    expect(newRawToken).not.toBe(oldRawToken);
    expect(typeof accessToken).toBe('string');
    expect(accessToken.length).toBeGreaterThan(0);

    const persistedOld = await repository.findByTokenHash(
      RefreshToken.hashToken(oldRawToken),
    );
    expect(persistedOld?.isRevoked()).toBe(true);

    const persistedNew = await repository.findByTokenHash(
      RefreshToken.hashToken(newRawToken),
    );
    expect(persistedNew).not.toBeNull();
    expect(persistedNew?.isRevoked()).toBe(false);
    expect(persistedNew?.getUserId()).toBe(user.id);
  });

  it('embeds the current user id and email in the rotated access token payload', async () => {
    const repository = new InMemoryRefreshTokenRepository();
    const { user } = await User.register('ada@example.com', 'password123');
    user.verifyEmail();
    const { useCase, userRepository, tokenIssuer } = buildUseCase(repository);
    await userRepository.save(user);
    const { refreshToken, rawToken } = RefreshToken.issue(user.id);
    await repository.save(refreshToken);

    await useCase.execute(rawToken);

    expect(tokenIssuer.lastPayload).toEqual({
      sub: user.id,
      email: 'ada@example.com',
    });
  });
});
