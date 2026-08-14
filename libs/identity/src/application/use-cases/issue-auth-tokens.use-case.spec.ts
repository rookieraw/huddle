import { User } from '../../domain/user.entity';
import { RefreshToken } from '../../domain/refresh-token.entity';
import { DisplayName } from '../../domain/value-objects/display-name.vo';
import { RefreshTokenRepository } from '../ports/refresh-token.repository.port';
import { TokenIssuer, AccessTokenPayload } from '../ports/token-issuer.port';
import { IssueRefreshTokenUseCase } from './issue-refresh-token.use-case';
import { IssueAuthTokensUseCase } from './issue-auth-tokens.use-case';

class FakeTokenIssuer implements TokenIssuer {
  public lastPayload: AccessTokenPayload | null = null;

  async issueAccessToken(payload: AccessTokenPayload): Promise<string> {
    this.lastPayload = payload;
    return `fake-access-token-for-${payload.sub}`;
  }
}

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

describe('IssueAuthTokensUseCase', () => {
  it('issues an access token built from the user id and email', async () => {
    const tokenIssuer = new FakeTokenIssuer();
    const issueRefreshTokenUseCase = new IssueRefreshTokenUseCase(
      new InMemoryRefreshTokenRepository(),
    );
    const useCase = new IssueAuthTokensUseCase(
      tokenIssuer,
      issueRefreshTokenUseCase,
    );
    const { user } = await User.register(
      'ada@example.com',
      'password123',
      DisplayName.create('Ada Lovelace'),
    );

    const { accessToken } = await useCase.execute(user);

    expect(accessToken).toBe(`fake-access-token-for-${user.id}`);
    expect(tokenIssuer.lastPayload).toEqual({
      sub: user.id,
      email: 'ada@example.com',
    });
  });

  it('issues and persists a refresh token for the same user', async () => {
    const refreshTokenRepository = new InMemoryRefreshTokenRepository();
    const useCase = new IssueAuthTokensUseCase(
      new FakeTokenIssuer(),
      new IssueRefreshTokenUseCase(refreshTokenRepository),
    );
    const { user } = await User.register(
      'ada@example.com',
      'password123',
      DisplayName.create('Ada Lovelace'),
    );

    const { refreshToken } = await useCase.execute(user);

    const persisted = await refreshTokenRepository.findByTokenHash(
      RefreshToken.hashToken(refreshToken),
    );
    expect(persisted).not.toBeNull();
    expect(persisted?.getUserId()).toBe(user.id);
  });

  it('returns different access tokens for different users', async () => {
    const useCase = new IssueAuthTokensUseCase(
      new FakeTokenIssuer(),
      new IssueRefreshTokenUseCase(new InMemoryRefreshTokenRepository()),
    );
    const { user: userA } = await User.register(
      'a@example.com',
      'password123',
      DisplayName.create('User A'),
    );
    const { user: userB } = await User.register(
      'b@example.com',
      'password123',
      DisplayName.create('User B'),
    );

    const tokensA = await useCase.execute(userA);
    const tokensB = await useCase.execute(userB);

    expect(tokensA.accessToken).not.toBe(tokensB.accessToken);
  });
});
