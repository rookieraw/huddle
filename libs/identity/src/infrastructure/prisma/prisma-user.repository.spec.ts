import type { PrismaClient } from './generated/client';
import { PrismaUserRepository } from './prisma-user.repository';

describe('PrismaUserRepository', () => {
  it('loads profile projections with one minimal batch query', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 'user-123', displayName: 'Ada Lovelace' },
      { id: 'user-456', displayName: 'Grace Hopper' },
    ]);
    const prisma = { user: { findMany } } as unknown as PrismaClient;
    const repository = new PrismaUserRepository(prisma);

    const profiles = await repository.findProfilesByIds([
      'user-123',
      'user-456',
    ]);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: { id: { in: ['user-123', 'user-456'] } },
      select: { id: true, displayName: true },
    });
    expect(profiles).toEqual([
      { userId: 'user-123', displayName: 'Ada Lovelace' },
      { userId: 'user-456', displayName: 'Grace Hopper' },
    ]);
  });
});
