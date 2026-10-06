import type { ContactRelationship } from '../../domain/contact-relationship.entity';
import type { ContactRelationshipRepository } from '../ports/contact-relationship.repository.port';
import {
  ContactRelationshipNotFoundError,
  ContactRequestAlreadyAcceptedError,
} from './accept-contact-request.use-case';

type RejectContactRequestInput = {
  rejectingUserId: string;
  relationshipId: string;
};

export class ContactRequestRejectionNotAuthorizedError extends Error {
  constructor() {
    super('Only the recipient can reject a Contact request.');
    this.name = 'ContactRequestRejectionNotAuthorizedError';
  }
}

export class ContactRequestAlreadyRejectedError extends Error {
  constructor() {
    super('The Contact request has already been rejected.');
    this.name = 'ContactRequestAlreadyRejectedError';
  }
}

export class ContactRequestRejectionUnavailableError extends Error {
  constructor() {
    super('Contact request rejection is temporarily unavailable.');
    this.name = 'ContactRequestRejectionUnavailableError';
  }
}

export class RejectContactRequestUseCase {
  constructor(
    private readonly contactRelationshipRepository: ContactRelationshipRepository,
  ) {}

  async execute(
    input: RejectContactRequestInput,
  ): Promise<ContactRelationship> {
    const relationship = await this.findRelationship(input.relationshipId);

    if (!relationship) {
      throw new ContactRelationshipNotFoundError();
    }

    if (input.rejectingUserId !== relationship.recipientId) {
      throw new ContactRequestRejectionNotAuthorizedError();
    }

    if (relationship.isAccepted()) {
      throw new ContactRequestAlreadyAcceptedError();
    }

    if (relationship.isRejected()) {
      throw new ContactRequestAlreadyRejectedError();
    }

    relationship.reject(input.rejectingUserId);

    let applied: boolean;

    try {
      applied =
        await this.contactRelationshipRepository.transitionFromPending(
          relationship,
        );
    } catch {
      throw new ContactRequestRejectionUnavailableError();
    }

    if (!applied) {
      const current = await this.findRelationship(input.relationshipId);

      if (current?.isAccepted()) {
        throw new ContactRequestAlreadyAcceptedError();
      }

      if (current?.isRejected()) {
        throw new ContactRequestAlreadyRejectedError();
      }

      throw new ContactRequestRejectionUnavailableError();
    }

    return relationship;
  }

  private async findRelationship(
    relationshipId: string,
  ): Promise<ContactRelationship | null> {
    try {
      return await this.contactRelationshipRepository.findById(relationshipId);
    } catch {
      throw new ContactRequestRejectionUnavailableError();
    }
  }
}
