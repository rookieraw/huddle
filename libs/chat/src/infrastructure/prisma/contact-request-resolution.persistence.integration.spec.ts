import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { PrismaPg } from '@prisma/adapter-pg';
import type { ContactRelationshipRepository } from '../../application/ports/contact-relationship.repository.port';
import type { ContactTargetDirectory } from '../../application/ports/contact-target-directory.port';
import {
  AcceptContactRequestUseCase,
  ContactRequestAcceptanceNotAuthorizedError,
} from '../../application/use-cases/accept-contact-request.use-case';
import {
  ContactRequestAlreadyAcceptedError,
  ContactRequestAlreadyRejectedError,
} from '../../application/use-cases/contact-request.errors';
import {
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

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function withTimeout(
  promise: Promise<void>,
  milliseconds: number,
  message: string,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), milliseconds);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

class LoadBarrierContactRelationshipRepository implements ContactRelationshipRepository {
  private completedLoads = 0;
  private findByIdCalls = 0;
  private readonly allLoaded = createDeferred();

  constructor(
    private readonly realRepository: ContactRelationshipRepository,
    private readonly parties = 2,
  ) {}

  get findByIdCallCount(): number {
    return this.findByIdCalls;
  }

  async findById(relationshipId: string): Promise<ContactRelationship | null> {
    this.findByIdCalls += 1;
    const relationship = await this.realRepository.findById(relationshipId);

    if (this.completedLoads < this.parties) {
      this.completedLoads += 1;

      if (this.completedLoads === this.parties) {
        this.allLoaded.resolve();
      }

      await withTimeout(
        this.allLoaded.promise,
        5000,
        'Not every concurrent caller loaded the relationship.',
      );
    }

    return relationship;
  }

  findCurrentByUserPair(
    firstUserId: string,
    secondUserId: string,
  ): Promise<ContactRelationship | null> {
    return this.realRepository.findCurrentByUserPair(firstUserId, secondUserId);
  }

  save(relationship: ContactRelationship): Promise<ContactRelationship> {
    return this.realRepository.save(relationship);
  }

  transitionFromPending(relationship: ContactRelationship): Promise<boolean> {
    return this.realRepository.transitionFromPending(relationship);
  }
}

describe('Contact request resolution with PostgreSQL persistence', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let repository: PrismaContactRelationshipRepository;
  let acceptContactRequest: AcceptContactRequestUseCase;
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

  describe('rejection', () => {
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

      const barrierRepository = new LoadBarrierContactRelationshipRepository(
        repository,
      );
      const racingReject = new RejectContactRequestUseCase(barrierRepository);

      const outcomes = await Promise.allSettled([
        racingReject.execute({
          rejectingUserId: 'user-recipient',
          relationshipId: pending.id,
        }),
        racingReject.execute({
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
      expect(barrierRepository.findByIdCallCount).toBe(3);
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
      expect(stored.find((row) => row.id === first.id)?.status).toBe(
        'rejected',
      );
      expect(stored.find((row) => row.id === second.id)?.status).toBe(
        'pending',
      );
    });
  });

  describe('acceptance', () => {
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

      const barrierRepository = new LoadBarrierContactRelationshipRepository(
        repository,
      );
      const racingAccept = new AcceptContactRequestUseCase(barrierRepository);

      const outcomes = await Promise.allSettled([
        racingAccept.execute({
          acceptingUserId: 'user-recipient',
          relationshipId: pending.id,
        }),
        racingAccept.execute({
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
      expect(barrierRepository.findByIdCallCount).toBe(3);
    });
  });

  describe('concurrent acceptance and rejection', () => {
    it('lets exactly one of a concurrent acceptance and rejection win and reports the winner state to the loser', async () => {
      const pending = await sendContactRequest.execute({
        requesterId: 'user-requester',
        targetUserId: 'user-recipient',
      });

      const barrierRepository = new LoadBarrierContactRelationshipRepository(
        repository,
      );
      const racingAccept = new AcceptContactRequestUseCase(barrierRepository);
      const racingReject = new RejectContactRequestUseCase(barrierRepository);

      const [acceptOutcome, rejectOutcome] = await Promise.allSettled([
        racingAccept.execute({
          acceptingUserId: 'user-recipient',
          relationshipId: pending.id,
        }),
        racingReject.execute({
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
      expect(barrierRepository.findByIdCallCount).toBe(3);
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
});
