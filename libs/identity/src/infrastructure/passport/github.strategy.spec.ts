import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainError } from '@huddle/shared-kernel';
import { GithubStrategy } from './github.strategy';
import { GithubOAuthProfile } from './github-profile.mapper';
import { OAuthLoginUseCase } from '../../application/use-cases/oauth-login.use-case';

function buildConfigService(): ConfigService {
  return {
    get: jest.fn().mockReturnValue('test-value'),
  } as unknown as ConfigService;
}

function buildProfile(
  overrides: Partial<GithubOAuthProfile> = {},
): GithubOAuthProfile {
  return {
    id: 'github-id-456',
    displayName: 'Ada Lovelace',
    username: 'adalovelace',
    emails: [{ value: 'ada@example.com', primary: true, verified: true }],
    ...overrides,
  };
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

describe('GithubStrategy', () => {
  it('passes the mapped provider display name through to OAuthLoginUseCase', async () => {
    const { oauthLoginUseCase, execute } = buildUseCase();
    const strategy = new GithubStrategy(
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

  it('falls back to username when GitHub provides no displayName, and still passes it through', async () => {
    const { oauthLoginUseCase, execute } = buildUseCase();
    const strategy = new GithubStrategy(
      buildConfigService(),
      oauthLoginUseCase,
    );

    await strategy.validate(
      'token',
      'refresh',
      buildProfile({ displayName: undefined, username: 'adalovelace' }),
    );

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'adalovelace' }),
    );
  });

  it('omits displayName from the use-case input when neither displayName nor username is present', async () => {
    const { oauthLoginUseCase, execute } = buildUseCase();
    const strategy = new GithubStrategy(
      buildConfigService(),
      oauthLoginUseCase,
    );

    await strategy.validate(
      'token',
      'refresh',
      buildProfile({ displayName: undefined, username: undefined }),
    );

    const callArg = execute.mock.calls[0][0] as { displayName?: string };
    expect(callArg.displayName).toBeUndefined();
  });

  it('maps a DomainError from the use case to UnauthorizedException', async () => {
    const execute = jest
      .fn()
      .mockRejectedValue(new DomainError('Invalid link'));
    const oauthLoginUseCase = { execute } as unknown as OAuthLoginUseCase;
    const strategy = new GithubStrategy(
      buildConfigService(),
      oauthLoginUseCase,
    );

    await expect(
      strategy.validate('token', 'refresh', buildProfile()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
