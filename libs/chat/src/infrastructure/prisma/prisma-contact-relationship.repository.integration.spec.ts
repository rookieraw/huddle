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
      'another recipient’s row',
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
