import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { PrismaPg } from '@prisma/adapter-pg';
import type { ContactTargetDirectory } from '../../application/ports/contact-target-directory.port';
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
});
