import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  AuthenticatedPrincipal,
  AuthenticationApi,
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
    const payload =
      await this.jwtService.verifyAsync<VerifiedAccessTokenPayload>(
        accessToken,
      );

    return {
      userId: payload.sub,
      expiresAt: new Date(payload.exp * 1000),
    };
  }
}
