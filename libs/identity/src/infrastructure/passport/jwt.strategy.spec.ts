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
    });

    expect(result).toEqual({ id: 'user-123', email: 'ada@example.com' });
  });

  it('reads the signing secret from ConfigService under JWT_SECRET', () => {
    const configService = buildConfigService();

    new JwtStrategy(configService);

    expect(configService.get).toHaveBeenCalledWith('JWT_SECRET');
  });
});
