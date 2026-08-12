import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client';

const MIGRATIONS_DIR = join(__dirname, 'migrations');
const PRE_EXISTING_MIGRATIONS = [
  '20260723090721_init',
  '20260725233142_add_verification_token',
  '20260728043707_add_refresh_token_revoked_at',
];
// Updated once the real migration folder is generated in the GREEN step.
const DISPLAY_NAME_MIGRATION = '20260812094909_add_display_name';

function readMigrationSql(folder: string): string {
  return readFileSync(join(MIGRATIONS_DIR, folder, 'migration.sql'), 'utf-8');
}

describe('add-display-name migration (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  const credentialUserId = randomUUID();
  const oauthUserId = randomUUID();

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    const connectionString = container.getConnectionUri();
    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });

    // Reproduce the exact Phase 1 schema by applying only the
    // pre-existing migrations, in order.
    for (const folder of PRE_EXISTING_MIGRATIONS) {
      await prisma.$executeRawUnsafe(readMigrationSql(folder));
    }

    // Seed rows representing real Phase 1 users: one credential-based,
    // one OAuth-only (no password hash).
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

    // Now apply the migration under test.
    await prisma.$executeRawUnsafe(readMigrationSql(DISPLAY_NAME_MIGRATION));
  }, 60000);

  afterAll(async () => {
    await prisma.$disconnect();
    await container.stop();
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
