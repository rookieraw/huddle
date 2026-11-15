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
  });
});
