import type { ContactRelationshipRepository } from '../../application/ports/contact-relationship.repository.port';
import { ContactRelationship } from '../../domain/contact-relationship.entity';
import { PrismaClient } from './generated/client';

type ContactRelationshipRecord = {
  id: string;
  requesterId: string;
  recipientId: string;
  status: string;
};

export class PrismaContactRelationshipRepository implements ContactRelationshipRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findCurrentByUserPair(
    firstUserId: string,
    secondUserId: string,
  ): Promise<ContactRelationship | null> {
    const record = await this.prisma.contactRelationship.findFirst({
      where: {
        status: 'pending',
        OR: [
          {
            requesterId: firstUserId,
            recipientId: secondUserId,
          },
          {
            requesterId: secondUserId,
            recipientId: firstUserId,
          },
        ],
      },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async save(relationship: ContactRelationship): Promise<void> {
    await this.prisma.contactRelationship.upsert({
      where: { id: relationship.id },
      create: {
        id: relationship.id,
        requesterId: relationship.requesterId,
        recipientId: relationship.recipientId,
        status: 'pending',
      },
      update: {
        requesterId: relationship.requesterId,
        recipientId: relationship.recipientId,
        status: 'pending',
      },
    });
  }

  private toDomain(record: ContactRelationshipRecord): ContactRelationship {
    if (record.status !== 'pending') {
      throw new Error('Unsupported persisted ContactRelationship status.');
    }

    return ContactRelationship.reconstitute({
      id: record.id,
      requesterId: record.requesterId,
      recipientId: record.recipientId,
      status: record.status,
    });
  }
}
