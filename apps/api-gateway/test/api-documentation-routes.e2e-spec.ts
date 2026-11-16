import { CHAT_PRISMA_CLIENT } from '@huddle/chat';
import {
  AUTHENTICATION_API,
  DIRECTORY_API,
  PROFILE_QUERY_API,
} from '@huddle/identity';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApiDocumentation } from '../src/interface/http/api-documentation/setup-api-documentation';

async function createApp(
  switchValue: string | undefined,
): Promise<NestExpressApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(AUTHENTICATION_API)
    .useValue({ verifyAccessToken: jest.fn() })
    .overrideProvider(DIRECTORY_API)
    .useValue({ userExists: jest.fn() })
    .overrideProvider(PROFILE_QUERY_API)
    .useValue({ getProfiles: jest.fn() })
    .overrideProvider(CHAT_PRISMA_CLIENT)
    .useValue({ contactRelationship: {} })
    .compile();

  const created = moduleFixture.createNestApplication<NestExpressApplication>();
  setupApiDocumentation(created, switchValue);
  await created.init();

  return created;
}

// Nest's not-found message repeats the requested path, so compare bodies with
// the path replaced.
function withoutPath(body: unknown, requestedPath: string) {
  const { message, ...rest } = body as { message: string };

  return { ...rest, message: message.replace(requestedPath, '<path>') };
}

describe('API documentation routes (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createApp('true');
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the OpenAPI 3.0 JSON description at /docs/api/openapi.json when the switch is enabled', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs/api/openapi.json')
      .expect(200);
    const body = response.body as { openapi: string };

    expect(response.type).toBe('application/json');
    expect(body.openapi).toMatch(/^3\.0\.\d+$/);
  });

  it('serves Swagger UI at /docs/api with its static assets under the prefix', async () => {
    const page = await request(app.getHttpServer())
      .get('/docs/api')
      .expect(200);

    expect(page.type).toBe('text/html');
    expect(page.text).toContain('swagger-ui');

    await request(app.getHttpServer())
      .get('/docs/api/swagger-ui-bundle.js')
      .expect(200);
  });

  it.each([
    '/docs',
    '/docs/api-json',
    '/docs/api-yaml',
    '/docs/api/openapi.yaml',
  ])('does not serve %s', async (path) => {
    await request(app.getHttpServer()).get(path).expect(404);
  });
});

describe.each([undefined, '', 'false', 'TRUE', '1', ' true'])(
  'API documentation routes with the switch set to %p (e2e)',
  (switchValue) => {
    const unregisteredPath = '/not/a/registered/path';
    let app: NestExpressApplication;

    beforeAll(async () => {
      app = await createApp(switchValue);
    });

    afterAll(async () => {
      await app.close();
    });

    it.each([
      '/docs/api',
      '/docs/api/',
      '/docs/api/index.html',
      '/docs/api/swagger-ui-bundle.js',
      '/docs/api/swagger-ui-init.js',
      '/docs/api/openapi.json',
    ])('answers %s like an unregistered path', async (path) => {
      const unregistered = await request(app.getHttpServer()).get(
        unregisteredPath,
      );
      const response = await request(app.getHttpServer()).get(path);

      expect(unregistered.status).toBe(404);
      expect(response.status).toBe(unregistered.status);
      expect(withoutPath(response.body, path)).toEqual(
        withoutPath(unregistered.body, unregisteredPath),
      );
    });
  },
);
