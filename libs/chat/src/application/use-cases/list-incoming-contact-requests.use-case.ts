import type { ContactRelationship } from '../../domain/contact-relationship.entity';
import type {
  ContactRelationshipRepository,
  FindPendingByRecipientQuery,
} from '../ports/contact-relationship.repository.port';
import type {
  RequesterProfile,
  RequesterProfileDirectory,
} from '../ports/requester-profile-directory.port';

export const INCOMING_CONTACT_REQUEST_DEFAULT_LIMIT = 20;
export const INCOMING_CONTACT_REQUEST_MAX_LIMIT = 50;

export class ContactRequestListingUnavailableError extends Error {
  constructor() {
    super('Incoming Contact requests are temporarily unavailable.');
    this.name = 'ContactRequestListingUnavailableError';
  }
}

export class InvalidIncomingListLimitError extends Error {
  constructor() {
    super(
      `limit must be an integer from 1 to ${INCOMING_CONTACT_REQUEST_MAX_LIMIT}.`,
    );
    this.name = 'InvalidIncomingListLimitError';
  }
}

function resolveLimit(rawLimit: unknown): number {
  if (rawLimit === undefined) {
    return INCOMING_CONTACT_REQUEST_DEFAULT_LIMIT;
  }

  if (typeof rawLimit !== 'string' || !/^[0-9]+$/.test(rawLimit)) {
    throw new InvalidIncomingListLimitError();
  }

  const limit = Number(rawLimit);

  if (limit < 1 || limit > INCOMING_CONTACT_REQUEST_MAX_LIMIT) {
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

type ListIncomingContactRequestsInput = {
  recipientId: string;
  limit?: unknown;
  cursor?: unknown;
};

export class InvalidIncomingListCursorError extends Error {
  constructor() {
    super('cursor must be a valid cursor.');
    this.name = 'InvalidIncomingListCursorError';
  }
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

export type IncomingContactRequestItem = {
  id: string;
  requesterId: string;
  displayName: string | null;
  status: 'pending';
};

export type IncomingContactRequestPage = {
  items: IncomingContactRequestItem[];
  nextCursor: string | null;
};

export class ListIncomingContactRequestsUseCase {
  constructor(
    private readonly contactRelationshipRepository: ContactRelationshipRepository,
    private readonly requesterProfileDirectory: RequesterProfileDirectory,
  ) {}

  async execute(
    input: ListIncomingContactRequestsInput,
  ): Promise<IncomingContactRequestPage> {
    const limit = resolveLimit(input.limit);
    const afterId = resolveAfterId(input.cursor);
    const relationships = await this.findPendingRelationships({
      recipientId: input.recipientId,
      take: limit + 1,
      ...(afterId !== undefined && { afterRelationshipId: afterId }),
    });

    const keptRelationships = relationships.slice(0, limit);
    const profiles =
      keptRelationships.length === 0
        ? []
        : await this.findRequesterProfiles(
            keptRelationships.map((relationship) => relationship.requesterId),
          );
    const displayNames = new Map(
      profiles.map((profile) => [profile.userId, profile.displayName]),
    );
    const items = keptRelationships.map((relationship) => ({
      id: relationship.id,
      requesterId: relationship.requesterId,
      displayName: displayNames.get(relationship.requesterId) ?? null,
      status: 'pending' as const,
    }));
    const hasMore = relationships.length > limit;

    return {
      items,
      nextCursor: hasMore ? encodeCursor(items[items.length - 1].id) : null,
    };
  }

  private async findPendingRelationships(
    query: FindPendingByRecipientQuery,
  ): Promise<ContactRelationship[]> {
    try {
      return await this.contactRelationshipRepository.findPendingByRecipient(
        query,
      );
    } catch {
      throw new ContactRequestListingUnavailableError();
    }
  }

  private async findRequesterProfiles(
    requesterIds: string[],
  ): Promise<RequesterProfile[]> {
    try {
      return await this.requesterProfileDirectory.findProfiles(requesterIds);
    } catch {
      throw new ContactRequestListingUnavailableError();
    }
  }
}
