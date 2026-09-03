import type { ContactRelationship } from '../../domain/contact-relationship.entity';
import type { ContactRelationshipRepository } from '../ports/contact-relationship.repository.port';

type AcceptContactRequestInput = {
  acceptingUserId: string;
  relationshipId: string;
};

export class ContactRelationshipNotFoundError extends Error {
  constructor() {
    super('Contact relationship was not found.');
    this.name = 'ContactRelationshipNotFoundError';
  }
}

export class ContactRequestAcceptanceNotAuthorizedError extends Error {
  constructor() {
    super('Only the recipient can accept a Contact request.');
    this.name = 'ContactRequestAcceptanceNotAuthorizedError';
  }
}

export class ContactRequestAlreadyAcceptedError extends Error {
  constructor() {
    super('The Contact request has already been accepted.');
    this.name = 'ContactRequestAlreadyAcceptedError';
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
    let relationship: ContactRelationship | null;

    try {
      relationship = await this.contactRelationshipRepository.findById(
        input.relationshipId,
      );
    } catch {
      throw new ContactRequestAcceptanceUnavailableError();
    }

    if (!relationship) {
      throw new ContactRelationshipNotFoundError();
    }

    if (input.acceptingUserId !== relationship.recipientId) {
      throw new ContactRequestAcceptanceNotAuthorizedError();
    }

    if (!relationship.isPending()) {
      throw new ContactRequestAlreadyAcceptedError();
    }

    relationship.accept(input.acceptingUserId);

    return this.contactRelationshipRepository.save(relationship);
  }
}
