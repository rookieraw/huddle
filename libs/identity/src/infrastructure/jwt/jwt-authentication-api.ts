import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  AuthenticatedPrincipal,
  AuthenticationApi,
  ExpiredAccessTokenError,
  InvalidAccessTokenError,
  UnsupportedAccessTokenTypeError,
} from '../../application/public-api/authentication-api';
import { ACCESS_TOKEN_TYPE } from './access-token-policy';

interface VerifiedAccessTokenPayload {
  sub: string;
  exp: number;
  tokenType?: string;
}

@Injectable()
export class JwtAuthenticationApi implements AuthenticationApi {
  constructor(private readonly jwtService: JwtService) {}

  async verifyAccessToken(
    accessToken: string,
  ): Promise<AuthenticatedPrincipal> {
    let payload: VerifiedAccessTokenPayload;

    try {
      payload =
        await this.jwtService.verifyAsync<VerifiedAccessTokenPayload>(
          accessToken,
        );
    } catch (error) {
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        throw new ExpiredAccessTokenError();
      }

      if (error instanceof Error && error.name === 'JsonWebTokenError') {
        throw new InvalidAccessTokenError();
      }

      throw error;
    }

    if (payload.tokenType === undefined) {
      throw new InvalidAccessTokenError();
    }

    if (payload.tokenType !== ACCESS_TOKEN_TYPE) {
      throw new UnsupportedAccessTokenTypeError();
    }

    if (payload.sub === undefined) {
      throw new InvalidAccessTokenError();
    }

    if (payload.exp === undefined) {
      throw new InvalidAccessTokenError();
    }

    return {
      userId: payload.sub,
      expiresAt: new Date(payload.exp * 1000),
    };
  }
}
