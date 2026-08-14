export interface AuthenticatedPrincipal {
  userId: string;
  expiresAt: Date;
}

export class InvalidAccessTokenError extends Error {
  constructor() {
    super('Invalid access token');
    this.name = 'InvalidAccessTokenError';
  }
}

export interface AuthenticationApi {
  verifyAccessToken(accessToken: string): Promise<AuthenticatedPrincipal>;
}
