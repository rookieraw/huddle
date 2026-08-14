import { execSync } from 'node:child_process';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client';
import { RefreshToken } from '../../domain/refresh-token.entity';
import { PrismaRefreshTokenRepository } from './prisma-refresh-token.repository';

describe('PrismaRefreshTokenRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let repository: PrismaRefreshTokenRepository;
  let userId: string;

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
    repository = new PrismaRefreshTokenRepository(prisma);
  }, 60000);

  afterAll(async () => {
    await prisma.$disconnect();
    await container.stop();
  });

  beforeEach(async () => {
    // RefreshToken has a foreign key to User, so a real user row is needed to attach to.
    const user = await prisma.user.create({
      data: {
        email: `user-${Date.now()}-${Math.random()}@example.com`,
        emailVerified: true,
        displayName: 'Test User',
      },
    });
    userId = user.id;
  });

  afterEach(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
  });

  it('returns null when no token exists with the given hash', async () => {
    const found = await repository.findByTokenHash('nonexistent-hash');

    expect(found).toBeNull();
  });

  it('persists a new refresh token and retrieves it by token hash', async () => {
    const { refreshToken } = RefreshToken.issue(userId);

    await repository.save(refreshToken);
    const found = await repository.findByTokenHash(refreshToken.getTokenHash());

    expect(found?.id).toBe(refreshToken.id);
    expect(found?.getUserId()).toBe(userId);
    expect(found?.isRevoked()).toBe(false);
  });

  it('persists a revocation and its exact timestamp', async () => {
    const { refreshToken } = RefreshToken.issue(userId);
    await repository.save(refreshToken);

    refreshToken.revoke();
    await repository.save(refreshToken);

    const found = await repository.findByTokenHash(refreshToken.getTokenHash());
    expect(found?.isRevoked()).toBe(true);
    expect(found?.getRevokedAt()).not.toBeNull();
  });

  it('finds all tokens belonging to a user', async () => {
    const { refreshToken: first } = RefreshToken.issue(userId);
    const { refreshToken: second } = RefreshToken.issue(userId);
    await repository.save(first);
    await repository.save(second);

    const found = await repository.findAllByUserId(userId);

    expect(found).toHaveLength(2);
  });
});
