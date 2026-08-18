import { DomainError } from '@huddle/shared-kernel';

type ContactRelationshipStatus = 'pending';

type CreateContactRelationshipInput = {
  requesterId: string;
  recipientId: string;
};

export class ContactRelationship {
  private constructor(
    public readonly requesterId: string,
    public readonly recipientId: string,
    private readonly status: ContactRelationshipStatus,
  ) {}

  static create(input: CreateContactRelationshipInput): ContactRelationship {
    if (input.requesterId === input.recipientId) {
      throw new DomainError('A user cannot contact themselves.');
    }

    return new ContactRelationship(
      input.requesterId,
      input.recipientId,
      'pending',
    );
  }

  isPending(): boolean {
    return this.status === 'pending';
  }
}
