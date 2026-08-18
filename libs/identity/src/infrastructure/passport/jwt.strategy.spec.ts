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

  it('rejects a decoded access-token payload that is missing its subject', async () => {
    const strategy = new JwtStrategy(buildConfigService());
    const payloadWithoutSubject = {
      email: 'ada@example.com',
      tokenType: 'access',
    };

    const validation = strategy.validate(payloadWithoutSubject);

    await expect(validation).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a decoded access-token payload with a non-string subject', async () => {
    const strategy = new JwtStrategy(buildConfigService());
    const payloadWithInvalidSubject = {
      sub: 123,
      email: 'ada@example.com',
      tokenType: 'access',
    } as unknown as Parameters<JwtStrategy['validate']>[0];

    const validation = strategy.validate(payloadWithInvalidSubject);

    await expect(validation).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a decoded access-token payload that is missing its email', async () => {
    const strategy = new JwtStrategy(buildConfigService());
    const payloadWithoutEmail = {
      sub: 'user-123',
      tokenType: 'access',
    };

    const validation = strategy.validate(payloadWithoutEmail);

    await expect(validation).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a decoded access-token payload with a non-string email', async () => {
    const strategy = new JwtStrategy(buildConfigService());
    const payloadWithInvalidEmail = {
      sub: 'user-123',
      email: 123,
      tokenType: 'access',
    } as unknown as Parameters<JwtStrategy['validate']>[0];

    const validation = strategy.validate(payloadWithInvalidEmail);

    await expect(validation).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
