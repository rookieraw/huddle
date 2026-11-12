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

  it('persists and reloads a removal with its removing user and time through the accepted-only transition', async () => {
    const requesterId = 'user-removal-requester';
    const recipientId = 'user-removal-recipient';
    const removedAt = new Date('2026-11-11T10:00:00.000Z');
    const relationship = ContactRelationship.create({
      requesterId,
      recipientId,
    });
    await repository.save(relationship);
    relationship.accept(recipientId);
    await repository.transitionFromPending(relationship);
    relationship.remove(recipientId, removedAt);

    const applied = await repository.transitionFromAccepted(relationship);
    const found = await repository.findById(relationship.id);

    expect(applied).toBe(true);
    expect(found?.id).toBe(relationship.id);
    expect(found?.requesterId).toBe(requesterId);
    expect(found?.recipientId).toBe(recipientId);
    expect(found?.isRemoved()).toBe(true);
    expect(found?.removedByUserId).toBe(recipientId);
    expect(found?.removedAt).toEqual(removedAt);
  });

  it.each(['pending', 'rejected', 'removed'])(
    'reports not applied and keeps the stored row when a removal finds it %s',
    async (storedStatus) => {
      const requesterId = 'user-not-accepted-requester';
      const recipientId = 'user-not-accepted-recipient';
      const relationshipId = `relationship-not-accepted-${storedStatus}`;
      const storedRemovedAt = new Date('2026-11-10T09:00:00.000Z');
      const storedRemover = storedStatus === 'removed' ? requesterId : null;
      const storedRemovalTime =
        storedStatus === 'removed' ? storedRemovedAt : null;
      await prisma.contactRelationship.create({
        data: {
          id: relationshipId,
          requesterId,
          recipientId,
          status: storedStatus,
          removedByUserId: storedRemover,
          removedAt: storedRemovalTime,
        },
      });
      const staleCopy = ContactRelationship.reconstitute({
        id: relationshipId,
        requesterId,
        recipientId,
        status: 'accepted',
      });
      staleCopy.remove(recipientId, new Date('2026-11-12T10:00:00.000Z'));

      const applied = await repository.transitionFromAccepted(staleCopy);

      const row = await prisma.contactRelationship.findUnique({
        where: { id: relationshipId },
      });
      expect(applied).toBe(false);
      expect(row?.status).toBe(storedStatus);
      expect(row?.removedByUserId).toBe(storedRemover);
      expect(row?.removedAt).toEqual(storedRemovalTime);
    },
  );

  it('reports not applied when a removal targets a relationship that does not exist', async () => {
    const relationship = ContactRelationship.reconstitute({
      id: 'relationship-removal-never-saved',
      requesterId: 'user-removal-missing-requester',
      recipientId: 'user-removal-missing-recipient',
      status: 'accepted',
    });
    relationship.remove(
      'user-removal-missing-recipient',
      new Date('2026-11-12T10:00:00.000Z'),
    );

    const applied = await repository.transitionFromAccepted(relationship);

    expect(applied).toBe(false);
  });

  it('lets exactly one of two concurrent removals win and keeps the winner as the removing user', async () => {
    const requesterId = 'user-removal-race-requester';
    const recipientId = 'user-removal-race-recipient';
    const accepted = ContactRelationship.create({ requesterId, recipientId });
    accepted.accept(recipientId);
    await repository.save(accepted);
    const requesterRemoval = ContactRelationship.reconstitute({
      id: accepted.id,
      requesterId,
      recipientId,
      status: 'accepted',
    });
    const recipientRemoval = ContactRelationship.reconstitute({
      id: accepted.id,
      requesterId,
      recipientId,
      status: 'accepted',
    });
    requesterRemoval.remove(requesterId, new Date('2026-11-12T10:00:00.000Z'));
    recipientRemoval.remove(recipientId, new Date('2026-11-12T10:00:01.000Z'));

    const [requesterApplied, recipientApplied] = await Promise.all([
      repository.transitionFromAccepted(requesterRemoval),
      repository.transitionFromAccepted(recipientRemoval),
    ]);
    const found = await repository.findById(accepted.id);

    expect([requesterApplied, recipientApplied].filter(Boolean)).toHaveLength(
      1,
    );
    expect(found?.isRemoved()).toBe(true);
    expect(found?.removedByUserId).toBe(
      requesterApplied ? requesterId : recipientId,
    );
  });

  it.each([
    [
      'by the original requester',
      'user-after-removal-a',
      'user-after-removal-b',
    ],
    [
      'by the original recipient',
      'user-after-removal-b',
      'user-after-removal-a',
    ],
  ])(
    'allows a new pending request with a new identity after a removal, %s',
    async (_label, newRequesterId, newRecipientId) => {
      const originalRequesterId = 'user-after-removal-a';
      const originalRecipientId = 'user-after-removal-b';
      const original = ContactRelationship.create({
        requesterId: originalRequesterId,
        recipientId: originalRecipientId,
      });
      original.accept(originalRecipientId);
      await repository.save(original);
      original.remove(
        originalRecipientId,
        new Date('2026-11-12T10:00:00.000Z'),
      );
      await repository.transitionFromAccepted(original);
      const currentAfterRemoval = await repository.findCurrentByUserPair(
        originalRequesterId,
        originalRecipientId,
      );
      const newRequest = ContactRelationship.create({
        requesterId: newRequesterId,
        recipientId: newRecipientId,
      });

      const saved = await repository.save(newRequest);
      const current = await repository.findCurrentByUserPair(
        originalRequesterId,
        originalRecipientId,
      );
      const previous = await repository.findById(original.id);

      expect(currentAfterRemoval).toBeNull();
      expect(saved.id).toBe(newRequest.id);
      expect(saved.id).not.toBe(original.id);
      expect(current?.id).toBe(newRequest.id);
      expect(current?.isPending()).toBe(true);
      expect(previous?.isRemoved()).toBe(true);
    },
  );

  it('keeps at most one current relationship when a removal races a new request for the same pair', async () => {
    const requesterId = 'user-removal-request-race-a';
    const recipientId = 'user-removal-request-race-b';
    const accepted = ContactRelationship.create({ requesterId, recipientId });
    accepted.accept(recipientId);
    await repository.save(accepted);
    accepted.remove(recipientId, new Date('2026-11-12T10:00:00.000Z'));
    const newRequest = ContactRelationship.create({
      requesterId: recipientId,
      recipientId: requesterId,
    });

    const [removalApplied] = await Promise.all([
      repository.transitionFromAccepted(accepted),
      repository.save(newRequest),
    ]);

    const rows = await prisma.contactRelationship.findMany();
    const currentRows = rows.filter(
      (row) => row.status === 'pending' || row.status === 'accepted',
    );
    expect(removalApplied).toBe(true);
    expect(currentRows.length).toBeLessThanOrEqual(1);
    expect(currentRows.every((row) => row.id === newRequest.id)).toBe(true);
    expect(rows.find((row) => row.id === accepted.id)?.status).toBe('removed');
  });

  it('loads a removed relationship by identifier but excludes it from the current-pair, accepted and pending queries', async () => {
    const userId = 'user-removed-excluded';
    const counterpartId = 'user-removed-excluded-counterpart';
    const removedAt = new Date('2026-11-12T10:00:00.000Z');
    const relationship = ContactRelationship.create({
      requesterId: userId,
      recipientId: counterpartId,
    });
    relationship.accept(counterpartId);
    await repository.save(relationship);
    relationship.remove(userId, removedAt);
    await repository.transitionFromAccepted(relationship);

    const byId = await repository.findById(relationship.id);
    const current = await repository.findCurrentByUserPair(
      userId,
      counterpartId,
    );
    const accepted = await repository.findAcceptedByUser({ userId, take: 50 });
    const acceptedForCounterpart = await repository.findAcceptedByUser({
      userId: counterpartId,
      take: 50,
    });
    const pendingByRecipient = await repository.findPendingByRecipient({
      recipientId: counterpartId,
      take: 50,
    });
    const pendingByRequester = await repository.findPendingByRequester({
      requesterId: userId,
      take: 50,
    });

    expect(byId?.isRemoved()).toBe(true);
    expect(byId?.removedByUserId).toBe(userId);
    expect(byId?.removedAt).toEqual(removedAt);
    expect(current).toBeNull();
    expect(accepted).toEqual([]);
    expect(acceptedForCounterpart).toEqual([]);
    expect(pendingByRecipient).toEqual([]);
    expect(pendingByRequester).toEqual([]);
  });

  it('refuses to save a removed relationship and keeps the stored accepted row', async () => {
    const recipientId = 'user-save-removed-recipient';
    const relationship = ContactRelationship.create({
      requesterId: 'user-save-removed-requester',
      recipientId,
    });
    relationship.accept(recipientId);
    await repository.save(relationship);
    relationship.remove(recipientId, new Date('2026-11-12T10:00:00.000Z'));

    const execution = repository.save(relationship);

    await expect(execution).rejects.toThrow(
      'Unsupported ContactRelationship status.',
    );
    const row = await prisma.contactRelationship.findUnique({
      where: { id: relationship.id },
    });
    expect(row?.status).toBe('accepted');
    expect(row?.removedByUserId).toBeNull();
    expect(row?.removedAt).toBeNull();
  });

  it('refuses to transition a removed relationship from pending and keeps the stored pending row', async () => {
    const requesterId = 'user-pending-removed-requester';
    const recipientId = 'user-pending-removed-recipient';
    const stored = ContactRelationship.create({ requesterId, recipientId });
    await repository.save(stored);
    const removedCopy = ContactRelationship.reconstitute({
      id: stored.id,
      requesterId,
      recipientId,
      status: 'accepted',
    });
    removedCopy.remove(recipientId, new Date('2026-11-12T10:00:00.000Z'));

    const execution = repository.transitionFromPending(removedCopy);

    await expect(execution).rejects.toThrow(
      'Only a resolved ContactRelationship can be transitioned from pending.',
    );
    const row = await prisma.contactRelationship.findUnique({
      where: { id: stored.id },
    });
    expect(row?.status).toBe('pending');
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

  it('finds only the pending relationships addressed to the recipient', async () => {
    const recipientId = 'user-listing-recipient';
    const seeded = [
      [
        'relationship-listing-pending-1',
        'user-listing-requester-1',
        recipientId,
        'pending',
      ],
      [
        'relationship-listing-pending-2',
        'user-listing-requester-2',
        recipientId,
        'pending',
      ],
      [
        'relationship-listing-accepted',
        'user-listing-requester-3',
        recipientId,
        'accepted',
      ],
      [
        'relationship-listing-rejected',
        'user-listing-requester-4',
        recipientId,
        'rejected',
      ],
      [
        'relationship-listing-outgoing',
        recipientId,
        'user-listing-other-recipient',
        'pending',
      ],
      [
        'relationship-listing-other',
        'user-listing-requester-1',
        'user-listing-other-recipient',
        'pending',
      ],
    ] as const;
    for (const [id, requesterId, seededRecipientId, status] of seeded) {
      await repository.save(
        ContactRelationship.reconstitute({
          id,
          requesterId,
          recipientId: seededRecipientId,
          status,
        }),
      );
    }

    const found = await repository.findPendingByRecipient({
      recipientId,
      take: 50,
    });

    expect(found.map((relationship) => relationship.id).sort()).toEqual([
      'relationship-listing-pending-1',
      'relationship-listing-pending-2',
    ]);
    expect(
      found.every(
        (relationship) =>
          relationship.isPending() && relationship.recipientId === recipientId,
      ),
    ).toBe(true);
  });

  it('finds pending relationships for the recipient in ascending identifier order regardless of insertion order', async () => {
    const recipientId = 'user-ordering-recipient';
    for (const [id, requesterId] of [
      ['relationship-ordering-c', 'user-ordering-requester-1'],
      ['relationship-ordering-a', 'user-ordering-requester-2'],
      ['relationship-ordering-b', 'user-ordering-requester-3'],
    ]) {
      await repository.save(
        ContactRelationship.reconstitute({
          id,
          requesterId,
          recipientId,
          status: 'pending',
        }),
      );
    }

    const found = await repository.findPendingByRecipient({
      recipientId,
      take: 50,
    });

    expect(found.map((relationship) => relationship.id)).toEqual([
      'relationship-ordering-a',
      'relationship-ordering-b',
      'relationship-ordering-c',
    ]);
  });

  it('finds at most take pending relationships and returns the first ones in identifier order', async () => {
    const recipientId = 'user-take-recipient';
    for (const number of [4, 2, 5, 1, 3]) {
      await repository.save(
        ContactRelationship.reconstitute({
          id: `relationship-take-${number}`,
          requesterId: `user-take-requester-${number}`,
          recipientId,
          status: 'pending',
        }),
      );
    }

    const found = await repository.findPendingByRecipient({
      recipientId,
      take: 3,
    });

    expect(found.map((relationship) => relationship.id)).toEqual([
      'relationship-take-1',
      'relationship-take-2',
      'relationship-take-3',
    ]);
  });

  it('returns exactly 51 of 52 pending relationships in identifier order for the maximum listing lookahead', async () => {
    const recipientId = 'user-bound-recipient';
    const boundId = (number: number) =>
      `relationship-bound-${String(number).padStart(2, '0')}`;
    for (let number = 51; number >= 0; number -= 1) {
      await repository.save(
        ContactRelationship.reconstitute({
          id: boundId(number),
          requesterId: `user-bound-requester-${number}`,
          recipientId,
          status: 'pending',
        }),
      );
    }

    const found = await repository.findPendingByRecipient({
      recipientId,
      take: 51,
    });

    expect(found).toHaveLength(51);
    expect(found.map((relationship) => relationship.id)).toEqual(
      Array.from({ length: 51 }, (_, number) => boundId(number)),
    );
  });

  it('continues after the given identifier and excludes that row, in identifier order', async () => {
    const recipientId = 'user-continuation-recipient';
    for (const number of [3, 1, 4, 2, 5]) {
      await repository.save(
        ContactRelationship.reconstitute({
          id: `relationship-continuation-${number}`,
          requesterId: `user-continuation-requester-${number}`,
          recipientId,
          status: 'pending',
        }),
      );
    }

    const found = await repository.findPendingByRecipient({
      recipientId,
      take: 2,
      afterRelationshipId: 'relationship-continuation-2',
    });

    expect(found.map((relationship) => relationship.id)).toEqual([
      'relationship-continuation-3',
      'relationship-continuation-4',
    ]);
  });

  it.each([
    [
      'a missing row',
      'relationship-gap-2a',
      ['relationship-gap-3', 'relationship-gap-4'],
    ],
    [
      'a resolved row',
      'relationship-gap-2',
      ['relationship-gap-3', 'relationship-gap-4'],
    ],
    [
      "another recipient's row",
      'relationship-gap-0',
      ['relationship-gap-1', 'relationship-gap-3', 'relationship-gap-4'],
    ],
  ])(
    'continues from the id alone when the continuation id is %s',
    async (_label, afterId, expectedIds) => {
      const recipientId = 'user-gap-recipient';
      const seeded = [
        ['relationship-gap-0', 'user-gap-other', 'pending'],
        ['relationship-gap-1', recipientId, 'pending'],
        ['relationship-gap-2', recipientId, 'rejected'],
        ['relationship-gap-3', recipientId, 'pending'],
        ['relationship-gap-4', recipientId, 'pending'],
      ] as const;
      for (const [index, [id, seededRecipientId, status]] of seeded.entries()) {
        await repository.save(
          ContactRelationship.reconstitute({
            id,
            requesterId: `user-gap-requester-${index}`,
            recipientId: seededRecipientId,
            status,
          }),
        );
      }

      const found = await repository.findPendingByRecipient({
        recipientId,
        take: 10,
        afterRelationshipId: afterId,
      });

      expect(found.map((relationship) => relationship.id)).toEqual(expectedIds);
    },
  );

  it('returns an empty list when the recipient has no pending requests', async () => {
    await repository.save(
      ContactRelationship.reconstitute({
        id: 'relationship-empty-accepted',
        requesterId: 'user-empty-requester',
        recipientId: 'user-empty-recipient',
        status: 'accepted',
      }),
    );

    const found = await repository.findPendingByRecipient({
      recipientId: 'user-empty-recipient',
      take: 10,
    });

    expect(found).toEqual([]);
  });

  it('finds only the pending relationships created by the requester', async () => {
    const requesterId = 'user-outgoing-requester';
    const seeded = [
      [
        'relationship-outgoing-pending-1',
        requesterId,
        'user-outgoing-recipient-1',
        'pending',
      ],
      [
        'relationship-outgoing-pending-2',
        requesterId,
        'user-outgoing-recipient-2',
        'pending',
      ],
      [
        'relationship-outgoing-accepted',
        requesterId,
        'user-outgoing-recipient-3',
        'accepted',
      ],
      [
        'relationship-outgoing-rejected',
        requesterId,
        'user-outgoing-recipient-4',
        'rejected',
      ],
      [
        'relationship-outgoing-incoming',
        'user-outgoing-sender',
        requesterId,
        'pending',
      ],
      [
        'relationship-outgoing-other',
        'user-outgoing-other-requester',
        'user-outgoing-recipient-1',
        'pending',
      ],
    ] as const;
    for (const [id, seededRequesterId, recipientId, status] of seeded) {
      await repository.save(
        ContactRelationship.reconstitute({
          id,
          requesterId: seededRequesterId,
          recipientId,
          status,
        }),
      );
    }

    const found = await repository.findPendingByRequester({
      requesterId,
      take: 50,
    });

    expect(found.map((relationship) => relationship.id).sort()).toEqual([
      'relationship-outgoing-pending-1',
      'relationship-outgoing-pending-2',
    ]);
    expect(
      found.every(
        (relationship) =>
          relationship.isPending() && relationship.requesterId === requesterId,
      ),
    ).toBe(true);
  });

  it('finds pending relationships for the requester in ascending identifier order regardless of insertion order', async () => {
    const requesterId = 'user-requester-ordering';
    for (const [id, recipientId] of [
      ['relationship-requester-ordering-c', 'user-requester-ordering-1'],
      ['relationship-requester-ordering-a', 'user-requester-ordering-2'],
      ['relationship-requester-ordering-b', 'user-requester-ordering-3'],
    ]) {
      await repository.save(
        ContactRelationship.reconstitute({
          id,
          requesterId,
          recipientId,
          status: 'pending',
        }),
      );
    }

    const found = await repository.findPendingByRequester({
      requesterId,
      take: 50,
    });

    expect(found.map((relationship) => relationship.id)).toEqual([
      'relationship-requester-ordering-a',
      'relationship-requester-ordering-b',
      'relationship-requester-ordering-c',
    ]);
  });

  it('finds at most take pending relationships for the requester and returns the first ones in identifier order', async () => {
    const requesterId = 'user-requester-take';
    for (const number of [4, 2, 5, 1, 3]) {
      await repository.save(
        ContactRelationship.reconstitute({
          id: `relationship-requester-take-${number}`,
          requesterId,
          recipientId: `user-requester-take-recipient-${number}`,
          status: 'pending',
        }),
      );
    }

    const found = await repository.findPendingByRequester({
      requesterId,
      take: 3,
    });

    expect(found.map((relationship) => relationship.id)).toEqual([
      'relationship-requester-take-1',
      'relationship-requester-take-2',
      'relationship-requester-take-3',
    ]);
  });

  it('returns exactly 51 of 52 pending relationships for the requester in identifier order for the maximum listing lookahead', async () => {
    const requesterId = 'user-requester-bound';
    const boundId = (number: number) =>
      `relationship-requester-bound-${String(number).padStart(2, '0')}`;
    for (let number = 51; number >= 0; number -= 1) {
      await repository.save(
        ContactRelationship.reconstitute({
          id: boundId(number),
          requesterId,
          recipientId: `user-requester-bound-recipient-${number}`,
          status: 'pending',
        }),
      );
    }

    const found = await repository.findPendingByRequester({
      requesterId,
      take: 51,
    });

    expect(found).toHaveLength(51);
    expect(found.map((relationship) => relationship.id)).toEqual(
      Array.from({ length: 51 }, (_, number) => boundId(number)),
    );
  });

  it('continues the requester listing after the given identifier and excludes that row, in identifier order', async () => {
    const requesterId = 'user-requester-continuation';
    for (const number of [3, 1, 4, 2, 5]) {
      await repository.save(
        ContactRelationship.reconstitute({
          id: `relationship-requester-continuation-${number}`,
          requesterId,
          recipientId: `user-requester-continuation-recipient-${number}`,
          status: 'pending',
        }),
      );
    }

    const found = await repository.findPendingByRequester({
      requesterId,
      take: 2,
      afterRelationshipId: 'relationship-requester-continuation-2',
    });

    expect(found.map((relationship) => relationship.id)).toEqual([
      'relationship-requester-continuation-3',
      'relationship-requester-continuation-4',
    ]);
  });

  it.each([
    [
      'a missing row',
      'relationship-requester-gap-2a',
      ['relationship-requester-gap-3', 'relationship-requester-gap-4'],
    ],
    [
      'a resolved row',
      'relationship-requester-gap-2',
      ['relationship-requester-gap-3', 'relationship-requester-gap-4'],
    ],
    [
      "another requester's row",
      'relationship-requester-gap-0',
      [
        'relationship-requester-gap-1',
        'relationship-requester-gap-3',
        'relationship-requester-gap-4',
      ],
    ],
  ])(
    'continues the requester listing from the id alone when the continuation id is %s',
    async (_label, afterId, expectedIds) => {
      const requesterId = 'user-requester-gap';
      const seeded = [
        ['relationship-requester-gap-0', 'user-requester-gap-other', 'pending'],
        ['relationship-requester-gap-1', requesterId, 'pending'],
        ['relationship-requester-gap-2', requesterId, 'rejected'],
        ['relationship-requester-gap-3', requesterId, 'pending'],
        ['relationship-requester-gap-4', requesterId, 'pending'],
      ] as const;
      for (const [index, [id, seededRequesterId, status]] of seeded.entries()) {
        await repository.save(
          ContactRelationship.reconstitute({
            id,
            requesterId: seededRequesterId,
            recipientId: `user-requester-gap-recipient-${index}`,
            status,
          }),
        );
      }

      const found = await repository.findPendingByRequester({
        requesterId,
        take: 10,
        afterRelationshipId: afterId,
      });

      expect(found.map((relationship) => relationship.id)).toEqual(expectedIds);
    },
  );

  it('returns an empty list when the requester has no pending requests', async () => {
    await repository.save(
      ContactRelationship.reconstitute({
        id: 'relationship-requester-empty-accepted',
        requesterId: 'user-requester-empty',
        recipientId: 'user-requester-empty-recipient',
        status: 'accepted',
      }),
    );

    const found = await repository.findPendingByRequester({
      requesterId: 'user-requester-empty',
      take: 10,
    });

    expect(found).toEqual([]);
  });

  it('finds the accepted relationship where the user is the recipient and excludes other users relationships', async () => {
    const userId = 'user-accepted-listing-recipient';
    const seeded = [
      [
        'relationship-accepted-listing-as-recipient',
        'user-accepted-listing-requester',
        userId,
      ],
      [
        'relationship-accepted-listing-unrelated',
        'user-accepted-listing-other-requester',
        'user-accepted-listing-other-recipient',
      ],
    ] as const;
    for (const [id, requesterId, recipientId] of seeded) {
      await repository.save(
        ContactRelationship.reconstitute({
          id,
          requesterId,
          recipientId,
          status: 'accepted',
        }),
      );
    }

    const found = await repository.findAcceptedByUser({ userId, take: 50 });

    expect(found.map((relationship) => relationship.id)).toEqual([
      'relationship-accepted-listing-as-recipient',
    ]);
    expect(
      found.every(
        (relationship) =>
          relationship.isAccepted() &&
          relationship.recipientId === userId &&
          relationship.requesterId === 'user-accepted-listing-requester',
      ),
    ).toBe(true);
  });

  it('finds accepted relationships where the user is the requester as well as the recipient', async () => {
    const userId = 'user-accepted-both-directions';
    const seeded = [
      [
        'relationship-accepted-both-as-recipient',
        'user-accepted-both-requester',
        userId,
      ],
      [
        'relationship-accepted-both-as-requester',
        userId,
        'user-accepted-both-recipient',
      ],
      [
        'relationship-accepted-both-unrelated',
        'user-accepted-both-other-requester',
        'user-accepted-both-other-recipient',
      ],
    ] as const;
    for (const [id, requesterId, recipientId] of seeded) {
      await repository.save(
        ContactRelationship.reconstitute({
          id,
          requesterId,
          recipientId,
          status: 'accepted',
        }),
      );
    }

    const found = await repository.findAcceptedByUser({ userId, take: 50 });

    expect(found.map((relationship) => relationship.id).sort()).toEqual([
      'relationship-accepted-both-as-recipient',
      'relationship-accepted-both-as-requester',
    ]);
  });

  it('finds only accepted relationships and excludes the user pending and rejected ones in both directions', async () => {
    const userId = 'user-accepted-only';
    const seeded = [
      [
        'relationship-accepted-only-accepted-as-recipient',
        'user-accepted-only-counterpart-1',
        userId,
        'accepted',
      ],
      [
        'relationship-accepted-only-accepted-as-requester',
        userId,
        'user-accepted-only-counterpart-2',
        'accepted',
      ],
      [
        'relationship-accepted-only-pending-as-recipient',
        'user-accepted-only-counterpart-3',
        userId,
        'pending',
      ],
      [
        'relationship-accepted-only-pending-as-requester',
        userId,
        'user-accepted-only-counterpart-4',
        'pending',
      ],
      [
        'relationship-accepted-only-rejected-as-recipient',
        'user-accepted-only-counterpart-5',
        userId,
        'rejected',
      ],
      [
        'relationship-accepted-only-rejected-as-requester',
        userId,
        'user-accepted-only-counterpart-6',
        'rejected',
      ],
    ] as const;
    for (const [id, requesterId, recipientId, status] of seeded) {
      await repository.save(
        ContactRelationship.reconstitute({
          id,
          requesterId,
          recipientId,
          status,
        }),
      );
    }

    const found = await repository.findAcceptedByUser({ userId, take: 50 });

    expect(found.map((relationship) => relationship.id).sort()).toEqual([
      'relationship-accepted-only-accepted-as-recipient',
      'relationship-accepted-only-accepted-as-requester',
    ]);
  });

  it('finds accepted relationships in ascending identifier order across both directions regardless of insertion order', async () => {
    const userId = 'user-accepted-ordering';
    const seeded = [
      [
        'relationship-accepted-ordering-c',
        'user-accepted-ordering-counterpart-1',
        userId,
      ],
      [
        'relationship-accepted-ordering-a',
        userId,
        'user-accepted-ordering-counterpart-2',
      ],
      [
        'relationship-accepted-ordering-d',
        userId,
        'user-accepted-ordering-counterpart-3',
      ],
      [
        'relationship-accepted-ordering-b',
        'user-accepted-ordering-counterpart-4',
        userId,
      ],
    ] as const;
    for (const [id, requesterId, recipientId] of seeded) {
      await repository.save(
        ContactRelationship.reconstitute({
          id,
          requesterId,
          recipientId,
          status: 'accepted',
        }),
      );
    }

    const found = await repository.findAcceptedByUser({ userId, take: 50 });

    expect(found.map((relationship) => relationship.id)).toEqual([
      'relationship-accepted-ordering-a',
      'relationship-accepted-ordering-b',
      'relationship-accepted-ordering-c',
      'relationship-accepted-ordering-d',
    ]);
  });

  it('finds at most take accepted relationships across both directions and returns the first ones in identifier order', async () => {
    const userId = 'user-accepted-take';
    for (let index = 1; index <= 5; index += 1) {
      const id = `relationship-accepted-take-${index}`;
      const counterpartId = `user-accepted-take-counterpart-${index}`;
      await repository.save(
        ContactRelationship.reconstitute({
          id,
          requesterId: index % 2 === 0 ? userId : counterpartId,
          recipientId: index % 2 === 0 ? counterpartId : userId,
          status: 'accepted',
        }),
      );
    }

    const found = await repository.findAcceptedByUser({ userId, take: 3 });

    expect(found.map((relationship) => relationship.id)).toEqual([
      'relationship-accepted-take-1',
      'relationship-accepted-take-2',
      'relationship-accepted-take-3',
    ]);
  });

  it('returns exactly 51 of 52 accepted relationships of the user in identifier order across both directions for the maximum listing lookahead', async () => {
    const userId = 'user-accepted-bound';
    const boundId = (number: number) =>
      `relationship-accepted-bound-${String(number).padStart(2, '0')}`;
    for (let number = 51; number >= 0; number -= 1) {
      await repository.save(
        ContactRelationship.reconstitute({
          id: boundId(number),
          requesterId:
            number % 2 === 0
              ? userId
              : `user-accepted-bound-counterpart-${number}`,
          recipientId:
            number % 2 === 0
              ? `user-accepted-bound-counterpart-${number}`
              : userId,
          status: 'accepted',
        }),
      );
    }

    const found = await repository.findAcceptedByUser({ userId, take: 51 });

    expect(found).toHaveLength(51);
    expect(found.map((relationship) => relationship.id)).toEqual(
      Array.from({ length: 51 }, (_, number) => boundId(number)),
    );
  });

  it('continues the accepted listing after the given identifier across both directions and excludes that row, in identifier order', async () => {
    const userId = 'user-accepted-continuation';
    for (let index = 1; index <= 5; index += 1) {
      const counterpartId = `user-accepted-continuation-counterpart-${index}`;
      await repository.save(
        ContactRelationship.reconstitute({
          id: `relationship-accepted-continuation-${index}`,
          requesterId: index % 2 === 0 ? userId : counterpartId,
          recipientId: index % 2 === 0 ? counterpartId : userId,
          status: 'accepted',
        }),
      );
    }

    const found = await repository.findAcceptedByUser({
      userId,
      take: 2,
      afterRelationshipId: 'relationship-accepted-continuation-2',
    });

    expect(found.map((relationship) => relationship.id)).toEqual([
      'relationship-accepted-continuation-3',
      'relationship-accepted-continuation-4',
    ]);
  });

  it('returns an empty list when the user has no accepted relationships', async () => {
    await repository.save(
      ContactRelationship.reconstitute({
        id: 'relationship-accepted-empty-pending',
        requesterId: 'user-accepted-empty',
        recipientId: 'user-accepted-empty-counterpart',
        status: 'pending',
      }),
    );

    const found = await repository.findAcceptedByUser({
      userId: 'user-accepted-empty',
      take: 10,
    });

    expect(found).toEqual([]);
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
