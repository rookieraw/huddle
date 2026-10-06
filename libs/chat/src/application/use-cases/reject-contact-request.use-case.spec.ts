import { ContactRelationship } from '../../domain/contact-relationship.entity';
import {
  ContactRelationshipNotFoundError,
  ContactRequestAlreadyAcceptedError,
} from './accept-contact-request.use-case';
import {
  ContactRequestAlreadyRejectedError,
  ContactRequestRejectionNotAuthorizedError,
  ContactRequestRejectionUnavailableError,
  RejectContactRequestUseCase,
} from './reject-contact-request.use-case';

type ContactRelationshipRepositoryMock = {
  findCurrentByUserPair: jest.Mock;
  findById: jest.Mock;
  save: jest.Mock;
  transitionFromPending: jest.Mock;
};

function createRepository(
  overrides: Partial<ContactRelationshipRepositoryMock> = {},
): ContactRelationshipRepositoryMock {
  return {
    findCurrentByUserPair: jest.fn(),
    findById: jest.fn(),
    save: jest.fn(),
    transitionFromPending: jest.fn(),
    ...overrides,
  };
}

describe('RejectContactRequestUseCase', () => {
  it('loads, rejects, transitions, and returns an existing pending relationship for its original recipient', async () => {
    const relationshipId = 'relationship-pending';
    const recipientId = 'user-original-recipient';
    const relationship = ContactRelationship.reconstitute({
      id: relationshipId,
      requesterId: 'user-original-requester',
      recipientId,
      status: 'pending',
    });
    const reject = jest.spyOn(relationship, 'reject');
    const contactRelationshipRepository = createRepository({
      findById: jest.fn().mockResolvedValue(relationship),
      transitionFromPending: jest.fn().mockResolvedValue(true),
    });
    const useCase = new RejectContactRequestUseCase(
      contactRelationshipRepository,
    );

    const result = await useCase.execute({
      rejectingUserId: recipientId,
      relationshipId,
    });

    expect(contactRelationshipRepository.findById).toHaveBeenCalledTimes(1);
    expect(contactRelationshipRepository.findById).toHaveBeenCalledWith(
      relationshipId,
    );
    expect(reject).toHaveBeenCalledTimes(1);
    expect(reject).toHaveBeenCalledWith(recipientId);
    expect(
      contactRelationshipRepository.transitionFromPending,
    ).toHaveBeenCalledTimes(1);
    expect(
      contactRelationshipRepository.transitionFromPending,
    ).toHaveBeenCalledWith(relationship);
    expect(contactRelationshipRepository.save).not.toHaveBeenCalled();
    expect(result).toBe(relationship);
    expect(result.id).toBe(relationshipId);
    expect(result.isRejected()).toBe(true);
  });

  it('reports a missing relationship without transitioning', async () => {
    const relationshipId = 'relationship-missing';
    const contactRelationshipRepository = createRepository({
      findById: jest.fn().mockResolvedValue(null),
    });
    const useCase = new RejectContactRequestUseCase(
      contactRelationshipRepository,
    );

    const execution = useCase.execute({
      rejectingUserId: 'user-rejecting',
      relationshipId,
    });

    await expect(execution).rejects.toBeInstanceOf(
      ContactRelationshipNotFoundError,
    );
    expect(contactRelationshipRepository.findById).toHaveBeenCalledTimes(1);
    expect(contactRelationshipRepository.findById).toHaveBeenCalledWith(
      relationshipId,
    );
    expect(
      contactRelationshipRepository.transitionFromPending,
    ).not.toHaveBeenCalled();
    expect(contactRelationshipRepository.save).not.toHaveBeenCalled();
  });

  it('reports lookup unavailability without transitioning', async () => {
    const relationshipId = 'relationship-unavailable';
    const contactRelationshipRepository = createRepository({
      findById: jest.fn().mockRejectedValue(new Error('lookup unavailable')),
    });
    const useCase = new RejectContactRequestUseCase(
      contactRelationshipRepository,
    );

    const execution = useCase.execute({
      rejectingUserId: 'user-rejecting',
      relationshipId,
    });

    await expect(execution).rejects.toBeInstanceOf(
      ContactRequestRejectionUnavailableError,
    );
    expect(contactRelationshipRepository.findById).toHaveBeenCalledTimes(1);
    expect(contactRelationshipRepository.findById).toHaveBeenCalledWith(
      relationshipId,
    );
    expect(
      contactRelationshipRepository.transitionFromPending,
    ).not.toHaveBeenCalled();
    expect(contactRelationshipRepository.save).not.toHaveBeenCalled();
  });

  it.each([
    {
      actor: 'original requester',
      rejectingUserId: 'user-original-requester',
    },
    {
      actor: 'unrelated user',
      rejectingUserId: 'user-unrelated',
    },
  ])(
    'rejects $actor without rejecting or transitioning',
    async ({ rejectingUserId }) => {
      const relationship = ContactRelationship.reconstitute({
        id: 'relationship-pending',
        requesterId: 'user-original-requester',
        recipientId: 'user-original-recipient',
        status: 'pending',
      });
      const reject = jest.spyOn(relationship, 'reject');
      const contactRelationshipRepository = createRepository({
        findById: jest.fn().mockResolvedValue(relationship),
      });
      const useCase = new RejectContactRequestUseCase(
        contactRelationshipRepository,
      );

      const execution = useCase.execute({
        rejectingUserId,
        relationshipId: relationship.id,
      });

      await expect(execution).rejects.toBeInstanceOf(
        ContactRequestRejectionNotAuthorizedError,
      );
      expect(contactRelationshipRepository.findById).toHaveBeenCalledWith(
        relationship.id,
      );
      expect(reject).not.toHaveBeenCalled();
      expect(
        contactRelationshipRepository.transitionFromPending,
      ).not.toHaveBeenCalled();
      expect(contactRelationshipRepository.save).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      state: 'accepted',
      status: 'accepted' as const,
      expectedError: ContactRequestAlreadyAcceptedError,
    },
    {
      state: 'rejected',
      status: 'rejected' as const,
      expectedError: ContactRequestAlreadyRejectedError,
    },
  ])(
    'reports an already $state relationship to its recipient without rejecting or transitioning',
    async ({ status, expectedError }) => {
      const recipientId = 'user-original-recipient';
      const relationship = ContactRelationship.reconstitute({
        id: 'relationship-resolved',
        requesterId: 'user-original-requester',
        recipientId,
        status,
      });
      const reject = jest.spyOn(relationship, 'reject');
      const contactRelationshipRepository = createRepository({
        findById: jest.fn().mockResolvedValue(relationship),
      });
      const useCase = new RejectContactRequestUseCase(
        contactRelationshipRepository,
      );

      const execution = useCase.execute({
        rejectingUserId: recipientId,
        relationshipId: relationship.id,
      });

      await expect(execution).rejects.toBeInstanceOf(expectedError);
      expect(contactRelationshipRepository.findById).toHaveBeenCalledWith(
        relationship.id,
      );
      expect(reject).not.toHaveBeenCalled();
      expect(
        contactRelationshipRepository.transitionFromPending,
      ).not.toHaveBeenCalled();
      expect(contactRelationshipRepository.save).not.toHaveBeenCalled();
    },
  );

  it('reports transition unavailability instead of returning success', async () => {
    const recipientId = 'user-original-recipient';
    const relationship = ContactRelationship.reconstitute({
      id: 'relationship-transition-unavailable',
      requesterId: 'user-original-requester',
      recipientId,
      status: 'pending',
    });
    const contactRelationshipRepository = createRepository({
      findById: jest.fn().mockResolvedValue(relationship),
      transitionFromPending: jest
        .fn()
        .mockRejectedValue(new Error('transition unavailable')),
    });
    const useCase = new RejectContactRequestUseCase(
      contactRelationshipRepository,
    );

    const execution = useCase.execute({
      rejectingUserId: recipientId,
      relationshipId: relationship.id,
    });

    await expect(execution).rejects.toBeInstanceOf(
      ContactRequestRejectionUnavailableError,
    );
    expect(contactRelationshipRepository.findById).toHaveBeenCalledWith(
      relationship.id,
    );
    expect(
      contactRelationshipRepository.transitionFromPending,
    ).toHaveBeenCalledTimes(1);
    expect(
      contactRelationshipRepository.transitionFromPending,
    ).toHaveBeenCalledWith(relationship);
    expect(contactRelationshipRepository.save).not.toHaveBeenCalled();
  });

  it.each([
    {
      state: 'accepted',
      status: 'accepted' as const,
      expectedError: ContactRequestAlreadyAcceptedError,
    },
    {
      state: 'rejected',
      status: 'rejected' as const,
      expectedError: ContactRequestAlreadyRejectedError,
    },
  ])(
    'reports the $state state when a concurrent resolution wins the transition',
    async ({ status, expectedError }) => {
      const recipientId = 'user-original-recipient';
      const requesterId = 'user-original-requester';
      const relationshipId = 'relationship-concurrent';
      const loadedPending = ContactRelationship.reconstitute({
        id: relationshipId,
        requesterId,
        recipientId,
        status: 'pending',
      });
      const reloadedResolved = ContactRelationship.reconstitute({
        id: relationshipId,
        requesterId,
        recipientId,
        status,
      });
      const contactRelationshipRepository = createRepository({
        findById: jest
          .fn()
          .mockResolvedValueOnce(loadedPending)
          .mockResolvedValueOnce(reloadedResolved),
        transitionFromPending: jest.fn().mockResolvedValue(false),
      });
      const useCase = new RejectContactRequestUseCase(
        contactRelationshipRepository,
      );

      const execution = useCase.execute({
        rejectingUserId: recipientId,
        relationshipId,
      });

      await expect(execution).rejects.toBeInstanceOf(expectedError);
      expect(contactRelationshipRepository.findById).toHaveBeenCalledTimes(2);
      expect(contactRelationshipRepository.findById).toHaveBeenNthCalledWith(
        1,
        relationshipId,
      );
      expect(contactRelationshipRepository.findById).toHaveBeenNthCalledWith(
        2,
        relationshipId,
      );
      expect(
        contactRelationshipRepository.transitionFromPending,
      ).toHaveBeenCalledTimes(1);
      expect(contactRelationshipRepository.save).not.toHaveBeenCalled();
    },
  );

  it('reports unavailability instead of success when the transition is not applied but the relationship is still pending', async () => {
    const recipientId = 'user-original-recipient';
    const requesterId = 'user-original-requester';
    const relationshipId = 'relationship-still-pending';
    const loadedPending = ContactRelationship.reconstitute({
      id: relationshipId,
      requesterId,
      recipientId,
      status: 'pending',
    });
    const reloadedPending = ContactRelationship.reconstitute({
      id: relationshipId,
      requesterId,
      recipientId,
      status: 'pending',
    });
    const contactRelationshipRepository = createRepository({
      findById: jest
        .fn()
        .mockResolvedValueOnce(loadedPending)
        .mockResolvedValueOnce(reloadedPending),
      transitionFromPending: jest.fn().mockResolvedValue(false),
    });
    const useCase = new RejectContactRequestUseCase(
      contactRelationshipRepository,
    );

    const execution = useCase.execute({
      rejectingUserId: recipientId,
      relationshipId,
    });

    await expect(execution).rejects.toBeInstanceOf(
      ContactRequestRejectionUnavailableError,
    );
    expect(contactRelationshipRepository.findById).toHaveBeenCalledTimes(2);
    expect(
      contactRelationshipRepository.transitionFromPending,
    ).toHaveBeenCalledTimes(1);
    expect(contactRelationshipRepository.save).not.toHaveBeenCalled();
  });

  it('reports re-read unavailability when the transition is not applied', async () => {
    const recipientId = 'user-original-recipient';
    const relationship = ContactRelationship.reconstitute({
      id: 'relationship-reread-unavailable',
      requesterId: 'user-original-requester',
      recipientId,
      status: 'pending',
    });
    const contactRelationshipRepository = createRepository({
      findById: jest
        .fn()
        .mockResolvedValueOnce(relationship)
        .mockRejectedValueOnce(new Error('re-read unavailable')),
      transitionFromPending: jest.fn().mockResolvedValue(false),
    });
    const useCase = new RejectContactRequestUseCase(
      contactRelationshipRepository,
    );

    const execution = useCase.execute({
      rejectingUserId: recipientId,
      relationshipId: relationship.id,
    });

    await expect(execution).rejects.toBeInstanceOf(
      ContactRequestRejectionUnavailableError,
    );
    expect(contactRelationshipRepository.findById).toHaveBeenCalledTimes(2);
    expect(
      contactRelationshipRepository.transitionFromPending,
    ).toHaveBeenCalledTimes(1);
    expect(contactRelationshipRepository.save).not.toHaveBeenCalled();
  });

  it('reports unavailability when the transition is not applied and the relationship can no longer be read', async () => {
    const recipientId = 'user-original-recipient';
    const relationship = ContactRelationship.reconstitute({
      id: 'relationship-reread-missing',
      requesterId: 'user-original-requester',
      recipientId,
      status: 'pending',
    });
    const contactRelationshipRepository = createRepository({
      findById: jest
        .fn()
        .mockResolvedValueOnce(relationship)
        .mockResolvedValueOnce(null),
      transitionFromPending: jest.fn().mockResolvedValue(false),
    });
    const useCase = new RejectContactRequestUseCase(
      contactRelationshipRepository,
    );

    const execution = useCase.execute({
      rejectingUserId: recipientId,
      relationshipId: relationship.id,
    });

    await expect(execution).rejects.toBeInstanceOf(
      ContactRequestRejectionUnavailableError,
    );
    expect(contactRelationshipRepository.findById).toHaveBeenCalledTimes(2);
    expect(
      contactRelationshipRepository.transitionFromPending,
    ).toHaveBeenCalledTimes(1);
    expect(contactRelationshipRepository.save).not.toHaveBeenCalled();
  });
});
