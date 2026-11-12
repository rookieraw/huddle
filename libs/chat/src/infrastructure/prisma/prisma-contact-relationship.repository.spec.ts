import { ContactRelationship } from '../../domain/contact-relationship.entity';
import { PrismaClient } from './generated/client';
import { PrismaContactRelationshipRepository } from './prisma-contact-relationship.repository';

describe('PrismaContactRelationshipRepository', () => {
  it('loads a pending relationship by its identifier', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'relationship-pending',
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
      status: 'pending',
    });
    const prisma = {
      contactRelationship: {
        findUnique,
      },
    } as unknown as PrismaClient;
    const repository = new PrismaContactRelationshipRepository(prisma);

    const found = await repository.findById('relationship-pending');

    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'relationship-pending' },
    });
    expect(found?.id).toBe('relationship-pending');
    expect(found?.requesterId).toBe('user-original-requester');
    expect(found?.recipientId).toBe('user-original-recipient');
    expect(found?.isPending()).toBe(true);
  });

  it('loads a rejected relationship by its identifier', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'relationship-rejected',
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
      status: 'rejected',
    });
    const prisma = {
      contactRelationship: {
        findUnique,
      },
    } as unknown as PrismaClient;
    const repository = new PrismaContactRelationshipRepository(prisma);

    const found = await repository.findById('relationship-rejected');

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'relationship-rejected' },
    });
    expect(found?.id).toBe('relationship-rejected');
    expect(found?.requesterId).toBe('user-original-requester');
    expect(found?.recipientId).toBe('user-original-recipient');
    expect(found?.isRejected()).toBe(true);
  });

  it('persists a rejected relationship only while its stored status is still pending', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      contactRelationship: {
        updateMany,
      },
    } as unknown as PrismaClient;
    const repository = new PrismaContactRelationshipRepository(prisma);
    const relationship = ContactRelationship.reconstitute({
      id: 'relationship-pending',
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
      status: 'pending',
    });
    relationship.reject('user-original-recipient');

    const applied = await repository.transitionFromPending(relationship);

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'relationship-pending', status: 'pending' },
      data: { status: 'rejected' },
    });
    expect(applied).toBe(true);
  });

  it('refuses to transition a relationship that is still pending', async () => {
    const updateMany = jest.fn();
    const prisma = {
      contactRelationship: {
        updateMany,
      },
    } as unknown as PrismaClient;
    const repository = new PrismaContactRelationshipRepository(prisma);
    const relationship = ContactRelationship.reconstitute({
      id: 'relationship-still-pending',
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
      status: 'pending',
    });

    const execution = repository.transitionFromPending(relationship);

    await expect(execution).rejects.toThrow(
      'Only a resolved ContactRelationship can be transitioned from pending.',
    );
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('refuses to transition from accepted a relationship that has not been removed', async () => {
    const updateMany = jest.fn();
    const prisma = {
      contactRelationship: {
        updateMany,
      },
    } as unknown as PrismaClient;
    const repository = new PrismaContactRelationshipRepository(prisma);
    const relationship = ContactRelationship.reconstitute({
      id: 'relationship-still-accepted',
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
      status: 'accepted',
    });

    const execution = repository.transitionFromAccepted(relationship);

    await expect(execution).rejects.toThrow(
      'Only a removed ContactRelationship can be transitioned from accepted.',
    );
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('preserves a uniqueness error for an unrelated constraint', async () => {
    const unrelatedCollision = {
      code: 'P2002',
      meta: {
        modelName: 'ContactRelationship',
        driverAdapterError: {
          name: 'DriverAdapterError',
          cause: {
            kind: 'UniqueConstraintViolation',
            originalCode: '23505',
            originalMessage:
              'duplicate key value violates unique constraint "unrelated_key"',
          },
        },
      },
    };
    const upsert = jest.fn().mockRejectedValue(unrelatedCollision);
    const findFirst = jest.fn();
    const prisma = {
      contactRelationship: {
        upsert,
        findFirst,
      },
    } as unknown as PrismaClient;
    const repository = new PrismaContactRelationshipRepository(prisma);
    const relationship = ContactRelationship.create({
      requesterId: 'user-requester',
      recipientId: 'user-recipient',
    });

    const execution = repository.save(relationship);

    await expect(execution).rejects.toBe(unrelatedCollision);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('retries the save when the pair collision has no current winner because it was removed in between', async () => {
    const pairCollision = {
      code: 'P2002',
      meta: {
        modelName: 'ContactRelationship',
        driverAdapterError: {
          name: 'DriverAdapterError',
          cause: {
            kind: 'UniqueConstraintViolation',
            originalCode: '23505',
            originalMessage:
              'duplicate key value violates unique constraint "contact_relationships_current_user_pair_key"',
          },
        },
      },
    };
    const relationship = ContactRelationship.create({
      requesterId: 'user-requester',
      recipientId: 'user-recipient',
    });
    const upsert = jest
      .fn()
      .mockRejectedValueOnce(pairCollision)
      .mockResolvedValueOnce({
        id: relationship.id,
        requesterId: 'user-requester',
        recipientId: 'user-recipient',
        status: 'pending',
        removedByUserId: null,
        removedAt: null,
      });
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = {
      contactRelationship: {
        upsert,
        findFirst,
      },
    } as unknown as PrismaClient;
    const repository = new PrismaContactRelationshipRepository(prisma);

    const saved = await repository.save(relationship);

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(saved.id).toBe(relationship.id);
    expect(saved.isPending()).toBe(true);
  });

  it('retries the save only once and surfaces a second pair collision', async () => {
    const pairCollision = {
      code: 'P2002',
      meta: {
        modelName: 'ContactRelationship',
        driverAdapterError: {
          name: 'DriverAdapterError',
          cause: {
            kind: 'UniqueConstraintViolation',
            originalCode: '23505',
            originalMessage:
              'duplicate key value violates unique constraint "contact_relationships_current_user_pair_key"',
          },
        },
      },
    };
    const upsert = jest.fn().mockRejectedValue(pairCollision);
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = {
      contactRelationship: {
        upsert,
        findFirst,
      },
    } as unknown as PrismaClient;
    const repository = new PrismaContactRelationshipRepository(prisma);
    const relationship = ContactRelationship.create({
      requesterId: 'user-requester',
      recipientId: 'user-recipient',
    });

    const execution = repository.save(relationship);

    await expect(execution).rejects.toBe(pairCollision);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it('preserves an ordinary persistence failure', async () => {
    const persistenceFailure = new Error('PostgreSQL unavailable');
    const upsert = jest.fn().mockRejectedValue(persistenceFailure);
    const findFirst = jest.fn();
    const prisma = {
      contactRelationship: {
        upsert,
        findFirst,
      },
    } as unknown as PrismaClient;
    const repository = new PrismaContactRelationshipRepository(prisma);
    const relationship = ContactRelationship.create({
      requesterId: 'user-requester',
      recipientId: 'user-recipient',
    });

    const execution = repository.save(relationship);

    await expect(execution).rejects.toBe(persistenceFailure);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('rejects an unsupported persisted relationship status', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'relationship-unsupported',
      requesterId: 'user-requester',
      recipientId: 'user-recipient',
      status: 'unsupported',
    });
    const prisma = {
      contactRelationship: {
        findFirst,
      },
    } as unknown as PrismaClient;
    const repository = new PrismaContactRelationshipRepository(prisma);

    const execution = repository.findCurrentByUserPair(
      'user-requester',
      'user-recipient',
    );

    await expect(execution).rejects.toThrow(
      'Unsupported persisted ContactRelationship status.',
    );
  });

  it.each([
    {
      missing: 'the removing user',
      removedByUserId: null,
      removedAt: new Date('2026-11-12T00:00:00.000Z'),
    },
    {
      missing: 'the removal time',
      removedByUserId: 'user-original-requester',
      removedAt: null,
    },
    {
      missing: 'both the removing user and the removal time',
      removedByUserId: null,
      removedAt: null,
    },
  ])(
    'rejects a persisted removed relationship that lacks $missing',
    async ({ removedByUserId, removedAt }) => {
      const findUnique = jest.fn().mockResolvedValue({
        id: 'relationship-removed-incomplete',
        requesterId: 'user-original-requester',
        recipientId: 'user-original-recipient',
        status: 'removed',
        removedByUserId,
        removedAt,
      });
      const prisma = {
        contactRelationship: {
          findUnique,
        },
      } as unknown as PrismaClient;
      const repository = new PrismaContactRelationshipRepository(prisma);

      const execution = repository.findById('relationship-removed-incomplete');

      await expect(execution).rejects.toThrow(
        'Persisted removed ContactRelationship lacks its removal details.',
      );
    },
  );

  it('finds pending relationships created by the requester in ascending identifier order limited to take', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'relationship-a',
        requesterId: 'user-requester',
        recipientId: 'user-recipient-a',
        status: 'pending',
      },
      {
        id: 'relationship-b',
        requesterId: 'user-requester',
        recipientId: 'user-recipient-b',
        status: 'pending',
      },
    ]);
    const prisma = {
      contactRelationship: {
        findMany,
      },
    } as unknown as PrismaClient;
    const repository = new PrismaContactRelationshipRepository(prisma);

    const found = await repository.findPendingByRequester({
      requesterId: 'user-requester',
      take: 21,
    });

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: { requesterId: 'user-requester', status: 'pending' },
      orderBy: { id: 'asc' },
      take: 21,
    });
    expect(found.map((relationship) => relationship.id)).toEqual([
      'relationship-a',
      'relationship-b',
    ]);
    expect(found.map((relationship) => relationship.recipientId)).toEqual([
      'user-recipient-a',
      'user-recipient-b',
    ]);
    expect(found.every((relationship) => relationship.isPending())).toBe(true);
  });

  it('continues pending relationships created by the requester strictly after the given identifier', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      contactRelationship: {
        findMany,
      },
    } as unknown as PrismaClient;
    const repository = new PrismaContactRelationshipRepository(prisma);

    await repository.findPendingByRequester({
      requesterId: 'user-requester',
      take: 21,
      afterRelationshipId: 'relationship-b',
    });

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        requesterId: 'user-requester',
        status: 'pending',
        id: { gt: 'relationship-b' },
      },
      orderBy: { id: 'asc' },
      take: 21,
    });
  });

  it('passes the accepted, either-direction, identifier-ordered, take-limited query to Prisma and maps the returned records', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'relationship-a',
        requesterId: 'user-actor',
        recipientId: 'user-contact-a',
        status: 'accepted',
      },
      {
        id: 'relationship-b',
        requesterId: 'user-contact-b',
        recipientId: 'user-actor',
        status: 'accepted',
      },
    ]);
    const prisma = {
      contactRelationship: {
        findMany,
      },
    } as unknown as PrismaClient;
    const repository = new PrismaContactRelationshipRepository(prisma);

    const found = await repository.findAcceptedByUser({
      userId: 'user-actor',
      take: 21,
    });

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        status: 'accepted',
        OR: [{ recipientId: 'user-actor' }, { requesterId: 'user-actor' }],
      },
      orderBy: { id: 'asc' },
      take: 21,
    });
    expect(found.map((relationship) => relationship.id)).toEqual([
      'relationship-a',
      'relationship-b',
    ]);
    expect(found.every((relationship) => relationship.isAccepted())).toBe(true);
  });

  it('adds the strictly-after identifier condition to the accepted query', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      contactRelationship: {
        findMany,
      },
    } as unknown as PrismaClient;
    const repository = new PrismaContactRelationshipRepository(prisma);

    await repository.findAcceptedByUser({
      userId: 'user-actor',
      take: 21,
      afterRelationshipId: 'relationship-b',
    });

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        status: 'accepted',
        OR: [{ recipientId: 'user-actor' }, { requesterId: 'user-actor' }],
        id: { gt: 'relationship-b' },
      },
      orderBy: { id: 'asc' },
      take: 21,
    });
  });
});
