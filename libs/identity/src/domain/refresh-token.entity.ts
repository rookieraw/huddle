import { randomBytes, randomUUID, createHash } from 'node:crypto';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export class RefreshToken {
  private constructor(
    public readonly id: string,
    private readonly userId: string,
    private readonly tokenHash: string,
    private readonly expiresAt: Date,
    private readonly createdAt: Date,
    private revokedAt: Date | null,
  ) {}

  static issue(userId: string): {
    refreshToken: RefreshToken;
    rawToken: string;
  } {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const refreshToken = new RefreshToken(
      randomUUID(),
      userId,
      tokenHash,
      new Date(Date.now() + SEVEN_DAYS_MS),
      new Date(),
      null,
    );

    return { refreshToken, rawToken };
  }

  static reconstitute(data: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    createdAt: Date;
    revokedAt: Date | null;
  }): RefreshToken {
    return new RefreshToken(
      data.id,
      data.userId,
      data.tokenHash,
      data.expiresAt,
      data.createdAt,
      data.revokedAt,
    );
  }

  revoke(): void {
    if (this.revokedAt) {
      return;
    }
    this.revokedAt = new Date();
  }

  isExpired(): boolean {
    return this.expiresAt.getTime() < Date.now();
  }

  isRevoked(): boolean {
    return this.revokedAt !== null;
  }

  getUserId(): string {
    return this.userId;
  }

  getTokenHash(): string {
    return this.tokenHash;
  }

  getExpiresAt(): Date {
    return this.expiresAt;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getRevokedAt(): Date | null {
    return this.revokedAt;
  }
}
