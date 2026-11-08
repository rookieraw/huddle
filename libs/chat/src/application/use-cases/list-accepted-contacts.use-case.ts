import type { ContactRelationship } from '../../domain/contact-relationship.entity';
import type {
  ContactRelationshipRepository,
  FindAcceptedByUserQuery,
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

export class AcceptedContactListingUnavailableError extends Error {
  constructor() {
    super('Accepted Contacts are temporarily unavailable.');
    this.name = 'AcceptedContactListingUnavailableError';
  }
}

type ListAcceptedContactsInput = {
  userId: string;
  limit?: unknown;
  cursor?: unknown;
};

export type AcceptedContactItem = {
  userId: string;
  displayName: string | null;
};

export type AcceptedContactPage = {
  items: AcceptedContactItem[];
  nextCursor: string | null;
};

export class ListAcceptedContactsUseCase {
  constructor(
    private readonly contactRelationshipRepository: ContactRelationshipRepository,
    private readonly profileDirectory: UserProfileDirectory,
  ) {}

  async execute(
    input: ListAcceptedContactsInput,
  ): Promise<AcceptedContactPage> {
    const limit = resolveLimit(input.limit);
    const afterId = resolveAfterId(input.cursor);
    const relationships = await this.findAcceptedRelationships({
      userId: input.userId,
      take: limit + 1,
      ...(afterId !== undefined && { afterRelationshipId: afterId }),
    });
    const keptRelationships = relationships.slice(0, limit);
    const contactUserIds = keptRelationships.map((relationship) =>
      relationship.requesterId === input.userId
        ? relationship.recipientId
        : relationship.requesterId,
    );
    const profiles =
      contactUserIds.length === 0
        ? []
        : await this.findContactProfiles(contactUserIds);
    const displayNames = new Map(
      profiles.map((profile) => [profile.userId, profile.displayName]),
    );
    const hasMore = relationships.length > limit;

    return {
      items: contactUserIds.map((contactUserId) => ({
        userId: contactUserId,
        displayName: displayNames.get(contactUserId) ?? null,
      })),
      nextCursor: hasMore
        ? encodeCursor(keptRelationships[keptRelationships.length - 1].id)
        : null,
    };
  }

  private async findAcceptedRelationships(
    query: FindAcceptedByUserQuery,
  ): Promise<ContactRelationship[]> {
    try {
      return await this.contactRelationshipRepository.findAcceptedByUser(query);
    } catch {
      throw new AcceptedContactListingUnavailableError();
    }
  }

  private async findContactProfiles(userIds: string[]): Promise<UserProfile[]> {
    try {
      return await this.profileDirectory.findProfiles(userIds);
    } catch {
      throw new AcceptedContactListingUnavailableError();
    }
  }
}
