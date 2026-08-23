import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  CHAT_PRISMA_CLIENT,
  CONTACT_RELATIONSHIP_REPOSITORY,
  ChatPersistenceModule,
} from '@huddle/chat';

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
});
