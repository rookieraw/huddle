import { execSync } from 'node:child_process';
import path from 'node:path';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

interface RegisterResponseBody {
  id: string;
  email: string;
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
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  }, 60000);

  afterAll(async () => {
    await app.close();
    await container.stop();
  });

  describe('register → verify → login', () => {
    it('registers, verifies, and logs in, returning a JWT pair', async () => {
      const email = `e2e-${Date.now()}@example.com`;
      const password = 'correct-horse-battery';

      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password })
        .expect(201);
      const registerBody = registerRes.body as RegisterResponseBody;

      expect(registerBody).toMatchObject({ email });
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
    });

    it('rejects registering the same email twice', async () => {
      const email = `e2e-dup-${Date.now()}@example.com`;
      const password = 'correct-horse-battery';

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password })
        .expect(409);
    });
  });
});
