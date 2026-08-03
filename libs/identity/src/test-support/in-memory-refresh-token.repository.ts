import { RefreshToken } from '../domain/refresh-token.entity';
import { RefreshTokenRepository } from '../application/ports/refresh-token.repository.port';

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
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
