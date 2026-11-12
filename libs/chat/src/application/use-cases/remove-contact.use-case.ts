import type { ContactRelationship } from '../../domain/contact-relationship.entity';
import type { ChatClock } from '../ports/chat-clock.port';
import type { ContactRelationshipRepository } from '../ports/contact-relationship.repository.port';

type RemoveContactInput = {
  removingUserId: string;
  contactUserId: string;
};

export class ContactNotFoundError extends Error {
  constructor() {
    super('Contact was not found.');
    this.name = 'ContactNotFoundError';
  }
}

export class ContactRemovalUnavailableError extends Error {
  constructor() {
    super('Contact removal is temporarily unavailable.');
    this.name = 'ContactRemovalUnavailableError';
  }
}

export class RemoveContactUseCase {
  constructor(
    private readonly contactRelationshipRepository: ContactRelationshipRepository,
    private readonly clock: ChatClock,
  ) {}

  async execute(input: RemoveContactInput): Promise<void> {
    const relationship = await this.findCurrentRelationship(input);

    if (!relationship?.isAccepted()) {
      throw new ContactNotFoundError();
    }

    relationship.remove(input.removingUserId, this.clock.now());

    let applied: boolean;

    try {
      applied =
        await this.contactRelationshipRepository.transitionFromAccepted(
          relationship,
        );
    } catch {
      throw new ContactRemovalUnavailableError();
    }

    if (!applied) {
      throw new ContactNotFoundError();
    }
  }

  private async findCurrentRelationship(
    input: RemoveContactInput,
  ): Promise<ContactRelationship | null> {
    try {
      return await this.contactRelationshipRepository.findCurrentByUserPair(
        input.removingUserId,
        input.contactUserId,
      );
    } catch {
      throw new ContactRemovalUnavailableError();
    }
  }
}
