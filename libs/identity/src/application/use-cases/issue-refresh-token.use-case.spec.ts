import { RefreshToken } from '../../domain/refresh-token.entity';
import { RefreshTokenRepository } from '../ports/refresh-token.repository.port';
import { IssueRefreshTokenUseCase } from './issue-refresh-token.use-case';

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
