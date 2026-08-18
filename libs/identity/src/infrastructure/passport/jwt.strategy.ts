import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ACCESS_TOKEN_TYPE } from '../jwt/access-token-policy';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

interface JwtPayload {
  sub?: unknown;
  email?: string;
  tokenType?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (payload.tokenType !== ACCESS_TOKEN_TYPE) {
      throw new UnauthorizedException();
    }

    if (typeof payload.sub !== 'string') {
      throw new UnauthorizedException();
    }

    if (payload.email === undefined) {
      throw new UnauthorizedException();
    }

    return { id: payload.sub, email: payload.email };
  }
}
