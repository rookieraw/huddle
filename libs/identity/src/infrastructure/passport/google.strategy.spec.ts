import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Profile } from 'passport-google-oauth20';
import { DomainError } from '@huddle/shared-kernel';
import { GoogleStrategy } from './google.strategy';
import { OAuthLoginUseCase } from '../../application/use-cases/oauth-login.use-case';

function buildConfigService(): ConfigService {
  return {
    get: jest.fn().mockReturnValue('test-value'),
  } as unknown as ConfigService;
}

function buildProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    provider: 'google',
    id: 'google-sub-123',
    displayName: 'Ada Lovelace',
    profileUrl: 'https://plus.google.com/123',
    emails: [{ value: 'ada@example.com', verified: true }],
    _raw: '{}',
    _json: {} as Profile['_json'],
    ...overrides,
  } as Profile;
}

function buildUseCase(): {
  oauthLoginUseCase: OAuthLoginUseCase;
  execute: jest.Mock;
} {
  const execute = jest.fn().mockResolvedValue({ id: 'user-1' });
  return {
    oauthLoginUseCase: { execute } as unknown as OAuthLoginUseCase,
    execute,
  };
}

describe('GoogleStrategy', () => {
  it('passes the mapped provider display name through to OAuthLoginUseCase', async () => {
    const { oauthLoginUseCase, execute } = buildUseCase();
    const strategy = new GoogleStrategy(
      buildConfigService(),
      oauthLoginUseCase,
    );

    await strategy.validate(
      'token',
      'refresh',
      buildProfile({ displayName: 'Ada Lovelace' }),
    );

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'Ada Lovelace' }),
    );
  });

  it('omits displayName from the use-case input when Google provides none', async () => {
    const { oauthLoginUseCase, execute } = buildUseCase();
    const strategy = new GoogleStrategy(
      buildConfigService(),
      oauthLoginUseCase,
    );

    await strategy.validate(
      'token',
      'refresh',
      buildProfile({ displayName: undefined }),
    );

    const callArg = execute.mock.calls[0][0] as { displayName?: string };
    expect(callArg.displayName).toBeUndefined();
  });

  it('still passes provider, providerId, email, and emailVerifiedByProvider correctly', async () => {
    const { oauthLoginUseCase, execute } = buildUseCase();
    const strategy = new GoogleStrategy(
      buildConfigService(),
      oauthLoginUseCase,
    );

    await strategy.validate('token', 'refresh', buildProfile());

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google',
        providerId: 'google-sub-123',
        email: 'ada@example.com',
        emailVerifiedByProvider: true,
      }),
    );
  });

  it('maps a DomainError from the use case to UnauthorizedException', async () => {
    const execute = jest
      .fn()
      .mockRejectedValue(new DomainError('Invalid link'));
    const oauthLoginUseCase = { execute } as unknown as OAuthLoginUseCase;
    const strategy = new GoogleStrategy(
      buildConfigService(),
      oauthLoginUseCase,
    );

    await expect(
      strategy.validate('token', 'refresh', buildProfile()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
