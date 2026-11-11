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

  describe('reject', () => {
    it('allows the original recipient to reject a pending relationship while preserving its identity and roles', () => {
      const requesterId = 'user-original-requester';
      const recipientId = 'user-original-recipient';
      const relationship = ContactRelationship.create({
        requesterId,
        recipientId,
      });
      const relationshipId = relationship.id;

      relationship.reject(recipientId);

      expect(relationship.id).toBe(relationshipId);
      expect(relationship.requesterId).toBe(requesterId);
      expect(relationship.recipientId).toBe(recipientId);
      expect(relationship.isPending()).toBe(false);
      expect(relationship.isAccepted()).toBe(false);
      expect(relationship.isRejected()).toBe(true);
    });

    it('rejects rejection by the requester while preserving the pending relationship', () => {
      const requesterId = 'user-original-requester';
      const recipientId = 'user-original-recipient';
      const relationship = ContactRelationship.create({
        requesterId,
        recipientId,
      });
      const relationshipId = relationship.id;

      expect(() => relationship.reject(requesterId)).toThrow(DomainError);

      expect(relationship.id).toBe(relationshipId);
      expect(relationship.requesterId).toBe(requesterId);
      expect(relationship.recipientId).toBe(recipientId);
      expect(relationship.isPending()).toBe(true);
      expect(relationship.isRejected()).toBe(false);
    });

    it('rejects rejection by an unrelated user while preserving the pending relationship', () => {
      const requesterId = 'user-original-requester';
      const recipientId = 'user-original-recipient';
      const relationship = ContactRelationship.create({
        requesterId,
        recipientId,
      });
      const relationshipId = relationship.id;

      expect(() => relationship.reject('user-unrelated')).toThrow(DomainError);

      expect(relationship.id).toBe(relationshipId);
      expect(relationship.requesterId).toBe(requesterId);
      expect(relationship.recipientId).toBe(recipientId);
      expect(relationship.isPending()).toBe(true);
      expect(relationship.isRejected()).toBe(false);
    });

    it('rejects repeated rejection while preserving the rejected relationship', () => {
      const requesterId = 'user-original-requester';
      const recipientId = 'user-original-recipient';
      const relationship = ContactRelationship.create({
        requesterId,
        recipientId,
      });
      relationship.reject(recipientId);
      const relationshipId = relationship.id;

      expect(() => relationship.reject(recipientId)).toThrow(DomainError);

      expect(relationship.id).toBe(relationshipId);
      expect(relationship.requesterId).toBe(requesterId);
      expect(relationship.recipientId).toBe(recipientId);
      expect(relationship.isPending()).toBe(false);
      expect(relationship.isAccepted()).toBe(false);
      expect(relationship.isRejected()).toBe(true);
    });

    it('rejects rejection of an accepted relationship while preserving the accepted relationship', () => {
      const requesterId = 'user-original-requester';
      const recipientId = 'user-original-recipient';
      const relationship = ContactRelationship.create({
        requesterId,
        recipientId,
      });
      relationship.accept(recipientId);
      const relationshipId = relationship.id;

      expect(() => relationship.reject(recipientId)).toThrow(DomainError);

      expect(relationship.id).toBe(relationshipId);
      expect(relationship.requesterId).toBe(requesterId);
      expect(relationship.recipientId).toBe(recipientId);
      expect(relationship.isPending()).toBe(false);
      expect(relationship.isAccepted()).toBe(true);
      expect(relationship.isRejected()).toBe(false);
    });
  });

  describe('remove', () => {
    it('allows the original requester to remove an accepted relationship, recording the removing user and time while preserving its identity and roles', () => {
      const requesterId = 'user-original-requester';
      const recipientId = 'user-original-recipient';
      const removedAt = new Date('2026-11-11T10:00:00.000Z');
      const relationship = ContactRelationship.create({
        requesterId,
        recipientId,
      });
      relationship.accept(recipientId);
      const relationshipId = relationship.id;

      relationship.remove(requesterId, removedAt);

      expect(relationship.id).toBe(relationshipId);
      expect(relationship.requesterId).toBe(requesterId);
      expect(relationship.recipientId).toBe(recipientId);
      expect(relationship.removedByUserId).toBe(requesterId);
      expect(relationship.removedAt).toEqual(removedAt);
      expect(relationship.isPending()).toBe(false);
      expect(relationship.isAccepted()).toBe(false);
    });

    it('rejects removal by an unrelated user while preserving the accepted relationship', () => {
      const requesterId = 'user-original-requester';
      const recipientId = 'user-original-recipient';
      const relationship = ContactRelationship.create({
        requesterId,
        recipientId,
      });
      relationship.accept(recipientId);
      const relationshipId = relationship.id;

      expect(() =>
        relationship.remove(
          'user-unrelated',
          new Date('2026-11-11T10:00:00.000Z'),
        ),
      ).toThrow(DomainError);

      expect(relationship.id).toBe(relationshipId);
      expect(relationship.requesterId).toBe(requesterId);
      expect(relationship.recipientId).toBe(recipientId);
      expect(relationship.removedByUserId).toBeNull();
      expect(relationship.removedAt).toBeNull();
      expect(relationship.isPending()).toBe(false);
      expect(relationship.isAccepted()).toBe(true);
    });
  });

  describe('isRemoved', () => {
    it('reports a removed relationship as removed and no other relationship as removed', () => {
      const requesterId = 'user-original-requester';
      const recipientId = 'user-original-recipient';
      const pending = ContactRelationship.create({ requesterId, recipientId });
      const accepted = ContactRelationship.create({ requesterId, recipientId });
      accepted.accept(recipientId);
      const rejected = ContactRelationship.create({ requesterId, recipientId });
      rejected.reject(recipientId);
      const removed = ContactRelationship.create({ requesterId, recipientId });
      removed.accept(recipientId);
      removed.remove(recipientId, new Date('2026-11-11T10:00:00.000Z'));

      expect(removed.isRemoved()).toBe(true);
      expect(pending.isRemoved()).toBe(false);
      expect(accepted.isRemoved()).toBe(false);
      expect(rejected.isRemoved()).toBe(false);
    });
  });

  describe('remove state', () => {
    it('rejects removal of a pending relationship while preserving the pending relationship', () => {
      const requesterId = 'user-original-requester';
      const recipientId = 'user-original-recipient';
      const relationship = ContactRelationship.create({
        requesterId,
        recipientId,
      });
      const relationshipId = relationship.id;

      expect(() =>
        relationship.remove(requesterId, new Date('2026-11-11T10:00:00.000Z')),
      ).toThrow(DomainError);

      expect(relationship.id).toBe(relationshipId);
      expect(relationship.requesterId).toBe(requesterId);
      expect(relationship.recipientId).toBe(recipientId);
      expect(relationship.removedByUserId).toBeNull();
      expect(relationship.removedAt).toBeNull();
      expect(relationship.isPending()).toBe(true);
      expect(relationship.isAccepted()).toBe(false);
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

    it('restores a persisted removed relationship with its removing user and removal time', () => {
      const removedAt = new Date('2026-11-11T10:00:00.000Z');

      const relationship = ContactRelationship.reconstitute({
        id: 'relationship-existing',
        requesterId: 'user-original-requester',
        recipientId: 'user-original-recipient',
        status: 'removed',
        removedByUserId: 'user-original-recipient',
        removedAt,
      });

      expect(relationship.id).toBe('relationship-existing');
      expect(relationship.requesterId).toBe('user-original-requester');
      expect(relationship.recipientId).toBe('user-original-recipient');
      expect(relationship.isRemoved()).toBe(true);
      expect(relationship.removedByUserId).toBe('user-original-recipient');
      expect(relationship.removedAt).toEqual(removedAt);
    });
  });
});
