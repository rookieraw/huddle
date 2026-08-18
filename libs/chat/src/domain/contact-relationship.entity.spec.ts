import { DomainError } from '@huddle/shared-kernel';
import { ContactRelationship } from './contact-relationship.entity';

describe('ContactRelationship', () => {
  describe('create', () => {
    it('creates a pending relationship for two distinct users', () => {
      const requesterId = 'user-requester';
      const recipientId = 'user-recipient';

      const relationship = ContactRelationship.create({
        requesterId,
        recipientId,
      });

      expect(relationship.requesterId).toBe(requesterId);
      expect(relationship.recipientId).toBe(recipientId);
      expect(relationship.isPending()).toBe(true);
    });

    it('rejects a relationship targeting the requesting user', () => {
      const userId = 'user-same';

      expect(() =>
        ContactRelationship.create({
          requesterId: userId,
          recipientId: userId,
        }),
      ).toThrow(DomainError);
    });
  });
});
