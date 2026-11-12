import { CHAT_PRISMA_CLIENT } from '@huddle/chat';
import {
  AUTHENTICATION_API,
  DIRECTORY_API,
  InvalidAccessTokenError,
  PROFILE_QUERY_API,
} from '@huddle/identity';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ApiValidationPipe } from '../src/interface/http/api-validation.pipe';

type ContactRemovalErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

const acceptedRelationship = {
  id: 'relationship-private-id',
  requesterId: 'user-contact',
  recipientId: 'user-actor',
  status: 'accepted',
  removedByUserId: null,
  removedAt: null,
};

const privateValues = [
  'relationship-private-id',
  'accepted',
  'removed',
  'removedAt',
  'removedByUserId',
  'status',
];

describe('Contact removal (e2e)', () => {
  let app: INestApplication<App>;

  const verifyAccessToken = jest.fn();
  const userExists = jest.fn();
  const getProfiles = jest.fn();
  const findFirst = jest.fn();
  const updateMany = jest.fn();

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
      .useValue({ contactRelationship: { findFirst, updateMany } })
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
    getProfiles.mockReset();
    findFirst.mockReset().mockResolvedValue(null);
    updateMany.mockReset().mockResolvedValue({ count: 1 });
  });

  afterAll(async () => {
    await app.close();
  });

  it('removes an accepted Contact through the authenticated route and returns 204 with no body', async () => {
    findFirst.mockResolvedValueOnce(acceptedRelationship);

    const response = await request(app.getHttpServer())
      .delete('/contacts/user-contact')
      .set('Authorization', 'Bearer access-token')
      .expect(204);

    expect(response.text).toBe('');
    expect(response.body).toEqual({});
    expect(verifyAccessToken).toHaveBeenCalledWith('access-token');
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'relationship-private-id', status: 'accepted' },
      data: {
        status: 'removed',
        removedByUserId: 'user-actor',
        removedAt: expect.any(Date) as Date,
      },
    });
    expect(userExists).not.toHaveBeenCalled();
    expect(getProfiles).not.toHaveBeenCalled();
  });

  it('lets either user of the relationship remove it regardless of who requested', async () => {
    findFirst.mockResolvedValueOnce({
      ...acceptedRelationship,
      requesterId: 'user-actor',
      recipientId: 'user-contact',
    });

    await request(app.getHttpServer())
      .delete('/contacts/user-contact')
      .set('Authorization', 'Bearer access-token')
      .expect(204);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'relationship-private-id', status: 'accepted' },
      data: expect.objectContaining({
        removedByUserId: 'user-actor',
      }) as unknown,
    });
  });

  it('ignores client-supplied body and query values and removes as the verified user', async () => {
    findFirst.mockResolvedValueOnce(acceptedRelationship);

    await request(app.getHttpServer())
      .delete('/contacts/user-contact')
      .query({
        userId: 'user-other',
        contactUserId: 'user-other',
        removedByUserId: 'user-other',
      })
      .set('Authorization', 'Bearer access-token')
      .send({
        userId: 'user-other',
        contactUserId: 'user-other',
        removedByUserId: 'user-other',
        removedAt: '2000-01-01T00:00:00.000Z',
        status: 'accepted',
      })
      .expect(204);

    expect(updateMany).toHaveBeenCalledTimes(1);
    const [{ data }] = updateMany.mock.calls[0] as [
      { data: { removedByUserId: string; removedAt: Date } },
    ];
    expect(data.removedByUserId).toBe('user-actor');
    expect(data.removedAt.getUTCFullYear()).toBeGreaterThan(2000);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { requesterId: 'user-actor', recipientId: 'user-contact' },
            { requesterId: 'user-contact', recipientId: 'user-actor' },
          ],
        }) as unknown,
      }),
    );
  });

  it.each([
    {
      scenario: 'the pair has no relationship',
      contactUserId: 'user-contact',
      arrange: () => undefined,
      expectedUpdateCalls: 0,
    },
    {
      scenario: 'the pair has only a pending relationship',
      contactUserId: 'user-contact',
      arrange: () => {
        findFirst.mockResolvedValueOnce({
          ...acceptedRelationship,
          status: 'pending',
        });
      },
      expectedUpdateCalls: 0,
    },
    {
      scenario: 'the target is the verified user',
      contactUserId: 'user-actor',
      arrange: () => undefined,
      expectedUpdateCalls: 0,
    },
    {
      scenario: 'a concurrent removal won',
      contactUserId: 'user-contact',
      arrange: () => {
        findFirst.mockResolvedValueOnce(acceptedRelationship);
        updateMany.mockResolvedValueOnce({ count: 0 });
      },
      expectedUpdateCalls: 1,
    },
  ])(
    'returns the identical fixed CONTACT_NOT_FOUND response when $scenario',
    async ({ contactUserId, arrange, expectedUpdateCalls }) => {
      arrange();

      const response = await request(app.getHttpServer())
        .delete(`/contacts/${contactUserId}`)
        .set('Authorization', 'Bearer access-token')
        .expect(404);
      const body = response.body as ContactRemovalErrorBody;

      expect(body).toEqual({
        error: {
          code: 'CONTACT_NOT_FOUND',
          message: 'Contact was not found.',
        },
      });
      expect(updateMany).toHaveBeenCalledTimes(expectedUpdateCalls);
      expect(userExists).not.toHaveBeenCalled();
      const serializedBody = JSON.stringify(body);
      for (const privateValue of privateValues) {
        expect(serializedBody).not.toContain(privateValue);
      }
    },
  );

  it('returns authentication required for a missing header before any lookup', async () => {
    const response = await request(app.getHttpServer())
      .delete('/contacts/user-contact')
      .expect(401);
    const body = response.body as ContactRemovalErrorBody;

    expect(body).toEqual({
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required.',
      },
    });
    expect(verifyAccessToken).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('returns authentication required for an invalid access token before any lookup', async () => {
    verifyAccessToken.mockRejectedValueOnce(new InvalidAccessTokenError());

    const response = await request(app.getHttpServer())
      .delete('/contacts/user-contact')
      .set('Authorization', 'Bearer unusable-access-token')
      .expect(401);
    const body = response.body as ContactRemovalErrorBody;

    expect(body).toEqual({
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required.',
      },
    });
    expect(verifyAccessToken).toHaveBeenCalledWith('unusable-access-token');
    expect(findFirst).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it.each([
    {
      scenario: 'a relationship lookup rejection',
      arrangeFailure: (internalMessage: string) => {
        findFirst.mockRejectedValueOnce(new Error(internalMessage));
      },
      internalMessage: 'private removal lookup failure',
      expectedUpdateCalls: 0,
    },
    {
      scenario: 'a removal transition rejection',
      arrangeFailure: (internalMessage: string) => {
        findFirst.mockResolvedValueOnce(acceptedRelationship);
        updateMany.mockRejectedValueOnce(new Error(internalMessage));
      },
      internalMessage: 'private removal transition failure',
      expectedUpdateCalls: 1,
    },
  ])(
    'returns the fixed CONTACT_REMOVAL_UNAVAILABLE response for $scenario',
    async ({ arrangeFailure, internalMessage, expectedUpdateCalls }) => {
      arrangeFailure(internalMessage);

      const response = await request(app.getHttpServer())
        .delete('/contacts/user-contact')
        .set('Authorization', 'Bearer access-token')
        .expect(503);
      const body = response.body as ContactRemovalErrorBody;

      expect(body).toEqual({
        error: {
          code: 'CONTACT_REMOVAL_UNAVAILABLE',
          message: 'Contact removal is temporarily unavailable.',
        },
      });
      expect(JSON.stringify(body)).not.toContain(internalMessage);
      expect(findFirst).toHaveBeenCalledTimes(1);
      expect(updateMany).toHaveBeenCalledTimes(expectedUpdateCalls);
    },
  );

  it('returns only the fixed internal-error response for an unexpected failure', async () => {
    const internalValues = [
      'unexpected verifier failure',
      'JWT_PROVIDER_FAILURE',
      'private@example.com',
      'secret-access-token',
      'D:\\internal\\contact-removal.ts',
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
      .delete('/contacts/user-contact')
      .set('Authorization', 'Bearer secret-access-token')
      .expect(500);
    const body = response.body as ContactRemovalErrorBody;

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
    expect(findFirst).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });
});
