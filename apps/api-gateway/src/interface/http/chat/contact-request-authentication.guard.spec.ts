import type { ExecutionContext } from '@nestjs/common';
import {
  ExpiredAccessTokenError,
  InvalidAccessTokenError,
  UnsupportedAccessTokenTypeError,
} from '@huddle/identity';
import type { AuthenticationApi } from '@huddle/identity';
import {
  ContactRequestAuthenticationGuard,
  ContactRequestAuthenticationRequiredError,
} from './contact-request-authentication.guard';

type TestRequest = {
  headers: Record<string, unknown>;
  user?: unknown;
};

function createExecutionContext(request: TestRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function createSubject(authorization?: unknown) {
  const verifyAccessToken = jest.fn();
  const authenticationApi = {
    verifyAccessToken,
  } as AuthenticationApi;
  const request: TestRequest = { headers: {} };

  if (authorization !== undefined) {
    request.headers.authorization = authorization;
  }

  return {
    guard: new ContactRequestAuthenticationGuard(authenticationApi),
    request,
    context: createExecutionContext(request),
    verifyAccessToken,
  };
}

describe('ContactRequestAuthenticationGuard', () => {
  it.each([
    ['a missing header', undefined],
    ['a non-string header', ['Bearer access-token']],
    ['a different scheme', 'Basic access-token'],
    ['a missing token', 'Bearer'],
    ['more than one credential', 'Bearer access-token unexpected'],
  ])('rejects %s as authentication required', async (_case, authorization) => {
    const { guard, context, request, verifyAccessToken } =
      createSubject(authorization);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ContactRequestAuthenticationRequiredError,
    );
    expect(verifyAccessToken).not.toHaveBeenCalled();
    expect(request).not.toHaveProperty('user');
  });

  it.each([
    ['invalid', new InvalidAccessTokenError()],
    ['expired', new ExpiredAccessTokenError()],
    ['unsupported', new UnsupportedAccessTokenTypeError()],
  ])(
    'classifies an %s access token as authentication required',
    async (_case, tokenError) => {
      const { guard, context, request, verifyAccessToken } = createSubject(
        'Bearer access-token',
      );
      verifyAccessToken.mockRejectedValueOnce(tokenError);

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        ContactRequestAuthenticationRequiredError,
      );
      expect(verifyAccessToken).toHaveBeenCalledWith('access-token');
      expect(request).not.toHaveProperty('user');
    },
  );

  it('preserves an unexpected authentication failure', async () => {
    const unexpectedFailure = new Error('Unexpected verifier failure');
    const { guard, context, request, verifyAccessToken } = createSubject(
      'Bearer access-token',
    );
    verifyAccessToken.mockRejectedValueOnce(unexpectedFailure);

    await expect(guard.canActivate(context)).rejects.toBe(unexpectedFailure);
    expect(request).not.toHaveProperty('user');
  });

  it('attaches only the verified user identifier to the request', async () => {
    const { guard, context, request, verifyAccessToken } = createSubject(
      'Bearer access-token',
    );
    verifyAccessToken.mockResolvedValueOnce({
      userId: 'user-requester',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifyAccessToken).toHaveBeenCalledWith('access-token');
    expect(request.user).toEqual({ userId: 'user-requester' });
    expect(Object.keys(request.user as object)).toEqual(['userId']);
  });
});
