import type {
  ContactRelationshipRepository,
  FindAcceptedByUserQuery,
  FindPendingByRecipientQuery,
  FindPendingByRequesterQuery,
} from '../../application/ports/contact-relationship.repository.port';
import { ContactRelationship } from '../../domain/contact-relationship.entity';
import { PrismaClient } from './generated/client';

type ContactRelationshipRecord = {
  id: string;
  requesterId: string;
  recipientId: string;
  status: string;
  removedByUserId: string | null;
  removedAt: Date | null;
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

  async findById(relationshipId: string): Promise<ContactRelationship | null> {
    const record = await this.prisma.contactRelationship.findUnique({
      where: { id: relationshipId },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findCurrentByUserPair(
    firstUserId: string,
    secondUserId: string,
  ): Promise<ContactRelationship | null> {
    const record = await this.prisma.contactRelationship.findFirst({
      where: {
        status: { in: ['pending', 'accepted'] },
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

  async findAcceptedByUser(
    query: FindAcceptedByUserQuery,
  ): Promise<ContactRelationship[]> {
    const records = await this.prisma.contactRelationship.findMany({
      where: {
        status: 'accepted',
        OR: [{ recipientId: query.userId }, { requesterId: query.userId }],
        ...(query.afterRelationshipId !== undefined && {
          id: { gt: query.afterRelationshipId },
        }),
      },
      orderBy: { id: 'asc' },
      take: query.take,
    });

    return records.map((record) => this.toDomain(record));
  }

  async findPendingByRecipient(
    query: FindPendingByRecipientQuery,
  ): Promise<ContactRelationship[]> {
    const records = await this.prisma.contactRelationship.findMany({
      where: {
        recipientId: query.recipientId,
        status: 'pending',
        ...(query.afterRelationshipId !== undefined && {
          id: { gt: query.afterRelationshipId },
        }),
      },
      orderBy: { id: 'asc' },
      take: query.take,
    });

    return records.map((record) => this.toDomain(record));
  }

  async findPendingByRequester(
    query: FindPendingByRequesterQuery,
  ): Promise<ContactRelationship[]> {
    const records = await this.prisma.contactRelationship.findMany({
      where: {
        requesterId: query.requesterId,
        status: 'pending',
        ...(query.afterRelationshipId !== undefined && {
          id: { gt: query.afterRelationshipId },
        }),
      },
      orderBy: { id: 'asc' },
      take: query.take,
    });

    return records.map((record) => this.toDomain(record));
  }

  async save(relationship: ContactRelationship): Promise<ContactRelationship> {
    const status = this.toPersistenceStatus(relationship);

    try {
      return await this.upsert(relationship, status);
    } catch (error) {
      if (!this.isCurrentUserPairCollision(error)) {
        throw error;
      }

      const winner = await this.findCurrentByUserPair(
        relationship.requesterId,
        relationship.recipientId,
      );

      if (winner) {
        return winner;
      }

      // The current relationship ended, for example by removal, between the
      // collision and the lookup, so the pair is free again.
      return this.upsert(relationship, status);
    }
  }

  private async upsert(
    relationship: ContactRelationship,
    status: 'pending' | 'accepted' | 'rejected',
  ): Promise<ContactRelationship> {
    const record = await this.prisma.contactRelationship.upsert({
      where: { id: relationship.id },
      create: {
        id: relationship.id,
        requesterId: relationship.requesterId,
        recipientId: relationship.recipientId,
        status,
      },
      update: {
        requesterId: relationship.requesterId,
        recipientId: relationship.recipientId,
        status,
      },
    });

    return this.toDomain(record);
  }

  async transitionFromPending(
    relationship: ContactRelationship,
  ): Promise<boolean> {
    if (!relationship.isAccepted() && !relationship.isRejected()) {
      throw new Error(
        'Only a resolved ContactRelationship can be transitioned from pending.',
      );
    }

    const result = await this.prisma.contactRelationship.updateMany({
      where: { id: relationship.id, status: 'pending' },
      data: { status: this.toPersistenceStatus(relationship) },
    });

    return result.count === 1;
  }

  async transitionFromAccepted(
    relationship: ContactRelationship,
  ): Promise<boolean> {
    if (!relationship.isRemoved()) {
      throw new Error(
        'Only a removed ContactRelationship can be transitioned from accepted.',
      );
    }

    const result = await this.prisma.contactRelationship.updateMany({
      where: { id: relationship.id, status: 'accepted' },
      data: {
        status: 'removed',
        removedByUserId: relationship.removedByUserId,
        removedAt: relationship.removedAt,
      },
    });

    return result.count === 1;
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
    if (
      record.status !== 'pending' &&
      record.status !== 'accepted' &&
      record.status !== 'rejected' &&
      record.status !== 'removed'
    ) {
      throw new Error('Unsupported persisted ContactRelationship status.');
    }

    if (
      record.status === 'removed' &&
      (record.removedByUserId === null || record.removedAt === null)
    ) {
      throw new Error(
        'Persisted removed ContactRelationship lacks its removal details.',
      );
    }

    return ContactRelationship.reconstitute({
      id: record.id,
      requesterId: record.requesterId,
      recipientId: record.recipientId,
      status: record.status,
      removedByUserId: record.removedByUserId,
      removedAt: record.removedAt,
    });
  }

  private toPersistenceStatus(
    relationship: ContactRelationship,
  ): 'pending' | 'accepted' | 'rejected' {
    if (relationship.isPending()) {
      return 'pending';
    }

    if (relationship.isAccepted()) {
      return 'accepted';
    }

    if (relationship.isRejected()) {
      return 'rejected';
    }

    throw new Error('Unsupported ContactRelationship status.');
  }
}
