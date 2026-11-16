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
import {
  createApiDocument,
  serializeApiDocument,
} from '../src/interface/http/api-documentation/create-api-document';
import { setupApiDocumentation } from '../src/interface/http/api-documentation/setup-api-documentation';

describe('OpenAPI generation (e2e)', () => {
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

  it('serves exactly the document that createApiDocument generates', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs/api/openapi.json')
      .expect(200);

    expect(response.body).toEqual(
      JSON.parse(serializeApiDocument(createApiDocument(app))) as unknown,
    );
  });

  it('serializes as two-space JSON with exactly one trailing newline', () => {
    const text = serializeApiDocument(createApiDocument(app));

    expect(text).toMatch(/^\{\n {2}"[^"\n]+": /);
    expect(text.endsWith('}\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
    expect(() => JSON.parse(text) as unknown).not.toThrow();
  });

  it('generates identical text every time', () => {
    expect(serializeApiDocument(createApiDocument(app))).toBe(
      serializeApiDocument(createApiDocument(app)),
    );
  });
});
