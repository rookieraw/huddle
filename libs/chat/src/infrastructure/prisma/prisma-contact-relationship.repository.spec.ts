import { ContactRelationship } from '../../domain/contact-relationship.entity';
import { PrismaClient } from './generated/client';
import { PrismaContactRelationshipRepository } from './prisma-contact-relationship.repository';

describe('PrismaContactRelationshipRepository', () => {
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
});
