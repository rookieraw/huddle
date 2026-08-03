import { DomainError } from '@huddle/shared-kernel';
import { User } from '../../domain/user.entity';
import { InMemoryUserRepository } from '../../test-support/in-memory-user.repository';
import { VerifyEmailUseCase } from './verify-email.use-case';

describe('VerifyEmailUseCase', () => {
  it('verifies the user matching the given token', async () => {
    const repository = new InMemoryUserRepository();
    const { user } = await User.register(
      'ada@example.com',
      'correct-horse-battery',
    );
    await repository.save(user);
    const token = user.getVerificationToken()!;
    const useCase = new VerifyEmailUseCase(repository);

    const verifiedUser = await useCase.execute(token);

    expect(verifiedUser.isEmailVerified()).toBe(true);
  });

  it('persists the verified state via the repository', async () => {
    const repository = new InMemoryUserRepository();
    const { user } = await User.register(
      'ada@example.com',
      'correct-horse-battery',
    );
    await repository.save(user);
    const token = user.getVerificationToken()!;
    const useCase = new VerifyEmailUseCase(repository);

    await useCase.execute(token);

    const found = await repository.findByEmail('ada@example.com');
    expect(found?.isEmailVerified()).toBe(true);
  });

  it('rejects an unknown token', async () => {
    const repository = new InMemoryUserRepository();
    const useCase = new VerifyEmailUseCase(repository);

    await expect(useCase.execute('nonexistent-token')).rejects.toThrow(
      DomainError,
    );
  });

  it('rejects reusing the same token a second time', async () => {
    const repository = new InMemoryUserRepository();
    const { user } = await User.register(
      'ada@example.com',
      'correct-horse-battery',
    );
    await repository.save(user);
    const token = user.getVerificationToken()!;
    const useCase = new VerifyEmailUseCase(repository);
    await useCase.execute(token);

    await expect(useCase.execute(token)).rejects.toThrow(DomainError);
  });

  it('propagates the expired-token rule from User.verifyEmail', async () => {
    const repository = new InMemoryUserRepository();
    const user = User.reconstitute({
      id: 'existing-id',
      email: 'ada@example.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$c29tZWhhc2g',
      emailVerified: false,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      oauthProviders: [],
      verificationToken: 'expired-token',
      verificationTokenExpiresAt: new Date('2024-01-02T00:00:00.000Z'),
    });
    await repository.save(user);
    const useCase = new VerifyEmailUseCase(repository);

    await expect(useCase.execute('expired-token')).rejects.toThrow(DomainError);
  });
});
