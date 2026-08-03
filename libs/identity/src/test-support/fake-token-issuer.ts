import {
  AccessTokenPayload,
  TokenIssuer,
} from '../application/ports/token-issuer.port';

export class FakeTokenIssuer implements TokenIssuer {
  public lastPayload: AccessTokenPayload | null = null;

  async issueAccessToken(payload: AccessTokenPayload): Promise<string> {
    this.lastPayload = payload;
    return `fake-access-token-for-${payload.sub}`;
  }
}
