import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { CHAT_PRISMA_CLIENT, ChatPersistenceModule } from '@huddle/chat';

type DisconnectablePrismaClient = {
  $disconnect(): Promise<void>;
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
});
