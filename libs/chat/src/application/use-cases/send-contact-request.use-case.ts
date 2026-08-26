import { ContactRelationship } from '../../domain/contact-relationship.entity';
import type { ContactRelationshipRepository } from '../ports/contact-relationship.repository.port';
import type { ContactTargetDirectory } from '../ports/contact-target-directory.port';

type SendContactRequestInput = {
  requesterId: string;
  targetUserId: string;
};

export class SelfContactRequestError extends Error {
  constructor() {
    super('A Contact request cannot target the requester.');
    this.name = 'SelfContactRequestError';
  }
}

export class ContactTargetLookupUnavailableError extends Error {
  constructor() {
    super('Contact target validation is temporarily unavailable.');
    this.name = 'ContactTargetLookupUnavailableError';
  }
}

export class ContactTargetNotFoundError extends Error {
  constructor() {
    super('Contact target was not found.');
    this.name = 'ContactTargetNotFoundError';
  }
}

export class SendContactRequestUseCase {
  constructor(
    private readonly contactTargetDirectory: ContactTargetDirectory,
    private readonly contactRelationshipRepository: ContactRelationshipRepository,
  ) {}

  async execute(input: SendContactRequestInput): Promise<ContactRelationship> {
    if (input.requesterId === input.targetUserId) {
      throw new SelfContactRequestError();
    }

    let targetExists: boolean;

    try {
      targetExists = await this.contactTargetDirectory.targetUserExists(
        input.targetUserId,
      );
    } catch {
      throw new ContactTargetLookupUnavailableError();
    }

    if (!targetExists) {
      throw new ContactTargetNotFoundError();
    }

    const currentRelationship =
      await this.contactRelationshipRepository.findCurrentByUserPair(
        input.requesterId,
        input.targetUserId,
      );

    if (currentRelationship) {
      return currentRelationship;
    }

    const relationship = ContactRelationship.create({
      requesterId: input.requesterId,
      recipientId: input.targetUserId,
    });

    return this.contactRelationshipRepository.save(relationship);
  }
}
