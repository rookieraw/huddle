import type { ContactRelationshipRepository } from '../../application/ports/contact-relationship.repository.port';
import { ContactRelationship } from '../../domain/contact-relationship.entity';
import { PrismaClient } from './generated/client';

type ContactRelationshipRecord = {
  id: string;
  requesterId: string;
  recipientId: string;
  status: string;
};

const CURRENT_USER_PAIR_CONSTRAINT =
  'contact_relationships_current_user_pair_key';

type PrismaUniqueConstraintError = {
  code?: unknown;
  meta?: {
    modelName?: unknown;
    driverAdapterError?: {
      name?: unknown;
      cause?: {
        kind?: unknown;
        originalCode?: unknown;
        originalMessage?: unknown;
      };
    };
  };
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

  async save(relationship: ContactRelationship): Promise<ContactRelationship> {
    try {
      const record = await this.prisma.contactRelationship.upsert({
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

      return this.toDomain(record);
    } catch (error) {
      if (!this.isCurrentUserPairCollision(error)) {
        throw error;
      }

      const winner = await this.findCurrentByUserPair(
        relationship.requesterId,
        relationship.recipientId,
      );

      if (!winner) {
        throw error;
      }

      return winner;
    }
  }

  private isCurrentUserPairCollision(error: unknown): boolean {
    const candidate = error as PrismaUniqueConstraintError;
    const driverError = candidate?.meta?.driverAdapterError;
    const driverCause = driverError?.cause;

    return (
      candidate?.code === 'P2002' &&
      candidate.meta?.modelName === 'ContactRelationship' &&
      driverError?.name === 'DriverAdapterError' &&
      driverCause?.kind === 'UniqueConstraintViolation' &&
      driverCause.originalCode === '23505' &&
      typeof driverCause.originalMessage === 'string' &&
      driverCause.originalMessage.includes(
        `unique constraint "${CURRENT_USER_PAIR_CONSTRAINT}"`,
      )
    );
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
