import { JwtService } from '@nestjs/jwt';
import { JwtAuthenticationApi } from './jwt-authentication-api';

describe('JwtAuthenticationApi', () => {
  it('verifies a valid access token and returns only its trusted principal', async () => {
    const jwtService = new JwtService({
      secret: 'authentication-api-test-secret',
      signOptions: { expiresIn: '15m' },
    });
    const authenticationApi = new JwtAuthenticationApi(jwtService);
    const accessToken = await jwtService.signAsync({
      sub: 'user-123',
      email: 'ada@example.com',
      tokenType: 'access',
    });
    const decoded = jwtService.decode(accessToken) as { exp: number };

    const principal = await authenticationApi.verifyAccessToken(accessToken);

    expect(principal).toEqual({
      userId: 'user-123',
      expiresAt: new Date(decoded.exp * 1000),
    });
  });
});
