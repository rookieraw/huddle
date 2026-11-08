export const CONTACT_LIST_DEFAULT_LIMIT = 20;
export const CONTACT_LIST_MAX_LIMIT = 50;

const CURSOR_VERSION = 'v1';

export class InvalidContactListLimitError extends Error {
  constructor() {
    super(`limit must be an integer from 1 to ${CONTACT_LIST_MAX_LIMIT}.`);
    this.name = 'InvalidContactListLimitError';
  }
}

export class InvalidContactListCursorError extends Error {
  constructor() {
    super('cursor must be a valid cursor.');
    this.name = 'InvalidContactListCursorError';
  }
}

export function resolveLimit(rawLimit: unknown): number {
  if (rawLimit === undefined) {
    return CONTACT_LIST_DEFAULT_LIMIT;
  }

  if (typeof rawLimit !== 'string' || !/^[0-9]+$/.test(rawLimit)) {
    throw new InvalidContactListLimitError();
  }

  const limit = Number(rawLimit);

  if (limit < 1 || limit > CONTACT_LIST_MAX_LIMIT) {
    throw new InvalidContactListLimitError();
  }

  return limit;
}

export function resolveAfterId(rawCursor: unknown): string | undefined {
  if (rawCursor === undefined) {
    return undefined;
  }

  if (typeof rawCursor !== 'string' || !/^[A-Za-z0-9_-]+$/.test(rawCursor)) {
    throw new InvalidContactListCursorError();
  }

  const decoded = Buffer.from(rawCursor, 'base64url');
  const text = decoded.toString('utf8');
  const prefix = `${CURSOR_VERSION}:`;

  if (
    decoded.toString('base64url') !== rawCursor ||
    !text.startsWith(prefix) ||
    text.length === prefix.length ||
    text.includes('\u0000')
  ) {
    throw new InvalidContactListCursorError();
  }

  return text.slice(prefix.length);
}

export function encodeCursor(relationshipId: string): string {
  return Buffer.from(`${CURSOR_VERSION}:${relationshipId}`, 'utf8').toString(
    'base64url',
  );
}
