/**
 * Test-only, closed-world conformance check of a JSON value against a schema
 * of a generated OpenAPI 3.0 document. It exists so response agreement can be
 * proven without a validator dependency, and so undocumented properties are
 * rejected.
 *
 * It supports exactly the keywords the Contacts description uses and throws on
 * any other, so it can never silently skip a constraint.
 */

type Schema = Record<string, unknown>;

type OpenApiDocumentLike = {
  components?: { schemas?: Record<string, unknown> };
};

const SUPPORTED_TYPES = new Set([
  'object',
  'array',
  'string',
  'integer',
  'boolean',
]);
const ANNOTATIONS = new Set([
  'description',
  'example',
  'examples',
  'title',
  'default',
]);
const SCALAR_KEYWORDS = [
  'type',
  'enum',
  'nullable',
  'minLength',
  'minimum',
  'maximum',
] as const;

type ScalarKeyword = (typeof SCALAR_KEYWORDS)[number];

type NormalizedSchema = {
  scalars: Partial<Record<ScalarKeyword, unknown>>;
  required: Set<string>;
  properties: Map<string, unknown[]>;
  items: unknown[];
};

function asSchema(value: unknown): Schema {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('A schema must be an object.');
  }

  return value as Schema;
}

function resolveReference(
  document: OpenApiDocumentLike,
  reference: unknown,
): unknown {
  const match =
    typeof reference === 'string'
      ? /^#\/components\/schemas\/(.+)$/.exec(reference)
      : null;

  if (!match) {
    throw new Error(`Unsupported $ref ${JSON.stringify(reference)}.`);
  }

  const target = document.components?.schemas?.[match[1]];

  if (target === undefined) {
    throw new Error(`Unresolved $ref ${String(reference)}.`);
  }

  return target;
}

function collect(
  document: OpenApiDocumentLike,
  schemaValue: unknown,
  into: NormalizedSchema,
): void {
  const schema = asSchema(schemaValue);

  for (const [keyword, value] of Object.entries(schema)) {
    if (ANNOTATIONS.has(keyword)) {
      continue;
    }

    if (keyword === '$ref') {
      collect(document, resolveReference(document, value), into);
    } else if (keyword === 'allOf') {
      if (!Array.isArray(value)) {
        throw new Error('allOf must be an array.');
      }

      for (const part of value) {
        collect(document, part, into);
      }
    } else if (keyword === 'required') {
      for (const name of value as string[]) {
        into.required.add(name);
      }
    } else if (keyword === 'properties') {
      for (const [name, property] of Object.entries(asSchema(value))) {
        into.properties.set(name, [
          ...(into.properties.get(name) ?? []),
          property,
        ]);
      }
    } else if (keyword === 'items') {
      into.items.push(value);
    } else if ((SCALAR_KEYWORDS as readonly string[]).includes(keyword)) {
      const scalar = keyword as ScalarKeyword;

      if (
        scalar in into.scalars &&
        JSON.stringify(into.scalars[scalar]) !== JSON.stringify(value)
      ) {
        throw new Error(`Conflicting ${scalar} constraints in allOf.`);
      }

      if (scalar === 'type' && !SUPPORTED_TYPES.has(value as string)) {
        throw new Error(`Unsupported schema type ${JSON.stringify(value)}.`);
      }

      into.scalars[scalar] = value;
    } else {
      throw new Error(`Unsupported schema keyword "${keyword}".`);
    }
  }
}

function normalize(
  document: OpenApiDocumentLike,
  schema: unknown,
): NormalizedSchema {
  const normalized: NormalizedSchema = {
    scalars: {},
    required: new Set(),
    properties: new Map(),
    items: [],
  };

  collect(document, schema, normalized);

  return normalized;
}

function describeType(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  return Array.isArray(value) ? 'array' : typeof value;
}

function hasType(type: string, value: unknown): boolean {
  switch (type) {
    case 'object':
      return (
        value !== null && typeof value === 'object' && !Array.isArray(value)
      );
    case 'array':
      return Array.isArray(value);
    case 'string':
      return typeof value === 'string';
    case 'integer':
      return Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    default:
      return false;
  }
}

function validate(
  document: OpenApiDocumentLike,
  schema: NormalizedSchema,
  value: unknown,
  path: string,
  violations: string[],
): void {
  const {
    type,
    enum: allowed,
    nullable,
    minLength,
    minimum,
    maximum,
  } = schema.scalars;

  if (value === null) {
    if (nullable !== true) {
      violations.push(`${path}: null is not allowed.`);
    }

    return;
  }

  if (typeof type === 'string' && !hasType(type, value)) {
    violations.push(
      `${path}: expected ${type}, received ${describeType(value)}.`,
    );

    return;
  }

  if (Array.isArray(allowed) && !allowed.includes(value)) {
    violations.push(`${path}: value is not one of the documented values.`);
  }

  if (typeof value === 'string' && typeof minLength === 'number') {
    if (value.length < minLength) {
      violations.push(`${path}: shorter than ${minLength}.`);
    }
  }

  if (typeof value === 'number') {
    if (typeof minimum === 'number' && value < minimum) {
      violations.push(`${path}: below ${minimum}.`);
    }

    if (typeof maximum === 'number' && value > maximum) {
      violations.push(`${path}: above ${maximum}.`);
    }
  }

  if (Array.isArray(value) && schema.items.length > 0) {
    const itemSchema = normalize(document, { allOf: schema.items });

    value.forEach((element, index) => {
      validate(document, itemSchema, element, `${path}[${index}]`, violations);
    });
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;

    for (const name of schema.required) {
      if (!(name in record)) {
        violations.push(`${path}.${name}: required property is missing.`);
      }
    }

    for (const [name, child] of Object.entries(record)) {
      const declared = schema.properties.get(name);

      if (declared === undefined) {
        violations.push(`${path}.${name}: undocumented property.`);
        continue;
      }

      validate(
        document,
        normalize(document, { allOf: declared }),
        child,
        `${path}.${name}`,
        violations,
      );
    }
  }
}

/**
 * Returns the violations of `value` against `schema`, or an empty list when it
 * conforms. Throws when the schema cannot be judged faithfully.
 */
export function validateAgainstSchema(
  document: unknown,
  schema: unknown,
  value: unknown,
): string[] {
  const violations: string[] = [];

  validate(
    document as OpenApiDocumentLike,
    normalize(document as OpenApiDocumentLike, schema),
    value,
    '$',
    violations,
  );

  return violations;
}
