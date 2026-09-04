import { CHAT_PRISMA_CLIENT } from '@huddle/chat';
import {
  AUTHENTICATION_API,
  DIRECTORY_API,
  ExpiredAccessTokenError,
  InvalidAccessTokenError,
  UnsupportedAccessTokenTypeError,
} from '@huddle/identity';
import {
  BadRequestException,
  INestApplication,
  type PipeTransform,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ApiValidationPipe } from '../src/interface/http/api-validation.pipe';

type ContactRequestSuccessBody = {
  id: string;
  requesterId: string;
  recipientId: string;
  status: string;
};

type ContactRequestErrorBody = {
  error: {
    code: string;
    message: string;
    details?: Array<{
      field: string;
      message: string;
    }>;
  };
};

const authenticationRequiredBody = {
  error: {
    code: 'AUTHENTICATION_REQUIRED',
    message: 'Authentication is required.',
  },
};

const contactRequestNotFoundBody = {
  error: {
    code: 'CONTACT_REQUEST_NOT_FOUND',
    message: 'Contact request was not found.',
  },
};

const contactRequestAlreadyAcceptedBody = {
  error: {
    code: 'CONTACT_REQUEST_ALREADY_ACCEPTED',
    message: 'Contact request has already been accepted.',
  },
};

const contactRequestAcceptanceUnavailableBody = {
  error: {
    code: 'CONTACT_REQUEST_ACCEPTANCE_UNAVAILABLE',
    message: 'Contact request acceptance is temporarily unavailable.',
  },
};

describe('Contact requests (e2e)', () => {
  let app: INestApplication<App>;

  const verifyAccessToken = jest.fn();
  const userExists = jest.fn();
  const findUnique = jest.fn();
  const findFirst = jest.fn();
  const upsert = jest.fn();
  const transformedRequestBodies: unknown[] = [];
  const observeTransformedBody: PipeTransform = {
    transform(value: unknown, metadata) {
      if (metadata.type === 'body') {
        transformedRequestBodies.push(value);
      }

      return value;
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AUTHENTICATION_API)
      .useValue({ verifyAccessToken })
      .overrideProvider(DIRECTORY_API)
      .useValue({ userExists })
      .overrideProvider(CHAT_PRISMA_CLIENT)
      .useValue({
        contactRelationship: {
          findUnique,
          findFirst,
          upsert,
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ApiValidationPipe(), observeTransformedBody);
    await app.init();
  });

  beforeEach(() => {
    transformedRequestBodies.length = 0;
    verifyAccessToken.mockReset().mockResolvedValue({
      userId: 'user-requester',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    });
    userExists.mockReset().mockResolvedValue(true);
    findUnique.mockReset().mockResolvedValue({
      id: 'relationship-id',
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
      status: 'pending',
    });
    findFirst.mockReset().mockResolvedValue(null);
    upsert.mockReset().mockResolvedValue({
      id: 'relationship-id',
      requesterId: 'user-requester',
      recipientId: 'user-target',
      status: 'pending',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a pending relationship through the authenticated HTTP route', async () => {
    const response = await request(app.getHttpServer())
      .post('/contact-requests')
      .set('Authorization', 'Bearer access-token')
      .send({ targetUserId: 'user-target' })
      .expect(200);
    const body = response.body as ContactRequestSuccessBody;

    expect(body).toEqual({
      id: 'relationship-id',
      requesterId: 'user-requester',
      recipientId: 'user-target',
      status: 'pending',
    });
    expect(verifyAccessToken).toHaveBeenCalledWith('access-token');
    expect(userExists).toHaveBeenCalledWith('user-target');
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('accepts a pending relationship without a request body', async () => {
    verifyAccessToken.mockResolvedValueOnce({
      userId: 'user-original-recipient',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    });
    upsert.mockResolvedValueOnce({
      id: 'relationship-id',
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
      status: 'accepted',
    });

    const response = await request(app.getHttpServer())
      .post('/contact-requests/relationship-id/accept')
      .set('Authorization', 'Bearer recipient-access-token')
      .expect(200);
    const body = response.body as ContactRequestSuccessBody;

    expect(body).toEqual({
      id: 'relationship-id',
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
      status: 'accepted',
    });
    expect(verifyAccessToken).toHaveBeenCalledWith('recipient-access-token');
    expect(userExists).not.toHaveBeenCalled();
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'relationship-id' },
    });
    expect(findFirst).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls).toMatchObject([
      [
        {
          where: { id: 'relationship-id' },
          update: {
            requesterId: 'user-original-requester',
            recipientId: 'user-original-recipient',
            status: 'accepted',
          },
        },
      ],
    ]);
  });

  it('ignores unsupported acceptance body fields', async () => {
    verifyAccessToken.mockResolvedValueOnce({
      userId: 'user-original-recipient',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    });
    findUnique.mockResolvedValueOnce({
      id: 'path-relationship-id',
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
      status: 'pending',
    });
    upsert.mockResolvedValueOnce({
      id: 'path-relationship-id',
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
      status: 'accepted',
    });

    const response = await request(app.getHttpServer())
      .post('/contact-requests/path-relationship-id/accept')
      .set('Authorization', 'Bearer recipient-access-token')
      .send({
        acceptingUserId: 'user-attacker',
        relationshipId: 'body-relationship-id',
        requesterId: 'user-attacker',
        recipientId: 'user-attacker',
        status: 'accepted',
      })
      .expect(200);
    const body = response.body as ContactRequestSuccessBody;

    expect(body).toEqual({
      id: 'path-relationship-id',
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
      status: 'accepted',
    });
    expect(transformedRequestBodies).toEqual([]);
    expect(verifyAccessToken).toHaveBeenCalledWith('recipient-access-token');
    expect(userExists).not.toHaveBeenCalled();
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'path-relationship-id' },
    });
    expect(findFirst).not.toHaveBeenCalled();
    expect(upsert.mock.calls).toMatchObject([
      [
        {
          where: { id: 'path-relationship-id' },
          update: {
            requesterId: 'user-original-requester',
            recipientId: 'user-original-recipient',
            status: 'accepted',
          },
        },
      ],
    ]);
  });

  it('requires authentication before accepting a Contact request', async () => {
    const response = await request(app.getHttpServer())
      .post('/contact-requests/relationship-id/accept')
      .expect(401);
    const body = response.body as ContactRequestErrorBody;

    expect(body).toEqual(authenticationRequiredBody);
    expect(verifyAccessToken).not.toHaveBeenCalled();
    expect(userExists).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('returns authentication required for an unusable acceptance access token', async () => {
    verifyAccessToken.mockRejectedValueOnce(new InvalidAccessTokenError());

    const response = await request(app.getHttpServer())
      .post('/contact-requests/relationship-id/accept')
      .set('Authorization', 'Bearer unusable-access-token')
      .expect(401);
    const body = response.body as ContactRequestErrorBody;

    expect(body).toEqual(authenticationRequiredBody);
    expect(verifyAccessToken).toHaveBeenCalledWith('unusable-access-token');
    expect(userExists).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it.each([
    {
      scenario: 'a missing relationship',
      acceptingUserId: 'user-original-recipient',
      persistedRelationship: null,
    },
    {
      scenario: 'the original requester on a pending relationship',
      acceptingUserId: 'user-original-requester',
      persistedRelationship: {
        id: 'relationship-id',
        requesterId: 'user-original-requester',
        recipientId: 'user-original-recipient',
        status: 'pending',
      },
    },
    {
      scenario: 'an unrelated actor on an accepted relationship',
      acceptingUserId: 'user-unrelated',
      persistedRelationship: {
        id: 'relationship-id',
        requesterId: 'user-original-requester',
        recipientId: 'user-original-recipient',
        status: 'accepted',
      },
    },
  ])(
    'returns the fixed CONTACT_REQUEST_NOT_FOUND response for $scenario',
    async ({ acceptingUserId, persistedRelationship }) => {
      verifyAccessToken.mockResolvedValueOnce({
        userId: acceptingUserId,
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      });
      findUnique.mockResolvedValueOnce(persistedRelationship);

      const response = await request(app.getHttpServer())
        .post('/contact-requests/relationship-id/accept')
        .set('Authorization', 'Bearer access-token')
        .expect(404);
      const body = response.body as ContactRequestErrorBody;

      expect(body).toEqual(contactRequestNotFoundBody);
      expect(verifyAccessToken).toHaveBeenCalledWith('access-token');
      expect(userExists).not.toHaveBeenCalled();
      expect(findUnique).toHaveBeenCalledWith({
        where: { id: 'relationship-id' },
      });
      expect(findFirst).not.toHaveBeenCalled();
      expect(upsert).not.toHaveBeenCalled();
    },
  );

  it('returns already accepted for the original recipient accepting again', async () => {
    verifyAccessToken.mockResolvedValueOnce({
      userId: 'user-original-recipient',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    });
    findUnique.mockResolvedValueOnce({
      id: 'relationship-id',
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
      status: 'accepted',
    });

    const response = await request(app.getHttpServer())
      .post('/contact-requests/relationship-id/accept')
      .set('Authorization', 'Bearer recipient-access-token')
      .expect(409);
    const body = response.body as ContactRequestErrorBody;

    expect(body).toEqual(contactRequestAlreadyAcceptedBody);
    expect(verifyAccessToken).toHaveBeenCalledWith('recipient-access-token');
    expect(userExists).not.toHaveBeenCalled();
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'relationship-id' },
    });
    expect(findFirst).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it.each([
    {
      scenario: 'repository lookup rejection',
      arrangeFailure: (internalMessage: string) => {
        findUnique.mockRejectedValueOnce(new Error(internalMessage));
      },
      expectedFindUniqueCalls: 1,
      expectedUpsertCalls: 0,
    },
    {
      scenario: 'repository save rejection',
      arrangeFailure: (internalMessage: string) => {
        upsert.mockRejectedValueOnce(new Error(internalMessage));
      },
      expectedFindUniqueCalls: 1,
      expectedUpsertCalls: 1,
    },
  ])(
    'returns the fixed CONTACT_REQUEST_ACCEPTANCE_UNAVAILABLE response for $scenario',
    async ({
      arrangeFailure,
      expectedFindUniqueCalls,
      expectedUpsertCalls,
    }) => {
      const internalMessage = 'private acceptance repository failure';
      verifyAccessToken.mockResolvedValueOnce({
        userId: 'user-original-recipient',
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      });
      arrangeFailure(internalMessage);

      const response = await request(app.getHttpServer())
        .post('/contact-requests/relationship-id/accept')
        .set('Authorization', 'Bearer recipient-access-token')
        .expect(503);
      const body = response.body as ContactRequestErrorBody;

      expect(body).toEqual(contactRequestAcceptanceUnavailableBody);
      expect(JSON.stringify(body)).not.toContain(internalMessage);
      expect(verifyAccessToken).toHaveBeenCalledWith('recipient-access-token');
      expect(userExists).not.toHaveBeenCalled();
      expect(findUnique).toHaveBeenCalledTimes(expectedFindUniqueCalls);
      expect(findFirst).not.toHaveBeenCalled();
      expect(upsert).toHaveBeenCalledTimes(expectedUpsertCalls);
    },
  );

  it('returns the fixed internal-error response for unexpected acceptance failure', async () => {
    const internalValues = [
      'Unsupported ContactRelationship status.',
      'ContactRelationship',
      'PrismaContactRelationshipRepository',
      'P2002',
      'contact_relationships_current_user_pair_key',
      'private@example.com',
      'secret-access-token',
      'D:\\internal\\contact-request-acceptance.ts',
    ];
    verifyAccessToken.mockResolvedValueOnce({
      userId: 'user-original-recipient',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    });
    upsert.mockResolvedValueOnce({
      id: 'relationship-id',
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
      status: 'pending',
    });

    const response = await request(app.getHttpServer())
      .post('/contact-requests/relationship-id/accept')
      .set('Authorization', 'Bearer secret-access-token')
      .expect(500);
    const body = response.body as ContactRequestErrorBody;

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
    expect(userExists).not.toHaveBeenCalled();
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'relationship-id' },
    });
    expect(findFirst).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('reuses a same-direction pending relationship through the authenticated HTTP route', async () => {
    findFirst.mockResolvedValueOnce({
      id: 'existing-relationship-id',
      requesterId: 'user-requester',
      recipientId: 'user-target',
      status: 'pending',
    });

    const response = await request(app.getHttpServer())
      .post('/contact-requests')
      .set('Authorization', 'Bearer access-token')
      .send({ targetUserId: 'user-target' })
      .expect(200);
    const body = response.body as ContactRequestSuccessBody;

    expect(body).toEqual({
      id: 'existing-relationship-id',
      requesterId: 'user-requester',
      recipientId: 'user-target',
      status: 'pending',
    });
    expect(userExists).toHaveBeenCalledWith('user-target');
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('preserves original roles when reusing an opposing pending relationship', async () => {
    verifyAccessToken.mockResolvedValueOnce({
      userId: 'user-target',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    });
    findFirst.mockResolvedValueOnce({
      id: 'existing-relationship-id',
      requesterId: 'user-requester',
      recipientId: 'user-target',
      status: 'pending',
    });

    const response = await request(app.getHttpServer())
      .post('/contact-requests')
      .set('Authorization', 'Bearer opposing-access-token')
      .send({ targetUserId: 'user-requester' })
      .expect(200);
    const body = response.body as ContactRequestSuccessBody;

    expect(body).toEqual({
      id: 'existing-relationship-id',
      requesterId: 'user-requester',
      recipientId: 'user-target',
      status: 'pending',
    });
    expect(verifyAccessToken).toHaveBeenCalledWith('opposing-access-token');
    expect(userExists).toHaveBeenCalledWith('user-requester');
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('returns an accepted relationship truthfully when reusing it in the opposing direction', async () => {
    verifyAccessToken.mockResolvedValueOnce({
      userId: 'user-original-recipient',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    });
    findFirst.mockResolvedValueOnce({
      id: 'accepted-relationship-id',
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
      status: 'accepted',
    });

    const response = await request(app.getHttpServer())
      .post('/contact-requests')
      .set('Authorization', 'Bearer recipient-access-token')
      .send({ targetUserId: 'user-original-requester' })
      .expect(200);
    const body = response.body as ContactRequestSuccessBody;

    expect(body).toEqual({
      id: 'accepted-relationship-id',
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
      status: 'accepted',
    });
    expect(verifyAccessToken).toHaveBeenCalledWith('recipient-access-token');
    expect(userExists).toHaveBeenCalledWith('user-original-requester');
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(upsert).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', {}],
    ['non-string', { targetUserId: 42 }],
    ['empty', { targetUserId: '' }],
  ])(
    'returns the fixed safe validation envelope for a %s target user identifier',
    async (_scenario, body) => {
      const response = await request(app.getHttpServer())
        .post('/contact-requests')
        .set('Authorization', 'Bearer access-token')
        .send(body)
        .expect(400);
      const responseBody = response.body as ContactRequestErrorBody;

      expect(responseBody).toEqual({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed.',
          details: [
            {
              field: 'targetUserId',
              message: 'targetUserId must be a non-empty string.',
            },
          ],
        },
      });
      expect(userExists).not.toHaveBeenCalled();
      expect(findFirst).not.toHaveBeenCalled();
      expect(upsert).not.toHaveBeenCalled();
    },
  );

  it('removes unsupported fields and keeps requester authority server-side', async () => {
    const response = await request(app.getHttpServer())
      .post('/contact-requests')
      .set('Authorization', 'Bearer access-token')
      .send({
        targetUserId: 'user-target',
        requesterId: 'user-attacker',
        internalValue: 'private-client-value',
      })
      .expect(200);
    const body = response.body as ContactRequestSuccessBody;

    expect(transformedRequestBodies).toEqual([{ targetUserId: 'user-target' }]);
    expect(body).toEqual({
      id: 'relationship-id',
      requesterId: 'user-requester',
      recipientId: 'user-target',
      status: 'pending',
    });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls).toMatchObject([
      [
        {
          create: {
            requesterId: 'user-requester',
            recipientId: 'user-target',
          },
        },
      ],
    ]);
  });

  it.each([
    ['a missing header', undefined],
    ['a different scheme', 'Basic access-token'],
    ['a missing token', 'Bearer'],
    ['more than one credential', 'Bearer access-token unexpected'],
  ])(
    'returns authentication required for %s',
    async (_scenario, authorization) => {
      let httpRequest = request(app.getHttpServer()).post('/contact-requests');

      if (authorization !== undefined) {
        httpRequest = httpRequest.set('Authorization', authorization);
      }

      const response = await httpRequest
        .send({ targetUserId: 'user-target' })
        .expect(401);
      const body = response.body as ContactRequestErrorBody;

      expect(body).toEqual(authenticationRequiredBody);
      expect(verifyAccessToken).not.toHaveBeenCalled();
      expect(userExists).not.toHaveBeenCalled();
      expect(findFirst).not.toHaveBeenCalled();
      expect(upsert).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['invalid', new InvalidAccessTokenError()],
    ['expired', new ExpiredAccessTokenError()],
    ['unsupported', new UnsupportedAccessTokenTypeError()],
  ])(
    'returns authentication required for an %s access token',
    async (_scenario, tokenError) => {
      verifyAccessToken.mockRejectedValueOnce(tokenError);

      const response = await request(app.getHttpServer())
        .post('/contact-requests')
        .set('Authorization', 'Bearer unusable-access-token')
        .send({ targetUserId: 'user-target' })
        .expect(401);
      const body = response.body as ContactRequestErrorBody;

      expect(body).toEqual(authenticationRequiredBody);
      expect(verifyAccessToken).toHaveBeenCalledWith('unusable-access-token');
      expect(userExists).not.toHaveBeenCalled();
      expect(findFirst).not.toHaveBeenCalled();
      expect(upsert).not.toHaveBeenCalled();
    },
  );

  it('returns the fixed self-contact-request response before dependency work', async () => {
    const response = await request(app.getHttpServer())
      .post('/contact-requests')
      .set('Authorization', 'Bearer access-token')
      .send({ targetUserId: 'user-requester' })
      .expect(400);
    const body = response.body as ContactRequestErrorBody;

    expect(body).toEqual({
      error: {
        code: 'SELF_CONTACT_REQUEST',
        message: 'A Contact request cannot target the requester.',
      },
    });
    expect(userExists).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('returns the fixed target-not-found response for a confirmed missing target', async () => {
    userExists.mockResolvedValueOnce(false);

    const response = await request(app.getHttpServer())
      .post('/contact-requests')
      .set('Authorization', 'Bearer access-token')
      .send({ targetUserId: 'user-missing' })
      .expect(404);
    const body = response.body as ContactRequestErrorBody;

    expect(body).toEqual({
      error: {
        code: 'CONTACT_TARGET_NOT_FOUND',
        message: 'Contact target was not found.',
      },
    });
    expect(userExists).toHaveBeenCalledWith('user-missing');
    expect(findFirst).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it.each([
    {
      scenario: 'a Directory rejection',
      arrangeFailure: (internalMessage: string) => {
        userExists.mockRejectedValueOnce(new Error(internalMessage));
      },
      code: 'CONTACT_TARGET_LOOKUP_UNAVAILABLE',
      message: 'Contact target validation is temporarily unavailable.',
      internalMessage: 'private Directory provider failure',
      expectedFindFirstCalls: 0,
      expectedUpsertCalls: 0,
    },
    {
      scenario: 'a repository lookup rejection',
      arrangeFailure: (internalMessage: string) => {
        findFirst.mockRejectedValueOnce(new Error(internalMessage));
      },
      code: 'CONTACT_REQUEST_UNAVAILABLE',
      message: 'Contact request service is temporarily unavailable.',
      internalMessage: 'private repository lookup failure',
      expectedFindFirstCalls: 1,
      expectedUpsertCalls: 0,
    },
    {
      scenario: 'a repository save rejection',
      arrangeFailure: (internalMessage: string) => {
        upsert.mockRejectedValueOnce(new Error(internalMessage));
      },
      code: 'CONTACT_REQUEST_UNAVAILABLE',
      message: 'Contact request service is temporarily unavailable.',
      internalMessage: 'private repository save failure',
      expectedFindFirstCalls: 1,
      expectedUpsertCalls: 1,
    },
  ])(
    'returns the fixed $code response for $scenario',
    async ({
      arrangeFailure,
      code,
      message,
      internalMessage,
      expectedFindFirstCalls,
      expectedUpsertCalls,
    }) => {
      arrangeFailure(internalMessage);

      const response = await request(app.getHttpServer())
        .post('/contact-requests')
        .set('Authorization', 'Bearer access-token')
        .send({ targetUserId: 'user-target' })
        .expect(503);
      const body = response.body as ContactRequestErrorBody;

      expect(body).toEqual({
        error: { code, message },
      });
      expect(JSON.stringify(body)).not.toContain(internalMessage);
      expect(userExists).toHaveBeenCalledWith('user-target');
      expect(findFirst).toHaveBeenCalledTimes(expectedFindFirstCalls);
      expect(upsert).toHaveBeenCalledTimes(expectedUpsertCalls);
    },
  );

  it('returns only the fixed internal-error response for an unexpected failure', async () => {
    const internalValues = [
      'unexpected verifier failure',
      'JWT_PROVIDER_FAILURE',
      'private@example.com',
      'secret-access-token',
      'P2002',
      'contact_relationships_current_user_pair_key',
      'D:\\internal\\contact-request.ts',
    ];
    const unexpectedFailure = Object.assign(
      new BadRequestException(internalValues[0]),
      {
        providerCode: internalValues[1],
        principalEmail: internalValues[2],
        token: internalValues[3],
        databaseCode: internalValues[4],
        constraint: internalValues[5],
        stack: internalValues[6],
      },
    );
    verifyAccessToken.mockRejectedValueOnce(unexpectedFailure);

    const response = await request(app.getHttpServer())
      .post('/contact-requests')
      .set('Authorization', 'Bearer secret-access-token')
      .send({ targetUserId: 'user-target' })
      .expect(500);
    const body = response.body as ContactRequestErrorBody;

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
    expect(userExists).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
});
