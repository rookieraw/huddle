import { execSync } from 'node:child_process';
import path from 'node:path';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApiDocumentation } from '../src/interface/http/api-documentation/setup-api-documentation';
import { ApiValidationPipe } from '../src/interface/http/api-validation.pipe';
import { applyPlaceholderIdentityEnvironment } from './support/placeholder-identity-environment';
import { validateAgainstSchema } from './support/openapi-schema-conformance';

type DescribedResponses = Record<
  string,
  { content?: Record<string, { schema?: unknown }> }
>;

type OpenApiDocument = {
  paths: Record<string, Record<string, { responses?: DescribedResponses }>>;
};

type Outcome = { status: number; body: unknown; text: string };

type Scenario = {
  name: string;
  method: 'get' | 'post';
  template: string;
  status: number;
  perform: () => Promise<Outcome>;
};

type RegisteredUser = {
  id: string;
  email: string;
  password: string;
  verificationToken: string;
};

type Tokens = { accessToken: string; refreshToken: string };

describe('Identity OpenAPI response agreement (e2e)', () => {
  let container: StartedPostgreSqlContainer;
  let app: NestExpressApplication;
  let document: OpenApiDocument;
  let restoreEnvironment: () => void;
  let previousDatabaseUrl: string | undefined;
  let counter = 0;

  const api = () => request(app.getHttpServer());

  const nextEmail = (): string => {
    counter += 1;

    return `agreement-${counter}-${Date.now()}@example.com`;
  };

  const password = 'correct-horse-battery';

  const registerUser = async (): Promise<RegisteredUser> => {
    const email = nextEmail();
    const response = await api()
      .post('/auth/register')
      .send({ email, password, displayName: 'Ada Lovelace' })
      .expect(201);
    const body = response.body as { id: string; verificationToken: string };

    return {
      id: body.id,
      email,
      password,
      verificationToken: body.verificationToken,
    };
  };

  const verifiedUser = async (): Promise<RegisteredUser> => {
    const user = await registerUser();

    await api()
      .get('/auth/verify')
      .query({ token: user.verificationToken })
      .expect(200);

    return user;
  };

  const loggedInUser = async (): Promise<RegisteredUser & Tokens> => {
    const user = await verifiedUser();
    const response = await api()
      .post('/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(200);

    return { ...user, ...(response.body as Tokens) };
  };

  const scenarios: Scenario[] = [
    {
      name: 'register succeeds',
      method: 'post',
      template: '/auth/register',
      status: 201,
      perform: () =>
        api().post('/auth/register').send({
          email: nextEmail(),
          password,
          displayName: 'Ada Lovelace',
        }),
    },
    {
      name: 'verify succeeds',
      method: 'get',
      template: '/auth/verify',
      status: 200,
      perform: async () => {
        const user = await registerUser();

        return api()
          .get('/auth/verify')
          .query({ token: user.verificationToken });
      },
    },
    {
      name: 'login succeeds',
      method: 'post',
      template: '/auth/login',
      status: 200,
      perform: async () => {
        const user = await verifiedUser();

        return api()
          .post('/auth/login')
          .send({ email: user.email, password: user.password });
      },
    },
    {
      name: 'refresh succeeds',
      method: 'post',
      template: '/auth/refresh',
      status: 200,
      perform: async () => {
        const user = await loggedInUser();

        return api()
          .post('/auth/refresh')
          .send({ refreshToken: user.refreshToken });
      },
    },
    {
      name: 'logout succeeds',
      method: 'post',
      template: '/auth/logout',
      status: 204,
      perform: async () => {
        const user = await loggedInUser();

        return api()
          .post('/auth/logout')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .send({ refreshToken: user.refreshToken });
      },
    },
    {
      name: 'current user succeeds',
      method: 'get',
      template: '/users/me',
      status: 200,
      perform: async () => {
        const user = await loggedInUser();

        return api()
          .get('/users/me')
          .set('Authorization', `Bearer ${user.accessToken}`);
      },
    },
  ];

  beforeAll(async () => {
    restoreEnvironment = applyPlaceholderIdentityEnvironment();
    previousDatabaseUrl = process.env.DATABASE_URL;

    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    process.env.DATABASE_URL = container.getConnectionUri();

    execSync(
      'pnpm exec prisma db push --schema=./src/infrastructure/prisma/schema.prisma',
      {
        cwd: path.resolve(__dirname, '../../../libs/identity'),
        env: process.env,
        stdio: 'inherit',
      },
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    app.useGlobalPipes(new ApiValidationPipe());
    setupApiDocumentation(app, 'true');
    await app.init();

    const response = await request(app.getHttpServer())
      .get('/docs/api/openapi.json')
      .expect(200);
    document = response.body as OpenApiDocument;
  }, 60000);

  afterAll(async () => {
    await app.close();
    await container.stop();

    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }

    restoreEnvironment();
  });

  it.each(scenarios)('$name', async (scenario) => {
    const response = await scenario.perform();

    // A wrong status means the scenario arranged the wrong situation, not
    // that the description disagrees.
    expect(response.status).toBe(scenario.status);

    const described =
      document.paths[scenario.template]?.[scenario.method]?.responses?.[
        String(scenario.status)
      ];

    expect(described).toBeDefined();

    if (scenario.status === 204) {
      expect(described?.content).toBeUndefined();
      expect(response.text).toBe('');

      return;
    }

    const schema = described?.content?.['application/json']?.schema;

    expect(schema).toBeDefined();
    expect(validateAgainstSchema(document, schema, response.body)).toEqual([]);
  });
});
