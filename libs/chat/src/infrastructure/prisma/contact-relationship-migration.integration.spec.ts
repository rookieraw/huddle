import { execSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

const PRISMA_DIR = __dirname;
const CHAT_PACKAGE_ROOT = resolve(PRISMA_DIR, '../../..');
const REAL_MIGRATIONS_DIR = join(PRISMA_DIR, 'migrations');
const INITIAL_MIGRATION = '20260820000000_create_contact_relationships';
const ACCEPTED_STATUS_MIGRATION =
  '20260902000000_add_accepted_contact_relationship_status';
const REMOVED_STATUS_MIGRATION =
  '20261111000000_add_removed_contact_relationship_status';

const MIGRATION_TEST_SCHEMA = `
datasource db {
  provider = "postgresql"
  schemas  = ["chat"]
}

model MigrationProbe {
  id String @id

  @@map("migration_probe")
  @@schema("chat")
}
`;

function runMigrateDeploy(schemaPath: string, databaseUrl: string): void {
  execSync(`pnpm exec prisma migrate deploy --schema="${schemaPath}"`, {
    cwd: CHAT_PACKAGE_ROOT,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
}

function copyMigration(migrationName: string, targetDirectory: string): void {
  cpSync(
    join(REAL_MIGRATIONS_DIR, migrationName),
    join(targetDirectory, migrationName),
    { recursive: true },
  );
}

describe('ContactRelationship migration (integration, via real prisma migrate deploy)', () => {
  let container: StartedPostgreSqlContainer;
  let tempDir: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    tempDir = mkdtempSync(join(tmpdir(), 'huddle-chat-migration-test-'));

    const schemaPath = join(tempDir, 'schema.prisma');
    const tempMigrationsDir = join(tempDir, 'migrations');
    writeFileSync(schemaPath, MIGRATION_TEST_SCHEMA);
    mkdirSync(tempMigrationsDir);
    copyFileSync(
      join(REAL_MIGRATIONS_DIR, 'migration_lock.toml'),
      join(tempMigrationsDir, 'migration_lock.toml'),
    );

    const migrationEntries = readdirSync(REAL_MIGRATIONS_DIR, {
      withFileTypes: true,
    }).filter((entry) => entry.isDirectory());

    copyMigration(INITIAL_MIGRATION, tempMigrationsDir);
    runMigrateDeploy(schemaPath, container.getConnectionUri());

    const existingRow = await container.exec([
      'psql',
      '--username',
      container.getUsername(),
      '--dbname',
      container.getDatabase(),
      '--set',
      'ON_ERROR_STOP=1',
      '--command',
      `INSERT INTO chat.contact_relationships
         (id, requester_id, recipient_id, status)
       VALUES
         ('relationship-before-upgrade', 'user-before-a', 'user-before-b', 'pending')`,
    ]);

    if (existingRow.exitCode !== 0) {
      throw new Error(
        `Failed to seed the pre-migration row: ${existingRow.output}`,
      );
    }

    copyMigration(ACCEPTED_STATUS_MIGRATION, tempMigrationsDir);
    runMigrateDeploy(schemaPath, container.getConnectionUri());

    const existingAcceptedRow = await container.exec([
      'psql',
      '--username',
      container.getUsername(),
      '--dbname',
      container.getDatabase(),
      '--set',
      'ON_ERROR_STOP=1',
      '--command',
      `INSERT INTO chat.contact_relationships
         (id, requester_id, recipient_id, status)
       VALUES
         ('relationship-accepted-before-rejection-upgrade', 'user-before-c', 'user-before-d', 'accepted')`,
    ]);

    if (existingAcceptedRow.exitCode !== 0) {
      throw new Error(
        `Failed to seed the accepted pre-migration row: ${existingAcceptedRow.output}`,
      );
    }

    for (const entry of migrationEntries) {
      if (
        entry.name !== INITIAL_MIGRATION &&
        entry.name !== ACCEPTED_STATUS_MIGRATION &&
        entry.name !== REMOVED_STATUS_MIGRATION
      ) {
        copyMigration(entry.name, tempMigrationsDir);
      }
    }

    runMigrateDeploy(schemaPath, container.getConnectionUri());

    const existingRejectedRow = await container.exec([
      'psql',
      '--username',
      container.getUsername(),
      '--dbname',
      container.getDatabase(),
      '--set',
      'ON_ERROR_STOP=1',
      '--command',
      `INSERT INTO chat.contact_relationships
         (id, requester_id, recipient_id, status)
       VALUES
         ('relationship-rejected-before-removal-upgrade', 'user-before-e', 'user-before-f', 'rejected')`,
    ]);

    if (existingRejectedRow.exitCode !== 0) {
      throw new Error(
        `Failed to seed the rejected pre-migration row: ${existingRejectedRow.output}`,
      );
    }

    copyMigration(REMOVED_STATUS_MIGRATION, tempMigrationsDir);
    runMigrateDeploy(schemaPath, container.getConnectionUri());
  }, 60000);

  afterAll(async () => {
    await container.stop();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('preserves an existing pending relationship through the additive migration', async () => {
    const existingRow = await container.exec([
      'psql',
      '--username',
      container.getUsername(),
      '--dbname',
      container.getDatabase(),
      '--tuples-only',
      '--no-align',
      '--command',
      `SELECT id, requester_id, recipient_id, status
         FROM chat.contact_relationships
         WHERE id = 'relationship-before-upgrade'`,
    ]);

    expect(existingRow.exitCode).toBe(0);
    expect(existingRow.output.trim()).toBe(
      'relationship-before-upgrade|user-before-a|user-before-b|pending',
    );
  });

  it('preserves an existing accepted relationship through the rejected-status migration', async () => {
    const existingRow = await container.exec([
      'psql',
      '--username',
      container.getUsername(),
      '--dbname',
      container.getDatabase(),
      '--tuples-only',
      '--no-align',
      '--command',
      `SELECT id, requester_id, recipient_id, status
         FROM chat.contact_relationships
         WHERE id = 'relationship-accepted-before-rejection-upgrade'`,
    ]);

    expect(existingRow.exitCode).toBe(0);
    expect(existingRow.output.trim()).toBe(
      'relationship-accepted-before-rejection-upgrade|user-before-c|user-before-d|accepted',
    );
  });

  it('preserves pending, accepted, and rejected relationships through the removal migration with no removal fields', async () => {
    const existingRows = await container.exec([
      'psql',
      '--username',
      container.getUsername(),
      '--dbname',
      container.getDatabase(),
      '--tuples-only',
      '--no-align',
      '--command',
      `SELECT id, status, removed_by_user_id IS NULL, removed_at IS NULL
         FROM chat.contact_relationships
         WHERE id IN (
           'relationship-before-upgrade',
           'relationship-accepted-before-rejection-upgrade',
           'relationship-rejected-before-removal-upgrade'
         )
         ORDER BY id`,
    ]);

    expect(existingRows.exitCode).toBe(0);
    expect(existingRows.output.trim().split(/\r?\n/)).toEqual([
      'relationship-accepted-before-rejection-upgrade|accepted|t|t',
      'relationship-before-upgrade|pending|t|t',
      'relationship-rejected-before-removal-upgrade|rejected|t|t',
    ]);
  });

  it('allows a rejected relationship to coexist with a current relationship for the same user pair', async () => {
    const insert = async (
      id: string,
      requester: string,
      recipient: string,
      status: string,
    ) =>
      container.exec([
        'psql',
        '--username',
        container.getUsername(),
        '--dbname',
        container.getDatabase(),
        '--set',
        'ON_ERROR_STOP=1',
        '--command',
        `INSERT INTO chat.contact_relationships
           (id, requester_id, recipient_id, status)
         VALUES ('${id}', '${requester}', '${recipient}', '${status}')`,
      ]);

    const rejected = await insert(
      'relationship-coexist-rejected',
      'user-coexist-a',
      'user-coexist-b',
      'rejected',
    );
    const currentAfterwards = await insert(
      'relationship-coexist-pending',
      'user-coexist-b',
      'user-coexist-a',
      'pending',
    );

    expect(rejected.exitCode).toBe(0);
    expect(currentAfterwards.exitCode).toBe(0);
  });

  it('creates storage that allows exactly the current relationship statuses', async () => {
    const columns = await container.exec([
      'psql',
      '--username',
      container.getUsername(),
      '--dbname',
      container.getDatabase(),
      '--tuples-only',
      '--no-align',
      '--command',
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'chat'
         AND table_name = 'contact_relationships'
       ORDER BY ordinal_position`,
    ]);

    expect(columns.exitCode).toBe(0);
    expect(columns.output.trim().split(/\r?\n/)).toEqual([
      'id|text|NO',
      'requester_id|text|NO',
      'recipient_id|text|NO',
      'status|text|NO',
      'removed_by_user_id|text|YES',
      'removed_at|timestamp with time zone|YES',
    ]);

    const statusConstraint = await container.exec([
      'psql',
      '--username',
      container.getUsername(),
      '--dbname',
      container.getDatabase(),
      '--tuples-only',
      '--no-align',
      '--command',
      `SELECT check_clause
       FROM information_schema.check_constraints
       WHERE constraint_schema = 'chat'
         AND constraint_name = 'contact_relationships_status_check'`,
    ]);

    expect(statusConstraint.exitCode).toBe(0);
    expect(statusConstraint.output).toContain('status');
    expect(statusConstraint.output).toContain('pending');
    expect(statusConstraint.output).toContain('accepted');
    expect(statusConstraint.output).toContain('rejected');
    expect(statusConstraint.output).toContain('removed');

    const acceptedInsert = await container.exec([
      'psql',
      '--username',
      container.getUsername(),
      '--dbname',
      container.getDatabase(),
      '--set',
      'ON_ERROR_STOP=1',
      '--command',
      `INSERT INTO chat.contact_relationships
         (id, requester_id, recipient_id, status)
       VALUES
         ('relationship-status-accepted', 'user-status-a', 'user-status-b', 'accepted')`,
    ]);

    expect(acceptedInsert.exitCode).toBe(0);

    const rejectedInsert = await container.exec([
      'psql',
      '--username',
      container.getUsername(),
      '--dbname',
      container.getDatabase(),
      '--set',
      'ON_ERROR_STOP=1',
      '--command',
      `INSERT INTO chat.contact_relationships
         (id, requester_id, recipient_id, status)
       VALUES
         ('relationship-status-rejected', 'user-status-e', 'user-status-f', 'rejected')`,
    ]);

    expect(rejectedInsert.exitCode).toBe(0);

    const removedInsert = await container.exec([
      'psql',
      '--username',
      container.getUsername(),
      '--dbname',
      container.getDatabase(),
      '--set',
      'ON_ERROR_STOP=1',
      '--command',
      `INSERT INTO chat.contact_relationships
         (id, requester_id, recipient_id, status, removed_by_user_id, removed_at)
       VALUES
         ('relationship-status-removed', 'user-status-g', 'user-status-h', 'removed', 'user-status-g', '2026-11-11T10:00:00Z')`,
    ]);

    expect(removedInsert.exitCode).toBe(0);

    const unsupportedInsert = await container.exec([
      'psql',
      '--username',
      container.getUsername(),
      '--dbname',
      container.getDatabase(),
      '--set',
      'ON_ERROR_STOP=1',
      '--command',
      `INSERT INTO chat.contact_relationships
         (id, requester_id, recipient_id, status)
       VALUES
         ('relationship-status-unsupported', 'user-status-c', 'user-status-d', 'unsupported')`,
    ]);

    expect(unsupportedInsert.exitCode).not.toBe(0);
    expect(unsupportedInsert.output).toContain(
      'contact_relationships_status_check',
    );
  });

  it.each([
    {
      description: 'a removed row without either removal field',
      id: 'relationship-removal-missing-both',
      status: 'removed',
      removedByUserId: 'NULL',
      removedAt: 'NULL',
    },
    {
      description: 'a removed row without the removal time',
      id: 'relationship-removal-missing-time',
      status: 'removed',
      removedByUserId: "'user-removal-a'",
      removedAt: 'NULL',
    },
    {
      description: 'a removed row without the removing user',
      id: 'relationship-removal-missing-user',
      status: 'removed',
      removedByUserId: 'NULL',
      removedAt: "'2026-11-11T10:00:00Z'",
    },
    {
      description: 'a removed row whose remover is outside the pair',
      id: 'relationship-removal-outsider',
      status: 'removed',
      removedByUserId: "'user-removal-outsider'",
      removedAt: "'2026-11-11T10:00:00Z'",
    },
    {
      description: 'an accepted row with removal fields',
      id: 'relationship-removal-on-accepted',
      status: 'accepted',
      removedByUserId: "'user-removal-a'",
      removedAt: "'2026-11-11T10:00:00Z'",
    },
  ])(
    'rejects $description',
    async ({ id, status, removedByUserId, removedAt }) => {
      const insert = await container.exec([
        'psql',
        '--username',
        container.getUsername(),
        '--dbname',
        container.getDatabase(),
        '--set',
        'ON_ERROR_STOP=1',
        '--command',
        `INSERT INTO chat.contact_relationships
           (id, requester_id, recipient_id, status, removed_by_user_id, removed_at)
         VALUES
           ('${id}', 'user-removal-a', 'user-removal-b', '${status}', ${removedByUserId}, ${removedAt})`,
      ]);

      expect(insert.exitCode).not.toBe(0);
      expect(insert.output).toContain('contact_relationships_removal_check');
    },
  );

  it.each([
    ['pending', 'pending'],
    ['pending', 'accepted'],
    ['accepted', 'pending'],
    ['accepted', 'accepted'],
  ] as const)(
    'rejects a reversed relationship for current %s/%s statuses',
    async (firstStatus, secondStatus) => {
      const pairKey = `${firstStatus}-${secondStatus}`;
      const firstUserId = `user-${pairKey}-a`;
      const secondUserId = `user-${pairKey}-b`;
      const firstInsert = await container.exec([
        'psql',
        '--username',
        container.getUsername(),
        '--dbname',
        container.getDatabase(),
        '--set',
        'ON_ERROR_STOP=1',
        '--command',
        `INSERT INTO chat.contact_relationships
           (id, requester_id, recipient_id, status)
         VALUES
           ('relationship-${pairKey}-first', '${firstUserId}', '${secondUserId}', '${firstStatus}')`,
      ]);

      expect(firstInsert.exitCode).toBe(0);

      const reversedInsert = await container.exec([
        'psql',
        '--username',
        container.getUsername(),
        '--dbname',
        container.getDatabase(),
        '--set',
        'ON_ERROR_STOP=1',
        '--command',
        `INSERT INTO chat.contact_relationships
           (id, requester_id, recipient_id, status)
         VALUES
           ('relationship-${pairKey}-reversed', '${secondUserId}', '${firstUserId}', '${secondStatus}')`,
      ]);

      expect(reversedInsert.exitCode).not.toBe(0);
      expect(reversedInsert.output).toContain(
        'contact_relationships_current_user_pair_key',
      );

      const rowCount = await container.exec([
        'psql',
        '--username',
        container.getUsername(),
        '--dbname',
        container.getDatabase(),
        '--tuples-only',
        '--no-align',
        '--command',
        `SELECT count(*)
         FROM chat.contact_relationships
         WHERE requester_id IN ('${firstUserId}', '${secondUserId}')
           AND recipient_id IN ('${firstUserId}', '${secondUserId}')`,
      ]);

      expect(rowCount.exitCode).toBe(0);
      expect(rowCount.output.trim()).toBe('1');
    },
  );
});
