import { RefreshToken } from '../../domain/refresh-token.entity';
import { InMemoryRefreshTokenRepository } from '../../test-support/in-memory-refresh-token.repository';
import { IssueRefreshTokenUseCase } from './issue-refresh-token.use-case';

describe('IssueRefreshTokenUseCase', () => {
  it('issues and persists a refresh token for the given user', async () => {
    const repository = new InMemoryRefreshTokenRepository();
    const useCase = new IssueRefreshTokenUseCase(repository);

    const { refreshToken, rawToken } = await useCase.execute('user-123');

    expect(refreshToken.getUserId()).toBe('user-123');
    expect(rawToken).toEqual(expect.any(String));
    expect(rawToken.length).toBeGreaterThan(0);

    const persisted = await repository.findByTokenHash(
      RefreshToken.hashToken(rawToken),
    );
    expect(persisted).not.toBeNull();
    expect(persisted?.getUserId()).toBe('user-123');
  });
});
