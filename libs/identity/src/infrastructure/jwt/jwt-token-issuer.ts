import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  AccessTokenPayload,
  TokenIssuer,
} from '../../application/ports/token-issuer.port';

@Injectable()
export class JwtTokenIssuer implements TokenIssuer {
  constructor(private readonly jwtService: JwtService) {}

  async issueAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwtService.signAsync({
      ...payload,
      tokenType: 'access',
    });
  }
}
