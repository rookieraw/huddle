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
  paths: Record<
    string,
    Record<string, { tags?: string[]; responses?: DescribedResponses }>
  >;
};

// A pooled connection to this address is refused at once, so an operation that
// needs the database fails with an unexpected error.
const unreachableDatabaseUrl = 'postgresql://nobody:nobody@127.0.0.1:1/none';

// Documented responses that cannot be arranged here: they need a real provider
// login or access to Identity internals. They are covered by reference
// identity instead: the callbacks' 200 uses the AuthTokensDto that the login
// and refresh scenarios prove, and the current-user 500 uses the error schema
// that the other 500 scenarios prove.
const unarrangeableResponses = [
  'get /auth/oauth/google/callback 200',
  'get /auth/oauth/github/callback 200',
  'get /users/me 500',
];

const identityTags = ['Authentication', 'OAuth', 'Current user'];

type Outcome = {
  status: number;
  body: unknown;
  text: string;
  headers: Record<string, unknown>;
};

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
  let failingApp: NestExpressApplication;
  let document: OpenApiDocument;
  let restoreEnvironment: () => void;
  let previousDatabaseUrl: string | undefined;
  let counter = 0;

  const api = () => request(app.getHttpServer());
  const failingApi = () => request(failingApp.getHttpServer());

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
      name: 'Google start redirects the browser',
      method: 'get',
      template: '/auth/oauth/google',
      status: 302,
      perform: () => api().get('/auth/oauth/google'),
    },
    {
      name: 'GitHub start redirects the browser',
      method: 'get',
      template: '/auth/oauth/github',
      status: 302,
      perform: () => api().get('/auth/oauth/github'),
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
    {
      name: 'register rejects an invalid request',
      method: 'post',
      template: '/auth/register',
      status: 400,
      perform: () =>
        api()
          .post('/auth/register')
          .send({ email: 'not-an-email', password, displayName: 'Ada' }),
    },
    {
      name: 'register rejects an email that is already registered',
      method: 'post',
      template: '/auth/register',
      status: 409,
      perform: async () => {
        const user = await registerUser();

        return api()
          .post('/auth/register')
          .send({ email: user.email, password, displayName: 'Ada Lovelace' });
      },
    },
    {
      name: 'register reports an unexpected failure',
      method: 'post',
      template: '/auth/register',
      status: 500,
      perform: () =>
        failingApi()
          .post('/auth/register')
          .send({ email: nextEmail(), password, displayName: 'Ada Lovelace' }),
    },
    {
      name: 'verify rejects an unknown token',
      method: 'get',
      template: '/auth/verify',
      status: 400,
      perform: () =>
        api().get('/auth/verify').query({ token: 'unknown-token' }),
    },
    {
      name: 'verify reports an unexpected failure',
      method: 'get',
      template: '/auth/verify',
      status: 500,
      perform: () =>
        failingApi().get('/auth/verify').query({ token: 'any-token' }),
    },
    {
      name: 'login rejects an invalid request',
      method: 'post',
      template: '/auth/login',
      status: 400,
      perform: () =>
        api().post('/auth/login').send({ email: 'not-an-email', password }),
    },
    {
      name: 'login rejects a wrong password',
      method: 'post',
      template: '/auth/login',
      status: 401,
      perform: async () => {
        const user = await verifiedUser();

        return api()
          .post('/auth/login')
          .send({ email: user.email, password: 'a-different-password' });
      },
    },
    {
      name: 'login rejects an email that is not verified',
      method: 'post',
      template: '/auth/login',
      status: 401,
      perform: async () => {
        const user = await registerUser();

        return api()
          .post('/auth/login')
          .send({ email: user.email, password: user.password });
      },
    },
    {
      name: 'login reports an unexpected failure',
      method: 'post',
      template: '/auth/login',
      status: 500,
      perform: () =>
        failingApi().post('/auth/login').send({ email: nextEmail(), password }),
    },
    {
      name: 'refresh rejects an invalid request',
      method: 'post',
      template: '/auth/refresh',
      status: 400,
      perform: () => api().post('/auth/refresh').send({}),
    },
    {
      name: 'refresh rejects an unknown refresh token',
      method: 'post',
      template: '/auth/refresh',
      status: 401,
      perform: () =>
        api()
          .post('/auth/refresh')
          .send({ refreshToken: 'unknown-refresh-token' }),
    },
    {
      name: 'refresh reports an unexpected failure',
      method: 'post',
      template: '/auth/refresh',
      status: 500,
      perform: () =>
        failingApi()
          .post('/auth/refresh')
          .send({ refreshToken: 'any-refresh-token' }),
    },
    {
      name: 'logout rejects an invalid request',
      method: 'post',
      template: '/auth/logout',
      status: 400,
      perform: async () => {
        const user = await loggedInUser();

        return api()
          .post('/auth/logout')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .send({});
      },
    },
    {
      name: 'logout rejects a request without an access token',
      method: 'post',
      template: '/auth/logout',
      status: 401,
      perform: () =>
        api().post('/auth/logout').send({ refreshToken: 'any-refresh-token' }),
    },
    {
      name: 'logout rejects a refresh token that belongs to another user',
      method: 'post',
      template: '/auth/logout',
      status: 401,
      perform: async () => {
        const user = await loggedInUser();
        const other = await loggedInUser();

        return api()
          .post('/auth/logout')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .send({ refreshToken: other.refreshToken });
      },
    },
    {
      name: 'logout reports an unexpected failure',
      method: 'post',
      template: '/auth/logout',
      status: 500,
      perform: async () => {
        const user = await loggedInUser();

        return failingApi()
          .post('/auth/logout')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .send({ refreshToken: user.refreshToken });
      },
    },
    {
      name: 'Google callback rejects a denied authorization',
      method: 'get',
      template: '/auth/oauth/google/callback',
      status: 401,
      perform: () =>
        api()
          .get('/auth/oauth/google/callback')
          .query({ error: 'access_denied' }),
    },
    // The contract lists a provider authentication failure as 401, but today a
    // provider-reported error other than access_denied is not mapped and gives
    // 500. This scenario proves only the body shape of that 500. The mismatch
    // is a known separate candidate and is not fixed here.
    {
      name: 'Google callback reports a provider error as an unexpected failure',
      method: 'get',
      template: '/auth/oauth/google/callback',
      status: 500,
      perform: () =>
        api()
          .get('/auth/oauth/google/callback')
          .query({ error: 'server_error' }),
    },
    {
      name: 'GitHub callback rejects a denied authorization',
      method: 'get',
      template: '/auth/oauth/github/callback',
      status: 401,
      perform: () =>
        api()
          .get('/auth/oauth/github/callback')
          .query({ error: 'access_denied' }),
    },
    // Same as the Google scenario above: a known 500 where the contract says 401.
    {
      name: 'GitHub callback reports a provider error as an unexpected failure',
      method: 'get',
      template: '/auth/oauth/github/callback',
      status: 500,
      perform: () =>
        api()
          .get('/auth/oauth/github/callback')
          .query({ error: 'server_error' }),
    },
    {
      name: 'current user rejects a request without an access token',
      method: 'get',
      template: '/users/me',
      status: 401,
      perform: () => api().get('/users/me'),
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

    // A second application whose database cannot be reached, for the
    // unexpected-failure responses. Only its connection string differs.
    process.env.DATABASE_URL = unreachableDatabaseUrl;
    const failingFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Its failures are intended, so Nest's error logging stays off.
    failingApp = failingFixture.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    failingApp.useGlobalPipes(new ApiValidationPipe());
    await failingApp.init();
    process.env.DATABASE_URL = container.getConnectionUri();

    const response = await request(app.getHttpServer())
      .get('/docs/api/openapi.json')
      .expect(200);
    document = response.body as OpenApiDocument;
  }, 60000);

  afterAll(async () => {
    await failingApp.close();
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

    if (scenario.status === 204 || scenario.status === 302) {
      expect(described?.content).toBeUndefined();
      expect(response.text).toBe('');

      if (scenario.status === 302) {
        // Only its presence is checked: the provider URL is never printed.
        expect(typeof response.headers.location).toBe('string');
      }

      return;
    }

    const schema = described?.content?.['application/json']?.schema;

    expect(schema).toBeDefined();
    expect(validateAgainstSchema(document, schema, response.body)).toEqual([]);
  });

  it('arranges every documented Identity response except the named exceptions', () => {
    const documented = Object.entries(document.paths).flatMap(
      ([path, methods]) =>
        Object.entries(methods)
          .filter(([, operation]) =>
            (operation.tags ?? []).some((tag) => identityTags.includes(tag)),
          )
          .flatMap(([method, operation]) =>
            Object.keys(operation.responses ?? {}).map(
              (status) => `${method} ${path} ${status}`,
            ),
          ),
    );
    const arranged = new Set(
      scenarios.map(
        (scenario) =>
          `${scenario.method} ${scenario.template} ${scenario.status}`,
      ),
    );

    expect(
      unarrangeableResponses.filter((response) => arranged.has(response)),
    ).toEqual([]);
    expect([...arranged, ...unarrangeableResponses].sort()).toEqual(
      [...documented].sort(),
    );
  });
});
