import { randomUUID } from 'node:crypto';
import { DomainError } from '@huddle/shared-kernel';

type ContactRelationshipStatus = 'pending';

type CreateContactRelationshipInput = {
  requesterId: string;
  recipientId: string;
};

type ReconstituteContactRelationshipInput = {
  id: string;
  requesterId: string;
  recipientId: string;
  status: ContactRelationshipStatus;
};

export class ContactRelationship {
  private constructor(
    public readonly id: string,
    public readonly requesterId: string,
    public readonly recipientId: string,
    private readonly status: ContactRelationshipStatus,
  ) {}

  static create(input: CreateContactRelationshipInput): ContactRelationship {
    if (input.requesterId === input.recipientId) {
      throw new DomainError('A user cannot contact themselves.');
    }

    return new ContactRelationship(
      randomUUID(),
      input.requesterId,
      input.recipientId,
      'pending',
    );
  }

  static reconstitute(
    input: ReconstituteContactRelationshipInput,
  ): ContactRelationship {
    return new ContactRelationship(
      input.id,
      input.requesterId,
      input.recipientId,
      input.status,
    );
  }

  isPending(): boolean {
    return this.status === 'pending';
  }
}
