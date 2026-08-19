import { ContactRelationship } from '../../domain/contact-relationship.entity';
import type { ContactRelationshipRepository } from '../ports/contact-relationship.repository.port';
import type { ContactTargetDirectory } from '../ports/contact-target-directory.port';

type SendContactRequestInput = {
  requesterId: string;
  targetUserId: string;
};

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

  async execute(input: SendContactRequestInput): Promise<void> {
    const targetExists = await this.contactTargetDirectory.targetUserExists(
      input.targetUserId,
    );

    if (!targetExists) {
      throw new ContactTargetNotFoundError();
    }

    const currentRelationship =
      await this.contactRelationshipRepository.findCurrentByUserPair(
        input.requesterId,
        input.targetUserId,
      );

    if (currentRelationship) {
      return;
    }

    const relationship = ContactRelationship.create({
      requesterId: input.requesterId,
      recipientId: input.targetUserId,
    });

    await this.contactRelationshipRepository.save(relationship);
  }
}
