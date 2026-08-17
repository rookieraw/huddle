import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

function buildConfigService(secret = 'test-jwt-secret'): ConfigService {
  return {
    get: jest.fn().mockReturnValue(secret),
  } as unknown as ConfigService;
}

describe('JwtStrategy', () => {
  it('maps a decoded payload to { id, email } without any repository lookup', async () => {
    const strategy = new JwtStrategy(buildConfigService());

    const result = await strategy.validate({
      sub: 'user-123',
      email: 'ada@example.com',
      tokenType: 'access',
    });

    expect(result).toEqual({ id: 'user-123', email: 'ada@example.com' });
  });

  it('reads the signing secret from ConfigService under JWT_SECRET', () => {
    const configService = buildConfigService();

    new JwtStrategy(configService);

    expect(configService.get).toHaveBeenCalledWith('JWT_SECRET');
  });

  it('rejects a decoded payload with an unsupported token type', async () => {
    const strategy = new JwtStrategy(buildConfigService());
    const unsupportedPayload = {
      sub: 'user-123',
      email: 'ada@example.com',
      tokenType: 'refresh',
    };

    const validation = strategy.validate(unsupportedPayload);

    await expect(validation).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a decoded payload that is missing its token type', async () => {
    const strategy = new JwtStrategy(buildConfigService());
    const payloadWithoutType = {
      sub: 'user-123',
      email: 'ada@example.com',
    };

    const validation = strategy.validate(payloadWithoutType);

    await expect(validation).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
