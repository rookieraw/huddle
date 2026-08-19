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
});
