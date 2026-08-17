import { User } from '../../domain/user.entity';
import { InMemoryUserRepository } from '../../test-support/in-memory-user.repository';
import { UserDirectoryApi } from './user-directory-api';

describe('UserDirectoryApi', () => {
  it('confirms that an existing Identity user exists', async () => {
    const userRepository = new InMemoryUserRepository();
    const directoryApi = new UserDirectoryApi(userRepository);
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

    const exists = await directoryApi.userExists('user-123');

    expect(exists).toBe(true);
  });
});
