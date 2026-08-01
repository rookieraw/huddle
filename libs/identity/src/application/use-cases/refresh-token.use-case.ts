import { DomainError } from '@huddle/shared-kernel';
import { RefreshToken } from '../../domain/refresh-token.entity';
import { RefreshTokenRepository } from '../ports/refresh-token.repository.port';
import { UserRepository } from '../ports/user.repository.port';
import { IssueAuthTokensUseCase } from './issue-auth-tokens.use-case';

export class RefreshTokenUseCase {
  constructor(
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly userRepository: UserRepository,
    private readonly issueAuthTokensUseCase: IssueAuthTokensUseCase,
  ) {}

  async execute(
    rawToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
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

    const user = await this.userRepository.findById(existing.getUserId());
    if (!user) {
      throw new DomainError('Invalid refresh token');
    }

    return this.issueAuthTokensUseCase.execute(user);
  }
}
