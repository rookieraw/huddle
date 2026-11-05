import { ContactRelationship } from '../../domain/contact-relationship.entity';
import { ListOutgoingContactRequestsUseCase } from './list-outgoing-contact-requests.use-case';

type ContactRelationshipRepositoryMock = {
  findCurrentByUserPair: jest.Mock;
  findById: jest.Mock;
  findPendingByRecipient: jest.Mock;
  findPendingByRequester: jest.Mock;
  save: jest.Mock;
  transitionFromPending: jest.Mock;
};

function createRepository(
  overrides: Partial<ContactRelationshipRepositoryMock> = {},
): ContactRelationshipRepositoryMock {
  return {
    findCurrentByUserPair: jest.fn(),
    findById: jest.fn(),
    findPendingByRecipient: jest.fn(),
    findPendingByRequester: jest.fn(),
    save: jest.fn(),
    transitionFromPending: jest.fn(),
    ...overrides,
  };
}

type ProfileDirectoryMock = {
  findProfiles: jest.Mock;
};

function createProfileDirectory(
  overrides: Partial<ProfileDirectoryMock> = {},
): ProfileDirectoryMock {
  return {
    findProfiles: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('ListOutgoingContactRequestsUseCase', () => {
  let profileDirectory: ProfileDirectoryMock;

  beforeEach(() => {
    profileDirectory = createProfileDirectory();
  });

  it('queries the repository for pending relationships created by the actor and returns them as page items', async () => {
    const requesterId = 'user-requester';
    const first = ContactRelationship.reconstitute({
      id: 'relationship-1',
      requesterId,
      recipientId: 'user-recipient-1',
      status: 'pending',
    });
    const second = ContactRelationship.reconstitute({
      id: 'relationship-2',
      requesterId,
      recipientId: 'user-recipient-2',
      status: 'pending',
    });
    const contactRelationshipRepository = createRepository({
      findPendingByRequester: jest.fn().mockResolvedValue([first, second]),
    });
    const useCase = new ListOutgoingContactRequestsUseCase(
      contactRelationshipRepository,
      profileDirectory,
    );

    const result = await useCase.execute({ requesterId });

    expect(
      contactRelationshipRepository.findPendingByRequester,
    ).toHaveBeenCalledTimes(1);
    expect(
      contactRelationshipRepository.findPendingByRequester,
    ).toHaveBeenCalledWith(expect.objectContaining({ requesterId }));
    expect(result.items).toMatchObject([
      { id: 'relationship-1', recipientId: 'user-recipient-1' },
      { id: 'relationship-2', recipientId: 'user-recipient-2' },
    ]);
    expect(
      contactRelationshipRepository.findPendingByRecipient,
    ).not.toHaveBeenCalled();
    expect(contactRelationshipRepository.findById).not.toHaveBeenCalled();
    expect(contactRelationshipRepository.save).not.toHaveBeenCalled();
    expect(
      contactRelationshipRepository.transitionFromPending,
    ).not.toHaveBeenCalled();
  });
});
