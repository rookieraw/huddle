import { execSync } from 'node:child_process';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client';
import { User } from '../../domain/user.entity';
import { DisplayName } from '../../domain/value-objects/display-name.vo';
import { UserDirectoryApi } from '../../application/apis/user-directory-api';
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
      DisplayName.create('Ada Lovelace'),
    );

    await repository.save(user);
    const found = await repository.findByEmail('ada@example.com');

    expect(found?.id).toBe(user.id);
    expect(found?.getEmail()).toBe('ada@example.com');
    expect(found?.isEmailVerified()).toBe(false);
  });

  it('round-trips the display name so it survives persistence and reload', async () => {
    const { user } = await User.register(
      'ada@example.com',
      'correct-horse-battery',
      DisplayName.create('Ada Lovelace'),
    );

    await repository.save(user);
    const found = await repository.findByEmail('ada@example.com');

    expect(found?.getDisplayName()).toBe('Ada Lovelace');
  });

  it('round-trips the password hash so verifyPassword still works after reload', async () => {
    const { user } = await User.register(
      'ada@example.com',
      'correct-horse-battery',
      DisplayName.create('Ada Lovelace'),
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
    expect(found?.getOAuthProviderId('google')).toBe('google-sub-789');
    expect(found?.isEmailVerified()).toBe(true);
  });

  it('round-trips the fallback display name for an OAuth-registered user with no provider name', async () => {
    const { user } = User.registerViaOAuth(
      'grace@example.com',
      'google',
      'google-sub-789',
    );

    await repository.save(user);
    const found = await repository.findByEmail('grace@example.com');

    expect(found?.getDisplayName()).toBe(user.getDisplayName());
  });

  it('round-trips multiple linked OAuth providers on the same user', async () => {
    const { user } = User.registerViaOAuth(
      'grace@example.com',
      'google',
      'google-sub-789',
    );
    user.linkOAuthProvider('github', 'github-id-321');
    await repository.save(user);

    const found = await repository.findByEmail('grace@example.com');
    const sortByProvider = (a: { provider: string }, b: { provider: string }) =>
      a.provider.localeCompare(b.provider);

    expect(found?.getOAuthProviders().sort(sortByProvider)).toEqual(
      [
        { provider: 'github', providerId: 'github-id-321' },
        { provider: 'google', providerId: 'google-sub-789' },
      ].sort(sortByProvider),
    );
  });

  it('returns null when no user has the given provider/providerId linked', async () => {
    const found = await repository.findByOAuthProvider(
      'google',
      'nonexistent-sub',
    );

    expect(found).toBeNull();
  });

  it('finds a user by their linked OAuth provider identity', async () => {
    const { user } = User.registerViaOAuth(
      'ivy@example.com',
      'google',
      'google-sub-555',
    );
    await repository.save(user);

    const found = await repository.findByOAuthProvider(
      'google',
      'google-sub-555',
    );

    expect(found?.id).toBe(user.id);
    expect(found?.getEmail()).toBe('ivy@example.com');
  });

  it('does not match a providerId under the wrong provider', async () => {
    const { user } = User.registerViaOAuth(
      'ivy@example.com',
      'google',
      'google-sub-555',
    );
    await repository.save(user);

    const found = await repository.findByOAuthProvider(
      'github',
      'google-sub-555',
    );

    expect(found).toBeNull();
  });

  it('returns minimal profile projections for requested existing users in a batch lookup', async () => {
    const ada = User.reconstitute({
      id: 'user-ada',
      email: 'ada@example.com',
      passwordHash: null,
      emailVerified: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      oauthProviders: [],
      verificationToken: null,
      verificationTokenExpiresAt: null,
      displayName: 'Ada Lovelace',
    });
    const grace = User.reconstitute({
      id: 'user-grace',
      email: 'grace@example.com',
      passwordHash: null,
      emailVerified: true,
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      oauthProviders: [],
      verificationToken: null,
      verificationTokenExpiresAt: null,
      displayName: 'Grace Hopper',
    });
    await repository.save(ada);
    await repository.save(grace);

    const profiles = await repository.findProfilesByIds([
      'user-ada',
      'missing-user',
      'user-grace',
    ]);
    const byUserId = (a: { userId: string }, b: { userId: string }) =>
      a.userId.localeCompare(b.userId);

    expect(profiles.sort(byUserId)).toEqual(
      [
        { userId: 'user-ada', displayName: 'Ada Lovelace' },
        { userId: 'user-grace', displayName: 'Grace Hopper' },
      ].sort(byUserId),
    );
  });

  it('supports directory existence checks against persisted users', async () => {
    const user = User.reconstitute({
      id: 'user-123',
      email: 'ada@example.com',
      passwordHash: null,
      emailVerified: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      oauthProviders: [],
      verificationToken: null,
      verificationTokenExpiresAt: null,
      displayName: 'Ada Lovelace',
    });
    await repository.save(user);
    const directoryApi = new UserDirectoryApi(repository);

    await expect(directoryApi.userExists('user-123')).resolves.toBe(true);
    await expect(directoryApi.userExists('missing-user')).resolves.toBe(false);
  });
});
