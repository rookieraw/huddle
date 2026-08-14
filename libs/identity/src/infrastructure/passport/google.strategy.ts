import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy, Profile } from 'passport-google-oauth20';
import { DomainError } from '@huddle/shared-kernel';
import { User } from '../../domain/user.entity';
import { OAuthLoginUseCase } from '../../application/use-cases/oauth-login.use-case';
import { mapGoogleProfile } from './google-profile.mapper';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    configService: ConfigService,
    private readonly oauthLoginUseCase: OAuthLoginUseCase,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID')!,
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET')!,
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL')!,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<User> {
    const { providerId, email, emailVerified, displayName } =
      mapGoogleProfile(profile);

    try {
      return await this.oauthLoginUseCase.execute({
        provider: 'google',
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
