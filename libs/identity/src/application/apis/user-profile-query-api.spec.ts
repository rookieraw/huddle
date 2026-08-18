import { User } from '../../domain/user.entity';
import { InMemoryUserRepository } from '../../test-support/in-memory-user.repository';
import { UserProfileQueryApi } from './user-profile-query-api';

describe('UserProfileQueryApi', () => {
  it('returns only the public profile fields for an existing Identity user', async () => {
    const userRepository = new InMemoryUserRepository();
    const profileQueryApi = new UserProfileQueryApi(userRepository);
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
    await userRepository.save(user);

    const result = await profileQueryApi.getProfiles(['user-123']);

    expect(result).toEqual({
      profiles: [{ userId: 'user-123', displayName: 'Ada Lovelace' }],
      missingUserIds: [],
    });
  });

  it('distinguishes a missing Identity user from returned profiles', async () => {
    const profileQueryApi = new UserProfileQueryApi(
      new InMemoryUserRepository(),
    );

    const result = await profileQueryApi.getProfiles(['missing-user']);

    expect(result).toEqual({
      profiles: [],
      missingUserIds: ['missing-user'],
    });
  });

  it('normalizes duplicate identifiers before persistence lookup', async () => {
    const userRepository = new InMemoryUserRepository();
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
    await userRepository.save(user);
    const findProfilesByIds = jest.spyOn(userRepository, 'findProfilesByIds');
    const profileQueryApi = new UserProfileQueryApi(userRepository);

    const result = await profileQueryApi.getProfiles([
      'user-123',
      'missing-user',
      'user-123',
    ]);

    expect(findProfilesByIds).toHaveBeenCalledTimes(1);
    expect(findProfilesByIds).toHaveBeenCalledWith([
      'user-123',
      'missing-user',
    ]);
    expect(result).toEqual({
      profiles: [{ userId: 'user-123', displayName: 'Ada Lovelace' }],
      missingUserIds: ['missing-user'],
    });
  });

  it('returns an explicit empty result without a persistence lookup', async () => {
    const userRepository = new InMemoryUserRepository();
    const findProfilesByIds = jest.spyOn(userRepository, 'findProfilesByIds');
    const profileQueryApi = new UserProfileQueryApi(userRepository);

    const result = await profileQueryApi.getProfiles([]);

    expect(findProfilesByIds).not.toHaveBeenCalled();
    expect(result).toEqual({ profiles: [], missingUserIds: [] });
  });

  it('rejects more than 50 input identifiers before normalization and persistence lookup', async () => {
    const userRepository = new InMemoryUserRepository();
    const findProfilesByIds = jest.spyOn(userRepository, 'findProfilesByIds');
    const profileQueryApi = new UserProfileQueryApi(userRepository);
    const userIds = Array.from({ length: 51 }, () => 'user-123');

    const query = profileQueryApi.getProfiles(userIds);

    await expect(query).rejects.toThrow(
      'Profile query accepts at most 50 user identifiers',
    );
    expect(findProfilesByIds).not.toHaveBeenCalled();
  });

  it('accepts exactly 50 identifiers', async () => {
    const profileQueryApi = new UserProfileQueryApi(
      new InMemoryUserRepository(),
    );
    const userIds = Array.from({ length: 50 }, (_, index) => `user-${index}`);

    const result = await profileQueryApi.getProfiles(userIds);

    expect(result).toEqual({ profiles: [], missingUserIds: userIds });
  });
});
