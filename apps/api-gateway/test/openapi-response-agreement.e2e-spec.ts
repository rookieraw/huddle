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
import { ApiValidationPipe } from '../src/interface/http/api-validation.pipe';
import { validateAgainstSchema } from './support/openapi-schema-conformance';

describe('OpenAPI response agreement (e2e)', () => {
  describe('closed-world schema conformance helper', () => {
    const document = {
      components: {
        schemas: {
          Item: {
            type: 'object',
            required: ['id', 'name'],
            properties: {
              id: { type: 'string', description: 'Ignored annotation.' },
              name: { type: 'string', nullable: true, example: 'Ignored' },
            },
          },
          Page: {
            type: 'object',
            required: ['items'],
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/Item' },
              },
            },
          },
          Envelope: {
            type: 'object',
            required: ['error'],
            properties: {
              error: {
                type: 'object',
                required: ['code', 'message'],
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    };
    const item = { $ref: '#/components/schemas/Item' };
    const page = { $ref: '#/components/schemas/Page' };
    const narrowedError = {
      allOf: [
        { $ref: '#/components/schemas/Envelope' },
        {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: { code: { type: 'string', enum: ['KNOWN'] } },
            },
          },
        },
      ],
    };

    it('accepts a conforming value, including a nullable null', () => {
      expect(
        validateAgainstSchema(document, page, {
          items: [
            { id: 'a', name: 'A' },
            { id: 'b', name: null },
          ],
        }),
      ).toEqual([]);
    });

    it('accepts an error that matches the narrowed envelope', () => {
      expect(
        validateAgainstSchema(document, narrowedError, {
          error: { code: 'KNOWN', message: 'Text.' },
        }),
      ).toEqual([]);
    });

    it('rejects an undocumented property at the top level', () => {
      expect(
        validateAgainstSchema(document, item, {
          id: 'a',
          name: 'A',
          extra: 'x',
        }),
      ).toEqual([expect.stringContaining('extra')]);
    });

    it('rejects an undocumented property inside items[]', () => {
      expect(
        validateAgainstSchema(document, page, {
          items: [{ id: 'a', name: 'A', extra: 'x' }],
        }),
      ).toEqual([expect.stringContaining('extra')]);
    });

    it('rejects an undocumented property inside error', () => {
      expect(
        validateAgainstSchema(document, narrowedError, {
          error: { code: 'KNOWN', message: 'Text.', extra: 'x' },
        }),
      ).toEqual([expect.stringContaining('extra')]);
    });

    it('rejects a missing required property', () => {
      expect(validateAgainstSchema(document, item, { id: 'a' })).toEqual([
        expect.stringContaining('name'),
      ]);
    });

    it('rejects a wrong type', () => {
      expect(
        validateAgainstSchema(document, item, { id: 1, name: 'A' }),
      ).toEqual([expect.stringContaining('id')]);
    });

    it('rejects a code outside the response enum', () => {
      expect(
        validateAgainstSchema(document, narrowedError, {
          error: { code: 'OTHER', message: 'Text.' },
        }),
      ).toEqual([expect.stringContaining('code')]);
    });

    it('rejects null where the schema is not nullable', () => {
      expect(
        validateAgainstSchema(document, item, { id: null, name: 'A' }),
      ).toEqual([expect.stringContaining('id')]);
    });

    it('throws on a keyword it does not support', () => {
      const unsupported = { type: 'string', pattern: '^a$' };

      expect(() => validateAgainstSchema(document, unsupported, 'a')).toThrow(
        /pattern/,
      );
    });

    it('throws when allOf parts declare conflicting constraints', () => {
      const conflicting = {
        allOf: [
          { type: 'string', enum: ['A'] },
          { type: 'string', enum: ['B'] },
        ],
      };

      expect(() => validateAgainstSchema(document, conflicting, 'A')).toThrow(
        /conflict/i,
      );
    });

    describe('oneOf', () => {
      const stringOrStrings = {
        oneOf: [
          { type: 'string' },
          { type: 'array', items: { type: 'string' } },
        ],
      };

      it('accepts a string and an array of strings', () => {
        expect(validateAgainstSchema(document, stringOrStrings, 'a')).toEqual(
          [],
        );
        expect(
          validateAgainstSchema(document, stringOrStrings, ['a', 'b']),
        ).toEqual([]);
      });

      it('rejects a value that matches no alternative', () => {
        expect(
          validateAgainstSchema(document, stringOrStrings, 1),
        ).toHaveLength(1);
        expect(
          validateAgainstSchema(document, stringOrStrings, ['a', 1]),
        ).toHaveLength(1);
      });

      it('rejects a value that matches more than one alternative', () => {
        const overlapping = {
          oneOf: [{ type: 'string' }, { type: 'string', minLength: 1 }],
        };

        expect(validateAgainstSchema(document, overlapping, 'a')).toHaveLength(
          1,
        );
        expect(validateAgainstSchema(document, overlapping, '')).toEqual([]);
      });
    });
  });

  describe('real responses against the generated description', () => {
    type Scenario = {
      name: string;
      method: 'get' | 'post' | 'delete';
      template: string;
      url: string;
      status: number;
      body?: Record<string, unknown>;
      authenticated?: boolean;
      arrange?: () => void;
    };

    type DescribedResponses = Record<
      string,
      { content?: Record<string, { schema?: unknown }> }
    >;

    let app: NestExpressApplication;
    let document: {
      paths: Record<string, Record<string, { responses?: DescribedResponses }>>;
    };

    const verifyAccessToken = jest.fn();
    const userExists = jest.fn();
    const getProfiles = jest.fn();
    const findUnique = jest.fn();
    const findFirst = jest.fn();
    const findMany = jest.fn();
    const upsert = jest.fn();
    const updateMany = jest.fn();

    const relationship = (status: string) => ({
      id: 'relationship-id',
      requesterId: 'user-original-requester',
      recipientId: 'user-actor',
      status,
    });
    const unexpectedFailure = () =>
      verifyAccessToken.mockRejectedValueOnce(new Error('unexpected failure'));

    const create = '/contact-requests';
    const acceptTemplate = '/contact-requests/{contactRequestId}/accept';
    const rejectTemplate = '/contact-requests/{contactRequestId}/reject';
    const incoming = '/contact-requests/incoming';
    const outgoing = '/contact-requests/outgoing';
    const accepted = '/contacts';
    const removalTemplate = '/contacts/{contactUserId}';

    const scenarios: Scenario[] = [
      // Success responses.
      {
        name: 'create succeeds',
        method: 'post',
        template: create,
        url: create,
        status: 200,
        body: { targetUserId: 'user-target' },
      },
      {
        name: 'accept succeeds',
        method: 'post',
        template: acceptTemplate,
        url: '/contact-requests/relationship-id/accept',
        status: 200,
      },
      {
        name: 'reject succeeds',
        method: 'post',
        template: rejectTemplate,
        url: '/contact-requests/relationship-id/reject',
        status: 200,
      },
      {
        name: 'incoming lists a page with a name, a missing name and a next cursor',
        method: 'get',
        template: incoming,
        url: '/contact-requests/incoming?limit=1',
        status: 200,
        arrange: () => {
          findMany.mockResolvedValueOnce([
            { ...relationship('pending'), id: 'relationship-1' },
            { ...relationship('pending'), id: 'relationship-2' },
          ]);
          getProfiles.mockResolvedValueOnce({
            profiles: [{ userId: 'user-original-requester', displayName: 'A' }],
            missingUserIds: [],
          });
        },
      },
      {
        name: 'outgoing lists a page with a missing name',
        method: 'get',
        template: outgoing,
        url: outgoing,
        status: 200,
        arrange: () => {
          findMany.mockResolvedValueOnce([
            {
              ...relationship('pending'),
              requesterId: 'user-actor',
              recipientId: 'user-recipient',
            },
          ]);
        },
      },
      {
        name: 'accepted lists a page',
        method: 'get',
        template: accepted,
        url: accepted,
        status: 200,
        arrange: () => {
          findMany.mockResolvedValueOnce([relationship('accepted')]);
        },
      },
      {
        name: 'removal succeeds with no content',
        method: 'delete',
        template: removalTemplate,
        url: '/contacts/user-contact',
        status: 204,
        arrange: () => {
          findFirst.mockResolvedValueOnce({
            ...relationship('accepted'),
            requesterId: 'user-contact',
          });
        },
      },
      // Create errors.
      {
        name: 'create rejects an invalid body',
        method: 'post',
        template: create,
        url: create,
        status: 400,
        body: {},
      },
      {
        name: 'create rejects a self request',
        method: 'post',
        template: create,
        url: create,
        status: 400,
        body: { targetUserId: 'user-actor' },
      },
      {
        name: 'create requires authentication',
        method: 'post',
        template: create,
        url: create,
        status: 401,
        body: { targetUserId: 'user-target' },
        authenticated: false,
      },
      {
        name: 'create reports a missing target',
        method: 'post',
        template: create,
        url: create,
        status: 404,
        body: { targetUserId: 'user-target' },
        arrange: () => userExists.mockResolvedValueOnce(false),
      },
      {
        name: 'create reports an unavailable target lookup',
        method: 'post',
        template: create,
        url: create,
        status: 503,
        body: { targetUserId: 'user-target' },
        arrange: () => userExists.mockRejectedValueOnce(new Error('private')),
      },
      {
        name: 'create reports an unavailable relationship service',
        method: 'post',
        template: create,
        url: create,
        status: 503,
        body: { targetUserId: 'user-target' },
        arrange: () => findFirst.mockRejectedValueOnce(new Error('private')),
      },
      {
        name: 'create reports an unexpected failure',
        method: 'post',
        template: create,
        url: create,
        status: 500,
        body: { targetUserId: 'user-target' },
        arrange: unexpectedFailure,
      },
      // Accept errors.
      {
        name: 'accept requires authentication',
        method: 'post',
        template: acceptTemplate,
        url: '/contact-requests/relationship-id/accept',
        status: 401,
        authenticated: false,
      },
      {
        name: 'accept reports a missing request',
        method: 'post',
        template: acceptTemplate,
        url: '/contact-requests/relationship-id/accept',
        status: 404,
        arrange: () => findUnique.mockResolvedValueOnce(null),
      },
      {
        name: 'accept reports an already accepted request',
        method: 'post',
        template: acceptTemplate,
        url: '/contact-requests/relationship-id/accept',
        status: 409,
        arrange: () =>
          findUnique.mockResolvedValueOnce(relationship('accepted')),
      },
      {
        name: 'accept reports an already rejected request',
        method: 'post',
        template: acceptTemplate,
        url: '/contact-requests/relationship-id/accept',
        status: 409,
        arrange: () =>
          findUnique.mockResolvedValueOnce(relationship('rejected')),
      },
      {
        name: 'accept reports an unavailable service',
        method: 'post',
        template: acceptTemplate,
        url: '/contact-requests/relationship-id/accept',
        status: 503,
        arrange: () => findUnique.mockRejectedValueOnce(new Error('private')),
      },
      {
        name: 'accept reports an unexpected failure',
        method: 'post',
        template: acceptTemplate,
        url: '/contact-requests/relationship-id/accept',
        status: 500,
        arrange: unexpectedFailure,
      },
      // Reject errors.
      {
        name: 'reject requires authentication',
        method: 'post',
        template: rejectTemplate,
        url: '/contact-requests/relationship-id/reject',
        status: 401,
        authenticated: false,
      },
      {
        name: 'reject reports a missing request',
        method: 'post',
        template: rejectTemplate,
        url: '/contact-requests/relationship-id/reject',
        status: 404,
        arrange: () => findUnique.mockResolvedValueOnce(null),
      },
      {
        name: 'reject reports an already rejected request',
        method: 'post',
        template: rejectTemplate,
        url: '/contact-requests/relationship-id/reject',
        status: 409,
        arrange: () =>
          findUnique.mockResolvedValueOnce(relationship('rejected')),
      },
      {
        name: 'reject reports an already accepted request',
        method: 'post',
        template: rejectTemplate,
        url: '/contact-requests/relationship-id/reject',
        status: 409,
        arrange: () =>
          findUnique.mockResolvedValueOnce(relationship('accepted')),
      },
      {
        name: 'reject reports an unavailable service',
        method: 'post',
        template: rejectTemplate,
        url: '/contact-requests/relationship-id/reject',
        status: 503,
        arrange: () => findUnique.mockRejectedValueOnce(new Error('private')),
      },
      {
        name: 'reject reports an unexpected failure',
        method: 'post',
        template: rejectTemplate,
        url: '/contact-requests/relationship-id/reject',
        status: 500,
        arrange: unexpectedFailure,
      },
      // Listing errors.
      ...(
        [
          ['incoming', incoming],
          ['outgoing', outgoing],
          ['accepted', accepted],
        ] as const
      ).flatMap(([label, path]): Scenario[] => [
        {
          name: `${label} rejects an invalid limit`,
          method: 'get',
          template: path,
          url: `${path}?limit=0`,
          status: 400,
        },
        {
          name: `${label} requires authentication`,
          method: 'get',
          template: path,
          url: path,
          status: 401,
          authenticated: false,
        },
        {
          name: `${label} reports an unavailable listing`,
          method: 'get',
          template: path,
          url: path,
          status: 503,
          arrange: () => findMany.mockRejectedValueOnce(new Error('private')),
        },
        {
          name: `${label} reports an unexpected failure`,
          method: 'get',
          template: path,
          url: path,
          status: 500,
          arrange: unexpectedFailure,
        },
      ]),
      // Removal errors.
      {
        name: 'removal requires authentication',
        method: 'delete',
        template: removalTemplate,
        url: '/contacts/user-contact',
        status: 401,
        authenticated: false,
      },
      {
        name: 'removal reports a missing Contact',
        method: 'delete',
        template: removalTemplate,
        url: '/contacts/user-contact',
        status: 404,
      },
      {
        name: 'removal reports an unavailable service',
        method: 'delete',
        template: removalTemplate,
        url: '/contacts/user-contact',
        status: 503,
        arrange: () => findFirst.mockRejectedValueOnce(new Error('private')),
      },
      {
        name: 'removal reports an unexpected failure',
        method: 'delete',
        template: removalTemplate,
        url: '/contacts/user-contact',
        status: 500,
        arrange: unexpectedFailure,
      },
    ];

    beforeAll(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(AUTHENTICATION_API)
        .useValue({ verifyAccessToken })
        .overrideProvider(DIRECTORY_API)
        .useValue({ userExists })
        .overrideProvider(PROFILE_QUERY_API)
        .useValue({ getProfiles })
        .overrideProvider(CHAT_PRISMA_CLIENT)
        .useValue({
          contactRelationship: {
            findUnique,
            findFirst,
            findMany,
            upsert,
            updateMany,
          },
        })
        .compile();

      app = moduleFixture.createNestApplication<NestExpressApplication>();
      app.useGlobalPipes(new ApiValidationPipe());
      setupApiDocumentation(app, 'true');
      await app.init();

      const response = await request(app.getHttpServer())
        .get('/docs/api/openapi.json')
        .expect(200);
      document = response.body as typeof document;
    });

    beforeEach(() => {
      verifyAccessToken.mockReset().mockResolvedValue({
        userId: 'user-actor',
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      });
      userExists.mockReset().mockResolvedValue(true);
      getProfiles.mockReset().mockResolvedValue({
        profiles: [],
        missingUserIds: [],
      });
      findUnique.mockReset().mockResolvedValue(relationship('pending'));
      findFirst.mockReset().mockResolvedValue(null);
      findMany.mockReset().mockResolvedValue([]);
      updateMany.mockReset().mockResolvedValue({ count: 1 });
      upsert.mockReset().mockResolvedValue({
        id: 'relationship-id',
        requesterId: 'user-actor',
        recipientId: 'user-target',
        status: 'pending',
      });
    });

    afterAll(async () => {
      await app.close();
    });

    it.each(scenarios)('$name', async (scenario) => {
      scenario.arrange?.();

      let pending = request(app.getHttpServer())[scenario.method](scenario.url);

      if (scenario.authenticated !== false) {
        pending = pending.set('Authorization', 'Bearer access-token');
      }

      if (scenario.body !== undefined) {
        pending = pending.send(scenario.body);
      }

      const response = await pending;

      // A wrong status means the scenario arranged the wrong situation, not
      // that the description disagrees.
      expect(response.status).toBe(scenario.status);

      const described =
        document.paths[scenario.template][scenario.method].responses?.[
          String(scenario.status)
        ];

      if (scenario.status === 204) {
        expect(described?.content).toBeUndefined();
        expect(response.text).toBe('');

        return;
      }

      const schema = described?.content?.['application/json']?.schema;

      expect(schema).toBeDefined();
      expect(validateAgainstSchema(document, schema, response.body)).toEqual(
        [],
      );
    });
  });
});
