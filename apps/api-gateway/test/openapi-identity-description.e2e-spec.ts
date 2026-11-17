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
import { applyPlaceholderIdentityEnvironment } from './support/placeholder-identity-environment';

type SchemaObject = {
  type?: string;
  required?: string[];
  properties?: Record<string, Record<string, unknown>>;
};

type OpenApiOperation = {
  description?: string;
  deprecated?: boolean;
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
  responses?: Record<
    string,
    {
      description?: string;
      headers?: Record<
        string,
        {
          description?: string;
          schema?: Record<string, unknown>;
          example?: unknown;
        }
      >;
      content?: Record<string, { schema?: Record<string, unknown> }>;
    }
  >;
};

type OpenApiDocument = {
  paths: Record<string, Record<string, OpenApiOperation>>;
  components?: { schemas?: Record<string, SchemaObject> };
};

describe('Identity OpenAPI description (e2e)', () => {
  let app: NestExpressApplication;
  let document: OpenApiDocument;
  let restoreEnvironment: () => void;

  beforeAll(async () => {
    restoreEnvironment = applyPlaceholderIdentityEnvironment();

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
    restoreEnvironment();
  });

  const schemaOf = (name: string): SchemaObject =>
    document.components?.schemas?.[name] ?? {};

  describe('success responses', () => {
    const successes: Array<[string, string, string, string]> = [
      ['post', '/auth/register', '201', 'RegisteredUserDto'],
      ['get', '/auth/verify', '200', 'VerifiedUserDto'],
      ['post', '/auth/login', '200', 'AuthTokensDto'],
      ['post', '/auth/refresh', '200', 'AuthTokensDto'],
      ['get', '/users/me', '200', 'CurrentUserDto'],
    ];

    const successStatuses = (method: string, path: string): string[] =>
      Object.keys(document.paths[path]?.[method]?.responses ?? {}).filter(
        (status) => status.startsWith('2'),
      );

    it.each(successes)(
      'describes %s %s as %s JSON %s with no other success status',
      (method, path, status, schemaName) => {
        expect(successStatuses(method, path)).toEqual([status]);
        expect(
          document.paths[path]?.[method]?.responses?.[status]?.content?.[
            'application/json'
          ]?.schema,
        ).toEqual({ $ref: `#/components/schemas/${schemaName}` });
      },
    );

    it('describes post /auth/logout as 204 with no content', () => {
      const responses = document.paths['/auth/logout']?.post?.responses ?? {};

      expect(successStatuses('post', '/auth/logout')).toEqual(['204']);
      expect(responses['204']).toBeDefined();
      expect(responses['204']?.content).toBeUndefined();
    });

    it('describes RegisteredUserDto with its four required string fields', () => {
      const schema = schemaOf('RegisteredUserDto');

      expect(schema.type).toBe('object');
      expect([...(schema.required ?? [])].sort()).toEqual([
        'displayName',
        'email',
        'id',
        'verificationToken',
      ]);
      expect(Object.keys(schema.properties ?? {}).sort()).toEqual([
        'displayName',
        'email',
        'id',
        'verificationToken',
      ]);

      for (const property of Object.values(schema.properties ?? {})) {
        expect(property.type).toBe('string');
      }
    });

    it('describes VerifiedUserDto with a boolean verified flag', () => {
      const schema = schemaOf('VerifiedUserDto');

      expect(schema.type).toBe('object');
      expect([...(schema.required ?? [])].sort()).toEqual([
        'email',
        'id',
        'verified',
      ]);
      expect(Object.keys(schema.properties ?? {}).sort()).toEqual([
        'email',
        'id',
        'verified',
      ]);
      expect(schema.properties?.verified?.type).toBe('boolean');
    });

    it('describes AuthTokensDto with an access token and a refresh token', () => {
      const schema = schemaOf('AuthTokensDto');

      expect(schema.type).toBe('object');
      expect([...(schema.required ?? [])].sort()).toEqual([
        'accessToken',
        'refreshToken',
      ]);
      expect(Object.keys(schema.properties ?? {}).sort()).toEqual([
        'accessToken',
        'refreshToken',
      ]);
      expect(schema.properties?.accessToken?.type).toBe('string');
      expect(schema.properties?.refreshToken?.type).toBe('string');
    });

    it('describes CurrentUserDto with id, email and the free tier', () => {
      const schema = schemaOf('CurrentUserDto');

      expect(schema.type).toBe('object');
      expect([...(schema.required ?? [])].sort()).toEqual([
        'email',
        'id',
        'tier',
      ]);
      expect(Object.keys(schema.properties ?? {}).sort()).toEqual([
        'email',
        'id',
        'tier',
      ]);
      expect(schema.properties?.tier?.enum).toEqual(['free']);
    });

    it('carries no example on any email or token property of a response', () => {
      for (const schemaName of [
        'RegisteredUserDto',
        'VerifiedUserDto',
        'AuthTokensDto',
        'CurrentUserDto',
      ]) {
        const properties = schemaOf(schemaName).properties ?? {};

        for (const name of [
          'email',
          'verificationToken',
          'accessToken',
          'refreshToken',
        ]) {
          if (name in properties) {
            expect(properties[name]).not.toHaveProperty('example');
          }
        }
      }
    });
  });

  describe('OAuth routes', () => {
    const starts = ['/auth/oauth/google', '/auth/oauth/github'];
    const callbacks = [
      '/auth/oauth/google/callback',
      '/auth/oauth/github/callback',
    ];

    const successOrRedirectStatuses = (path: string): string[] =>
      Object.keys(document.paths[path]?.get?.responses ?? {}).filter(
        (status) => status.startsWith('2') || status.startsWith('3'),
      );

    it.each(starts)(
      'describes get %s as a 302 redirect with no content and no other success status',
      (path) => {
        expect(successOrRedirectStatuses(path)).toEqual(['302']);
        expect(
          document.paths[path]?.get?.responses?.['302']?.content,
        ).toBeUndefined();
      },
    );

    it.each(starts)(
      'describes the Location header of get %s without an example',
      (path) => {
        const header =
          document.paths[path]?.get?.responses?.['302']?.headers?.Location;

        expect(header?.description).toEqual(expect.stringMatching(/provider/i));
        expect(header?.schema?.type).toBe('string');
        expect(header).not.toHaveProperty('example');
        expect(header?.schema).not.toHaveProperty('example');
      },
    );

    it.each(starts)(
      'says that get %s is a browser redirect a documentation client cannot complete',
      (path) => {
        const description = document.paths[path]?.get?.description;

        expect(description).toEqual(expect.stringMatching(/browser redirect/i));
        expect(description).toEqual(expect.stringMatching(/cannot complete/i));
      },
    );

    it.each(callbacks)(
      'describes get %s as a 200 JSON AuthTokensDto with no other success status',
      (path) => {
        expect(successOrRedirectStatuses(path)).toEqual(['200']);
        expect(
          document.paths[path]?.get?.responses?.['200']?.content?.[
            'application/json'
          ]?.schema,
        ).toEqual({ $ref: '#/components/schemas/AuthTokensDto' });
      },
    );

    it.each(callbacks)(
      'says that get %s is a provider callback a documentation client cannot complete',
      (path) => {
        const description = document.paths[path]?.get?.description;

        expect(description).toEqual(
          expect.stringMatching(/provider callback/i),
        );
        expect(description).toEqual(expect.stringMatching(/cannot complete/i));
      },
    );
  });

  describe('transitional behavior', () => {
    it('marks verificationToken as transitional and says when it goes away', () => {
      const description =
        schemaOf('RegisteredUserDto').properties?.verificationToken
          ?.description;

      expect(description).toEqual(expect.stringMatching(/^Transitional:/));
      expect(description).toEqual(expect.stringMatching(/email delivery/i));
      expect(description).toEqual(expect.stringMatching(/removed/i));
    });

    it('marks the Free tier as transitional and names its replacement owner', () => {
      const description =
        schemaOf('CurrentUserDto').properties?.tier?.description;

      expect(description).toEqual(expect.stringMatching(/^Transitional:/));
      expect(description).toEqual(expect.stringMatching(/hardcoded/i));
      expect(description).toEqual(expect.stringMatching(/Billing/));
    });

    it.each([
      ['post', '/auth/register'],
      ['get', '/users/me'],
    ])('says that %s %s is a transitional operation', (method, path) => {
      expect(document.paths[path]?.[method]?.description).toEqual(
        expect.stringMatching(/transitional/i),
      );
    });

    // A guard rather than RED evidence: the fields are still returned today,
    // so they are marked transitional in words, not deprecated.
    it('does not mark the transitional operations or fields as deprecated', () => {
      expect(
        document.paths['/auth/register']?.post?.deprecated,
      ).toBeUndefined();
      expect(document.paths['/users/me']?.get?.deprecated).toBeUndefined();
      expect(
        schemaOf('RegisteredUserDto').properties?.verificationToken,
      ).not.toHaveProperty('deprecated');
      expect(schemaOf('CurrentUserDto').properties?.tier).not.toHaveProperty(
        'deprecated',
      );
    });
  });

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
