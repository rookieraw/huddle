import type { ContactRelationship } from '../../domain/contact-relationship.entity';
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
  async targetUserExists(targetUserId: string): Promise<boolean> {
    void targetUserId;

    return true;
  }
}

class FailingContactTargetDirectory implements ContactTargetDirectory {
  constructor(private readonly failure: Error) {}

  async targetUserExists(targetUserId: string): Promise<boolean> {
    void targetUserId;

    throw this.failure;
  }
}

class RecordingContactRelationshipRepository implements ContactRelationshipRepository {
  readonly savedRelationships: ContactRelationship[] = [];

  async save(relationship: ContactRelationship): Promise<void> {
    this.savedRelationships.push(relationship);
  }
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
    expect(contactRelationshipRepository.savedRelationships).toEqual([]);
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
    expect(contactRelationshipRepository.savedRelationships).toEqual([]);
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

    expect(contactRelationshipRepository.savedRelationships).toHaveLength(1);

    const [relationship] = contactRelationshipRepository.savedRelationships;

    expect(relationship?.requesterId).toBe('user-requester');
    expect(relationship?.recipientId).toBe('user-target');
    expect(relationship?.isPending()).toBe(true);
  });
});
