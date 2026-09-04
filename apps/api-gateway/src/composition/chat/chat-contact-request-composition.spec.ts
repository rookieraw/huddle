import { ConfigModule } from '@nestjs/config';
import type { ArgumentsHost, ExecutionContext } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import {
  EXCEPTION_FILTERS_METADATA,
  GUARDS_METADATA,
} from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AcceptContactRequestUseCase,
  CHAT_PRISMA_CLIENT,
  CONTACT_RELATIONSHIP_REPOSITORY,
  CONTACT_TARGET_DIRECTORY,
  ChatPersistenceModule,
  ContactRequestUnavailableError,
  SendContactRequestUseCase,
} from '@huddle/chat';
import { AUTHENTICATION_API, DIRECTORY_API } from '@huddle/identity';
import { ContactRequestAuthenticationGuard } from '../../interface/http/chat/contact-request-authentication.guard';
import { ContactRequestExceptionFilter } from '../../interface/http/chat/contact-request-exception.filter';
import { ContactRequestsController } from '../../interface/http/chat/contact-requests.controller';
import { ChatContactRequestModule } from './chat-contact-request.module';
import { IdentityContactTargetDirectoryAdapter } from './identity-contact-target-directory.adapter';

type DisconnectablePrismaClient = {
  $disconnect(): Promise<void>;
};

type ContactRelationshipRepository = {
  findCurrentByUserPair(
    firstUserId: string,
    secondUserId: string,
  ): Promise<unknown>;
};

type ContactRequestTestRequest = {
  headers: {
    authorization?: unknown;
  };
  user?: {
    userId: string;
  };
};

function createExecutionContext(
  request: ContactRequestTestRequest,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function createArgumentsHost() {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
  };
  response.status.mockReturnValue(response);

  return {
    host: {
      switchToHttp: () => ({
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost,
    response,
  };
}

describe('Chat Contact-request production composition', () => {
  let testingModule: TestingModule | undefined;

  afterEach(async () => {
    await testingModule?.close();
  });

  it('disconnects the Chat Prisma client when its production module closes', async () => {
    testingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              DATABASE_URL:
                'postgresql://test:test@localhost:5432/chat-composition',
            }),
          ],
        }),
        ChatPersistenceModule,
      ],
    }).compile();
    const prisma =
      testingModule.get<DisconnectablePrismaClient>(CHAT_PRISMA_CLIENT);
    const disconnect = jest
      .spyOn(prisma, '$disconnect')
      .mockResolvedValue(undefined);

    await testingModule.close();
    testingModule = undefined; // Prevent afterEach from closing the module twice.

    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('binds the real Contact relationship repository to the injected Chat Prisma client', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = {
      contactRelationship: {
        findFirst,
      },
    };
    testingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              DATABASE_URL:
                'postgresql://test:test@localhost:5432/chat-composition',
            }),
          ],
        }),
        ChatPersistenceModule,
      ],
    })
      .overrideProvider(CHAT_PRISMA_CLIENT)
      .useValue(prisma)
      .compile();

    const repository = testingModule.get<ContactRelationshipRepository>(
      CONTACT_RELATIONSHIP_REPOSITORY,
    );

    await expect(
      repository.findCurrentByUserPair('user-first', 'user-second'),
    ).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it('resolves the use case through the Identity adapter and both Chat ports', async () => {
    const userExists = jest.fn().mockResolvedValue(true);
    const findFirst = jest.fn().mockResolvedValue(null);
    const upsert = jest.fn().mockResolvedValue({
      id: 'relationship-id',
      requesterId: 'user-requester',
      recipientId: 'user-target',
      status: 'pending',
    });
    const prisma = {
      contactRelationship: {
        findFirst,
        upsert,
      },
    };
    testingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              DATABASE_URL:
                'postgresql://test:test@localhost:5432/chat-composition',
              GITHUB_CALLBACK_URL:
                'http://localhost/auth/oauth/github/callback',
              GITHUB_CLIENT_ID: 'composition-github-client',
              GITHUB_CLIENT_SECRET: 'composition-github-secret',
              GOOGLE_CALLBACK_URL:
                'http://localhost/auth/oauth/google/callback',
              GOOGLE_CLIENT_ID: 'composition-google-client',
              GOOGLE_CLIENT_SECRET: 'composition-google-secret',
              JWT_SECRET: 'composition-jwt-secret',
            }),
          ],
        }),
        ChatContactRequestModule,
      ],
    })
      .overrideProvider(DIRECTORY_API)
      .useValue({ userExists })
      .overrideProvider(CHAT_PRISMA_CLIENT)
      .useValue(prisma)
      .compile();

    const adapter = testingModule.get(IdentityContactTargetDirectoryAdapter);
    expect(testingModule.get(CONTACT_TARGET_DIRECTORY)).toBe(adapter);

    const useCase = testingModule.get(SendContactRequestUseCase);
    const result = await useCase.execute({
      requesterId: 'user-requester',
      targetUserId: 'user-target',
    });

    expect(userExists).toHaveBeenCalledTimes(1);
    expect(userExists).toHaveBeenCalledWith('user-target');
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      id: 'relationship-id',
      requesterId: 'user-requester',
      recipientId: 'user-target',
    });
  });

  it('resolves acceptance through the existing Contact relationship repository', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'relationship-id',
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
      status: 'pending',
    });
    const upsert = jest.fn().mockResolvedValue({
      id: 'relationship-id',
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
      status: 'accepted',
    });
    const prisma = {
      contactRelationship: {
        findUnique,
        upsert,
      },
    };
    testingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              DATABASE_URL:
                'postgresql://test:test@localhost:5432/chat-composition',
              GITHUB_CALLBACK_URL:
                'http://localhost/auth/oauth/github/callback',
              GITHUB_CLIENT_ID: 'composition-github-client',
              GITHUB_CLIENT_SECRET: 'composition-github-secret',
              GOOGLE_CALLBACK_URL:
                'http://localhost/auth/oauth/google/callback',
              GOOGLE_CLIENT_ID: 'composition-google-client',
              GOOGLE_CLIENT_SECRET: 'composition-google-secret',
              JWT_SECRET: 'composition-jwt-secret',
            }),
          ],
        }),
        ChatContactRequestModule,
      ],
    })
      .overrideProvider(DIRECTORY_API)
      .useValue({ userExists: jest.fn() })
      .overrideProvider(CHAT_PRISMA_CLIENT)
      .useValue(prisma)
      .compile();

    const controller = testingModule.get(ContactRequestsController);
    expect(testingModule.get(AcceptContactRequestUseCase)).toBeDefined();

    await expect(
      controller.acceptContactRequest(
        {
          headers: {},
          user: { userId: 'user-original-recipient' },
        },
        'relationship-id',
      ),
    ).resolves.toEqual({
      id: 'relationship-id',
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
      status: 'accepted',
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'relationship-id' },
    });
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('runs the registered controller path through the production graph', async () => {
    const verifyAccessToken = jest.fn().mockResolvedValue({
      userId: 'user-requester',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    });
    const userExists = jest.fn().mockResolvedValue(true);
    const repositoryFailure = new Error('Raw repository failure');
    const findFirst = jest.fn().mockRejectedValue(repositoryFailure);
    const prisma = {
      contactRelationship: {
        findFirst,
      },
    };
    testingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              DATABASE_URL:
                'postgresql://test:test@localhost:5432/chat-composition',
              GITHUB_CALLBACK_URL:
                'http://localhost/auth/oauth/github/callback',
              GITHUB_CLIENT_ID: 'composition-github-client',
              GITHUB_CLIENT_SECRET: 'composition-github-secret',
              GOOGLE_CALLBACK_URL:
                'http://localhost/auth/oauth/google/callback',
              GOOGLE_CLIENT_ID: 'composition-google-client',
              GOOGLE_CLIENT_SECRET: 'composition-google-secret',
              JWT_SECRET: 'composition-jwt-secret',
            }),
          ],
        }),
        ChatContactRequestModule,
      ],
    })
      .overrideProvider(AUTHENTICATION_API)
      .useValue({ verifyAccessToken })
      .overrideProvider(DIRECTORY_API)
      .useValue({ userExists })
      .overrideProvider(CHAT_PRISMA_CLIENT)
      .useValue(prisma)
      .compile();

    const controller = testingModule.get(ContactRequestsController);
    const guard = testingModule.get(ContactRequestAuthenticationGuard);
    const filter = testingModule.get(ContactRequestExceptionFilter);
    const adapter = testingModule.get(IdentityContactTargetDirectoryAdapter);
    expect(testingModule.get(CONTACT_TARGET_DIRECTORY)).toBe(adapter);

    const registeredGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      ContactRequestsController,
    ) as unknown;
    const registeredFilters = Reflect.getMetadata(
      EXCEPTION_FILTERS_METADATA,
      ContactRequestsController,
    ) as unknown;
    expect(registeredGuards).toEqual(
      expect.arrayContaining([ContactRequestAuthenticationGuard]),
    );
    expect(registeredFilters).toEqual(
      expect.arrayContaining([ContactRequestExceptionFilter]),
    );

    const request: ContactRequestTestRequest = {
      headers: {
        authorization: 'Bearer access-token',
      },
    };
    await expect(
      guard.canActivate(createExecutionContext(request)),
    ).resolves.toBe(true);
    expect(request.user).toEqual({ userId: 'user-requester' });

    if (!request.user) {
      throw new Error('Expected the Guard to attach a verified user.');
    }

    const failure: unknown = await controller
      .createContactRequest(
        {
          headers: request.headers,
          user: request.user,
        },
        { targetUserId: 'user-target' },
      )
      .then(
        () => undefined,
        (error: unknown) => error,
      );
    expect(failure).toBeInstanceOf(ContactRequestUnavailableError);

    const { host, response } = createArgumentsHost();
    filter.catch(failure, host);

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'CONTACT_REQUEST_UNAVAILABLE',
        message: 'Contact request service is temporarily unavailable.',
      },
    });
    expect(verifyAccessToken).toHaveBeenCalledWith('access-token');
    expect(userExists).toHaveBeenCalledWith('user-target');
    expect(findFirst).toHaveBeenCalledTimes(1);
  });
});
