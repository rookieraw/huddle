import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  AUTHENTICATION_API,
  ExpiredAccessTokenError,
  InvalidAccessTokenError,
  UnsupportedAccessTokenTypeError,
} from '@huddle/identity';
import type {
  AuthenticatedPrincipal,
  AuthenticationApi,
} from '@huddle/identity';

export type ContactRequestAuthenticatedRequest = {
  headers: {
    authorization?: unknown;
  };
  user?: {
    userId: string;
  };
};

export class ContactRequestAuthenticationRequiredError extends Error {
  constructor() {
    super('Authentication is required.');
    this.name = 'ContactRequestAuthenticationRequiredError';
  }
}

@Injectable()
export class ContactRequestAuthenticationGuard implements CanActivate {
  constructor(
    @Inject(AUTHENTICATION_API)
    private readonly authenticationApi: AuthenticationApi,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<ContactRequestAuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const bearerToken =
      typeof authorization === 'string'
        ? /^Bearer ([^\s]+)$/.exec(authorization)?.[1]
        : undefined;

    if (!bearerToken) {
      throw new ContactRequestAuthenticationRequiredError();
    }

    let principal: AuthenticatedPrincipal;

    try {
      principal = await this.authenticationApi.verifyAccessToken(bearerToken);
    } catch (error) {
      if (
        error instanceof InvalidAccessTokenError ||
        error instanceof ExpiredAccessTokenError ||
        error instanceof UnsupportedAccessTokenTypeError
      ) {
        throw new ContactRequestAuthenticationRequiredError();
      }

      throw error;
    }

    request.user = { userId: principal.userId };

    return true;
  }
}
