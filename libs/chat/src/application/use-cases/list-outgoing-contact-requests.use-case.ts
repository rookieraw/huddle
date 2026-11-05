import type { ContactRelationshipRepository } from '../ports/contact-relationship.repository.port';
import { InvalidIncomingListCursorError } from './list-incoming-contact-requests.use-case';
import type { RequesterProfileDirectory } from '../ports/requester-profile-directory.port';

export const OUTGOING_CONTACT_REQUEST_DEFAULT_LIMIT = 20;

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
    const limit = OUTGOING_CONTACT_REQUEST_DEFAULT_LIMIT;
    const afterId = resolveAfterId(input.cursor);
    const relationships =
      await this.contactRelationshipRepository.findPendingByRequester({
        requesterId: input.requesterId,
        take: limit + 1,
        ...(afterId !== undefined && { afterRelationshipId: afterId }),
      });

    const items = relationships.slice(0, limit).map((relationship) => ({
      id: relationship.id,
      recipientId: relationship.recipientId,
      displayName: null,
      status: 'pending' as const,
    }));
    const hasMore = relationships.length > limit;

    return {
      items,
      nextCursor: hasMore ? encodeCursor(items[items.length - 1].id) : null,
    };
  }
}
