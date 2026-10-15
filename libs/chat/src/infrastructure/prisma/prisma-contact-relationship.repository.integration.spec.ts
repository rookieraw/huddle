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

  it('returns null when the relationship identifier does not exist', async () => {
    const found = await repository.findById('relationship-missing');

    expect(found).toBeNull();
  });

  it('loads a pending relationship by its identifier from PostgreSQL', async () => {
    const relationship = ContactRelationship.reconstitute({
      id: 'relationship-pending-by-id',
      requesterId: 'user-pending-requester',
      recipientId: 'user-pending-recipient',
      status: 'pending',
    });
    await repository.save(relationship);

    const found = await repository.findById(relationship.id);

    expect(found?.id).toBe(relationship.id);
    expect(found?.requesterId).toBe('user-pending-requester');
    expect(found?.recipientId).toBe('user-pending-recipient');
    expect(found?.isPending()).toBe(true);
  });

  it('loads an accepted relationship by its identifier from PostgreSQL', async () => {
    const relationship = ContactRelationship.reconstitute({
      id: 'relationship-accepted-by-id',
      requesterId: 'user-accepted-requester',
      recipientId: 'user-accepted-recipient',
      status: 'accepted',
    });
    await repository.save(relationship);

    const found = await repository.findById(relationship.id);

    expect(found?.id).toBe(relationship.id);
    expect(found?.requesterId).toBe('user-accepted-requester');
    expect(found?.recipientId).toBe('user-accepted-recipient');
    expect(found?.isAccepted()).toBe(true);
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

  it('persists and reloads a rejected relationship through the pending-only transition', async () => {
    const requesterId = 'user-rejected-requester';
    const recipientId = 'user-rejected-recipient';
    const relationship = ContactRelationship.create({
      requesterId,
      recipientId,
    });
    await repository.save(relationship);
    relationship.reject(recipientId);

    const applied = await repository.transitionFromPending(relationship);
    const found = await repository.findById(relationship.id);

    expect(applied).toBe(true);
    expect(found?.id).toBe(relationship.id);
    expect(found?.requesterId).toBe(requesterId);
    expect(found?.recipientId).toBe(recipientId);
    expect(found?.isRejected()).toBe(true);
  });

  it('persists an accepted relationship through the pending-only transition', async () => {
    const recipientId = 'user-transition-recipient';
    const relationship = ContactRelationship.create({
      requesterId: 'user-transition-requester',
      recipientId,
    });
    await repository.save(relationship);
    relationship.accept(recipientId);

    const applied = await repository.transitionFromPending(relationship);
    const found = await repository.findById(relationship.id);

    expect(applied).toBe(true);
    expect(found?.isAccepted()).toBe(true);
  });

  it('reports not applied and keeps the stored state when the relationship is no longer pending', async () => {
    const recipientId = 'user-stale-recipient';
    const relationship = ContactRelationship.create({
      requesterId: 'user-stale-requester',
      recipientId,
    });
    await repository.save(relationship);
    const staleCopy = ContactRelationship.reconstitute({
      id: relationship.id,
      requesterId: relationship.requesterId,
      recipientId,
      status: 'pending',
    });
    relationship.accept(recipientId);
    await repository.transitionFromPending(relationship);
    staleCopy.reject(recipientId);

    const applied = await repository.transitionFromPending(staleCopy);
    const found = await repository.findById(relationship.id);

    expect(applied).toBe(false);
    expect(found?.isAccepted()).toBe(true);
  });

  it('does not resolve a stale copy or duplicate the current relationship when the pair is re-requested between load and write', async () => {
    const requesterId = 'user-stale-rerequest-requester';
    const recipientId = 'user-stale-rerequest-recipient';
    const original = ContactRelationship.create({ requesterId, recipientId });
    await repository.save(original);
    const staleCopy = ContactRelationship.reconstitute({
      id: original.id,
      requesterId,
      recipientId,
      status: 'pending',
    });
    original.reject(recipientId);
    await repository.transitionFromPending(original);
    const reRequest = ContactRelationship.create({
      requesterId,
      recipientId,
    });
    await repository.save(reRequest);
    staleCopy.accept(recipientId);

    const applied = await repository.transitionFromPending(staleCopy);

    const rows = await prisma.contactRelationship.findMany({
      orderBy: { id: 'asc' },
    });
    const current = await repository.findCurrentByUserPair(
      requesterId,
      recipientId,
    );
    expect(applied).toBe(false);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.id === original.id)?.status).toBe('rejected');
    expect(rows.find((row) => row.id === reRequest.id)?.status).toBe('pending');
    expect(current?.id).toBe(reRequest.id);
    expect(current?.isPending()).toBe(true);
  });

  it('reports not applied for a relationship that does not exist', async () => {
    const relationship = ContactRelationship.reconstitute({
      id: 'relationship-never-saved',
      requesterId: 'user-missing-requester',
      recipientId: 'user-missing-recipient',
      status: 'pending',
    });
    relationship.reject('user-missing-recipient');

    const applied = await repository.transitionFromPending(relationship);

    expect(applied).toBe(false);
  });

  it('lets exactly one of two concurrent resolutions win and keeps the winning state', async () => {
    const requesterId = 'user-race-requester';
    const recipientId = 'user-race-recipient';
    const created = ContactRelationship.create({ requesterId, recipientId });
    await repository.save(created);
    const accepting = ContactRelationship.reconstitute({
      id: created.id,
      requesterId,
      recipientId,
      status: 'pending',
    });
    const rejecting = ContactRelationship.reconstitute({
      id: created.id,
      requesterId,
      recipientId,
      status: 'pending',
    });
    accepting.accept(recipientId);
    rejecting.reject(recipientId);

    const [acceptApplied, rejectApplied] = await Promise.all([
      repository.transitionFromPending(accepting),
      repository.transitionFromPending(rejecting),
    ]);
    const found = await repository.findById(created.id);

    expect([acceptApplied, rejectApplied].filter(Boolean)).toHaveLength(1);
    expect(found?.isAccepted()).toBe(acceptApplied);
    expect(found?.isRejected()).toBe(rejectApplied);
  });

  it('does not treat a rejected relationship as current and allows a new pending request for the same pair', async () => {
    const requesterId = 'user-rerequest-requester';
    const recipientId = 'user-rerequest-recipient';
    const rejected = ContactRelationship.create({ requesterId, recipientId });
    await repository.save(rejected);
    rejected.reject(recipientId);
    await repository.transitionFromPending(rejected);

    const currentAfterRejection = await repository.findCurrentByUserPair(
      requesterId,
      recipientId,
    );
    const reRequest = ContactRelationship.create({
      requesterId: recipientId,
      recipientId: requesterId,
    });
    await repository.save(reRequest);
    const currentAfterReRequest = await repository.findCurrentByUserPair(
      requesterId,
      recipientId,
    );
    const previous = await repository.findById(rejected.id);

    expect(currentAfterRejection).toBeNull();
    expect(currentAfterReRequest?.id).toBe(reRequest.id);
    expect(currentAfterReRequest?.isPending()).toBe(true);
    expect(previous?.isRejected()).toBe(true);
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
