import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client';

const PRISMA_DIR = __dirname; // .../libs/identity/src/infrastructure/prisma
const IDENTITY_PACKAGE_ROOT = resolve(PRISMA_DIR, '../../..'); // .../libs/identity
const REAL_MIGRATIONS_DIR = join(PRISMA_DIR, 'migrations');
const REAL_SCHEMA_PATH = join(PRISMA_DIR, 'schema.prisma');

const PRE_EXISTING_MIGRATIONS = [
  '20260723090721_init',
  '20260725233142_add_verification_token',
  '20260728043707_add_refresh_token_revoked_at',
];
const DISPLAY_NAME_MIGRATION = '20260812094909_add_display_name';

function runMigrateDeploy(schemaPath: string, databaseUrl: string): void {
  execSync(`pnpm exec prisma migrate deploy --schema="${schemaPath}"`, {
    cwd: IDENTITY_PACKAGE_ROOT,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
}

describe('add-display-name migration (integration, via real prisma migrate deploy)', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let tempDir: string;
  const credentialUserId = randomUUID();
  const oauthUserId = randomUUID();

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    const connectionString = container.getConnectionUri();

    // Build a temporary schema + migrations directory containing only the
    // three pre-existing (Phase 1) migrations, to reproduce exactly what a
    // real deployment's recorded migration history looked like before this
    // change — then deploy through the real Prisma CLI, not raw SQL.
    tempDir = mkdtempSync(join(tmpdir(), 'huddle-migration-test-'));
    copyFileSync(REAL_SCHEMA_PATH, join(tempDir, 'schema.prisma'));
    const tempMigrationsDir = join(tempDir, 'migrations');
    mkdirSync(tempMigrationsDir);
    copyFileSync(
      join(REAL_MIGRATIONS_DIR, 'migration_lock.toml'),
      join(tempMigrationsDir, 'migration_lock.toml'),
    );
    for (const folder of PRE_EXISTING_MIGRATIONS) {
      cpSync(
        join(REAL_MIGRATIONS_DIR, folder),
        join(tempMigrationsDir, folder),
        {
          recursive: true,
        },
      );
    }

    runMigrateDeploy(join(tempDir, 'schema.prisma'), connectionString);

    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });

    // Seed rows representing real Phase 1 users: one credential-based,
    // one OAuth-only (no password hash) — inserted via raw SQL since the
    // generated client's types assume the final (post-migration) schema.
    await prisma.$executeRawUnsafe(
      `INSERT INTO identity.users (id, email, password_hash, email_verified, created_at)
       VALUES ($1, $2, $3, $4, now())`,
      credentialUserId,
      'ada-credential@example.com',
      'argon2-hash-stub',
      true,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO identity.users (id, email, password_hash, email_verified, created_at)
       VALUES ($1, $2, NULL, $3, now())`,
      oauthUserId,
      'grace-oauth@example.com',
      true,
    );

    // Now add the migration under test to the temp migrations directory
    // and deploy again — this applies only the new migration, since the
    // first three are already recorded in Prisma's own migration history
    // table for this database.
    cpSync(
      join(REAL_MIGRATIONS_DIR, DISPLAY_NAME_MIGRATION),
      join(tempMigrationsDir, DISPLAY_NAME_MIGRATION),
      { recursive: true },
    );
    runMigrateDeploy(join(tempDir, 'schema.prisma'), connectionString);
  }, 180000);

  afterAll(async () => {
    await prisma.$disconnect();
    await container.stop();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('records all four migrations, including add_display_name, in the Prisma migration history table', async () => {
    type SchemaLookupRow = { table_schema: string };
    const schemaLookupRows = await prisma.$queryRawUnsafe<SchemaLookupRow[]>(
      "SELECT table_schema FROM information_schema.tables WHERE table_name = '_prisma_migrations'",
    );
    const migrationsTableSchema = schemaLookupRows[0].table_schema;

    type MigrationRow = { migration_name: string };
    const rows = await prisma.$queryRawUnsafe<MigrationRow[]>(
      `SELECT migration_name FROM "${migrationsTableSchema}"._prisma_migrations ORDER BY finished_at ASC`,
    );

    expect(rows.map((r) => r.migration_name)).toEqual([
      ...PRE_EXISTING_MIGRATIONS,
      DISPLAY_NAME_MIGRATION,
    ]);
  });

  it('backfills a valid non-null display name for a pre-existing credential user', async () => {
    const rows = await prisma.$queryRawUnsafe<{ display_name: string }[]>(
      `SELECT display_name FROM identity.users WHERE id = $1`,
      credentialUserId,
    );

    const displayName = rows[0].display_name;
    expect(displayName).toBeTruthy();
    expect(displayName.length).toBeGreaterThan(0);
    expect(displayName.length).toBeLessThanOrEqual(50);
  });

  it('backfills a valid non-null display name for a pre-existing OAuth-only user', async () => {
    const rows = await prisma.$queryRawUnsafe<{ display_name: string }[]>(
      `SELECT display_name FROM identity.users WHERE id = $1`,
      oauthUserId,
    );

    const displayName = rows[0].display_name;
    expect(displayName).toBeTruthy();
    expect(displayName.length).toBeGreaterThan(0);
    expect(displayName.length).toBeLessThanOrEqual(50);
  });

  it('does not derive the backfilled display name from the email local part', async () => {
    const rows = await prisma.$queryRawUnsafe<{ display_name: string }[]>(
      `SELECT display_name FROM identity.users WHERE id = $1`,
      credentialUserId,
    );

    expect(rows[0].display_name).not.toContain('ada-credential');
  });

  it('enforces NOT NULL on display_name after migration', async () => {
    const rows = await prisma.$queryRawUnsafe<{ is_nullable: string }[]>(
      `SELECT is_nullable FROM information_schema.columns
       WHERE table_schema = 'identity' AND table_name = 'users' AND column_name = 'display_name'`,
    );

    expect(rows[0].is_nullable).toBe('NO');
  });

  it('does not enforce a uniqueness constraint on display_name', async () => {
    const rows = await prisma.$queryRawUnsafe<{ conname: string }[]>(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = 'identity.users'::regclass AND contype = 'u'
       AND conname LIKE '%display_name%'`,
    );

    expect(rows).toHaveLength(0);
  });
});
