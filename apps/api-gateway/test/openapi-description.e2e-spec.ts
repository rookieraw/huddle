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
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: Record<string, unknown> }>;
  };
  security?: Record<string, string[]>[];
  responses?: Record<
    string,
    {
      description?: string;
      content?: Record<string, { schema?: Record<string, unknown> }>;
    }
  >;
};

type SchemaObject = {
  type?: string;
  required?: string[];
  properties?: Record<string, Record<string, unknown>>;
};

type OpenApiDocument = {
  paths: Record<string, Record<string, OpenApiOperation>>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    securitySchemes?: Record<string, Record<string, unknown>>;
  };
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

  describe('request body', () => {
    it('describes the create request body as a required JSON SendContactRequestDto', () => {
      const requestBody = document.paths['/contact-requests'].post.requestBody;

      expect(requestBody?.required).toBe(true);
      expect(Object.keys(requestBody?.content ?? {})).toEqual([
        'application/json',
      ]);
      expect(requestBody?.content?.['application/json'].schema).toEqual({
        $ref: '#/components/schemas/SendContactRequestDto',
      });
    });

    it('describes targetUserId as the only, required, non-empty string field', () => {
      expect(document.components?.schemas?.SendContactRequestDto).toEqual(
        expect.objectContaining({
          type: 'object',
          required: ['targetUserId'],
          properties: {
            targetUserId: expect.objectContaining({
              type: 'string',
              minLength: 1,
            }) as unknown,
          },
        }),
      );
    });

    it.each([
      ['post', '/contact-requests/{contactRequestId}/accept'],
      ['post', '/contact-requests/{contactRequestId}/reject'],
      ['get', '/contact-requests/incoming'],
      ['get', '/contact-requests/outgoing'],
      ['get', '/contacts'],
      ['delete', '/contacts/{contactUserId}'],
    ])('declares no request body for %s %s', (method, path) => {
      expect(document.paths[path][method].requestBody).toBeUndefined();
    });
  });

  describe('success responses', () => {
    const relationshipFields = ['id', 'requesterId', 'recipientId', 'status'];

    it.each([
      ['/contact-requests', 'ContactRequestDto', ['pending', 'accepted']],
      [
        '/contact-requests/{contactRequestId}/accept',
        'AcceptedContactRequestDto',
        ['accepted'],
      ],
      [
        '/contact-requests/{contactRequestId}/reject',
        'RejectedContactRequestDto',
        ['rejected'],
      ],
    ])(
      'describes post %s as 200 JSON %s with no other success status',
      (path, schemaName, statuses) => {
        const responses = document.paths[path].post.responses ?? {};

        expect(
          Object.keys(responses).filter((status) => status.startsWith('2')),
        ).toEqual(['200']);
        expect(Object.keys(responses['200'].content ?? {})).toEqual([
          'application/json',
        ]);
        expect(responses['200'].content?.['application/json'].schema).toEqual({
          $ref: `#/components/schemas/${schemaName}`,
        });

        const schema = document.components?.schemas?.[schemaName];
        expect(schema?.type).toBe('object');
        expect([...(schema?.required ?? [])].sort()).toEqual(
          [...relationshipFields].sort(),
        );
        expect(Object.keys(schema?.properties ?? {}).sort()).toEqual(
          [...relationshipFields].sort(),
        );
        expect(schema?.properties?.id.type).toBe('string');
        expect(schema?.properties?.requesterId.type).toBe('string');
        expect(schema?.properties?.recipientId.type).toBe('string');
        expect(schema?.properties?.status).toEqual(
          expect.objectContaining({ type: 'string', enum: statuses }),
        );
      },
    );

    it('describes delete /contacts/{contactUserId} as 204 with no content', () => {
      const responses =
        document.paths['/contacts/{contactUserId}'].delete.responses ?? {};

      expect(
        Object.keys(responses).filter((status) => status.startsWith('2')),
      ).toEqual(['204']);
      expect(responses['204'].content).toBeUndefined();
    });
  });

  describe('listing responses', () => {
    it.each([
      [
        '/contact-requests/incoming',
        'IncomingContactRequestPageDto',
        'IncomingContactRequestDto',
        ['id', 'requesterId', 'displayName', 'status'],
        ['pending'],
      ],
      [
        '/contact-requests/outgoing',
        'OutgoingContactRequestPageDto',
        'OutgoingContactRequestDto',
        ['id', 'recipientId', 'displayName', 'status'],
        ['pending'],
      ],
      [
        '/contacts',
        'AcceptedContactPageDto',
        'AcceptedContactDto',
        ['userId', 'displayName'],
        undefined,
      ],
    ])(
      'describes get %s as 200 JSON %s of %s items',
      (path, pageName, itemName, itemFields, statusEnum) => {
        const responses = document.paths[path].get.responses ?? {};

        expect(
          Object.keys(responses).filter((status) => status.startsWith('2')),
        ).toEqual(['200']);
        expect(Object.keys(responses['200'].content ?? {})).toEqual([
          'application/json',
        ]);
        expect(responses['200'].content?.['application/json'].schema).toEqual({
          $ref: `#/components/schemas/${pageName}`,
        });

        const page = document.components?.schemas?.[pageName];
        expect(page?.type).toBe('object');
        expect([...(page?.required ?? [])].sort()).toEqual([
          'items',
          'nextCursor',
        ]);
        expect(Object.keys(page?.properties ?? {}).sort()).toEqual([
          'items',
          'nextCursor',
        ]);
        expect(page?.properties?.items).toEqual(
          expect.objectContaining({
            type: 'array',
            items: { $ref: `#/components/schemas/${itemName}` },
          }),
        );
        expect(page?.properties?.nextCursor).toEqual(
          expect.objectContaining({ type: 'string', nullable: true }),
        );

        const item = document.components?.schemas?.[itemName];
        expect(item?.type).toBe('object');
        expect([...(item?.required ?? [])].sort()).toEqual(
          [...itemFields].sort(),
        );
        expect(Object.keys(item?.properties ?? {}).sort()).toEqual(
          [...itemFields].sort(),
        );
        expect(item?.properties?.displayName).toEqual(
          expect.objectContaining({ type: 'string', nullable: true }),
        );
        if (statusEnum) {
          expect(item?.properties?.status).toEqual(
            expect.objectContaining({ type: 'string', enum: statusEnum }),
          );
        }
      },
    );
  });

  describe('bearer authentication', () => {
    it('declares exactly one HTTP bearer security scheme', () => {
      const schemes = document.components?.securitySchemes ?? {};

      expect(Object.values(schemes)).toEqual([
        expect.objectContaining({ type: 'http', scheme: 'bearer' }),
      ]);
    });

    it('requires that scheme on every described operation', () => {
      const [schemeName] = Object.keys(
        document.components?.securitySchemes ?? {},
      );
      const operations = Object.values(document.paths).flatMap((methods) =>
        Object.values(methods),
      );

      expect(operations).toHaveLength(7);
      for (const operation of operations) {
        expect(operation.security).toEqual([{ [schemeName]: [] }]);
      }
    });
  });
});
