import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  AuthenticatedPrincipal,
  AuthenticationApi,
  InvalidAccessTokenError,
} from '../../application/public-api/authentication-api';

interface VerifiedAccessTokenPayload {
  sub: string;
  exp: number;
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
      if (error instanceof Error && error.name === 'JsonWebTokenError') {
        throw new InvalidAccessTokenError();
      }

      throw error;
    }

    return {
      userId: payload.sub,
      expiresAt: new Date(payload.exp * 1000),
    };
  }
}
