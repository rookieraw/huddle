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

type AcceptedContactsErrorBody = {
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

type AcceptedContactsBody = {
  items: Array<{
    userId: string;
    displayName: string | null;
  }>;
  nextCursor: string | null;
};

const acceptedQuery = (afterRelationshipId?: string) => ({
  where: {
    status: 'accepted',
    OR: [{ recipientId: 'user-actor' }, { requesterId: 'user-actor' }],
    ...(afterRelationshipId !== undefined && {
      id: { gt: afterRelationshipId },
    }),
  },
  orderBy: { id: 'asc' },
});

describe('Accepted Contacts (e2e)', () => {
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
      userId: 'user-actor',
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

  it('lists accepted Contacts in both relationship directions with display names through the authenticated HTTP route', async () => {
    findMany.mockResolvedValueOnce([
      {
        id: 'relationship-1',
        requesterId: 'user-contact-1',
        recipientId: 'user-actor',
        status: 'accepted',
      },
      {
        id: 'relationship-2',
        requesterId: 'user-actor',
        recipientId: 'user-contact-2',
        status: 'accepted',
      },
    ]);
    getProfiles.mockResolvedValueOnce({
      profiles: [
        { userId: 'user-contact-2', displayName: 'Bob' },
        { userId: 'user-contact-1', displayName: 'Alice' },
      ],
      missingUserIds: [],
    });

    const response = await request(app.getHttpServer())
      .get('/contacts')
      .set('Authorization', 'Bearer access-token')
      .expect(200);
    const body = response.body as AcceptedContactsBody;

    expect(body).toEqual({
      items: [
        { userId: 'user-contact-1', displayName: 'Alice' },
        { userId: 'user-contact-2', displayName: 'Bob' },
      ],
      nextCursor: null,
    });
    expect(verifyAccessToken).toHaveBeenCalledWith('access-token');
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({ ...acceptedQuery(), take: 21 });
    expect(getProfiles).toHaveBeenCalledTimes(1);
    expect(getProfiles).toHaveBeenCalledWith([
      'user-contact-1',
      'user-contact-2',
    ]);
    expect(userExists).not.toHaveBeenCalled();
  });

  it('exposes only userId and displayName for each Contact and hides the relationship id, direction and status', async () => {
    findMany.mockResolvedValueOnce([
      {
        id: 'relationship-private-id',
        requesterId: 'user-actor',
        recipientId: 'user-contact-1',
        status: 'accepted',
      },
    ]);
    getProfiles.mockResolvedValueOnce({
      profiles: [{ userId: 'user-contact-1', displayName: 'Alice' }],
      missingUserIds: [],
    });

    const response = await request(app.getHttpServer())
      .get('/contacts')
      .set('Authorization', 'Bearer access-token')
      .expect(200);
    const body = response.body as AcceptedContactsBody;

    expect(Object.keys(body).sort()).toEqual(['items', 'nextCursor']);
    expect(Object.keys(body.items[0]).sort()).toEqual([
      'displayName',
      'userId',
    ]);
    const serializedBody = JSON.stringify(body);
    expect(serializedBody).not.toContain('relationship-private-id');
    expect(serializedBody).not.toContain('requesterId');
    expect(serializedBody).not.toContain('recipientId');
    expect(serializedBody).not.toContain('accepted');
    expect(serializedBody).not.toContain('status');
  });

  it('returns an empty page without a profile lookup when there are no accepted Contacts', async () => {
    const response = await request(app.getHttpServer())
      .get('/contacts')
      .set('Authorization', 'Bearer access-token')
      .expect(200);
    const body = response.body as AcceptedContactsBody;

    expect(body).toEqual({ items: [], nextCursor: null });
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(getProfiles).not.toHaveBeenCalled();
  });

  it('serializes a Contact without a profile as a null displayName', async () => {
    findMany.mockResolvedValueOnce([
      {
        id: 'relationship-1',
        requesterId: 'user-contact-missing',
        recipientId: 'user-actor',
        status: 'accepted',
      },
    ]);
    getProfiles.mockResolvedValueOnce({
      profiles: [],
      missingUserIds: ['user-contact-missing'],
    });

    const response = await request(app.getHttpServer())
      .get('/contacts')
      .set('Authorization', 'Bearer access-token')
      .expect(200);
    const body = response.body as AcceptedContactsBody;

    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toHaveProperty('displayName', null);
    expect(body.items[0]).toEqual({
      userId: 'user-contact-missing',
      displayName: null,
    });
  });

  it('ignores client-supplied actor query values and scopes to the verified user', async () => {
    const response = await request(app.getHttpServer())
      .get('/contacts')
      .query({
        userId: 'user-other',
        requesterId: 'user-other',
        recipientId: 'user-other',
      })
      .set('Authorization', 'Bearer access-token')
      .expect(200);
    const body = response.body as AcceptedContactsBody;

    expect(body).toEqual({ items: [], nextCursor: null });
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({ ...acceptedQuery(), take: 21 });
  });

  it('pages with limit and continues strictly after the returned cursor', async () => {
    findMany.mockResolvedValueOnce([
      {
        id: 'relationship-1',
        requesterId: 'user-contact-1',
        recipientId: 'user-actor',
        status: 'accepted',
      },
      {
        id: 'relationship-2',
        requesterId: 'user-actor',
        recipientId: 'user-contact-2',
        status: 'accepted',
      },
    ]);
    getProfiles.mockResolvedValueOnce({
      profiles: [{ userId: 'user-contact-1', displayName: 'Alice' }],
      missingUserIds: [],
    });

    const firstResponse = await request(app.getHttpServer())
      .get('/contacts')
      .query({ limit: '1' })
      .set('Authorization', 'Bearer access-token')
      .expect(200);
    const firstPage = firstResponse.body as AcceptedContactsBody;

    expect(firstPage.items).toEqual([
      { userId: 'user-contact-1', displayName: 'Alice' },
    ]);
    expect(typeof firstPage.nextCursor).toBe('string');
    expect(findMany).toHaveBeenNthCalledWith(1, {
      ...acceptedQuery(),
      take: 2,
    });
    expect(getProfiles).toHaveBeenCalledWith(['user-contact-1']);

    findMany.mockResolvedValueOnce([
      {
        id: 'relationship-2',
        requesterId: 'user-actor',
        recipientId: 'user-contact-2',
        status: 'accepted',
      },
    ]);
    getProfiles.mockResolvedValueOnce({
      profiles: [{ userId: 'user-contact-2', displayName: 'Bob' }],
      missingUserIds: [],
    });

    const secondResponse = await request(app.getHttpServer())
      .get('/contacts')
      .query({ limit: '1', cursor: firstPage.nextCursor })
      .set('Authorization', 'Bearer access-token')
      .expect(200);
    const secondPage = secondResponse.body as AcceptedContactsBody;

    expect(secondPage).toEqual({
      items: [{ userId: 'user-contact-2', displayName: 'Bob' }],
      nextCursor: null,
    });
    expect(findMany).toHaveBeenNthCalledWith(2, {
      ...acceptedQuery('relationship-1'),
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
        .get(`/contacts?${query}`)
        .set('Authorization', 'Bearer access-token')
        .expect(400);
      const body = response.body as AcceptedContactsErrorBody;

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
      let httpRequest = request(app.getHttpServer()).get('/contacts?limit=0');

      if (authorization !== undefined) {
        httpRequest = httpRequest.set('Authorization', authorization);
      }

      const response = await httpRequest.expect(401);
      const body = response.body as AcceptedContactsErrorBody;

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
        .get('/contacts?limit=0')
        .set('Authorization', 'Bearer unusable-access-token')
        .expect(401);
      const body = response.body as AcceptedContactsErrorBody;

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
      internalMessage: 'private accepted repository failure',
      expectedGetProfilesCalls: 0,
    },
    {
      scenario: 'a Profile Query rejection',
      arrangeFailure: (internalMessage: string) => {
        findMany.mockResolvedValueOnce([
          {
            id: 'relationship-1',
            requesterId: 'user-contact-1',
            recipientId: 'user-actor',
            status: 'accepted',
          },
        ]);
        getProfiles.mockRejectedValueOnce(new Error(internalMessage));
      },
      internalMessage: 'private profile query failure',
      expectedGetProfilesCalls: 1,
    },
  ])(
    'returns the fixed ACCEPTED_CONTACT_LISTING_UNAVAILABLE response for $scenario',
    async ({ arrangeFailure, internalMessage, expectedGetProfilesCalls }) => {
      arrangeFailure(internalMessage);

      const response = await request(app.getHttpServer())
        .get('/contacts')
        .set('Authorization', 'Bearer access-token')
        .expect(503);
      const body = response.body as AcceptedContactsErrorBody;

      expect(body).toEqual({
        error: {
          code: 'ACCEPTED_CONTACT_LISTING_UNAVAILABLE',
          message: 'Accepted Contacts are temporarily unavailable.',
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
      'D:\\internal\\accepted-contacts.ts',
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
      .get('/contacts')
      .set('Authorization', 'Bearer secret-access-token')
      .expect(500);
    const body = response.body as AcceptedContactsErrorBody;

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
