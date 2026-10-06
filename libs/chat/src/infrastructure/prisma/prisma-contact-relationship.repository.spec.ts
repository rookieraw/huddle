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
});
