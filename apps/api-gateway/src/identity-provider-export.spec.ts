import { Inject, Injectable, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AUTHENTICATION_API,
  IdentityModule,
  InvalidAccessTokenError,
} from '@huddle/identity';
import type { AuthenticationApi } from '@huddle/identity';

@Injectable()
class AuthenticationApiConsumer {
  constructor(
    @Inject(AUTHENTICATION_API)
    readonly authenticationApi: AuthenticationApi,
  ) {}
}

@Module({
  imports: [IdentityModule],
  providers: [AuthenticationApiConsumer],
})
class AuthenticationApiConsumerModule {}

describe('IdentityModule public provider exports', () => {
  let testingModule: TestingModule;

  afterEach(async () => {
    await testingModule?.close();
  });

  it('allows a consumer module to inject the Authentication API token', async () => {
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
        AuthenticationApiConsumerModule,
      ],
    }).compile();

    const consumer = testingModule.get(AuthenticationApiConsumer);

    await expect(
      consumer.authenticationApi.verifyAccessToken('invalid-token'),
    ).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });
});
