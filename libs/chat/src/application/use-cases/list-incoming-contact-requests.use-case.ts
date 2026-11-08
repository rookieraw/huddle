import type { ContactRelationship } from '../../domain/contact-relationship.entity';
import type {
  ContactRelationshipRepository,
  FindPendingByRecipientQuery,
} from '../ports/contact-relationship.repository.port';
import type {
  UserProfile,
  UserProfileDirectory,
} from '../ports/user-profile-directory.port';
import {
  encodeCursor,
  resolveAfterId,
  resolveLimit,
} from './contact-list-pagination';

export class IncomingContactRequestListingUnavailableError extends Error {
  constructor() {
    super('Incoming Contact requests are temporarily unavailable.');
    this.name = 'IncomingContactRequestListingUnavailableError';
  }
}

type ListIncomingContactRequestsInput = {
  recipientId: string;
  limit?: unknown;
  cursor?: unknown;
};

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
    private readonly profileDirectory: UserProfileDirectory,
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
      throw new IncomingContactRequestListingUnavailableError();
    }
  }

  private async findRequesterProfiles(
    requesterIds: string[],
  ): Promise<UserProfile[]> {
    try {
      return await this.profileDirectory.findProfiles(requesterIds);
    } catch {
      throw new IncomingContactRequestListingUnavailableError();
    }
  }
}
