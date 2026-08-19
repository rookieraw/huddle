import { ContactRelationship } from '../../domain/contact-relationship.entity';
import type { ContactRelationshipRepository } from '../ports/contact-relationship.repository.port';
import type { ContactTargetDirectory } from '../ports/contact-target-directory.port';
import {
  ContactTargetNotFoundError,
  SendContactRequestUseCase,
} from './send-contact-request.use-case';

class MissingContactTargetDirectory implements ContactTargetDirectory {
  async targetUserExists(targetUserId: string): Promise<boolean> {
    void targetUserId;

    return false;
  }
}

class ExistingContactTargetDirectory implements ContactTargetDirectory {
  readonly targetUserExists = jest.fn(
    async (targetUserId: string): Promise<boolean> => {
      void targetUserId;

      return true;
    },
  );
}

class FailingContactTargetDirectory implements ContactTargetDirectory {
  constructor(private readonly failure: Error) {}

  async targetUserExists(targetUserId: string): Promise<boolean> {
    void targetUserId;

    throw this.failure;
  }
}

class RecordingContactRelationshipRepository implements ContactRelationshipRepository {
  private readonly currentRelationships: ContactRelationship[] = [];

  readonly findCurrentByUserPair = jest.fn(
    async (
      firstUserId: string,
      secondUserId: string,
    ): Promise<ContactRelationship | null> =>
      this.currentRelationships.find(
        (relationship) =>
          (relationship.requesterId === firstUserId &&
            relationship.recipientId === secondUserId) ||
          (relationship.requesterId === secondUserId &&
            relationship.recipientId === firstUserId),
      ) ?? null,
  );

  readonly save = jest.fn(
    async (relationship: ContactRelationship): Promise<void> => {
      this.currentRelationships.push(relationship);
    },
  );
}

describe('SendContactRequestUseCase', () => {
  it('rejects a confirmed missing target without saving a relationship', async () => {
    const contactTargetDirectory = new MissingContactTargetDirectory();
    const contactRelationshipRepository =
      new RecordingContactRelationshipRepository();
    const useCase = new SendContactRequestUseCase(
      contactTargetDirectory,
      contactRelationshipRepository,
    );

    const execution = useCase.execute({
      requesterId: 'user-requester',
      targetUserId: 'missing-user',
    });

    await expect(execution).rejects.toBeInstanceOf(ContactTargetNotFoundError);
    expect(contactRelationshipRepository.save).not.toHaveBeenCalled();
  });

  it('preserves a Directory dependency failure without saving a relationship', async () => {
    const directoryFailure = new Error('Directory unavailable');
    const contactTargetDirectory = new FailingContactTargetDirectory(
      directoryFailure,
    );
    const contactRelationshipRepository =
      new RecordingContactRelationshipRepository();
    const useCase = new SendContactRequestUseCase(
      contactTargetDirectory,
      contactRelationshipRepository,
    );

    const execution = useCase.execute({
      requesterId: 'user-requester',
      targetUserId: 'user-target',
    });

    await expect(execution).rejects.toBe(directoryFailure);
    expect(contactRelationshipRepository.save).not.toHaveBeenCalled();
  });

  it('preserves a repository lookup failure without saving a relationship', async () => {
    const repositoryFailure = new Error('Relationship lookup unavailable');
    const contactTargetDirectory = new ExistingContactTargetDirectory();
    const contactRelationshipRepository =
      new RecordingContactRelationshipRepository();
    contactRelationshipRepository.findCurrentByUserPair.mockRejectedValueOnce(
      repositoryFailure,
    );
    const useCase = new SendContactRequestUseCase(
      contactTargetDirectory,
      contactRelationshipRepository,
    );

    const execution = useCase.execute({
      requesterId: 'user-requester',
      targetUserId: 'user-target',
    });

    await expect(execution).rejects.toBe(repositoryFailure);
    expect(contactRelationshipRepository.save).not.toHaveBeenCalled();
  });

  it('preserves a repository save failure without reporting success', async () => {
    const repositoryFailure = new Error('Relationship save unavailable');
    const contactTargetDirectory = new ExistingContactTargetDirectory();
    const contactRelationshipRepository =
      new RecordingContactRelationshipRepository();
    contactRelationshipRepository.save.mockRejectedValueOnce(repositoryFailure);
    const useCase = new SendContactRequestUseCase(
      contactTargetDirectory,
      contactRelationshipRepository,
    );

    const execution = useCase.execute({
      requesterId: 'user-requester',
      targetUserId: 'user-target',
    });

    await expect(execution).rejects.toBe(repositoryFailure);
    expect(contactRelationshipRepository.save).toHaveBeenCalledTimes(1);
  });

  it('saves one pending relationship for a valid first request', async () => {
    const contactTargetDirectory = new ExistingContactTargetDirectory();
    const contactRelationshipRepository =
      new RecordingContactRelationshipRepository();
    const useCase = new SendContactRequestUseCase(
      contactTargetDirectory,
      contactRelationshipRepository,
    );

    await useCase.execute({
      requesterId: 'user-requester',
      targetUserId: 'user-target',
    });

    expect(contactTargetDirectory.targetUserExists).toHaveBeenCalledTimes(1);
    expect(contactTargetDirectory.targetUserExists).toHaveBeenCalledWith(
      'user-target',
    );
    expect(contactRelationshipRepository.save).toHaveBeenCalledTimes(1);

    const relationship = contactRelationshipRepository.save.mock.calls[0]?.[0];

    expect(relationship?.requesterId).toBe('user-requester');
    expect(relationship?.recipientId).toBe('user-target');
    expect(relationship?.isPending()).toBe(true);
  });

  it('reuses an existing current relationship without a second save', async () => {
    const contactTargetDirectory = new ExistingContactTargetDirectory();
    const contactRelationshipRepository =
      new RecordingContactRelationshipRepository();
    const useCase = new SendContactRequestUseCase(
      contactTargetDirectory,
      contactRelationshipRepository,
    );

    await useCase.execute({
      requesterId: 'user-requester',
      targetUserId: 'user-target',
    });
    await useCase.execute({
      requesterId: 'user-requester',
      targetUserId: 'user-target',
    });

    expect(contactRelationshipRepository.save).toHaveBeenCalledTimes(1);
    expect(
      contactRelationshipRepository.findCurrentByUserPair,
    ).toHaveBeenCalledTimes(2);
    expect(
      contactRelationshipRepository.findCurrentByUserPair,
    ).toHaveBeenNthCalledWith(1, 'user-requester', 'user-target');
    expect(
      contactRelationshipRepository.findCurrentByUserPair,
    ).toHaveBeenNthCalledWith(2, 'user-requester', 'user-target');
  });

  it('preserves existing roles for a sequential opposing request', async () => {
    const contactTargetDirectory = new ExistingContactTargetDirectory();
    const contactRelationshipRepository =
      new RecordingContactRelationshipRepository();
    const useCase = new SendContactRequestUseCase(
      contactTargetDirectory,
      contactRelationshipRepository,
    );

    await useCase.execute({
      requesterId: 'user-original-requester',
      targetUserId: 'user-original-recipient',
    });
    await useCase.execute({
      requesterId: 'user-original-recipient',
      targetUserId: 'user-original-requester',
    });

    expect(
      contactRelationshipRepository.findCurrentByUserPair,
    ).toHaveBeenCalledTimes(2);
    expect(
      contactRelationshipRepository.findCurrentByUserPair,
    ).toHaveBeenNthCalledWith(
      1,
      'user-original-requester',
      'user-original-recipient',
    );
    expect(
      contactRelationshipRepository.findCurrentByUserPair,
    ).toHaveBeenNthCalledWith(
      2,
      'user-original-recipient',
      'user-original-requester',
    );
    expect(contactRelationshipRepository.save).toHaveBeenCalledTimes(1);

    const existingRelationship =
      contactRelationshipRepository.save.mock.calls[0]?.[0];

    expect(existingRelationship?.requesterId).toBe('user-original-requester');
    expect(existingRelationship?.recipientId).toBe('user-original-recipient');
    expect(existingRelationship?.isPending()).toBe(true);
  });
});
