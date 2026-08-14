export interface AuthenticatedPrincipal {
  userId: string;
  expiresAt: Date;
}

export interface AuthenticationApi {
  verifyAccessToken(accessToken: string): Promise<AuthenticatedPrincipal>;
}
