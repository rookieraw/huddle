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

  it('requests one more row than the default limit of 20 from the repository', async () => {
    const contactRelationshipRepository = createRepository({
      findPendingByRequester: jest.fn().mockResolvedValue([]),
    });
    const useCase = new ListOutgoingContactRequestsUseCase(
      contactRelationshipRepository,
      profileDirectory,
    );

    await useCase.execute({ requesterId: 'user-requester' });

    expect(
      contactRelationshipRepository.findPendingByRequester,
    ).toHaveBeenCalledTimes(1);
    expect(
      contactRelationshipRepository.findPendingByRequester,
    ).toHaveBeenCalledWith({ requesterId: 'user-requester', take: 21 });
  });

  it('returns only the first 20 items and drops the lookahead row when the repository returns 21', async () => {
    const requesterId = 'user-requester';
    const relationships = Array.from({ length: 21 }, (_, index) =>
      ContactRelationship.reconstitute({
        id: `relationship-${index + 1}`,
        requesterId,
        recipientId: `user-recipient-${index + 1}`,
        status: 'pending',
      }),
    );
    const contactRelationshipRepository = createRepository({
      findPendingByRequester: jest.fn().mockResolvedValue(relationships),
    });
    const useCase = new ListOutgoingContactRequestsUseCase(
      contactRelationshipRepository,
      profileDirectory,
    );

    const result = await useCase.execute({ requesterId });

    expect(result.items).toHaveLength(20);
    expect(result.items.map((item) => item.id)).toEqual(
      relationships.slice(0, 20).map((relationship) => relationship.id),
    );
    expect(result.items.map((item) => item.id)).not.toContain(
      'relationship-21',
    );
  });

  it('returns a null nextCursor when the repository returns no more than the limit', async () => {
    const requesterId = 'user-requester';
    const relationships = Array.from({ length: 20 }, (_, index) =>
      ContactRelationship.reconstitute({
        id: `relationship-${index + 1}`,
        requesterId,
        recipientId: `user-recipient-${index + 1}`,
        status: 'pending',
      }),
    );
    const contactRelationshipRepository = createRepository({
      findPendingByRequester: jest.fn().mockResolvedValue(relationships),
    });
    const useCase = new ListOutgoingContactRequestsUseCase(
      contactRelationshipRepository,
      profileDirectory,
    );

    const result = await useCase.execute({ requesterId });

    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).toBeNull();
  });

  it('returns an opaque non-null nextCursor for the last kept item when a lookahead row exists', async () => {
    const requesterId = 'user-requester';
    const relationships = Array.from({ length: 21 }, (_, index) =>
      ContactRelationship.reconstitute({
        id: `relationship-${index + 1}`,
        requesterId,
        recipientId: `user-recipient-${index + 1}`,
        status: 'pending',
      }),
    );
    const contactRelationshipRepository = createRepository({
      findPendingByRequester: jest.fn().mockResolvedValue(relationships),
    });
    const useCase = new ListOutgoingContactRequestsUseCase(
      contactRelationshipRepository,
      profileDirectory,
    );

    const result = await useCase.execute({ requesterId });

    expect(result.nextCursor).toEqual(expect.any(String));
    expect(result.nextCursor).not.toBe('relationship-20');
    expect(result.nextCursor).not.toContain('relationship-20');
  });

  it('passes the id decoded from a returned nextCursor to the repository as the continuation point', async () => {
    const requesterId = 'user-requester';
    const relationships = Array.from({ length: 21 }, (_, index) =>
      ContactRelationship.reconstitute({
        id: `relationship-${index + 1}`,
        requesterId,
        recipientId: `user-recipient-${index + 1}`,
        status: 'pending',
      }),
    );
    const contactRelationshipRepository = createRepository({
      findPendingByRequester: jest
        .fn()
        .mockResolvedValueOnce(relationships)
        .mockResolvedValueOnce([]),
    });
    const useCase = new ListOutgoingContactRequestsUseCase(
      contactRelationshipRepository,
      profileDirectory,
    );

    const firstPage = await useCase.execute({ requesterId });
    await useCase.execute({ requesterId, cursor: firstPage.nextCursor });

    expect(
      contactRelationshipRepository.findPendingByRequester,
    ).toHaveBeenCalledTimes(2);
    expect(
      contactRelationshipRepository.findPendingByRequester,
    ).toHaveBeenLastCalledWith({
      requesterId,
      take: 21,
      afterRelationshipId: 'relationship-20',
    });
  });
});
