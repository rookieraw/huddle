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
    const findById = jest.spyOn(userRepository, 'findById');
    const profileQueryApi = new UserProfileQueryApi(userRepository);

    const result = await profileQueryApi.getProfiles(['user-123', 'user-123']);

    expect(findById).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      profiles: [{ userId: 'user-123', displayName: 'Ada Lovelace' }],
      missingUserIds: [],
    });
  });
});
