import type { ContactRelationship } from '../../domain/contact-relationship.entity';
import type {
  ContactRelationshipRepository,
  FindPendingByRequesterQuery,
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

export class OutgoingContactRequestListingUnavailableError extends Error {
  constructor() {
    super('Outgoing Contact requests are temporarily unavailable.');
    this.name = 'OutgoingContactRequestListingUnavailableError';
  }
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
    private readonly profileDirectory: UserProfileDirectory,
  ) {}

  async execute(
    input: ListOutgoingContactRequestsInput,
  ): Promise<OutgoingContactRequestPage> {
    const limit = resolveLimit(input.limit);
    const afterId = resolveAfterId(input.cursor);
    const relationships = await this.findPendingRelationships({
      requesterId: input.requesterId,
      take: limit + 1,
      ...(afterId !== undefined && { afterRelationshipId: afterId }),
    });

    const keptRelationships = relationships.slice(0, limit);
    const profiles =
      keptRelationships.length === 0
        ? []
        : await this.findRecipientProfiles(
            keptRelationships.map((relationship) => relationship.recipientId),
          );
    const displayNames = new Map(
      profiles.map((profile) => [profile.userId, profile.displayName]),
    );
    const items = keptRelationships.map((relationship) => ({
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

  private async findPendingRelationships(
    query: FindPendingByRequesterQuery,
  ): Promise<ContactRelationship[]> {
    try {
      return await this.contactRelationshipRepository.findPendingByRequester(
        query,
      );
    } catch {
      throw new OutgoingContactRequestListingUnavailableError();
    }
  }

  private async findRecipientProfiles(
    recipientIds: string[],
  ): Promise<UserProfile[]> {
    try {
      return await this.profileDirectory.findProfiles(recipientIds);
    } catch {
      throw new OutgoingContactRequestListingUnavailableError();
    }
  }
}
