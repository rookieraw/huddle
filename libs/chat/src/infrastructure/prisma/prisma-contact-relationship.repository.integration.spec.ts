import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { PrismaPg } from '@prisma/adapter-pg';
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

describe('PrismaContactRelationshipRepository (integration)', () => {
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

  it('returns null when the user pair has no current relationship', async () => {
    const found = await repository.findCurrentByUserPair(
      'user-first',
      'user-second',
    );

    expect(found).toBeNull();
  });

  it('round-trips a pending relationship through PostgreSQL', async () => {
    const relationship = ContactRelationship.create({
      requesterId: 'user-requester',
      recipientId: 'user-recipient',
    });

    await repository.save(relationship);
    const found = await repository.findCurrentByUserPair(
      'user-requester',
      'user-recipient',
    );

    expect(found?.id).toBe(relationship.id);
    expect(found?.requesterId).toBe('user-requester');
    expect(found?.recipientId).toBe('user-recipient');
    expect(found?.isPending()).toBe(true);
  });

  it('round-trips an accepted relationship through PostgreSQL', async () => {
    const requesterId = 'user-original-requester';
    const recipientId = 'user-original-recipient';
    const relationship = ContactRelationship.create({
      requesterId,
      recipientId,
    });
    relationship.accept(recipientId);

    await repository.save(relationship);
    const found = await repository.findCurrentByUserPair(
      requesterId,
      recipientId,
    );

    expect(found?.id).toBe(relationship.id);
    expect(found?.requesterId).toBe(requesterId);
    expect(found?.recipientId).toBe(recipientId);
    expect(found?.isPending()).toBe(false);
    expect(found?.isAccepted()).toBe(true);
  });

  it('finds the same current relationship when the user pair order is reversed', async () => {
    const relationship = ContactRelationship.create({
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
    });
    await repository.save(relationship);

    const found = await repository.findCurrentByUserPair(
      'user-original-recipient',
      'user-original-requester',
    );

    expect(found?.id).toBe(relationship.id);
    expect(found?.requesterId).toBe('user-original-requester');
    expect(found?.recipientId).toBe('user-original-recipient');
  });

  it('finds an accepted current relationship when the user pair order is reversed', async () => {
    const requesterId = 'user-accepted-requester';
    const recipientId = 'user-accepted-recipient';
    const relationship = ContactRelationship.create({
      requesterId,
      recipientId,
    });
    relationship.accept(recipientId);
    await repository.save(relationship);

    const found = await repository.findCurrentByUserPair(
      recipientId,
      requesterId,
    );

    expect(found?.id).toBe(relationship.id);
    expect(found?.requesterId).toBe(requesterId);
    expect(found?.recipientId).toBe(recipientId);
    expect(found?.isAccepted()).toBe(true);
  });

  it('returns the persisted winner for an unordered-pair uniqueness collision', async () => {
    const winner = ContactRelationship.create({
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
    });
    const competingRelationship = ContactRelationship.create({
      requesterId: 'user-original-recipient',
      recipientId: 'user-original-requester',
    });
    await repository.save(winner);

    const result = await repository.save(competingRelationship);

    expect(result).toMatchObject({
      id: winner.id,
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
    });
  });
});
