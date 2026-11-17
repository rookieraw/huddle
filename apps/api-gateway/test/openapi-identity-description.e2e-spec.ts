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

type SchemaObject = {
  type?: string;
  required?: string[];
  properties?: Record<string, Record<string, unknown>>;
};

type OpenApiOperation = {
  parameters?: Array<{
    name: string;
    in: string;
    required?: boolean;
    description?: string;
    schema?: Record<string, unknown>;
    example?: unknown;
  }>;
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: Record<string, unknown> }>;
  };
};

type OpenApiDocument = {
  paths: Record<string, Record<string, OpenApiOperation>>;
  components?: { schemas?: Record<string, SchemaObject> };
};

// Placeholder values only: the Identity module needs them to start, and the
// description never depends on real credentials.
const placeholderEnvironment: Record<string, string> = {
  JWT_SECRET: 'test-placeholder-jwt-secret',
  GOOGLE_CLIENT_ID: 'test-placeholder-google-client-id',
  GOOGLE_CLIENT_SECRET: 'test-placeholder-google-client-secret',
  GOOGLE_CALLBACK_URL: 'http://localhost:4000/auth/oauth/google/callback',
  GITHUB_CLIENT_ID: 'test-placeholder-github-client-id',
  GITHUB_CLIENT_SECRET: 'test-placeholder-github-client-secret',
  GITHUB_CALLBACK_URL: 'http://localhost:4000/auth/oauth/github/callback',
};

describe('Identity OpenAPI description (e2e)', () => {
  let app: NestExpressApplication;
  let document: OpenApiDocument;
  const previousEnvironment: Record<string, string | undefined> = {};

  beforeAll(async () => {
    for (const [name, value] of Object.entries(placeholderEnvironment)) {
      previousEnvironment[name] = process.env[name];
      process.env[name] = value;
    }

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

    for (const [name, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });

  const schemaOf = (name: string): SchemaObject =>
    document.components?.schemas?.[name] ?? {};

  describe('parameters', () => {
    it('describes verify with exactly one required string token query parameter', () => {
      const parameters = document.paths['/auth/verify']?.get?.parameters ?? [];

      expect(parameters).toHaveLength(1);
      expect(parameters[0]).toMatchObject({
        name: 'token',
        in: 'query',
        required: true,
      });
      expect(parameters[0]?.schema?.type).toBe('string');
    });

    it('describes the verify token as the verification token, without an example', () => {
      const [token] = document.paths['/auth/verify']?.get?.parameters ?? [];

      expect(token?.description).toMatch(/verification token/i);
      expect(token).not.toHaveProperty('example');
      expect(token?.schema).not.toHaveProperty('example');
    });

    // A guard rather than RED evidence: it already holds.
    it.each([
      ['post', '/auth/register'],
      ['post', '/auth/login'],
      ['post', '/auth/refresh'],
      ['post', '/auth/logout'],
      ['get', '/auth/oauth/google'],
      ['get', '/auth/oauth/google/callback'],
      ['get', '/auth/oauth/github'],
      ['get', '/auth/oauth/github/callback'],
      ['get', '/users/me'],
    ])('declares no parameters for %s %s', (method, path) => {
      expect(document.paths[path]?.[method]?.parameters ?? []).toEqual([]);
    });
  });

  describe('request bodies', () => {
    const bodies: Array<[string, string]> = [
      ['/auth/register', 'RegisterUserDto'],
      ['/auth/login', 'LoginUserDto'],
      ['/auth/refresh', 'RefreshTokenDto'],
      ['/auth/logout', 'LogoutDto'],
    ];

    it.each(bodies)(
      'describes post %s as a required JSON %s',
      (path, schemaName) => {
        const requestBody = document.paths[path]?.post?.requestBody;

        expect(requestBody?.required).toBe(true);
        expect(Object.keys(requestBody?.content ?? {})).toEqual([
          'application/json',
        ]);
        expect(requestBody?.content?.['application/json']?.schema).toEqual({
          $ref: `#/components/schemas/${schemaName}`,
        });
      },
    );

    it('describes RegisterUserDto with its three required, validated fields', () => {
      const schema = schemaOf('RegisterUserDto');

      expect(schema.type).toBe('object');
      expect([...(schema.required ?? [])].sort()).toEqual([
        'displayName',
        'email',
        'password',
      ]);
      expect(Object.keys(schema.properties ?? {}).sort()).toEqual([
        'displayName',
        'email',
        'password',
      ]);
      expect(schema.properties?.email).toEqual(
        expect.objectContaining({ type: 'string', format: 'email' }),
      );
      expect(schema.properties?.password).toEqual(
        expect.objectContaining({ type: 'string', minLength: 8 }),
      );
      expect(schema.properties?.displayName).toEqual(
        expect.objectContaining({
          type: 'string',
          minLength: 1,
          maxLength: 50,
        }),
      );
    });

    it('says that the displayName limits apply after trimming', () => {
      expect(
        schemaOf('RegisterUserDto').properties?.displayName?.description,
      ).toEqual(expect.stringMatching(/after trimming/i));
    });

    it('describes LoginUserDto with a required email and a plain string password', () => {
      const schema = schemaOf('LoginUserDto');

      expect(schema.type).toBe('object');
      expect([...(schema.required ?? [])].sort()).toEqual([
        'email',
        'password',
      ]);
      expect(Object.keys(schema.properties ?? {}).sort()).toEqual([
        'email',
        'password',
      ]);
      expect(schema.properties?.email).toEqual(
        expect.objectContaining({ type: 'string', format: 'email' }),
      );
      expect(schema.properties?.password).toEqual(
        expect.objectContaining({ type: 'string' }),
      );
      expect(schema.properties?.password).not.toHaveProperty('minLength');
    });

    it.each(['RefreshTokenDto', 'LogoutDto'])(
      'describes %s with one required refreshToken string',
      (schemaName) => {
        const schema = schemaOf(schemaName);

        expect(schema.type).toBe('object');
        expect(schema.required).toEqual(['refreshToken']);
        expect(Object.keys(schema.properties ?? {})).toEqual(['refreshToken']);
        expect(schema.properties?.refreshToken).toEqual(
          expect.objectContaining({ type: 'string' }),
        );
      },
    );

    it('carries no example on any credential or token property', () => {
      for (const schemaName of [
        'RegisterUserDto',
        'LoginUserDto',
        'RefreshTokenDto',
        'LogoutDto',
      ]) {
        const properties = schemaOf(schemaName).properties ?? {};

        for (const name of ['email', 'password', 'refreshToken']) {
          if (name in properties) {
            expect(properties[name]).not.toHaveProperty('example');
          }
        }
      }
    });
  });
});
