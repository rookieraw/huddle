import type { ContactRelationship } from '../../domain/contact-relationship.entity';
import type { ContactRelationshipRepository } from '../ports/contact-relationship.repository.port';
import {
  ContactRelationshipNotFoundError,
  ContactRequestAlreadyAcceptedError,
  ContactRequestAlreadyRejectedError,
} from './contact-request.errors';

type AcceptContactRequestInput = {
  acceptingUserId: string;
  relationshipId: string;
};

export class ContactRequestAcceptanceNotAuthorizedError extends Error {
  constructor() {
    super('Only the recipient can accept a Contact request.');
    this.name = 'ContactRequestAcceptanceNotAuthorizedError';
  }
}

export class ContactRequestAcceptanceUnavailableError extends Error {
  constructor() {
    super('Contact request acceptance is temporarily unavailable.');
    this.name = 'ContactRequestAcceptanceUnavailableError';
  }
}

export class AcceptContactRequestUseCase {
  constructor(
    private readonly contactRelationshipRepository: ContactRelationshipRepository,
  ) {}

  async execute(
    input: AcceptContactRequestInput,
  ): Promise<ContactRelationship> {
    const relationship = await this.findRelationship(input.relationshipId);

    if (!relationship) {
      throw new ContactRelationshipNotFoundError();
    }

    if (input.acceptingUserId !== relationship.recipientId) {
      throw new ContactRequestAcceptanceNotAuthorizedError();
    }

    if (relationship.isAccepted()) {
      throw new ContactRequestAlreadyAcceptedError();
    }

    if (relationship.isRejected()) {
      throw new ContactRequestAlreadyRejectedError();
    }

    relationship.accept(input.acceptingUserId);

    let applied: boolean;

    try {
      applied =
        await this.contactRelationshipRepository.transitionFromPending(
          relationship,
        );
    } catch {
      throw new ContactRequestAcceptanceUnavailableError();
    }

    if (!applied) {
      const current = await this.findRelationship(input.relationshipId);

      if (current?.isAccepted()) {
        throw new ContactRequestAlreadyAcceptedError();
      }

      if (current?.isRejected()) {
        throw new ContactRequestAlreadyRejectedError();
      }

      throw new ContactRequestAcceptanceUnavailableError();
    }

    return relationship;
  }

  private async findRelationship(
    relationshipId: string,
  ): Promise<ContactRelationship | null> {
    try {
      return await this.contactRelationshipRepository.findById(relationshipId);
    } catch {
      throw new ContactRequestAcceptanceUnavailableError();
    }
  }
}
