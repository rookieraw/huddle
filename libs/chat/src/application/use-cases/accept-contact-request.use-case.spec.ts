import { ContactRelationship } from '../../domain/contact-relationship.entity';
import {
  AcceptContactRequestUseCase,
  ContactRequestAcceptanceUnavailableError,
  ContactRequestAcceptanceNotAuthorizedError,
} from './accept-contact-request.use-case';
import {
  ContactRelationshipNotFoundError,
  ContactRequestAlreadyAcceptedError,
  ContactRequestAlreadyRejectedError,
} from './contact-request.errors';

describe('AcceptContactRequestUseCase', () => {
  it('loads, accepts, transitions, and returns an existing pending relationship for its original recipient', async () => {
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
      transitionFromPending: jest.fn().mockResolvedValue(true),
      findCurrentByUserPair: jest.fn(),
      findById: jest.fn().mockResolvedValue(relationship),
      save: jest.fn(),
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
    expect(
      contactRelationshipRepository.transitionFromPending,
    ).toHaveBeenCalledTimes(1);
    expect(
      contactRelationshipRepository.transitionFromPending,
    ).toHaveBeenCalledWith(relationship);
    expect(contactRelationshipRepository.save).not.toHaveBeenCalled();
    expect(result).toBe(relationship);
    expect(result.id).toBe(relationshipId);
    expect(result.isAccepted()).toBe(true);
  });

  it('reports a missing relationship without transitioning', async () => {
    const relationshipId = 'relationship-missing';
    const contactRelationshipRepository = {
      transitionFromPending: jest.fn(),
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
    expect(
      contactRelationshipRepository.transitionFromPending,
    ).not.toHaveBeenCalled();
  });

  it('reports lookup unavailability without transitioning', async () => {
    const relationshipId = 'relationship-unavailable';
    const contactRelationshipRepository = {
      transitionFromPending: jest.fn(),
      findCurrentByUserPair: jest.fn(),
      findById: jest.fn().mockRejectedValue(new Error('lookup unavailable')),
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
      ContactRequestAcceptanceUnavailableError,
    );
    expect(contactRelationshipRepository.findById).toHaveBeenCalledTimes(1);
    expect(contactRelationshipRepository.findById).toHaveBeenCalledWith(
      relationshipId,
    );
    expect(
      contactRelationshipRepository.transitionFromPending,
    ).not.toHaveBeenCalled();
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
    'rejects $actor without accepting or transitioning',
    async ({ acceptingUserId }) => {
      const relationship = ContactRelationship.reconstitute({
        id: 'relationship-pending',
        requesterId: 'user-original-requester',
        recipientId: 'user-original-recipient',
        status: 'pending',
      });
      const accept = jest.spyOn(relationship, 'accept');
      const contactRelationshipRepository = {
        transitionFromPending: jest.fn(),
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
      expect(
        contactRelationshipRepository.transitionFromPending,
      ).not.toHaveBeenCalled();
    },
  );

  it('reports an already accepted relationship without accepting or transitioning again', async () => {
    const recipientId = 'user-original-recipient';
    const relationship = ContactRelationship.reconstitute({
      id: 'relationship-accepted',
      requesterId: 'user-original-requester',
      recipientId,
      status: 'accepted',
    });
    const accept = jest.spyOn(relationship, 'accept');
    const contactRelationshipRepository = {
      transitionFromPending: jest.fn(),
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
    expect(
      contactRelationshipRepository.transitionFromPending,
    ).not.toHaveBeenCalled();
  });

  it('reports an already rejected relationship without accepting or writing', async () => {
    const recipientId = 'user-original-recipient';
    const relationship = ContactRelationship.reconstitute({
      id: 'relationship-rejected',
      requesterId: 'user-original-requester',
      recipientId,
      status: 'rejected',
    });
    const accept = jest.spyOn(relationship, 'accept');
    const contactRelationshipRepository = {
      transitionFromPending: jest.fn(),
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
      ContactRequestAlreadyRejectedError,
    );
    expect(contactRelationshipRepository.findById).toHaveBeenCalledWith(
      relationship.id,
    );
    expect(accept).not.toHaveBeenCalled();
    expect(
      contactRelationshipRepository.transitionFromPending,
    ).not.toHaveBeenCalled();
    expect(contactRelationshipRepository.save).not.toHaveBeenCalled();
  });

  it('reports transition unavailability instead of returning success', async () => {
    const recipientId = 'user-original-recipient';
    const relationship = ContactRelationship.reconstitute({
      id: 'relationship-transition-unavailable',
      requesterId: 'user-original-requester',
      recipientId,
      status: 'pending',
    });
    const contactRelationshipRepository = {
      transitionFromPending: jest
        .fn()
        .mockRejectedValue(new Error('transition unavailable')),
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
      ContactRequestAcceptanceUnavailableError,
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
      const contactRelationshipRepository = {
        transitionFromPending: jest.fn().mockResolvedValue(false),
        findCurrentByUserPair: jest.fn(),
        findById: jest
          .fn()
          .mockResolvedValueOnce(loadedPending)
          .mockResolvedValueOnce(reloadedResolved),
        save: jest.fn(),
      };
      const useCase = new AcceptContactRequestUseCase(
        contactRelationshipRepository,
      );

      const execution = useCase.execute({
        acceptingUserId: recipientId,
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

  it.each([
    {
      reread: 'is still pending',
      reloaded: () =>
        ContactRelationship.reconstitute({
          id: 'relationship-unconfirmed',
          requesterId: 'user-original-requester',
          recipientId: 'user-original-recipient',
          status: 'pending',
        }),
    },
    {
      reread: 'can no longer be read',
      reloaded: () => null,
    },
  ])(
    'reports unavailability instead of success when the transition is not applied and the relationship $reread',
    async ({ reloaded }) => {
      const recipientId = 'user-original-recipient';
      const loadedPending = ContactRelationship.reconstitute({
        id: 'relationship-unconfirmed',
        requesterId: 'user-original-requester',
        recipientId,
        status: 'pending',
      });
      const contactRelationshipRepository = {
        transitionFromPending: jest.fn().mockResolvedValue(false),
        findCurrentByUserPair: jest.fn(),
        findById: jest
          .fn()
          .mockResolvedValueOnce(loadedPending)
          .mockResolvedValueOnce(reloaded()),
        save: jest.fn(),
      };
      const useCase = new AcceptContactRequestUseCase(
        contactRelationshipRepository,
      );

      const execution = useCase.execute({
        acceptingUserId: recipientId,
        relationshipId: loadedPending.id,
      });

      await expect(execution).rejects.toBeInstanceOf(
        ContactRequestAcceptanceUnavailableError,
      );
      expect(contactRelationshipRepository.findById).toHaveBeenCalledTimes(2);
      expect(
        contactRelationshipRepository.transitionFromPending,
      ).toHaveBeenCalledTimes(1);
      expect(contactRelationshipRepository.save).not.toHaveBeenCalled();
    },
  );

  it('reports re-read unavailability when the transition is not applied', async () => {
    const recipientId = 'user-original-recipient';
    const relationship = ContactRelationship.reconstitute({
      id: 'relationship-reread-unavailable',
      requesterId: 'user-original-requester',
      recipientId,
      status: 'pending',
    });
    const contactRelationshipRepository = {
      transitionFromPending: jest.fn().mockResolvedValue(false),
      findCurrentByUserPair: jest.fn(),
      findById: jest
        .fn()
        .mockResolvedValueOnce(relationship)
        .mockRejectedValueOnce(new Error('re-read unavailable')),
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
      ContactRequestAcceptanceUnavailableError,
    );
    expect(contactRelationshipRepository.findById).toHaveBeenCalledTimes(2);
    expect(
      contactRelationshipRepository.transitionFromPending,
    ).toHaveBeenCalledTimes(1);
    expect(contactRelationshipRepository.save).not.toHaveBeenCalled();
  });
});
