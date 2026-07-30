import { DomainError } from '@huddle/shared-kernel';
import { User } from '../../domain/user.entity';
import { UserRepository } from '../ports/user.repository.port';
import { LoginUserUseCase } from './login-user.use-case';

class InMemoryUserRepository implements UserRepository {
  private readonly usersByEmail = new Map<string, User>();

  async findByEmail(email: string): Promise<User | null> {
    return this.usersByEmail.get(email) ?? null;
  }

  async findByVerificationToken(token: string): Promise<User | null> {
    for (const user of this.usersByEmail.values()) {
      if (user.getVerificationToken() === token) {
        return user;
      }
    }
    return null;
  }

  async findById(id: string): Promise<User | null> {
    for (const user of this.usersByEmail.values()) {
      if (user.id === id) {
        return user;
      }
    }
    return null;
  }

  async findByOAuthProvider(
    provider: 'google' | 'github',
    providerId: string,
  ): Promise<User | null> {
    for (const user of this.usersByEmail.values()) {
      if (user.getOAuthProviderId(provider) === providerId) {
        return user;
      }
    }
    return null;
  }

  async save(user: User): Promise<void> {
    this.usersByEmail.set(user.getEmail(), user);
  }
}

async function createVerifiedUser(
  repository: InMemoryUserRepository,
  email: string,
  password: string,
): Promise<User> {
  const { user } = await User.register(email, password);
  user.verifyEmail();
  await repository.save(user);
  return user;
}

describe('LoginUserUseCase', () => {
  it('returns the authenticated user for correct credentials on a verified account', async () => {
    const repository = new InMemoryUserRepository();
    await createVerifiedUser(
      repository,
      'ada@example.com',
      'correct-horse-battery',
    );
    const useCase = new LoginUserUseCase(repository);

    const user = await useCase.execute(
      'ada@example.com',
      'correct-horse-battery',
    );

    expect(user.getEmail()).toBe('ada@example.com');
  });

  it('rejects a non-existent email', async () => {
    const repository = new InMemoryUserRepository();
    const useCase = new LoginUserUseCase(repository);

    await expect(
      useCase.execute('nobody@example.com', 'whatever-password'),
    ).rejects.toThrow(DomainError);
  });

  it('rejects an incorrect password', async () => {
    const repository = new InMemoryUserRepository();
    await createVerifiedUser(
      repository,
      'ada@example.com',
      'correct-horse-battery',
    );
    const useCase = new LoginUserUseCase(repository);

    await expect(
      useCase.execute('ada@example.com', 'wrong-password'),
    ).rejects.toThrow(DomainError);
  });

  it('uses the same error message for a missing email and a wrong password', async () => {
    const repository = new InMemoryUserRepository();
    await createVerifiedUser(
      repository,
      'ada@example.com',
      'correct-horse-battery',
    );
    const useCase = new LoginUserUseCase(repository);

    const missingEmailAttempt = useCase.execute(
      'nobody@example.com',
      'whatever',
    );
    const wrongPasswordAttempt = useCase.execute(
      'ada@example.com',
      'wrong-password',
    );

    await expect(missingEmailAttempt).rejects.toThrow(
      'Invalid email or password',
    );
    await expect(wrongPasswordAttempt).rejects.toThrow(
      'Invalid email or password',
    );
  });

  it('rejects a correct password on an unverified account', async () => {
    const repository = new InMemoryUserRepository();
    const { user } = await User.register(
      'ada@example.com',
      'correct-horse-battery',
    );
    await repository.save(user);
    const useCase = new LoginUserUseCase(repository);

    await expect(
      useCase.execute('ada@example.com', 'correct-horse-battery'),
    ).rejects.toThrow(DomainError);
  });

  it('rejects login for an OAuth-only account', async () => {
    const repository = new InMemoryUserRepository();
    const { user } = User.registerViaOAuth(
      'ada@example.com',
      'google',
      'google-sub-123',
    );
    await repository.save(user);
    const useCase = new LoginUserUseCase(repository);

    await expect(
      useCase.execute('ada@example.com', 'any-password'),
    ).rejects.toThrow(DomainError);
  });
});
