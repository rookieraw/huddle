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

    it('assigns a stable identity to a new relationship', () => {
      const relationship = ContactRelationship.create({
        requesterId: 'user-requester',
        recipientId: 'user-recipient',
      });

      expect(relationship).toHaveProperty('id', expect.stringMatching(/\S/));
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

  describe('accept', () => {
    it('allows the original recipient to accept a pending relationship while preserving its identity and roles', () => {
      const requesterId = 'user-original-requester';
      const recipientId = 'user-original-recipient';
      const relationship = ContactRelationship.create({
        requesterId,
        recipientId,
      });
      const relationshipId = relationship.id;

      relationship.accept(recipientId);

      expect(relationship.id).toBe(relationshipId);
      expect(relationship.requesterId).toBe(requesterId);
      expect(relationship.recipientId).toBe(recipientId);
      expect(relationship.isPending()).toBe(false);
      expect(relationship.isAccepted()).toBe(true);
    });

    it('rejects acceptance by the requester while preserving the pending relationship', () => {
      const requesterId = 'user-original-requester';
      const recipientId = 'user-original-recipient';
      const relationship = ContactRelationship.create({
        requesterId,
        recipientId,
      });
      const relationshipId = relationship.id;

      expect(() => relationship.accept(requesterId)).toThrow(DomainError);

      expect(relationship.id).toBe(relationshipId);
      expect(relationship.requesterId).toBe(requesterId);
      expect(relationship.recipientId).toBe(recipientId);
      expect(relationship.isPending()).toBe(true);
      expect(relationship.isAccepted()).toBe(false);
    });

    it('rejects acceptance by an unrelated user while preserving the pending relationship', () => {
      const requesterId = 'user-original-requester';
      const recipientId = 'user-original-recipient';
      const relationship = ContactRelationship.create({
        requesterId,
        recipientId,
      });
      const relationshipId = relationship.id;

      expect(() => relationship.accept('user-unrelated')).toThrow(DomainError);

      expect(relationship.id).toBe(relationshipId);
      expect(relationship.requesterId).toBe(requesterId);
      expect(relationship.recipientId).toBe(recipientId);
      expect(relationship.isPending()).toBe(true);
      expect(relationship.isAccepted()).toBe(false);
    });

    it('rejects repeated acceptance while preserving the accepted relationship', () => {
      const requesterId = 'user-original-requester';
      const recipientId = 'user-original-recipient';
      const relationship = ContactRelationship.create({
        requesterId,
        recipientId,
      });
      relationship.accept(recipientId);
      const relationshipId = relationship.id;

      expect(() => relationship.accept(recipientId)).toThrow(DomainError);

      expect(relationship.id).toBe(relationshipId);
      expect(relationship.requesterId).toBe(requesterId);
      expect(relationship.recipientId).toBe(recipientId);
      expect(relationship.isPending()).toBe(false);
      expect(relationship.isAccepted()).toBe(true);
    });
  });

  describe('reconstitute', () => {
    it('restores a persisted pending relationship with its existing identity and roles', () => {
      const relationship = ContactRelationship.reconstitute({
        id: 'relationship-existing',
        requesterId: 'user-original-requester',
        recipientId: 'user-original-recipient',
        status: 'pending',
      });

      expect(relationship.id).toBe('relationship-existing');
      expect(relationship.requesterId).toBe('user-original-requester');
      expect(relationship.recipientId).toBe('user-original-recipient');
      expect(relationship.isPending()).toBe(true);
    });
  });
});
