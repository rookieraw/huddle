import type { ContactRelationshipRepository } from '../ports/contact-relationship.repository.port';
import type { RequesterProfileDirectory } from '../ports/requester-profile-directory.port';

export const OUTGOING_CONTACT_REQUEST_DEFAULT_LIMIT = 20;

type ListOutgoingContactRequestsInput = {
  requesterId: string;
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
    const relationships =
      await this.contactRelationshipRepository.findPendingByRequester({
        requesterId: input.requesterId,
        take: OUTGOING_CONTACT_REQUEST_DEFAULT_LIMIT,
      });

    return {
      items: relationships.map((relationship) => ({
        id: relationship.id,
        recipientId: relationship.recipientId,
        displayName: null,
        status: 'pending' as const,
      })),
      nextCursor: null,
    };
  }
}
