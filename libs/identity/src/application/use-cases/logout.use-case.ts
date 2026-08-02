import { DomainError } from '@huddle/shared-kernel';
import { RefreshToken } from '../../domain/refresh-token.entity';
import { RefreshTokenRepository } from '../ports/refresh-token.repository.port';

export class LogoutUseCase {
  constructor(
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async execute(userId: string, rawToken: string): Promise<void> {
    const tokenHash = RefreshToken.hashToken(rawToken);
    const existing =
      await this.refreshTokenRepository.findByTokenHash(tokenHash);

    if (!existing) {
      return;
    }

    if (existing.getUserId() !== userId) {
      throw new DomainError('Invalid refresh token');
    }

    existing.revoke();
    await this.refreshTokenRepository.save(existing);
  }
}
