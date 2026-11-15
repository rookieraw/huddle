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

    it.each([
      ['post', '/contact-requests/{contactRequestId}/accept'],
      ['post', '/contact-requests/{contactRequestId}/reject'],
      ['delete', '/contacts/{contactUserId}'],
    ])('describes the path parameter of %s %s', (method, path) => {
      const [parameter] = document.paths[path][method].parameters ?? [];

      expect(parameter.description).toEqual(expect.any(String));
      expect(parameter.description?.length).toBeGreaterThan(0);
    });

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

  describe('error responses', () => {
    const errorMatrix: Array<[string, string, Record<string, string[]>]> = [
      [
        'post',
        '/contact-requests',
        {
          '400': ['VALIDATION_FAILED', 'SELF_CONTACT_REQUEST'],
          '401': ['AUTHENTICATION_REQUIRED'],
          '404': ['CONTACT_TARGET_NOT_FOUND'],
          '500': ['INTERNAL_ERROR'],
          '503': [
            'CONTACT_TARGET_LOOKUP_UNAVAILABLE',
            'CONTACT_REQUEST_UNAVAILABLE',
          ],
        },
      ],
      [
        'post',
        '/contact-requests/{contactRequestId}/accept',
        {
          '401': ['AUTHENTICATION_REQUIRED'],
          '404': ['CONTACT_REQUEST_NOT_FOUND'],
          '409': [
            'CONTACT_REQUEST_ALREADY_ACCEPTED',
            'CONTACT_REQUEST_ALREADY_REJECTED',
          ],
          '500': ['INTERNAL_ERROR'],
          '503': ['CONTACT_REQUEST_ACCEPTANCE_UNAVAILABLE'],
        },
      ],
      [
        'post',
        '/contact-requests/{contactRequestId}/reject',
        {
          '401': ['AUTHENTICATION_REQUIRED'],
          '404': ['CONTACT_REQUEST_NOT_FOUND'],
          '409': [
            'CONTACT_REQUEST_ALREADY_REJECTED',
            'CONTACT_REQUEST_ALREADY_ACCEPTED',
          ],
          '500': ['INTERNAL_ERROR'],
          '503': ['CONTACT_REQUEST_REJECTION_UNAVAILABLE'],
        },
      ],
      [
        'get',
        '/contact-requests/incoming',
        {
          '400': ['VALIDATION_FAILED'],
          '401': ['AUTHENTICATION_REQUIRED'],
          '500': ['INTERNAL_ERROR'],
          '503': ['CONTACT_REQUEST_LISTING_UNAVAILABLE'],
        },
      ],
      [
        'get',
        '/contact-requests/outgoing',
        {
          '400': ['VALIDATION_FAILED'],
          '401': ['AUTHENTICATION_REQUIRED'],
          '500': ['INTERNAL_ERROR'],
          '503': ['OUTGOING_CONTACT_REQUEST_LISTING_UNAVAILABLE'],
        },
      ],
      [
        'get',
        '/contacts',
        {
          '400': ['VALIDATION_FAILED'],
          '401': ['AUTHENTICATION_REQUIRED'],
          '500': ['INTERNAL_ERROR'],
          '503': ['ACCEPTED_CONTACT_LISTING_UNAVAILABLE'],
        },
      ],
      [
        'delete',
        '/contacts/{contactUserId}',
        {
          '401': ['AUTHENTICATION_REQUIRED'],
          '404': ['CONTACT_NOT_FOUND'],
          '500': ['INTERNAL_ERROR'],
          '503': ['CONTACT_REMOVAL_UNAVAILABLE'],
        },
      ],
    ];

    it.each(errorMatrix)(
      'describes no non-success status other than the contract error statuses for %s %s',
      (method, path, expected) => {
        const responses = document.paths[path][method].responses ?? {};
        // Everything outside 2xx, including 1xx, 3xx and `default`, must be a
        // documented contract error status.
        const nonSuccessStatuses = Object.keys(responses)
          .filter((status) => !status.startsWith('2'))
          .sort();

        expect(nonSuccessStatuses).toEqual(Object.keys(expected).sort());
      },
    );

    it.each(errorMatrix)(
      'narrows error.code to the contract codes for each error response of %s %s',
      (method, path, expected) => {
        const responses = document.paths[path][method].responses ?? {};

        for (const [status, codes] of Object.entries(expected)) {
          const schema = responses[status]?.content?.['application/json']
            ?.schema as
            | {
                allOf?: [
                  Record<string, unknown>,
                  {
                    properties?: {
                      error?: {
                        properties?: { code?: { enum?: string[] } };
                      };
                    };
                  },
                ];
              }
            | undefined;

          expect(schema?.allOf?.[0]).toEqual({
            $ref: '#/components/schemas/ApplicationErrorEnvelopeDto',
          });
          expect(
            [
              ...(schema?.allOf?.[1].properties?.error?.properties?.code
                ?.enum ?? []),
            ].sort(),
          ).toEqual([...codes].sort());
        }
      },
    );

    // Fixed messages as listed in the Chat Contacts HTTP contract.
    const contractMessages: Record<string, string> = {
      AUTHENTICATION_REQUIRED: 'Authentication is required.',
      VALIDATION_FAILED: 'Request validation failed.',
      SELF_CONTACT_REQUEST: 'A Contact request cannot target the requester.',
      CONTACT_TARGET_NOT_FOUND: 'Contact target was not found.',
      CONTACT_TARGET_LOOKUP_UNAVAILABLE:
        'Contact target validation is temporarily unavailable.',
      CONTACT_REQUEST_UNAVAILABLE:
        'Contact request service is temporarily unavailable.',
      CONTACT_REQUEST_NOT_FOUND: 'Contact request was not found.',
      CONTACT_REQUEST_ALREADY_ACCEPTED:
        'Contact request has already been accepted.',
      CONTACT_REQUEST_ALREADY_REJECTED:
        'Contact request has already been rejected.',
      CONTACT_REQUEST_ACCEPTANCE_UNAVAILABLE:
        'Contact request acceptance is temporarily unavailable.',
      CONTACT_REQUEST_REJECTION_UNAVAILABLE:
        'Contact request rejection is temporarily unavailable.',
      CONTACT_REQUEST_LISTING_UNAVAILABLE:
        'Incoming Contact requests are temporarily unavailable.',
      OUTGOING_CONTACT_REQUEST_LISTING_UNAVAILABLE:
        'Outgoing Contact requests are temporarily unavailable.',
      ACCEPTED_CONTACT_LISTING_UNAVAILABLE:
        'Accepted Contacts are temporarily unavailable.',
      CONTACT_NOT_FOUND: 'Contact was not found.',
      CONTACT_REMOVAL_UNAVAILABLE:
        'Contact removal is temporarily unavailable.',
      INTERNAL_ERROR: 'An unexpected error occurred.',
    };

    it.each(errorMatrix)(
      'carries one example per code with the contract message for each error response of %s %s',
      (method, path, expected) => {
        const responses = document.paths[path][method].responses ?? {};

        for (const [status, codes] of Object.entries(expected)) {
          const media = responses[status]?.content?.['application/json'] as
            { examples?: Record<string, { value?: unknown }> } | undefined;
          const examples = Object.values(media?.examples ?? {}).map(
            (example) => example.value,
          );

          expect(examples).toHaveLength(codes.length);
          expect(examples).toEqual(
            expect.arrayContaining(
              codes.map((code) => ({
                error: { code, message: contractMessages[code] },
              })),
            ),
          );
        }
      },
    );

    it('describes the shared error envelope, error, and detail schemas', () => {
      const schemas = document.components?.schemas ?? {};

      expect(schemas.ApplicationErrorEnvelopeDto).toEqual(
        expect.objectContaining({
          type: 'object',
          required: ['error'],
          properties: {
            error: { $ref: '#/components/schemas/ApplicationErrorDto' },
          },
        }),
      );

      const error = schemas.ApplicationErrorDto;
      expect(error?.type).toBe('object');
      expect([...(error?.required ?? [])].sort()).toEqual(['code', 'message']);
      expect(Object.keys(error?.properties ?? {}).sort()).toEqual([
        'code',
        'details',
        'message',
      ]);
      expect(error?.properties?.details).toEqual(
        expect.objectContaining({
          type: 'array',
          items: { $ref: '#/components/schemas/ApplicationErrorDetailDto' },
        }),
      );

      const detail = schemas.ApplicationErrorDetailDto;
      expect(detail?.type).toBe('object');
      expect([...(detail?.required ?? [])].sort()).toEqual([
        'field',
        'message',
      ]);
      expect(Object.keys(detail?.properties ?? {}).sort()).toEqual([
        'field',
        'message',
      ]);
    });
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
