import { JwtService } from '@nestjs/jwt';
import { JwtTokenIssuer } from './jwt-token-issuer';

describe('JwtTokenIssuer', () => {
  it('marks issued access tokens with the supported token type', async () => {
    const jwtService = new JwtService({
      secret: 'token-issuer-test-secret',
      signOptions: { expiresIn: '15m' },
    });
    const tokenIssuer = new JwtTokenIssuer(jwtService);

    const accessToken = await tokenIssuer.issueAccessToken({
      sub: 'user-123',
      email: 'ada@example.com',
    });
    const payload = await jwtService.verifyAsync<{
      sub: string;
      email: string;
      tokenType?: string;
    }>(accessToken);

    expect(payload).toMatchObject({
      sub: 'user-123',
      email: 'ada@example.com',
      tokenType: 'access',
    });
  });
});
