import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from './generated/client';
import { User } from '../../domain/user.entity';
import { UserRepository } from '../../application/ports/user.repository.port';

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

  async save(user: User): Promise<void> {
    const passwordHash = user.getPasswordHash();
    const oauthProvider = user.getOAuthProvider();
    const oauthProviderId = user.getOAuthProviderId();

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
      },
      update: {
        email: user.getEmail(),
        passwordHash: passwordHash ? passwordHash.value : null,
        emailVerified: user.isEmailVerified(),
        verificationToken: user.getVerificationToken(),
        verificationTokenExpiresAt: user.getVerificationTokenExpiresAt(),
      },
    });

    if (oauthProvider && oauthProviderId) {
      await this.prisma.oAuthProvider.upsert({
        where: {
          provider_providerId: {
            provider: oauthProvider,
            providerId: oauthProviderId,
          },
        },
        create: {
          provider: oauthProvider,
          providerId: oauthProviderId,
          userId: user.id,
        },
        update: {
          userId: user.id,
        },
      });
    }
  }

  private toDomain(record: UserWithOAuthProviders): User {
    const oauth = record.oauthProviders[0] ?? null;

    return User.reconstitute({
      id: record.id,
      email: record.email,
      passwordHash: record.passwordHash,
      emailVerified: record.emailVerified,
      createdAt: record.createdAt,
      oauthProvider: oauth?.provider ?? null,
      oauthProviderId: oauth?.providerId ?? null,
      verificationToken: record.verificationToken,
      verificationTokenExpiresAt: record.verificationTokenExpiresAt,
    });
  }
}
