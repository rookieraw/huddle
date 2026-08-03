import { RefreshToken } from '../../domain/refresh-token.entity';
import { RefreshTokenRepository } from '../ports/refresh-token.repository.port';

export class IssueRefreshTokenUseCase {
  constructor(
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async execute(userId: string): Promise<{
    refreshToken: RefreshToken;
    rawToken: string;
  }> {
    const { refreshToken, rawToken } = RefreshToken.issue(userId);
    await this.refreshTokenRepository.save(refreshToken);
    return { refreshToken, rawToken };
  }
}
