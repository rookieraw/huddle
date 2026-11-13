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

describe('API documentation routes (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
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

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    setupApiDocumentation(app, 'true');
    await app.init();
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
