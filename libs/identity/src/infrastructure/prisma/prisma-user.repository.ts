import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from './generated/client';
import { User, LinkedOAuthProvider } from '../../domain/user.entity';
import type {
  UserProfileProjection,
  UserRepository,
} from '../../application/ports/user.repository.port';

type UserWithOAuthProviders = Prisma.UserGetPayload<{
  include: { oauthProviders: true };
}>;

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({
      where: { email },
      include: { oauthProviders: true },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findByVerificationToken(token: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({
      where: { verificationToken: token },
      include: { oauthProviders: true },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({
      where: { id },
      include: { oauthProviders: true },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findProfilesByIds(userIds: string[]): Promise<UserProfileProjection[]> {
    const records = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, displayName: true },
    });

    return records.map((record) => ({
      userId: record.id,
      displayName: record.displayName,
    }));
  }

  async findByOAuthProvider(
    provider: 'google' | 'github',
    providerId: string,
  ): Promise<User | null> {
    const record = await this.prisma.user.findFirst({
      where: {
        oauthProviders: {
          some: { provider, providerId },
        },
      },
      include: { oauthProviders: true },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async save(user: User): Promise<void> {
    const passwordHash = user.getPasswordHash();

    await this.prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.getEmail(),
        passwordHash: passwordHash ? passwordHash.value : null,
        emailVerified: user.isEmailVerified(),
        createdAt: user.getCreatedAt(),
        verificationToken: user.getVerificationToken(),
        verificationTokenExpiresAt: user.getVerificationTokenExpiresAt(),
        displayName: user.getDisplayName(),
      },
      update: {
        email: user.getEmail(),
        passwordHash: passwordHash ? passwordHash.value : null,
        emailVerified: user.isEmailVerified(),
        verificationToken: user.getVerificationToken(),
        verificationTokenExpiresAt: user.getVerificationTokenExpiresAt(),
        displayName: user.getDisplayName(),
      },
    });

    for (const { provider, providerId } of user.getOAuthProviders()) {
      await this.prisma.oAuthProvider.upsert({
        where: {
          provider_providerId: { provider, providerId },
        },
        create: {
          provider,
          providerId,
          userId: user.id,
        },
        update: {
          userId: user.id,
        },
      });
    }
  }

  private toDomain(record: UserWithOAuthProviders): User {
    const oauthProviders: LinkedOAuthProvider[] = record.oauthProviders.map(
      (p) => ({
        provider: p.provider as LinkedOAuthProvider['provider'],
        providerId: p.providerId,
      }),
    );

    return User.reconstitute({
      id: record.id,
      email: record.email,
      passwordHash: record.passwordHash,
      emailVerified: record.emailVerified,
      createdAt: record.createdAt,
      oauthProviders,
      verificationToken: record.verificationToken,
      verificationTokenExpiresAt: record.verificationTokenExpiresAt,
      displayName: record.displayName,
    });
  }
}
