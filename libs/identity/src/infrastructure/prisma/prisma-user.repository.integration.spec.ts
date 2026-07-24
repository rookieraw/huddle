import { execSync } from 'node:child_process';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client';
import { User } from '../../domain/user.entity';
import { PrismaUserRepository } from './prisma-user.repository';

describe('PrismaUserRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let repository: PrismaUserRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    const connectionString = container.getConnectionUri();

    execSync(
      'pnpm exec prisma db push --schema=./src/infrastructure/prisma/schema.prisma',
      {
        env: { ...process.env, DATABASE_URL: connectionString },
        stdio: 'inherit',
      },
    );

    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
    repository = new PrismaUserRepository(prisma);
  }, 60000);

  afterAll(async () => {
    await prisma.$disconnect();
    await container.stop();
  });

  afterEach(async () => {
    await prisma.user.deleteMany();
  });

  it('returns null when no user exists with the given email', async () => {
    const found = await repository.findByEmail('nobody@example.com');

    expect(found).toBeNull();
  });

  it('persists a new user and retrieves it by email', async () => {
    const { user } = await User.register(
      'ada@example.com',
      'correct-horse-battery',
    );

    await repository.save(user);
    const found = await repository.findByEmail('ada@example.com');

    expect(found?.id).toBe(user.id);
    expect(found?.getEmail()).toBe('ada@example.com');
    expect(found?.isEmailVerified()).toBe(false);
  });

  it('round-trips the password hash so verifyPassword still works after reload', async () => {
    const { user } = await User.register(
      'ada@example.com',
      'correct-horse-battery',
    );
    await repository.save(user);

    const found = await repository.findByEmail('ada@example.com');

    await expect(found!.verifyPassword('correct-horse-battery')).resolves.toBe(
      true,
    );
  });

  it('persists an OAuth-registered user with no password hash', async () => {
    const { user } = User.registerViaOAuth(
      'grace@example.com',
      'google',
      'google-sub-789',
    );

    await repository.save(user);
    const found = await repository.findByEmail('grace@example.com');

    expect(found?.getPasswordHash()).toBeNull();
    expect(found?.getOAuthProvider()).toBe('google');
    expect(found?.getOAuthProviderId()).toBe('google-sub-789');
    expect(found?.isEmailVerified()).toBe(true);
  });
});
