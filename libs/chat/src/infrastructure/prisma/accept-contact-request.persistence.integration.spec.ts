import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { PrismaPg } from '@prisma/adapter-pg';
import type { ContactTargetDirectory } from '../../application/ports/contact-target-directory.port';
import {
  AcceptContactRequestUseCase,
  ContactRequestAcceptanceNotAuthorizedError,
} from '../../application/use-cases/accept-contact-request.use-case';
import {
  ContactRequestAlreadyAcceptedError,
  ContactRequestAlreadyRejectedError,
} from '../../application/use-cases/contact-request.errors';
import { RejectContactRequestUseCase } from '../../application/use-cases/reject-contact-request.use-case';
import { SendContactRequestUseCase } from '../../application/use-cases/send-contact-request.use-case';
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

describe('AcceptContactRequestUseCase with PostgreSQL persistence', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let acceptContactRequest: AcceptContactRequestUseCase;
  let rejectContactRequest: RejectContactRequestUseCase;
  let sendContactRequest: SendContactRequestUseCase;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    const connectionString = container.getConnectionUri();
    runMigrateDeploy(connectionString);

    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
    const repository = new PrismaContactRelationshipRepository(prisma);
    const contactTargetDirectory: ContactTargetDirectory = {
      targetUserExists: jest.fn().mockResolvedValue(true),
    };
    acceptContactRequest = new AcceptContactRequestUseCase(repository);
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

  it('persists the accepted state for the original recipient', async () => {
    const pending = await sendContactRequest.execute({
      requesterId: 'user-requester',
      targetUserId: 'user-recipient',
    });

    const result = await acceptContactRequest.execute({
      acceptingUserId: 'user-recipient',
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
    expect(result.isAccepted()).toBe(true);
    expect(stored?.status).toBe('accepted');
  });

  it('keeps the relationship pending when the requester tries to accept it', async () => {
    const pending = await sendContactRequest.execute({
      requesterId: 'user-requester',
      targetUserId: 'user-recipient',
    });

    const execution = acceptContactRequest.execute({
      acceptingUserId: 'user-requester',
      relationshipId: pending.id,
    });

    await expect(execution).rejects.toBeInstanceOf(
      ContactRequestAcceptanceNotAuthorizedError,
    );
    const stored = await prisma.contactRelationship.findUnique({
      where: { id: pending.id },
    });
    expect(stored?.status).toBe('pending');
  });

  it('reports a repeated acceptance without changing the stored state', async () => {
    const pending = await sendContactRequest.execute({
      requesterId: 'user-requester',
      targetUserId: 'user-recipient',
    });
    await acceptContactRequest.execute({
      acceptingUserId: 'user-recipient',
      relationshipId: pending.id,
    });

    const execution = acceptContactRequest.execute({
      acceptingUserId: 'user-recipient',
      relationshipId: pending.id,
    });

    await expect(execution).rejects.toBeInstanceOf(
      ContactRequestAlreadyAcceptedError,
    );
    const stored = await prisma.contactRelationship.findUnique({
      where: { id: pending.id },
    });
    expect(stored?.status).toBe('accepted');
  });

  it('reports a rejected relationship without changing the stored state', async () => {
    const pending = await sendContactRequest.execute({
      requesterId: 'user-requester',
      targetUserId: 'user-recipient',
    });
    await rejectContactRequest.execute({
      rejectingUserId: 'user-recipient',
      relationshipId: pending.id,
    });

    const execution = acceptContactRequest.execute({
      acceptingUserId: 'user-recipient',
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

  it('lets exactly one of two concurrent acceptances succeed and reports the other as already accepted', async () => {
    const pending = await sendContactRequest.execute({
      requesterId: 'user-requester',
      targetUserId: 'user-recipient',
    });

    const outcomes = await Promise.allSettled([
      acceptContactRequest.execute({
        acceptingUserId: 'user-recipient',
        relationshipId: pending.id,
      }),
      acceptContactRequest.execute({
        acceptingUserId: 'user-recipient',
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
      ContactRequestAlreadyAcceptedError,
    );
    expect(stored?.status).toBe('accepted');
  });

  it('lets exactly one of a concurrent acceptance and rejection win and reports the winner state to the loser', async () => {
    const pending = await sendContactRequest.execute({
      requesterId: 'user-requester',
      targetUserId: 'user-recipient',
    });

    const [acceptOutcome, rejectOutcome] = await Promise.allSettled([
      acceptContactRequest.execute({
        acceptingUserId: 'user-recipient',
        relationshipId: pending.id,
      }),
      rejectContactRequest.execute({
        rejectingUserId: 'user-recipient',
        relationshipId: pending.id,
      }),
    ]);

    const stored = await prisma.contactRelationship.findUnique({
      where: { id: pending.id },
    });
    const acceptWon = acceptOutcome.status === 'fulfilled';
    const rejectWon = rejectOutcome.status === 'fulfilled';
    expect([acceptWon, rejectWon].filter(Boolean)).toHaveLength(1);
    if (acceptWon) {
      expect(stored?.status).toBe('accepted');
      expect(rejectOutcome).toMatchObject({
        status: 'rejected',
        reason: expect.any(ContactRequestAlreadyAcceptedError),
      });
    } else {
      expect(stored?.status).toBe('rejected');
      expect(acceptOutcome).toMatchObject({
        status: 'rejected',
        reason: expect.any(ContactRequestAlreadyRejectedError),
      });
    }
  });
});
