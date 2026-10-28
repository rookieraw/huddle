import { CHAT_PRISMA_CLIENT } from '@huddle/chat';
import {
  AUTHENTICATION_API,
  DIRECTORY_API,
  ExpiredAccessTokenError,
  InvalidAccessTokenError,
  PROFILE_QUERY_API,
  UnsupportedAccessTokenTypeError,
} from '@huddle/identity';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ApiValidationPipe } from '../src/interface/http/api-validation.pipe';

type IncomingContactRequestsErrorBody = {
  error: {
    code: string;
    message: string;
    details?: Array<{
      field: string;
      message: string;
    }>;
  };
};

const limitValidationDetail = {
  field: 'limit',
  message: 'limit must be an integer from 1 to 50.',
};

const cursorValidationDetail = {
  field: 'cursor',
  message: 'cursor must be a valid cursor.',
};

type IncomingContactRequestsBody = {
  items: Array<{
    id: string;
    requesterId: string;
    displayName: string | null;
    status: string;
  }>;
  nextCursor: string | null;
};

describe('Incoming Contact requests (e2e)', () => {
  let app: INestApplication<App>;

  const verifyAccessToken = jest.fn();
  const userExists = jest.fn();
  const getProfiles = jest.fn();
  const findMany = jest.fn();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AUTHENTICATION_API)
      .useValue({ verifyAccessToken })
      .overrideProvider(DIRECTORY_API)
      .useValue({ userExists })
      .overrideProvider(PROFILE_QUERY_API)
      .useValue({ getProfiles })
      .overrideProvider(CHAT_PRISMA_CLIENT)
      .useValue({ contactRelationship: { findMany } })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ApiValidationPipe());
    await app.init();
  });

  beforeEach(() => {
    verifyAccessToken.mockReset().mockResolvedValue({
      userId: 'user-recipient',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    });
    userExists.mockReset();
    getProfiles.mockReset().mockResolvedValue({
      profiles: [],
      missingUserIds: [],
    });
    findMany.mockReset().mockResolvedValue([]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists pending incoming requests with requester display names through the authenticated HTTP route', async () => {
    findMany.mockResolvedValueOnce([
      {
        id: 'relationship-1',
        requesterId: 'user-requester-1',
        recipientId: 'user-recipient',
        status: 'pending',
      },
      {
        id: 'relationship-2',
        requesterId: 'user-requester-2',
        recipientId: 'user-recipient',
        status: 'pending',
      },
    ]);
    getProfiles.mockResolvedValueOnce({
      profiles: [
        { userId: 'user-requester-2', displayName: 'Bob' },
        { userId: 'user-requester-1', displayName: 'Alice' },
      ],
      missingUserIds: [],
    });

    const response = await request(app.getHttpServer())
      .get('/contact-requests/incoming')
      .set('Authorization', 'Bearer access-token')
      .expect(200);
    const body = response.body as IncomingContactRequestsBody;

    expect(body).toEqual({
      items: [
        {
          id: 'relationship-1',
          requesterId: 'user-requester-1',
          displayName: 'Alice',
          status: 'pending',
        },
        {
          id: 'relationship-2',
          requesterId: 'user-requester-2',
          displayName: 'Bob',
          status: 'pending',
        },
      ],
      nextCursor: null,
    });
    expect(verifyAccessToken).toHaveBeenCalledWith('access-token');
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: { recipientId: 'user-recipient', status: 'pending' },
      orderBy: { id: 'asc' },
      take: 21,
    });
    expect(getProfiles).toHaveBeenCalledTimes(1);
    expect(getProfiles).toHaveBeenCalledWith([
      'user-requester-1',
      'user-requester-2',
    ]);
    expect(userExists).not.toHaveBeenCalled();
  });

  it('pages with limit and continues strictly after the returned cursor', async () => {
    findMany.mockResolvedValueOnce([
      {
        id: 'relationship-1',
        requesterId: 'user-requester-1',
        recipientId: 'user-recipient',
        status: 'pending',
      },
      {
        id: 'relationship-2',
        requesterId: 'user-requester-2',
        recipientId: 'user-recipient',
        status: 'pending',
      },
    ]);
    getProfiles.mockResolvedValueOnce({
      profiles: [{ userId: 'user-requester-1', displayName: 'Alice' }],
      missingUserIds: [],
    });

    const firstResponse = await request(app.getHttpServer())
      .get('/contact-requests/incoming')
      .query({ limit: '1' })
      .set('Authorization', 'Bearer access-token')
      .expect(200);
    const firstPage = firstResponse.body as IncomingContactRequestsBody;

    expect(firstPage.items).toEqual([
      {
        id: 'relationship-1',
        requesterId: 'user-requester-1',
        displayName: 'Alice',
        status: 'pending',
      },
    ]);
    expect(typeof firstPage.nextCursor).toBe('string');
    expect(findMany).toHaveBeenNthCalledWith(1, {
      where: { recipientId: 'user-recipient', status: 'pending' },
      orderBy: { id: 'asc' },
      take: 2,
    });
    expect(getProfiles).toHaveBeenCalledWith(['user-requester-1']);

    findMany.mockResolvedValueOnce([
      {
        id: 'relationship-2',
        requesterId: 'user-requester-2',
        recipientId: 'user-recipient',
        status: 'pending',
      },
    ]);
    getProfiles.mockResolvedValueOnce({
      profiles: [{ userId: 'user-requester-2', displayName: 'Bob' }],
      missingUserIds: [],
    });

    const secondResponse = await request(app.getHttpServer())
      .get('/contact-requests/incoming')
      .query({ limit: '1', cursor: firstPage.nextCursor })
      .set('Authorization', 'Bearer access-token')
      .expect(200);
    const secondPage = secondResponse.body as IncomingContactRequestsBody;

    expect(secondPage).toEqual({
      items: [
        {
          id: 'relationship-2',
          requesterId: 'user-requester-2',
          displayName: 'Bob',
          status: 'pending',
        },
      ],
      nextCursor: null,
    });
    expect(findMany).toHaveBeenNthCalledWith(2, {
      where: {
        recipientId: 'user-recipient',
        status: 'pending',
        id: { gt: 'relationship-1' },
      },
      orderBy: { id: 'asc' },
      take: 2,
    });
  });

  it.each([
    { scenario: 'zero', query: 'limit=0', detail: limitValidationDetail },
    {
      scenario: 'above the maximum',
      query: 'limit=51',
      detail: limitValidationDetail,
    },
    {
      scenario: 'non-numeric',
      query: 'limit=abc',
      detail: limitValidationDetail,
    },
    {
      scenario: 'fractional',
      query: 'limit=1.5',
      detail: limitValidationDetail,
    },
    { scenario: 'empty', query: 'limit=', detail: limitValidationDetail },
    {
      scenario: 'repeated',
      query: 'limit=1&limit=2',
      detail: limitValidationDetail,
    },
    {
      scenario: 'a malformed cursor',
      query: 'cursor=not-a-cursor',
      detail: cursorValidationDetail,
    },
    {
      scenario: 'a repeated cursor',
      query: 'cursor=first&cursor=second',
      detail: cursorValidationDetail,
    },
    {
      scenario: 'both invalid, reporting limit only',
      query: 'limit=0&cursor=not-a-cursor',
      detail: limitValidationDetail,
    },
  ])(
    'returns the fixed validation envelope for $scenario',
    async ({ query, detail }) => {
      const response = await request(app.getHttpServer())
        .get(`/contact-requests/incoming?${query}`)
        .set('Authorization', 'Bearer access-token')
        .expect(400);
      const body = response.body as IncomingContactRequestsErrorBody;

      expect(body).toEqual({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed.',
          details: [detail],
        },
      });
      expect(JSON.stringify(body)).not.toContain('not-a-cursor');
      expect(findMany).not.toHaveBeenCalled();
      expect(getProfiles).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['a missing header', undefined],
    ['a different scheme', 'Basic access-token'],
    ['a missing token', 'Bearer'],
    ['more than one credential', 'Bearer access-token unexpected'],
  ])(
    'returns authentication required before query validation for %s',
    async (_scenario, authorization) => {
      let httpRequest = request(app.getHttpServer()).get(
        '/contact-requests/incoming?limit=0',
      );

      if (authorization !== undefined) {
        httpRequest = httpRequest.set('Authorization', authorization);
      }

      const response = await httpRequest.expect(401);
      const body = response.body as IncomingContactRequestsErrorBody;

      expect(body).toEqual({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required.',
        },
      });
      expect(verifyAccessToken).not.toHaveBeenCalled();
      expect(findMany).not.toHaveBeenCalled();
      expect(getProfiles).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['invalid', new InvalidAccessTokenError()],
    ['expired', new ExpiredAccessTokenError()],
    ['unsupported', new UnsupportedAccessTokenTypeError()],
  ])(
    'returns authentication required before query validation for an %s access token',
    async (_scenario, tokenError) => {
      verifyAccessToken.mockRejectedValueOnce(tokenError);

      const response = await request(app.getHttpServer())
        .get('/contact-requests/incoming?limit=0')
        .set('Authorization', 'Bearer unusable-access-token')
        .expect(401);
      const body = response.body as IncomingContactRequestsErrorBody;

      expect(body).toEqual({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required.',
        },
      });
      expect(verifyAccessToken).toHaveBeenCalledWith('unusable-access-token');
      expect(findMany).not.toHaveBeenCalled();
      expect(getProfiles).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      scenario: 'a repository lookup rejection',
      arrangeFailure: (internalMessage: string) => {
        findMany.mockRejectedValueOnce(new Error(internalMessage));
      },
      internalMessage: 'private incoming repository failure',
      expectedGetProfilesCalls: 0,
    },
    {
      scenario: 'a Profile Query rejection',
      arrangeFailure: (internalMessage: string) => {
        findMany.mockResolvedValueOnce([
          {
            id: 'relationship-1',
            requesterId: 'user-requester-1',
            recipientId: 'user-recipient',
            status: 'pending',
          },
        ]);
        getProfiles.mockRejectedValueOnce(new Error(internalMessage));
      },
      internalMessage: 'private profile query failure',
      expectedGetProfilesCalls: 1,
    },
  ])(
    'returns the fixed CONTACT_REQUEST_LISTING_UNAVAILABLE response for $scenario',
    async ({ arrangeFailure, internalMessage, expectedGetProfilesCalls }) => {
      arrangeFailure(internalMessage);

      const response = await request(app.getHttpServer())
        .get('/contact-requests/incoming')
        .set('Authorization', 'Bearer access-token')
        .expect(503);
      const body = response.body as IncomingContactRequestsErrorBody;

      expect(body).toEqual({
        error: {
          code: 'CONTACT_REQUEST_LISTING_UNAVAILABLE',
          message: 'Incoming Contact requests are temporarily unavailable.',
        },
      });
      expect(JSON.stringify(body)).not.toContain(internalMessage);
      expect(findMany).toHaveBeenCalledTimes(1);
      expect(getProfiles).toHaveBeenCalledTimes(expectedGetProfilesCalls);
    },
  );

  it('returns only the fixed internal-error response for an unexpected failure', async () => {
    const internalValues = [
      'unexpected verifier failure',
      'JWT_PROVIDER_FAILURE',
      'private@example.com',
      'secret-access-token',
      'D:\\internal\\incoming-contact-requests.ts',
    ];
    verifyAccessToken.mockRejectedValueOnce(
      Object.assign(new Error(internalValues[0]), {
        providerCode: internalValues[1],
        principalEmail: internalValues[2],
        token: internalValues[3],
        stack: internalValues[4],
      }),
    );

    const response = await request(app.getHttpServer())
      .get('/contact-requests/incoming')
      .set('Authorization', 'Bearer secret-access-token')
      .expect(500);
    const body = response.body as IncomingContactRequestsErrorBody;

    expect(body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
    const serializedBody = JSON.stringify(body);
    for (const internalValue of internalValues) {
      expect(serializedBody).not.toContain(internalValue);
    }
    expect(verifyAccessToken).toHaveBeenCalledWith('secret-access-token');
    expect(findMany).not.toHaveBeenCalled();
    expect(getProfiles).not.toHaveBeenCalled();
  });
});
