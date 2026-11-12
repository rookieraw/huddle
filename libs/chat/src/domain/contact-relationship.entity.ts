import { randomUUID } from 'node:crypto';
import { DomainError } from '@huddle/shared-kernel';

type ContactRelationshipStatus =
  'pending' | 'accepted' | 'rejected' | 'removed';

type CreateContactRelationshipInput = {
  requesterId: string;
  recipientId: string;
};

type ReconstituteContactRelationshipInput = {
  id: string;
  requesterId: string;
  recipientId: string;
  status: ContactRelationshipStatus;
  removedByUserId?: string | null;
  removedAt?: Date | null;
};

export class ContactRelationship {
  private constructor(
    public readonly id: string,
    public readonly requesterId: string,
    public readonly recipientId: string,
    private status: ContactRelationshipStatus,
    private removingUserId: string | null,
    private removalTime: Date | null,
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
      null,
      null,
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
      input.removedByUserId ?? null,
      input.removedAt ?? null,
    );
  }

  get removedByUserId(): string | null {
    return this.removingUserId;
  }

  get removedAt(): Date | null {
    return this.removalTime;
  }

  isPending(): boolean {
    return this.status === 'pending';
  }

  isAccepted(): boolean {
    return this.status === 'accepted';
  }

  accept(acceptingUserId: string): void {
    if (acceptingUserId !== this.recipientId) {
      throw new DomainError('Only the recipient can accept a Contact request.');
    }

    if (!this.isPending()) {
      throw new DomainError('Only a pending Contact request can be accepted.');
    }

    this.status = 'accepted';
  }

  isRejected(): boolean {
    return this.status === 'rejected';
  }

  reject(rejectingUserId: string): void {
    if (rejectingUserId !== this.recipientId) {
      throw new DomainError('Only the recipient can reject a Contact request.');
    }

    if (!this.isPending()) {
      throw new DomainError('Only a pending Contact request can be rejected.');
    }

    this.status = 'rejected';
  }

  isRemoved(): boolean {
    return this.status === 'removed';
  }

  remove(removingUserId: string, now: Date): void {
    if (
      removingUserId !== this.requesterId &&
      removingUserId !== this.recipientId
    ) {
      throw new DomainError(
        'Only a user of the relationship can remove a Contact.',
      );
    }

    if (!this.isAccepted()) {
      throw new DomainError('Only an accepted Contact can be removed.');
    }

    this.status = 'removed';
    this.removingUserId = removingUserId;
    this.removalTime = now;
  }
}
