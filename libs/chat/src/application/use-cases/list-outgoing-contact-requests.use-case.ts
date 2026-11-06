import type { ContactRelationshipRepository } from '../ports/contact-relationship.repository.port';
import {
  InvalidIncomingListCursorError,
  InvalidIncomingListLimitError,
} from './list-incoming-contact-requests.use-case';
import type { RequesterProfileDirectory } from '../ports/requester-profile-directory.port';

export const OUTGOING_CONTACT_REQUEST_DEFAULT_LIMIT = 20;
const OUTGOING_CONTACT_REQUEST_MAX_LIMIT = 50;

function resolveLimit(rawLimit: unknown): number {
  if (rawLimit === undefined) {
    return OUTGOING_CONTACT_REQUEST_DEFAULT_LIMIT;
  }

  if (typeof rawLimit !== 'string' || !/^[0-9]+$/.test(rawLimit)) {
    throw new InvalidIncomingListLimitError();
  }

  const limit = Number(rawLimit);

  if (limit < 1 || limit > OUTGOING_CONTACT_REQUEST_MAX_LIMIT) {
    throw new InvalidIncomingListLimitError();
  }

  return limit;
}

const CURSOR_VERSION = 'v1';

function encodeCursor(relationshipId: string): string {
  return Buffer.from(`${CURSOR_VERSION}:${relationshipId}`, 'utf8').toString(
    'base64url',
  );
}

function resolveAfterId(rawCursor: unknown): string | undefined {
  if (rawCursor === undefined) {
    return undefined;
  }

  if (typeof rawCursor !== 'string' || !/^[A-Za-z0-9_-]+$/.test(rawCursor)) {
    throw new InvalidIncomingListCursorError();
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
    throw new InvalidIncomingListCursorError();
  }

  return text.slice(prefix.length);
}

type ListOutgoingContactRequestsInput = {
  requesterId: string;
  limit?: unknown;
  cursor?: unknown;
};

export type OutgoingContactRequestItem = {
  id: string;
  recipientId: string;
  displayName: string | null;
  status: 'pending';
};

export type OutgoingContactRequestPage = {
  items: OutgoingContactRequestItem[];
  nextCursor: string | null;
};

export class ListOutgoingContactRequestsUseCase {
  constructor(
    private readonly contactRelationshipRepository: ContactRelationshipRepository,
    private readonly profileDirectory: RequesterProfileDirectory,
  ) {}

  async execute(
    input: ListOutgoingContactRequestsInput,
  ): Promise<OutgoingContactRequestPage> {
    const limit = resolveLimit(input.limit);
    const afterId = resolveAfterId(input.cursor);
    const relationships =
      await this.contactRelationshipRepository.findPendingByRequester({
        requesterId: input.requesterId,
        take: limit + 1,
        ...(afterId !== undefined && { afterRelationshipId: afterId }),
      });

    const page = relationships.slice(0, limit);
    const displayNames = new Map<string, string>();

    if (page.length > 0) {
      const profiles = await this.profileDirectory.findProfiles(
        page.map((relationship) => relationship.recipientId),
      );

      for (const profile of profiles) {
        displayNames.set(profile.userId, profile.displayName);
      }
    }

    const items = page.map((relationship) => ({
      id: relationship.id,
      recipientId: relationship.recipientId,
      displayName: displayNames.get(relationship.recipientId) ?? null,
      status: 'pending' as const,
    }));
    const hasMore = relationships.length > limit;

    return {
      items,
      nextCursor: hasMore ? encodeCursor(items[items.length - 1].id) : null,
    };
  }
}
