import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { PrismaPg } from '@prisma/adapter-pg';
import type { ContactRelationshipRepository } from '../../application/ports/contact-relationship.repository.port';
import type { ContactTargetDirectory } from '../../application/ports/contact-target-directory.port';
import { SendContactRequestUseCase } from '../../application/use-cases/send-contact-request.use-case';
import type { ContactRelationship } from '../../domain/contact-relationship.entity';
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

class SaveBarrierContactRelationshipRepository implements ContactRelationshipRepository {
  private absentLookups = 0;
  private blockedSaves = 0;
  private readonly bothSavesBlocked = createDeferred();
  private readonly savesReleased = createDeferred();

  constructor(private readonly realRepository: ContactRelationshipRepository) {}

  get absentLookupCount(): number {
    return this.absentLookups;
  }

  get blockedSaveCount(): number {
    return this.blockedSaves;
  }

  async findCurrentByUserPair(
    firstUserId: string,
    secondUserId: string,
  ): Promise<ContactRelationship | null> {
    const relationship = await this.realRepository.findCurrentByUserPair(
      firstUserId,
      secondUserId,
    );

    if (!relationship) {
      this.absentLookups += 1;
    }

    return relationship;
  }

  async save(relationship: ContactRelationship): Promise<ContactRelationship> {
    this.blockedSaves += 1;

    if (this.blockedSaves === 2) {
      this.bothSavesBlocked.resolve();
    }

    await this.savesReleased.promise;

    return this.realRepository.save(relationship);
  }

  async waitUntilBothSavesAreBlocked(): Promise<void> {
    await this.bothSavesBlocked.promise;
  }

  releaseSaves(): void {
    this.savesReleased.resolve();
  }
}

describe('SendContactRequestUseCase with PostgreSQL persistence', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let repository: PrismaContactRelationshipRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    const connectionString = container.getConnectionUri();
    runMigrateDeploy(connectionString);

    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
    repository = new PrismaContactRelationshipRepository(prisma);
  }, 60000);

  afterAll(async () => {
    await prisma.$disconnect();
    await container.stop();
  });

  afterEach(async () => {
    await prisma.contactRelationship.deleteMany();
  });

  it('reuses one persisted relationship for sequential same-direction requests', async () => {
    const contactTargetDirectory: ContactTargetDirectory = {
      targetUserExists: jest.fn().mockResolvedValue(true),
    };
    const useCase = new SendContactRequestUseCase(
      contactTargetDirectory,
      repository,
    );

    const firstResult = await useCase.execute({
      requesterId: 'user-requester',
      targetUserId: 'user-recipient',
    });
    const duplicateResult = await useCase.execute({
      requesterId: 'user-requester',
      targetUserId: 'user-recipient',
    });

    const persistedRelationships = await prisma.contactRelationship.findMany();

    expect(persistedRelationships).toHaveLength(1);
    const expectedRelationship = {
      id: persistedRelationships[0].id,
      requesterId: 'user-requester',
      recipientId: 'user-recipient',
    };
    expect(firstResult).toMatchObject(expectedRelationship);
    expect(duplicateResult).toMatchObject(expectedRelationship);
  });

  it('preserves persisted roles for sequential opposing requests', async () => {
    const contactTargetDirectory: ContactTargetDirectory = {
      targetUserExists: jest.fn().mockResolvedValue(true),
    };
    const useCase = new SendContactRequestUseCase(
      contactTargetDirectory,
      repository,
    );

    const firstResult = await useCase.execute({
      requesterId: 'user-requester',
      targetUserId: 'user-recipient',
    });
    const opposingResult = await useCase.execute({
      requesterId: 'user-recipient',
      targetUserId: 'user-requester',
    });

    const persistedRelationships = await prisma.contactRelationship.findMany();

    expect(persistedRelationships).toHaveLength(1);
    const expectedRelationship = {
      id: persistedRelationships[0].id,
      requesterId: 'user-requester',
      recipientId: 'user-recipient',
    };
    expect(firstResult).toMatchObject(expectedRelationship);
    expect(opposingResult).toMatchObject(expectedRelationship);
  });

  it('converges genuinely concurrent same-direction requests', async () => {
    const contactTargetDirectory: ContactTargetDirectory = {
      targetUserExists: jest.fn().mockResolvedValue(true),
    };
    const saveBarrierRepository = new SaveBarrierContactRelationshipRepository(
      repository,
    );
    const useCase = new SendContactRequestUseCase(
      contactTargetDirectory,
      saveBarrierRepository,
    );
    let firstCompleted = false;
    let secondCompleted = false;

    const firstExecution = useCase
      .execute({
        requesterId: 'user-requester',
        targetUserId: 'user-recipient',
      })
      .finally(() => {
        firstCompleted = true;
      });
    const secondExecution = useCase
      .execute({
        requesterId: 'user-requester',
        targetUserId: 'user-recipient',
      })
      .finally(() => {
        secondCompleted = true;
      });

    await saveBarrierRepository.waitUntilBothSavesAreBlocked();

    expect(saveBarrierRepository.absentLookupCount).toBe(2);
    expect(saveBarrierRepository.blockedSaveCount).toBe(2);
    expect(firstCompleted).toBe(false);
    expect(secondCompleted).toBe(false);

    saveBarrierRepository.releaseSaves();

    const [firstResult, secondResult] = await Promise.all([
      firstExecution,
      secondExecution,
    ]);
    const persistedRelationships = await prisma.contactRelationship.findMany();

    expect(persistedRelationships).toHaveLength(1);
    const expectedRelationship = {
      id: persistedRelationships[0].id,
      requesterId: 'user-requester',
      recipientId: 'user-recipient',
    };
    expect(firstResult).toMatchObject(expectedRelationship);
    expect(secondResult).toMatchObject(expectedRelationship);
  });

  it('converges genuinely concurrent opposing requests', async () => {
    const contactTargetDirectory: ContactTargetDirectory = {
      targetUserExists: jest.fn().mockResolvedValue(true),
    };
    const saveBarrierRepository = new SaveBarrierContactRelationshipRepository(
      repository,
    );
    const useCase = new SendContactRequestUseCase(
      contactTargetDirectory,
      saveBarrierRepository,
    );
    let firstCompleted = false;
    let secondCompleted = false;

    const firstExecution = useCase
      .execute({
        requesterId: 'user-first',
        targetUserId: 'user-second',
      })
      .finally(() => {
        firstCompleted = true;
      });
    const secondExecution = useCase
      .execute({
        requesterId: 'user-second',
        targetUserId: 'user-first',
      })
      .finally(() => {
        secondCompleted = true;
      });

    await saveBarrierRepository.waitUntilBothSavesAreBlocked();

    expect(saveBarrierRepository.absentLookupCount).toBe(2);
    expect(saveBarrierRepository.blockedSaveCount).toBe(2);
    expect(firstCompleted).toBe(false);
    expect(secondCompleted).toBe(false);

    saveBarrierRepository.releaseSaves();

    const [firstResult, secondResult] = await Promise.all([
      firstExecution,
      secondExecution,
    ]);
    const persistedRelationships = await prisma.contactRelationship.findMany();

    expect(persistedRelationships).toHaveLength(1);
    expect([
      {
        requesterId: 'user-first',
        recipientId: 'user-second',
      },
      {
        requesterId: 'user-second',
        recipientId: 'user-first',
      },
    ]).toContainEqual({
      requesterId: persistedRelationships[0].requesterId,
      recipientId: persistedRelationships[0].recipientId,
    });
    const expectedRelationship = {
      id: persistedRelationships[0].id,
      requesterId: persistedRelationships[0].requesterId,
      recipientId: persistedRelationships[0].recipientId,
    };
    expect(firstResult).toMatchObject(expectedRelationship);
    expect(secondResult).toMatchObject(expectedRelationship);
  });
});
