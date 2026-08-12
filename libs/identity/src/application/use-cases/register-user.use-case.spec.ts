import { DomainError } from '@huddle/shared-kernel';
import { InMemoryUserRepository } from '../../test-support/in-memory-user.repository';
import { RegisterUserUseCase } from './register-user.use-case';

describe('RegisterUserUseCase', () => {
  it('registers a new user and persists it via the repository', async () => {
    const repository = new InMemoryUserRepository();
    const useCase = new RegisterUserUseCase(repository);

    const { user } = await useCase.execute(
      'ada@example.com',
      'correct-horse-battery',
      'Ada Lovelace',
    );

    await expect(repository.findByEmail('ada@example.com')).resolves.toBe(user);
  });

  it('rejects registration when the email is already taken', async () => {
    const repository = new InMemoryUserRepository();
    const useCase = new RegisterUserUseCase(repository);
    await useCase.execute(
      'ada@example.com',
      'correct-horse-battery',
      'Ada Lovelace',
    );

    await expect(
      useCase.execute(
        'ada@example.com',
        'a-different-password',
        'Ada Lovelace',
      ),
    ).rejects.toThrow(DomainError);
  });

  it('does not persist anything when rejecting a duplicate', async () => {
    const repository = new InMemoryUserRepository();
    const saveSpy = jest.spyOn(repository, 'save');
    const useCase = new RegisterUserUseCase(repository);
    await useCase.execute(
      'ada@example.com',
      'correct-horse-battery',
      'Ada Lovelace',
    );
    saveSpy.mockClear();

    await useCase
      .execute('ada@example.com', 'a-different-password', 'Ada Lovelace')
      .catch(() => {});

    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('stores the provided display name on the registered user', async () => {
    const repository = new InMemoryUserRepository();
    const useCase = new RegisterUserUseCase(repository);

    const { user } = await useCase.execute(
      'ada@example.com',
      'correct-horse-battery',
      'Ada Lovelace',
    );

    expect(user.getDisplayName()).toBe('Ada Lovelace');
  });

  it('propagates a DomainError when the display name is empty after trimming', async () => {
    const repository = new InMemoryUserRepository();
    const useCase = new RegisterUserUseCase(repository);

    await expect(
      useCase.execute('ada@example.com', 'correct-horse-battery', '   '),
    ).rejects.toThrow(DomainError);
  });

  it('propagates a DomainError when the display name exceeds 50 characters', async () => {
    const repository = new InMemoryUserRepository();
    const useCase = new RegisterUserUseCase(repository);

    await expect(
      useCase.execute(
        'ada@example.com',
        'correct-horse-battery',
        'A'.repeat(51),
      ),
    ).rejects.toThrow(DomainError);
  });
});
