import { User } from '../../domain/user.entity';
import { TokenIssuer } from '../ports/token-issuer.port';
import { IssueRefreshTokenUseCase } from './issue-refresh-token.use-case';

export class IssueAuthTokensUseCase {
  constructor(
    private readonly tokenIssuer: TokenIssuer,
    private readonly issueRefreshTokenUseCase: IssueRefreshTokenUseCase,
  ) {}

  async execute(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await this.tokenIssuer.issueAccessToken({
      sub: user.id,
      email: user.getEmail(),
    });
    const { rawToken: refreshToken } =
      await this.issueRefreshTokenUseCase.execute(user.id);

    return { accessToken, refreshToken };
  }
}
