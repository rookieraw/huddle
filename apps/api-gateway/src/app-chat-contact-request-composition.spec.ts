import {
  AcceptContactRequestUseCase,
  CHAT_PRISMA_CLIENT,
  SendContactRequestUseCase,
} from '@huddle/chat';
import { DIRECTORY_API } from '@huddle/identity';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';

describe('AppModule Chat Contact-request composition', () => {
  let testingModule: TestingModule | undefined;

  afterEach(async () => {
    await testingModule?.close();
  });

  it('includes the production Chat Contact-request module graph', async () => {
    testingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              DATABASE_URL:
                'postgresql://test:test@localhost:5432/chat-app-composition',
              GITHUB_CALLBACK_URL:
                'http://localhost/auth/oauth/github/callback',
              GITHUB_CLIENT_ID: 'app-composition-github-client',
              GITHUB_CLIENT_SECRET: 'app-composition-github-secret',
              GOOGLE_CALLBACK_URL:
                'http://localhost/auth/oauth/google/callback',
              GOOGLE_CLIENT_ID: 'app-composition-google-client',
              GOOGLE_CLIENT_SECRET: 'app-composition-google-secret',
              JWT_SECRET: 'app-composition-jwt-secret',
            }),
          ],
        }),
        AppModule,
      ],
    })
      .overrideProvider(DIRECTORY_API)
      .useValue({ userExists: jest.fn() })
      .overrideProvider(CHAT_PRISMA_CLIENT)
      .useValue({ contactRelationship: {} })
      .compile();

    expect(testingModule.get(SendContactRequestUseCase)).toBeDefined();
    expect(testingModule.get(AcceptContactRequestUseCase)).toBeDefined();
  });
});
