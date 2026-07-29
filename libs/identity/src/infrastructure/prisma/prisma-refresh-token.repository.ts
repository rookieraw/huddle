import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from './generated/client';
import { RefreshToken } from '../../domain/refresh-token.entity';
import { RefreshTokenRepository } from '../../application/ports/refresh-token.repository.port';

type RefreshTokenRecord = Prisma.RefreshTokenGetPayload<Record<string, never>>;

@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findAllByUserId(userId: string): Promise<RefreshToken[]> {
    const records = await this.prisma.refreshToken.findMany({
      where: { userId },
    });

    return records.map((record) => this.toDomain(record));
  }

  async save(refreshToken: RefreshToken): Promise<void> {
    await this.prisma.refreshToken.upsert({
      where: { id: refreshToken.id },
      create: {
        id: refreshToken.id,
        userId: refreshToken.getUserId(),
        tokenHash: refreshToken.getTokenHash(),
        expiresAt: refreshToken.getExpiresAt(),
        createdAt: refreshToken.getCreatedAt(),
        revokedAt: refreshToken.getRevokedAt(),
      },
      update: {
        revokedAt: refreshToken.getRevokedAt(),
      },
    });
  }

  private toDomain(record: RefreshTokenRecord): RefreshToken {
    return RefreshToken.reconstitute({
      id: record.id,
      userId: record.userId,
      tokenHash: record.tokenHash,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      revokedAt: record.revokedAt,
    });
  }
}
