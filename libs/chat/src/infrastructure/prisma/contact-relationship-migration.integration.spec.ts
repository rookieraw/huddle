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

    for (const entry of migrationEntries) {
      if (entry.name !== INITIAL_MIGRATION) {
        copyMigration(entry.name, tempMigrationsDir);
      }
    }

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
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'chat'
         AND table_name = 'contact_relationships'
       ORDER BY ordinal_position`,
    ]);

    expect(columns.exitCode).toBe(0);
    expect(columns.output.trim().split(/\r?\n/)).toEqual([
      'id',
      'requester_id',
      'recipient_id',
      'status',
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
