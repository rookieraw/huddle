import { ContactRelationship } from '../../domain/contact-relationship.entity';
import {
  ContactNotFoundError,
  ContactRemovalUnavailableError,
  RemoveContactUseCase,
} from './remove-contact.use-case';

type ContactRelationshipRepositoryMock = {
  findAcceptedByUser: jest.Mock;
  findCurrentByUserPair: jest.Mock;
  findById: jest.Mock;
  findPendingByRecipient: jest.Mock;
  findPendingByRequester: jest.Mock;
  save: jest.Mock;
  transitionFromPending: jest.Mock;
  transitionFromAccepted: jest.Mock;
};

function createRepository(
  overrides: Partial<ContactRelationshipRepositoryMock> = {},
): ContactRelationshipRepositoryMock {
  return {
    findAcceptedByUser: jest.fn(),
    findCurrentByUserPair: jest.fn(),
    findById: jest.fn(),
    findPendingByRecipient: jest.fn(),
    findPendingByRequester: jest.fn(),
    save: jest.fn(),
    transitionFromPending: jest.fn(),
    transitionFromAccepted: jest.fn(),
    ...overrides,
  };
}

describe('RemoveContactUseCase', () => {
  it('removes an accepted relationship at the clock time and transitions it from accepted', async () => {
    const removingUserId = 'user-original-recipient';
    const contactUserId = 'user-original-requester';
    const now = new Date('2026-11-11T10:00:00.000Z');
    const relationship = ContactRelationship.reconstitute({
      id: 'relationship-accepted',
      requesterId: contactUserId,
      recipientId: removingUserId,
      status: 'accepted',
    });
    const remove = jest.spyOn(relationship, 'remove');
    const contactRelationshipRepository = createRepository({
      findCurrentByUserPair: jest.fn().mockResolvedValue(relationship),
      transitionFromAccepted: jest.fn().mockResolvedValue(true),
    });
    const clock = { now: jest.fn().mockReturnValue(now) };
    const useCase = new RemoveContactUseCase(
      contactRelationshipRepository,
      clock,
    );

    await expect(
      useCase.execute({ removingUserId, contactUserId }),
    ).resolves.toBeUndefined();

    expect(
      contactRelationshipRepository.findCurrentByUserPair,
    ).toHaveBeenCalledWith(removingUserId, contactUserId);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(removingUserId, now);
    expect(
      contactRelationshipRepository.transitionFromAccepted,
    ).toHaveBeenCalledTimes(1);
    expect(
      contactRelationshipRepository.transitionFromAccepted,
    ).toHaveBeenCalledWith(relationship);
    expect(contactRelationshipRepository.save).not.toHaveBeenCalled();
    expect(relationship.isRemoved()).toBe(true);
    expect(relationship.removedByUserId).toBe(removingUserId);
    expect(relationship.removedAt).toEqual(now);
  });

  it.each(['lookup', 'transition'] as const)(
    'classifies a repository %s failure as unavailable regardless of its message',
    async (failingStep) => {
      const removingUserId = 'user-removing';
      const contactUserId = 'user-contact';
      const relationship = ContactRelationship.reconstitute({
        id: 'relationship-accepted',
        requesterId: contactUserId,
        recipientId: removingUserId,
        status: 'accepted',
      });
      const failure = new Error('not found');
      const contactRelationshipRepository = createRepository({
        findCurrentByUserPair:
          failingStep === 'lookup'
            ? jest.fn().mockRejectedValue(failure)
            : jest.fn().mockResolvedValue(relationship),
        transitionFromAccepted: jest.fn().mockRejectedValue(failure),
      });
      const clock = { now: jest.fn().mockReturnValue(new Date()) };
      const useCase = new RemoveContactUseCase(
        contactRelationshipRepository,
        clock,
      );

      await expect(
        useCase.execute({ removingUserId, contactUserId }),
      ).rejects.toBeInstanceOf(ContactRemovalUnavailableError);
    },
  );

  it('reports a lost race as not a Contact when the transition does not apply', async () => {
    const removingUserId = 'user-removing';
    const contactUserId = 'user-contact';
    const relationship = ContactRelationship.reconstitute({
      id: 'relationship-accepted',
      requesterId: contactUserId,
      recipientId: removingUserId,
      status: 'accepted',
    });
    const contactRelationshipRepository = createRepository({
      findCurrentByUserPair: jest.fn().mockResolvedValue(relationship),
      transitionFromAccepted: jest.fn().mockResolvedValue(false),
    });
    const clock = { now: jest.fn().mockReturnValue(new Date()) };
    const useCase = new RemoveContactUseCase(
      contactRelationshipRepository,
      clock,
    );

    await expect(
      useCase.execute({ removingUserId, contactUserId }),
    ).rejects.toBeInstanceOf(ContactNotFoundError);

    expect(
      contactRelationshipRepository.transitionFromAccepted,
    ).toHaveBeenCalledTimes(1);
    expect(
      contactRelationshipRepository.findCurrentByUserPair,
    ).toHaveBeenCalledTimes(1);
  });

  it.each(['pending', 'rejected', 'removed'] as const)(
    'reports a %s relationship as not a Contact without transitioning',
    async (status) => {
      const removingUserId = 'user-removing';
      const contactUserId = 'user-contact';
      const relationship = ContactRelationship.reconstitute({
        id: 'relationship-not-accepted',
        requesterId: contactUserId,
        recipientId: removingUserId,
        status,
        ...(status === 'removed' && {
          removedByUserId: contactUserId,
          removedAt: new Date('2026-11-10T10:00:00.000Z'),
        }),
      });
      const remove = jest.spyOn(relationship, 'remove');
      const contactRelationshipRepository = createRepository({
        findCurrentByUserPair: jest.fn().mockResolvedValue(relationship),
      });
      const clock = { now: jest.fn() };
      const useCase = new RemoveContactUseCase(
        contactRelationshipRepository,
        clock,
      );

      await expect(
        useCase.execute({ removingUserId, contactUserId }),
      ).rejects.toBeInstanceOf(ContactNotFoundError);

      expect(remove).not.toHaveBeenCalled();
      expect(
        contactRelationshipRepository.transitionFromAccepted,
      ).not.toHaveBeenCalled();
    },
  );

  it('reports a pair without a current relationship as not a Contact without transitioning', async () => {
    const removingUserId = 'user-removing';
    const contactUserId = 'user-contact';
    const contactRelationshipRepository = createRepository({
      findCurrentByUserPair: jest.fn().mockResolvedValue(null),
    });
    const clock = { now: jest.fn() };
    const useCase = new RemoveContactUseCase(
      contactRelationshipRepository,
      clock,
    );

    await expect(
      useCase.execute({ removingUserId, contactUserId }),
    ).rejects.toBeInstanceOf(ContactNotFoundError);

    expect(
      contactRelationshipRepository.findCurrentByUserPair,
    ).toHaveBeenCalledTimes(1);
    expect(
      contactRelationshipRepository.findCurrentByUserPair,
    ).toHaveBeenCalledWith(removingUserId, contactUserId);
    expect(
      contactRelationshipRepository.transitionFromAccepted,
    ).not.toHaveBeenCalled();
  });
});
