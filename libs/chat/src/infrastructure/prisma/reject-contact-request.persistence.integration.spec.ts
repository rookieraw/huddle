import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { PrismaPg } from '@prisma/adapter-pg';
import type { ContactTargetDirectory } from '../../application/ports/contact-target-directory.port';
import { ContactRequestAlreadyAcceptedError } from '../../application/use-cases/accept-contact-request.use-case';
import {
  ContactRequestAlreadyRejectedError,
  ContactRequestRejectionNotAuthorizedError,
  RejectContactRequestUseCase,
} from '../../application/use-cases/reject-contact-request.use-case';
import { SendContactRequestUseCase } from '../../application/use-cases/send-contact-request.use-case';
import { ContactRelationship } from '../../domain/contact-relationship.entity';
import { PrismaClient } from './generated/client';
import { PrismaContactRelationshipRepository } from './prisma-contact-relationship.repository';

const CHAT_PACKAGE_ROOT = resolve(__dirname, '../../..');
const SCHEMA_PATH = './src/infrastructure/prisma/schema.prisma';

function runMigrateDeploy(databaseUrl: string): void {
  execSync(`pnpm exec prisma migrate deploy --schema=${SCHEMA_PATH}`, {
    cwd: CHAT_PACKAGE_ROOT,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
}

describe('RejectContactRequestUseCase with PostgreSQL persistence', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let repository: PrismaContactRelationshipRepository;
  let rejectContactRequest: RejectContactRequestUseCase;
  let sendContactRequest: SendContactRequestUseCase;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    const connectionString = container.getConnectionUri();
    runMigrateDeploy(connectionString);

    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
    repository = new PrismaContactRelationshipRepository(prisma);
    const contactTargetDirectory: ContactTargetDirectory = {
      targetUserExists: jest.fn().mockResolvedValue(true),
    };
    rejectContactRequest = new RejectContactRequestUseCase(repository);
    sendContactRequest = new SendContactRequestUseCase(
      contactTargetDirectory,
      repository,
    );
  }, 60000);

  afterAll(async () => {
    await prisma.$disconnect();
    await container.stop();
  });

  afterEach(async () => {
    await prisma.contactRelationship.deleteMany();
  });

  it('persists the rejected state for the original recipient', async () => {
    const pending = await sendContactRequest.execute({
      requesterId: 'user-requester',
      targetUserId: 'user-recipient',
    });

    const result = await rejectContactRequest.execute({
      rejectingUserId: 'user-recipient',
      relationshipId: pending.id,
    });

    const stored = await prisma.contactRelationship.findUnique({
      where: { id: pending.id },
    });
    expect(result).toMatchObject({
      id: pending.id,
      requesterId: 'user-requester',
      recipientId: 'user-recipient',
    });
    expect(result.isRejected()).toBe(true);
    expect(stored?.status).toBe('rejected');
  });

  it('keeps the relationship pending when the requester tries to reject it', async () => {
    const pending = await sendContactRequest.execute({
      requesterId: 'user-requester',
      targetUserId: 'user-recipient',
    });

    const execution = rejectContactRequest.execute({
      rejectingUserId: 'user-requester',
      relationshipId: pending.id,
    });

    await expect(execution).rejects.toBeInstanceOf(
      ContactRequestRejectionNotAuthorizedError,
    );
    const stored = await prisma.contactRelationship.findUnique({
      where: { id: pending.id },
    });
    expect(stored?.status).toBe('pending');
  });

  it('reports a repeated rejection without changing the stored state', async () => {
    const pending = await sendContactRequest.execute({
      requesterId: 'user-requester',
      targetUserId: 'user-recipient',
    });
    await rejectContactRequest.execute({
      rejectingUserId: 'user-recipient',
      relationshipId: pending.id,
    });

    const execution = rejectContactRequest.execute({
      rejectingUserId: 'user-recipient',
      relationshipId: pending.id,
    });

    await expect(execution).rejects.toBeInstanceOf(
      ContactRequestAlreadyRejectedError,
    );
    const stored = await prisma.contactRelationship.findUnique({
      where: { id: pending.id },
    });
    expect(stored?.status).toBe('rejected');
  });

  it('reports an accepted relationship without changing the stored state', async () => {
    const relationship = ContactRelationship.create({
      requesterId: 'user-requester',
      recipientId: 'user-recipient',
    });
    relationship.accept('user-recipient');
    await repository.save(relationship);

    const execution = rejectContactRequest.execute({
      rejectingUserId: 'user-recipient',
      relationshipId: relationship.id,
    });

    await expect(execution).rejects.toBeInstanceOf(
      ContactRequestAlreadyAcceptedError,
    );
    const stored = await prisma.contactRelationship.findUnique({
      where: { id: relationship.id },
    });
    expect(stored?.status).toBe('accepted');
  });

  it('lets exactly one of two concurrent rejections succeed and reports the other as already rejected', async () => {
    const pending = await sendContactRequest.execute({
      requesterId: 'user-requester',
      targetUserId: 'user-recipient',
    });

    const outcomes = await Promise.allSettled([
      rejectContactRequest.execute({
        rejectingUserId: 'user-recipient',
        relationshipId: pending.id,
      }),
      rejectContactRequest.execute({
        rejectingUserId: 'user-recipient',
        relationshipId: pending.id,
      }),
    ]);

    const fulfilled = outcomes.filter(
      (outcome) => outcome.status === 'fulfilled',
    );
    const rejected = outcomes.filter(
      (outcome) => outcome.status === 'rejected',
    );
    const stored = await prisma.contactRelationship.findUnique({
      where: { id: pending.id },
    });
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(
      ContactRequestAlreadyRejectedError,
    );
    expect(stored?.status).toBe('rejected');
  });

  it('creates a new pending relationship when the same users request again after rejection', async () => {
    const first = await sendContactRequest.execute({
      requesterId: 'user-requester',
      targetUserId: 'user-recipient',
    });
    await rejectContactRequest.execute({
      rejectingUserId: 'user-recipient',
      relationshipId: first.id,
    });

    const second = await sendContactRequest.execute({
      requesterId: 'user-requester',
      targetUserId: 'user-recipient',
    });

    const stored = await prisma.contactRelationship.findMany({
      orderBy: { id: 'asc' },
    });
    expect(second.id).not.toBe(first.id);
    expect(second.isPending()).toBe(true);
    expect(stored).toHaveLength(2);
    expect(stored.find((row) => row.id === first.id)?.status).toBe('rejected');
    expect(stored.find((row) => row.id === second.id)?.status).toBe('pending');
  });
});
