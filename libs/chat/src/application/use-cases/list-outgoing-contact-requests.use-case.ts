import type { ContactRelationshipRepository } from '../ports/contact-relationship.repository.port';
import type { RequesterProfileDirectory } from '../ports/requester-profile-directory.port';

export const OUTGOING_CONTACT_REQUEST_DEFAULT_LIMIT = 20;

const CURSOR_VERSION = 'v1';

function encodeCursor(relationshipId: string): string {
  return Buffer.from(`${CURSOR_VERSION}:${relationshipId}`, 'utf8').toString(
    'base64url',
  );
}

function resolveAfterId(rawCursor: unknown): string | undefined {
  if (typeof rawCursor !== 'string') {
    return undefined;
  }

  return Buffer.from(rawCursor, 'base64url')
    .toString('utf8')
    .slice(`${CURSOR_VERSION}:`.length);
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
