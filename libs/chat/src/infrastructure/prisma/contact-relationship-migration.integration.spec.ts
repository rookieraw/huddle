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

    for (const entry of readdirSync(REAL_MIGRATIONS_DIR, {
      withFileTypes: true,
    })) {
      if (entry.isDirectory()) {
        cpSync(
          join(REAL_MIGRATIONS_DIR, entry.name),
          join(tempMigrationsDir, entry.name),
          { recursive: true },
        );
      }
    }

    runMigrateDeploy(schemaPath, container.getConnectionUri());
  }, 60000);

  afterAll(async () => {
    await container.stop();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates the Chat-owned pending ContactRelationship storage', async () => {
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
  });
});
