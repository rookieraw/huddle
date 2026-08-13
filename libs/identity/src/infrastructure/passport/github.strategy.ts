import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy } from 'passport-github2';
import { DomainError } from '@huddle/shared-kernel';
import { User } from '../../domain/user.entity';
import { OAuthLoginUseCase } from '../../application/use-cases/oauth-login.use-case';
import { mapGithubProfile, GithubOAuthProfile } from './github-profile.mapper';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    configService: ConfigService,
    private readonly oauthLoginUseCase: OAuthLoginUseCase,
  ) {
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID')!,
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET')!,
      callbackURL: configService.get<string>('GITHUB_CALLBACK_URL')!,
      scope: ['user:email'],
      allRawEmails: true,
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: GithubOAuthProfile,
  ): Promise<User> {
    const { providerId, email, emailVerified, displayName } =
      mapGithubProfile(profile);

    try {
      return await this.oauthLoginUseCase.execute({
        provider: 'github',
        providerId,
        email,
        emailVerifiedByProvider: emailVerified,
        displayName,
      });
    } catch (error) {
      if (error instanceof DomainError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }
}
