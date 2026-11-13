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

type OpenApiParameter = {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: Record<string, unknown>;
};

type OpenApiOperation = {
  parameters?: OpenApiParameter[];
};

type OpenApiDocument = {
  paths: Record<string, Record<string, OpenApiOperation>>;
};

describe('OpenAPI description (e2e)', () => {
  let app: NestExpressApplication;
  let document: OpenApiDocument;

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

    const response = await request(app.getHttpServer())
      .get('/docs/api/openapi.json')
      .expect(200);
    document = response.body as OpenApiDocument;
  });

  afterAll(async () => {
    await app.close();
  });

  it('describes exactly the seven Contacts operations and nothing else', () => {
    const operations = Object.entries(document.paths)
      .flatMap(([path, methods]) =>
        Object.keys(methods).map((method) => `${method} ${path}`),
      )
      .sort();

    expect(operations).toEqual(
      [
        'delete /contacts/{contactUserId}',
        'get /contact-requests/incoming',
        'get /contact-requests/outgoing',
        'get /contacts',
        'post /contact-requests',
        'post /contact-requests/{contactRequestId}/accept',
        'post /contact-requests/{contactRequestId}/reject',
      ].sort(),
    );
  });

  describe('parameters', () => {
    it.each([
      [
        'post',
        '/contact-requests/{contactRequestId}/accept',
        'contactRequestId',
      ],
      [
        'post',
        '/contact-requests/{contactRequestId}/reject',
        'contactRequestId',
      ],
      ['delete', '/contacts/{contactUserId}', 'contactUserId'],
    ])(
      'describes %s %s with exactly one required string path parameter',
      (method, path, name) => {
        const parameters = document.paths[path][method].parameters;

        expect(parameters).toEqual([
          expect.objectContaining({
            name,
            in: 'path',
            required: true,
            schema: expect.objectContaining({ type: 'string' }) as unknown,
          }),
        ]);
      },
    );

    it.each([
      '/contact-requests/incoming',
      '/contact-requests/outgoing',
      '/contacts',
    ])(
      'describes get %s with exactly the optional limit and cursor query parameters',
      (path) => {
        const parameters = document.paths[path].get.parameters ?? [];
        const byName = Object.fromEntries(
          parameters.map((parameter) => [parameter.name, parameter]),
        );

        expect(Object.keys(byName).sort()).toEqual(['cursor', 'limit']);
        expect(parameters.every((parameter) => parameter.in === 'query')).toBe(
          true,
        );
        expect(
          parameters.every((parameter) => parameter.required === false),
        ).toBe(true);
        expect(byName.limit.schema).toEqual(
          expect.objectContaining({
            type: 'integer',
            minimum: 1,
            maximum: 50,
            default: 20,
          }),
        );
        expect(byName.cursor.schema).toEqual(
          expect.objectContaining({ type: 'string' }),
        );
        expect(byName.limit.description).toEqual(expect.any(String));
        expect(byName.cursor.description).toEqual(expect.any(String));
      },
    );

    it('declares no parameters for create', () => {
      expect(document.paths['/contact-requests'].post.parameters ?? []).toEqual(
        [],
      );
    });
  });
});
