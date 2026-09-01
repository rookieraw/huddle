import { execSync } from 'node:child_process';
import path from 'node:path';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ApiValidationPipe } from '../src/interface/http/api-validation.pipe';

interface RegisterResponseBody {
  id: string;
  email: string;
  displayName: string;
  verificationToken: string;
}

interface VerifyResponseBody {
  id: string;
  email: string;
  verified: boolean;
}

interface LoginResponseBody {
  accessToken: string;
  refreshToken: string;
}

interface CurrentUserResponseBody {
  id: string;
  email: string;
  tier: string;
}

describe('Identity (e2e)', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication<App>;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    process.env.DATABASE_URL = container.getConnectionUri();

    const identityLibDir = path.resolve(__dirname, '../../../libs/identity');
    execSync(
      'pnpm exec prisma db push --schema=./src/infrastructure/prisma/schema.prisma',
      {
        cwd: identityLibDir,
        env: process.env,
        stdio: 'inherit',
      },
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ApiValidationPipe());
    await app.init();
  }, 60000);

  afterAll(async () => {
    await app.close();
    await container.stop();
  });

  describe('register → verify → login', () => {
    it('registers, verifies, logs in, and authenticates the current-user request', async () => {
      const email = `e2e-${Date.now()}@example.com`;
      const password = 'correct-horse-battery';

      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password, displayName: 'Ada Lovelace' })
        .expect(201);
      const registerBody = registerRes.body as RegisterResponseBody;

      expect(registerBody).toMatchObject({
        email,
        displayName: 'Ada Lovelace',
      });
      expect(registerBody.verificationToken).toEqual(expect.any(String));
      expect(registerBody.verificationToken.length).toBeGreaterThan(0);

      const verifyRes = await request(app.getHttpServer())
        .get('/auth/verify')
        .query({ token: registerBody.verificationToken })
        .expect(200);
      const verifyBody = verifyRes.body as VerifyResponseBody;

      expect(verifyBody).toMatchObject({ email, verified: true });

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);
      const loginBody = loginRes.body as LoginResponseBody;

      expect(loginBody.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
      expect(loginBody.refreshToken.length).toBeGreaterThan(0);

      const currentUserRes = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${loginBody.accessToken}`)
        .expect(200);
      const currentUserBody = currentUserRes.body as CurrentUserResponseBody;

      expect(currentUserBody).toEqual({
        id: registerBody.id,
        email,
        tier: 'free',
      });
    });

    it('rejects registering the same email twice', async () => {
      const email = `e2e-dup-${Date.now()}@example.com`;
      const password = 'correct-horse-battery';

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password, displayName: 'Ada Lovelace' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password, displayName: 'Ada Lovelace' })
        .expect(409);
    });
  });

  describe('input validation', () => {
    it('rejects a malformed email with 400, proving ValidationPipe is wired', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'not-an-email',
          password: 'correct-horse-battery',
          displayName: 'Ada Lovelace',
        })
        .expect(400);
    });

    it('rejects a missing display name with 400', async () => {
      const email = `e2e-missing-name-${Date.now()}@example.com`;

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'correct-horse-battery' })
        .expect(400);
    });

    it('rejects a non-string display name with 400', async () => {
      const email = `e2e-non-string-name-${Date.now()}@example.com`;

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email,
          password: 'correct-horse-battery',
          displayName: 12345,
        })
        .expect(400);
    });

    it('rejects a whitespace-only display name with 400', async () => {
      const email = `e2e-blank-name-${Date.now()}@example.com`;

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email,
          password: 'correct-horse-battery',
          displayName: '   ',
        })
        .expect(400);
    });

    it('rejects a display name over 50 characters with 400', async () => {
      const email = `e2e-long-name-${Date.now()}@example.com`;

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email,
          password: 'correct-horse-battery',
          displayName: 'A'.repeat(51),
        })
        .expect(400);
    });

    it('accepts a display name padded with whitespace that trims to exactly 50 characters', async () => {
      const email = `e2e-padded-name-${Date.now()}@example.com`;
      const paddedName = `  ${'A'.repeat(50)}  `;

      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email,
          password: 'correct-horse-battery',
          displayName: paddedName,
        })
        .expect(201);
      const registerBody = registerRes.body as RegisterResponseBody;

      expect(registerBody.displayName).toBe('A'.repeat(50));
    });

    it('accepts exactly 50 astral-plane (surrogate-pair) code points as a display name', async () => {
      const email = `e2e-astral-name-${Date.now()}@example.com`;
      const astralChar = String.fromCodePoint(0x1f600); // 😀
      const fiftyAstralChars = astralChar.repeat(50);

      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email,
          password: 'correct-horse-battery',
          displayName: fiftyAstralChars,
        })
        .expect(201);
      const registerBody = registerRes.body as RegisterResponseBody;

      expect(registerBody.displayName).toBe(fiftyAstralChars);
    });
  });
});
