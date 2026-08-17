import { Inject, Injectable, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AUTHENTICATION_API,
  DIRECTORY_API,
  IdentityModule,
  InvalidAccessTokenError,
} from '@huddle/identity';
import type { AuthenticationApi, DirectoryApi } from '@huddle/identity';

@Injectable()
class IdentityPublicApiConsumer {
  constructor(
    @Inject(AUTHENTICATION_API)
    readonly authenticationApi: AuthenticationApi,
    @Inject(DIRECTORY_API)
    readonly directoryApi: DirectoryApi,
  ) {}
}

@Module({
  imports: [IdentityModule],
  providers: [IdentityPublicApiConsumer],
})
class IdentityPublicApiConsumerModule {}

describe('IdentityModule public provider exports', () => {
  let testingModule: TestingModule;

  afterEach(async () => {
    await testingModule?.close();
  });

  it('allows a consumer module to inject the Authentication and Directory API tokens', async () => {
    testingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
              GITHUB_CALLBACK_URL:
                'http://localhost/auth/oauth/github/callback',
              GITHUB_CLIENT_ID: 'provider-export-github-client',
              GITHUB_CLIENT_SECRET: 'provider-export-github-secret',
              GOOGLE_CALLBACK_URL:
                'http://localhost/auth/oauth/google/callback',
              GOOGLE_CLIENT_ID: 'provider-export-google-client',
              GOOGLE_CLIENT_SECRET: 'provider-export-google-secret',
              JWT_SECRET: 'provider-export-test-secret',
            }),
          ],
        }),
        IdentityPublicApiConsumerModule,
      ],
    }).compile();

    const consumer = testingModule.get(IdentityPublicApiConsumer);

    await expect(
      consumer.authenticationApi.verifyAccessToken('invalid-token'),
    ).rejects.toBeInstanceOf(InvalidAccessTokenError);
    expect(consumer.directoryApi).toBeDefined();
  });
});
