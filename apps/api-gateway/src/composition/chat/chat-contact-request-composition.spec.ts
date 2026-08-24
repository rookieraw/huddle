import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  CHAT_PRISMA_CLIENT,
  CONTACT_RELATIONSHIP_REPOSITORY,
  CONTACT_TARGET_DIRECTORY,
  ChatPersistenceModule,
  SendContactRequestUseCase,
} from '@huddle/chat';
import { DIRECTORY_API } from '@huddle/identity';
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
    testingModule = undefined;

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

    expect(CONTACT_RELATIONSHIP_REPOSITORY).toBeDefined();

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
});
