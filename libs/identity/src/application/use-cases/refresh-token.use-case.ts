import { DomainError } from '@huddle/shared-kernel';
import { RefreshToken } from '../../domain/refresh-token.entity';
import { RefreshTokenRepository } from '../ports/refresh-token.repository.port';

export class RefreshTokenUseCase {
  constructor(
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async execute(rawToken: string): Promise<{
    refreshToken: RefreshToken;
    rawToken: string;
  }> {
    const tokenHash = RefreshToken.hashToken(rawToken);
    const existing =
      await this.refreshTokenRepository.findByTokenHash(tokenHash);

    if (!existing) {
      throw new DomainError('Invalid refresh token');
    }

    if (existing.isExpired()) {
      throw new DomainError('Invalid refresh token');
    }

    if (existing.isRevoked()) {
      const allUserTokens = await this.refreshTokenRepository.findAllByUserId(
        existing.getUserId(),
      );
      for (const token of allUserTokens) {
        token.revoke();
        await this.refreshTokenRepository.save(token);
      }
      throw new DomainError('Invalid refresh token');
    }

    existing.revoke();
    await this.refreshTokenRepository.save(existing);

    const { refreshToken: newToken, rawToken: newRawToken } =
      RefreshToken.issue(existing.getUserId());
    await this.refreshTokenRepository.save(newToken);

    return { refreshToken: newToken, rawToken: newRawToken };
  }
}
