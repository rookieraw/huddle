import { ContactRelationship } from '../../domain/contact-relationship.entity';
import {
  AcceptContactRequestUseCase,
  ContactRequestAlreadyAcceptedError,
  ContactRequestAcceptanceNotAuthorizedError,
  ContactRelationshipNotFoundError,
} from './accept-contact-request.use-case';

describe('AcceptContactRequestUseCase', () => {
  it('loads, accepts, saves, and returns an existing pending relationship for its original recipient', async () => {
    const relationshipId = 'relationship-pending';
    const recipientId = 'user-original-recipient';
    const relationship = ContactRelationship.reconstitute({
      id: relationshipId,
      requesterId: 'user-original-requester',
      recipientId,
      status: 'pending',
    });
    const accept = jest.spyOn(relationship, 'accept');
    const contactRelationshipRepository = {
      findCurrentByUserPair: jest.fn(),
      findById: jest.fn().mockResolvedValue(relationship),
      save: jest.fn(
        async (
          relationshipToSave: ContactRelationship,
        ): Promise<ContactRelationship> => relationshipToSave,
      ),
    };
    const useCase = new AcceptContactRequestUseCase(
      contactRelationshipRepository,
    );

    const result = await useCase.execute({
      acceptingUserId: recipientId,
      relationshipId,
    });

    expect(contactRelationshipRepository.findById).toHaveBeenCalledTimes(1);
    expect(contactRelationshipRepository.findById).toHaveBeenCalledWith(
      relationshipId,
    );
    expect(accept).toHaveBeenCalledTimes(1);
    expect(accept).toHaveBeenCalledWith(recipientId);
    expect(contactRelationshipRepository.save).toHaveBeenCalledTimes(1);
    expect(contactRelationshipRepository.save).toHaveBeenCalledWith(
      relationship,
    );
    expect(result).toBe(relationship);
    expect(result.id).toBe(relationshipId);
    expect(result.isAccepted()).toBe(true);
  });

  it('reports a missing relationship without saving', async () => {
    const relationshipId = 'relationship-missing';
    const contactRelationshipRepository = {
      findCurrentByUserPair: jest.fn(),
      findById: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
    };
    const useCase = new AcceptContactRequestUseCase(
      contactRelationshipRepository,
    );

    const execution = useCase.execute({
      acceptingUserId: 'user-accepting',
      relationshipId,
    });

    await expect(execution).rejects.toBeInstanceOf(
      ContactRelationshipNotFoundError,
    );
    expect(contactRelationshipRepository.findById).toHaveBeenCalledTimes(1);
    expect(contactRelationshipRepository.findById).toHaveBeenCalledWith(
      relationshipId,
    );
    expect(contactRelationshipRepository.save).not.toHaveBeenCalled();
  });

  it.each([
    {
      actor: 'original requester',
      acceptingUserId: 'user-original-requester',
    },
    {
      actor: 'unrelated user',
      acceptingUserId: 'user-unrelated',
    },
  ])(
    'rejects $actor without accepting or saving',
    async ({ acceptingUserId }) => {
      const relationship = ContactRelationship.reconstitute({
        id: 'relationship-pending',
        requesterId: 'user-original-requester',
        recipientId: 'user-original-recipient',
        status: 'pending',
      });
      const accept = jest.spyOn(relationship, 'accept');
      const contactRelationshipRepository = {
        findCurrentByUserPair: jest.fn(),
        findById: jest.fn().mockResolvedValue(relationship),
        save: jest.fn(),
      };
      const useCase = new AcceptContactRequestUseCase(
        contactRelationshipRepository,
      );

      const execution = useCase.execute({
        acceptingUserId,
        relationshipId: relationship.id,
      });

      await expect(execution).rejects.toBeInstanceOf(
        ContactRequestAcceptanceNotAuthorizedError,
      );
      expect(contactRelationshipRepository.findById).toHaveBeenCalledWith(
        relationship.id,
      );
      expect(accept).not.toHaveBeenCalled();
      expect(contactRelationshipRepository.save).not.toHaveBeenCalled();
    },
  );

  it('reports an already accepted relationship without accepting or saving again', async () => {
    const recipientId = 'user-original-recipient';
    const relationship = ContactRelationship.reconstitute({
      id: 'relationship-accepted',
      requesterId: 'user-original-requester',
      recipientId,
      status: 'accepted',
    });
    const accept = jest.spyOn(relationship, 'accept');
    const contactRelationshipRepository = {
      findCurrentByUserPair: jest.fn(),
      findById: jest.fn().mockResolvedValue(relationship),
      save: jest.fn(),
    };
    const useCase = new AcceptContactRequestUseCase(
      contactRelationshipRepository,
    );

    const execution = useCase.execute({
      acceptingUserId: recipientId,
      relationshipId: relationship.id,
    });

    await expect(execution).rejects.toBeInstanceOf(
      ContactRequestAlreadyAcceptedError,
    );
    expect(contactRelationshipRepository.findById).toHaveBeenCalledWith(
      relationship.id,
    );
    expect(accept).not.toHaveBeenCalled();
    expect(contactRelationshipRepository.save).not.toHaveBeenCalled();
  });
});
