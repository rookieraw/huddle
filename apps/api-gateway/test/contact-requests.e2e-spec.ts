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

const contactRequestAlreadyRejectedBody = {
  error: {
    code: 'CONTACT_REQUEST_ALREADY_REJECTED',
    message: 'Contact request has already been rejected.',
  },
};

const contactRequestAcceptanceUnavailableBody = {
  error: {
    code: 'CONTACT_REQUEST_ACCEPTANCE_UNAVAILABLE',
    message: 'Contact request acceptance is temporarily unavailable.',
  },
};

function createUnexpectedFailure() {
  const internalValues = {
    message: 'unexpected verifier failure',
    providerCode: 'JWT_PROVIDER_FAILURE',
    principalEmail: 'private@example.com',
    token: 'secret-access-token',
    databaseCode: 'P2002',
    constraint: 'contact_relationships_current_user_pair_key',
    domainType: 'ContactRelationship',
    repositoryType: 'PrismaContactRelationshipRepository',
    stack: 'D:\\internal\\contact-request.ts',
  };

  const failure = Object.assign(
    new BadRequestException(internalValues.message),
    {
      providerCode: internalValues.providerCode,
      principalEmail: internalValues.principalEmail,
      token: internalValues.token,
      databaseCode: internalValues.databaseCode,
      constraint: internalValues.constraint,
      domainType: internalValues.domainType,
      repositoryType: internalValues.repositoryType,
      stack: internalValues.stack,
    },
  );

  return { failure, internalValues: Object.values(internalValues) };
}

describe('Contact requests (e2e)', () => {
  let app: INestApplication<App>;

  const verifyAccessToken = jest.fn();
  const userExists = jest.fn();
  const findUnique = jest.fn();
  const findFirst = jest.fn();
  const upsert = jest.fn();
  const updateMany = jest.fn();
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
          updateMany,
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
    updateMany.mockReset().mockResolvedValue({ count: 1 });
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
    expect(upsert).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'relationship-id', status: 'pending' },
      data: { status: 'accepted' },
    });
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
    expect(upsert).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'path-relationship-id', status: 'pending' },
      data: { status: 'accepted' },
    });
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
    expect(updateMany).not.toHaveBeenCalled();
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
    expect(updateMany).not.toHaveBeenCalled();
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
    {
      scenario: 'an unrelated actor on a rejected relationship',
      acceptingUserId: 'user-unrelated',
      persistedRelationship: {
        id: 'relationship-id',
        requesterId: 'user-original-requester',
        recipientId: 'user-original-recipient',
        status: 'rejected',
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
      expect(updateMany).not.toHaveBeenCalled();
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
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('returns already rejected for the original recipient accepting a rejected relationship', async () => {
    verifyAccessToken.mockResolvedValueOnce({
      userId: 'user-original-recipient',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    });
    findUnique.mockResolvedValueOnce({
      id: 'relationship-id',
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
      status: 'rejected',
    });

    const response = await request(app.getHttpServer())
      .post('/contact-requests/relationship-id/accept')
      .set('Authorization', 'Bearer recipient-access-token')
      .expect(409);
    const body = response.body as ContactRequestErrorBody;

    expect(body).toEqual(contactRequestAlreadyRejectedBody);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'relationship-id' },
    });
    expect(upsert).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it.each([
    {
      resolved: 'accepted',
      expectedBody: contactRequestAlreadyAcceptedBody,
    },
    {
      resolved: 'rejected',
      expectedBody: contactRequestAlreadyRejectedBody,
    },
  ])(
    'returns the $resolved state when a concurrent resolution wins acceptance',
    async ({ resolved, expectedBody }) => {
      verifyAccessToken.mockResolvedValueOnce({
        userId: 'user-original-recipient',
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      });
      findUnique
        .mockResolvedValueOnce({
          id: 'relationship-id',
          requesterId: 'user-original-requester',
          recipientId: 'user-original-recipient',
          status: 'pending',
        })
        .mockResolvedValueOnce({
          id: 'relationship-id',
          requesterId: 'user-original-requester',
          recipientId: 'user-original-recipient',
          status: resolved,
        });
      updateMany.mockResolvedValueOnce({ count: 0 });

      const response = await request(app.getHttpServer())
        .post('/contact-requests/relationship-id/accept')
        .set('Authorization', 'Bearer recipient-access-token')
        .expect(409);
      const body = response.body as ContactRequestErrorBody;

      expect(body).toEqual(expectedBody);
      expect(findUnique).toHaveBeenCalledTimes(2);
      expect(updateMany).toHaveBeenCalledTimes(1);
      expect(upsert).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      scenario: 'repository lookup rejection',
      arrangeFailure: (internalMessage: string) => {
        findUnique.mockRejectedValueOnce(new Error(internalMessage));
      },
      expectedFindUniqueCalls: 1,
      expectedUpdateManyCalls: 0,
    },
    {
      scenario: 'repository transition rejection',
      arrangeFailure: (internalMessage: string) => {
        updateMany.mockRejectedValueOnce(new Error(internalMessage));
      },
      expectedFindUniqueCalls: 1,
      expectedUpdateManyCalls: 1,
    },
    {
      scenario: 'repository re-read rejection after a lost transition',
      arrangeFailure: (internalMessage: string) => {
        updateMany.mockResolvedValueOnce({ count: 0 });
        findUnique
          .mockResolvedValueOnce({
            id: 'relationship-id',
            requesterId: 'user-original-requester',
            recipientId: 'user-original-recipient',
            status: 'pending',
          })
          .mockRejectedValueOnce(new Error(internalMessage));
      },
      expectedFindUniqueCalls: 2,
      expectedUpdateManyCalls: 1,
    },
    {
      scenario:
        'a lost transition with a relationship that can no longer be read',
      arrangeFailure: () => {
        updateMany.mockResolvedValueOnce({ count: 0 });
        findUnique
          .mockResolvedValueOnce({
            id: 'relationship-id',
            requesterId: 'user-original-requester',
            recipientId: 'user-original-recipient',
            status: 'pending',
          })
          .mockResolvedValueOnce(null);
      },
      expectedFindUniqueCalls: 2,
      expectedUpdateManyCalls: 1,
    },
  ])(
    'returns the fixed CONTACT_REQUEST_ACCEPTANCE_UNAVAILABLE response for $scenario',
    async ({
      arrangeFailure,
      expectedFindUniqueCalls,
      expectedUpdateManyCalls,
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
      expect(upsert).not.toHaveBeenCalled();
      expect(updateMany).toHaveBeenCalledTimes(expectedUpdateManyCalls);
    },
  );

  it('rejects a pending relationship without a request body', async () => {
    verifyAccessToken.mockResolvedValueOnce({
      userId: 'user-original-recipient',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    });

    const response = await request(app.getHttpServer())
      .post('/contact-requests/relationship-id/reject')
      .set('Authorization', 'Bearer recipient-access-token')
      .expect(200);
    const body = response.body as ContactRequestSuccessBody;

    expect(body).toEqual({
      id: 'relationship-id',
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
      status: 'rejected',
    });
    expect(verifyAccessToken).toHaveBeenCalledWith('recipient-access-token');
    expect(userExists).not.toHaveBeenCalled();
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'relationship-id' },
    });
    expect(findFirst).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'relationship-id', status: 'pending' },
      data: { status: 'rejected' },
    });
  });

  it('ignores unsupported rejection body fields', async () => {
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

    const response = await request(app.getHttpServer())
      .post('/contact-requests/path-relationship-id/reject')
      .set('Authorization', 'Bearer recipient-access-token')
      .send({
        rejectingUserId: 'user-attacker',
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
      status: 'rejected',
    });
    expect(transformedRequestBodies).toEqual([]);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'path-relationship-id' },
    });
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'path-relationship-id', status: 'pending' },
      data: { status: 'rejected' },
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('requires authentication before rejecting a Contact request', async () => {
    const response = await request(app.getHttpServer())
      .post('/contact-requests/relationship-id/reject')
      .expect(401);
    const body = response.body as ContactRequestErrorBody;

    expect(body).toEqual(authenticationRequiredBody);
    expect(verifyAccessToken).not.toHaveBeenCalled();
    expect(userExists).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('returns authentication required for an unusable rejection access token', async () => {
    verifyAccessToken.mockRejectedValueOnce(new InvalidAccessTokenError());

    const response = await request(app.getHttpServer())
      .post('/contact-requests/relationship-id/reject')
      .set('Authorization', 'Bearer unusable-access-token')
      .expect(401);
    const body = response.body as ContactRequestErrorBody;

    expect(body).toEqual(authenticationRequiredBody);
    expect(verifyAccessToken).toHaveBeenCalledWith('unusable-access-token');
    expect(userExists).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it.each([
    {
      scenario: 'a missing relationship',
      rejectingUserId: 'user-original-recipient',
      persistedRelationship: null,
    },
    {
      scenario: 'the original requester on a pending relationship',
      rejectingUserId: 'user-original-requester',
      persistedRelationship: {
        id: 'relationship-id',
        requesterId: 'user-original-requester',
        recipientId: 'user-original-recipient',
        status: 'pending',
      },
    },
    {
      scenario: 'an unrelated actor on an accepted relationship',
      rejectingUserId: 'user-unrelated',
      persistedRelationship: {
        id: 'relationship-id',
        requesterId: 'user-original-requester',
        recipientId: 'user-original-recipient',
        status: 'accepted',
      },
    },
    {
      scenario: 'an unrelated actor on a rejected relationship',
      rejectingUserId: 'user-unrelated',
      persistedRelationship: {
        id: 'relationship-id',
        requesterId: 'user-original-requester',
        recipientId: 'user-original-recipient',
        status: 'rejected',
      },
    },
  ])(
    'returns the fixed CONTACT_REQUEST_NOT_FOUND response when rejecting $scenario',
    async ({ rejectingUserId, persistedRelationship }) => {
      verifyAccessToken.mockResolvedValueOnce({
        userId: rejectingUserId,
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      });
      findUnique.mockResolvedValueOnce(persistedRelationship);

      const response = await request(app.getHttpServer())
        .post('/contact-requests/relationship-id/reject')
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
      expect(updateMany).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      persisted: 'accepted',
      expectedBody: contactRequestAlreadyAcceptedBody,
    },
    {
      persisted: 'rejected',
      expectedBody: contactRequestAlreadyRejectedBody,
    },
  ])(
    'returns the $persisted state to the original recipient rejecting a resolved relationship',
    async ({ persisted, expectedBody }) => {
      verifyAccessToken.mockResolvedValueOnce({
        userId: 'user-original-recipient',
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      });
      findUnique.mockResolvedValueOnce({
        id: 'relationship-id',
        requesterId: 'user-original-requester',
        recipientId: 'user-original-recipient',
        status: persisted,
      });

      const response = await request(app.getHttpServer())
        .post('/contact-requests/relationship-id/reject')
        .set('Authorization', 'Bearer recipient-access-token')
        .expect(409);
      const body = response.body as ContactRequestErrorBody;

      expect(body).toEqual(expectedBody);
      expect(findUnique).toHaveBeenCalledWith({
        where: { id: 'relationship-id' },
      });
      expect(upsert).not.toHaveBeenCalled();
      expect(updateMany).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      resolved: 'accepted',
      expectedBody: contactRequestAlreadyAcceptedBody,
    },
    {
      resolved: 'rejected',
      expectedBody: contactRequestAlreadyRejectedBody,
    },
  ])(
    'returns the $resolved state when a concurrent resolution wins rejection',
    async ({ resolved, expectedBody }) => {
      verifyAccessToken.mockResolvedValueOnce({
        userId: 'user-original-recipient',
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      });
      findUnique
        .mockResolvedValueOnce({
          id: 'relationship-id',
          requesterId: 'user-original-requester',
          recipientId: 'user-original-recipient',
          status: 'pending',
        })
        .mockResolvedValueOnce({
          id: 'relationship-id',
          requesterId: 'user-original-requester',
          recipientId: 'user-original-recipient',
          status: resolved,
        });
      updateMany.mockResolvedValueOnce({ count: 0 });

      const response = await request(app.getHttpServer())
        .post('/contact-requests/relationship-id/reject')
        .set('Authorization', 'Bearer recipient-access-token')
        .expect(409);
      const body = response.body as ContactRequestErrorBody;

      expect(body).toEqual(expectedBody);
      expect(findUnique).toHaveBeenCalledTimes(2);
      expect(updateMany).toHaveBeenCalledTimes(1);
      expect(upsert).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      scenario: 'repository lookup rejection',
      arrangeFailure: (internalMessage: string) => {
        findUnique.mockRejectedValueOnce(new Error(internalMessage));
      },
      expectedFindUniqueCalls: 1,
      expectedUpdateManyCalls: 0,
    },
    {
      scenario: 'repository transition rejection',
      arrangeFailure: (internalMessage: string) => {
        updateMany.mockRejectedValueOnce(new Error(internalMessage));
      },
      expectedFindUniqueCalls: 1,
      expectedUpdateManyCalls: 1,
    },
    {
      scenario: 'repository re-read rejection after a lost transition',
      arrangeFailure: (internalMessage: string) => {
        updateMany.mockResolvedValueOnce({ count: 0 });
        findUnique
          .mockResolvedValueOnce({
            id: 'relationship-id',
            requesterId: 'user-original-requester',
            recipientId: 'user-original-recipient',
            status: 'pending',
          })
          .mockRejectedValueOnce(new Error(internalMessage));
      },
      expectedFindUniqueCalls: 2,
      expectedUpdateManyCalls: 1,
    },
    {
      scenario:
        'a lost transition with a relationship that can no longer be read',
      arrangeFailure: () => {
        updateMany.mockResolvedValueOnce({ count: 0 });
        findUnique
          .mockResolvedValueOnce({
            id: 'relationship-id',
            requesterId: 'user-original-requester',
            recipientId: 'user-original-recipient',
            status: 'pending',
          })
          .mockResolvedValueOnce(null);
      },
      expectedFindUniqueCalls: 2,
      expectedUpdateManyCalls: 1,
    },
  ])(
    'returns the fixed CONTACT_REQUEST_REJECTION_UNAVAILABLE response for $scenario',
    async ({
      arrangeFailure,
      expectedFindUniqueCalls,
      expectedUpdateManyCalls,
    }) => {
      const internalMessage = 'private rejection repository failure';
      verifyAccessToken.mockResolvedValueOnce({
        userId: 'user-original-recipient',
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      });
      arrangeFailure(internalMessage);

      const response = await request(app.getHttpServer())
        .post('/contact-requests/relationship-id/reject')
        .set('Authorization', 'Bearer recipient-access-token')
        .expect(503);
      const body = response.body as ContactRequestErrorBody;

      expect(body).toEqual({
        error: {
          code: 'CONTACT_REQUEST_REJECTION_UNAVAILABLE',
          message: 'Contact request rejection is temporarily unavailable.',
        },
      });
      expect(JSON.stringify(body)).not.toContain(internalMessage);
      expect(verifyAccessToken).toHaveBeenCalledWith('recipient-access-token');
      expect(userExists).not.toHaveBeenCalled();
      expect(findUnique).toHaveBeenCalledTimes(expectedFindUniqueCalls);
      expect(findFirst).not.toHaveBeenCalled();
      expect(upsert).not.toHaveBeenCalled();
      expect(updateMany).toHaveBeenCalledTimes(expectedUpdateManyCalls);
    },
  );

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

  it.each([
    {
      route: 'creation',
      path: '/contact-requests',
      body: { targetUserId: 'user-target' },
    },
    {
      route: 'acceptance',
      path: '/contact-requests/relationship-id/accept',
      body: undefined,
    },
    {
      route: 'rejection',
      path: '/contact-requests/relationship-id/reject',
      body: undefined,
    },
  ])(
    'returns only the fixed internal-error response for an unexpected failure on $route',
    async ({ path, body: requestBody }) => {
      const { failure, internalValues } = createUnexpectedFailure();
      verifyAccessToken.mockRejectedValueOnce(failure);

      let httpRequest = request(app.getHttpServer())
        .post(path)
        .set('Authorization', 'Bearer secret-access-token');
      if (requestBody) {
        httpRequest = httpRequest.send(requestBody);
      }
      const response = await httpRequest.expect(500);
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
      expect(findUnique).not.toHaveBeenCalled();
      expect(findFirst).not.toHaveBeenCalled();
      expect(upsert).not.toHaveBeenCalled();
      expect(updateMany).not.toHaveBeenCalled();
    },
  );
});
