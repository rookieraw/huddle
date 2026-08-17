import { JwtService } from '@nestjs/jwt';
import {
  ExpiredAccessTokenError,
  InvalidAccessTokenError,
  UnsupportedAccessTokenTypeError,
} from '../../application/public-api/authentication-api';
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

  it('rejects a token signed with a different secret as an invalid access token', async () => {
    const jwtService = new JwtService({
      secret: 'authentication-api-test-secret',
    });
    const authenticationApi = new JwtAuthenticationApi(jwtService);
    const accessToken = await new JwtService({
      secret: 'attacker-controlled-secret',
    }).signAsync({
      sub: 'user-123',
      tokenType: 'access',
    });

    const verification = authenticationApi.verifyAccessToken(accessToken);

    await expect(verification).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it('rejects an expired token with a distinguishable expiration error', async () => {
    const jwtService = new JwtService({
      secret: 'authentication-api-test-secret',
      signOptions: { expiresIn: -1 },
    });
    const authenticationApi = new JwtAuthenticationApi(jwtService);
    const accessToken = await jwtService.signAsync({
      sub: 'user-123',
      tokenType: 'access',
    });

    const verification = authenticationApi.verifyAccessToken(accessToken);

    await expect(verification).rejects.toBeInstanceOf(ExpiredAccessTokenError);
  });

  it('rejects a validly signed token with an unsupported token type', async () => {
    const jwtService = new JwtService({
      secret: 'authentication-api-test-secret',
      signOptions: { expiresIn: '15m' },
    });
    const authenticationApi = new JwtAuthenticationApi(jwtService);
    const unsupportedToken = await jwtService.signAsync({
      sub: 'user-123',
      tokenType: 'refresh',
    });

    const verification = authenticationApi.verifyAccessToken(unsupportedToken);

    await expect(verification).rejects.toBeInstanceOf(
      UnsupportedAccessTokenTypeError,
    );
  });

  it('rejects a validly signed token that is missing its token type', async () => {
    const jwtService = new JwtService({
      secret: 'authentication-api-test-secret',
      signOptions: { expiresIn: '15m' },
    });
    const authenticationApi = new JwtAuthenticationApi(jwtService);
    const tokenWithoutType = await jwtService.signAsync({
      sub: 'user-123',
    });

    const verification = authenticationApi.verifyAccessToken(tokenWithoutType);

    await expect(verification).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it('rejects a validly signed access token that is missing its subject', async () => {
    const jwtService = new JwtService({
      secret: 'authentication-api-test-secret',
      signOptions: { expiresIn: '15m' },
    });
    const authenticationApi = new JwtAuthenticationApi(jwtService);
    const tokenWithoutSubject = await jwtService.signAsync({
      tokenType: 'access',
    });

    const verification =
      authenticationApi.verifyAccessToken(tokenWithoutSubject);

    await expect(verification).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it('rejects a validly signed access token that is missing its expiration', async () => {
    const jwtService = new JwtService({
      secret: 'authentication-api-test-secret',
    });
    const authenticationApi = new JwtAuthenticationApi(jwtService);
    const tokenWithoutExpiration = await jwtService.signAsync({
      sub: 'user-123',
      tokenType: 'access',
    });

    const verification = authenticationApi.verifyAccessToken(
      tokenWithoutExpiration,
    );

    await expect(verification).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });
});
