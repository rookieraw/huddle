import { RefreshToken } from '../../domain/refresh-token.entity';

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');

export interface RefreshTokenRepository {
  findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  findAllByUserId(userId: string): Promise<RefreshToken[]>;
  save(refreshToken: RefreshToken): Promise<void>;
}
