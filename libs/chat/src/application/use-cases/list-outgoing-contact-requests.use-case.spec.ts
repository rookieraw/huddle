import { ContactRelationship } from '../../domain/contact-relationship.entity';
import {
  InvalidIncomingListCursorError,
  InvalidIncomingListLimitError,
} from './list-incoming-contact-requests.use-case';
import {
  ListOutgoingContactRequestsUseCase,
  OutgoingContactRequestListingUnavailableError,
} from './list-outgoing-contact-requests.use-case';

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

  it('uses an explicit limit for the page size and the lookahead row', async () => {
    const requesterId = 'user-requester';
    const relationships = Array.from({ length: 6 }, (_, index) =>
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

    const result = await useCase.execute({ requesterId, limit: '5' });

    expect(
      contactRelationshipRepository.findPendingByRequester,
    ).toHaveBeenCalledWith({ requesterId, take: 6 });
    expect(result.items.map((item) => item.id)).toEqual([
      'relationship-1',
      'relationship-2',
      'relationship-3',
      'relationship-4',
      'relationship-5',
    ]);
    expect(result.nextCursor).toEqual(expect.any(String));
  });

  it.each([
    ['1', 2],
    ['50', 51],
  ])(
    'accepts the limit %s and asks the repository for take %i',
    async (limit, expectedTake) => {
      const contactRelationshipRepository = createRepository({
        findPendingByRequester: jest.fn().mockResolvedValue([]),
      });
      const useCase = new ListOutgoingContactRequestsUseCase(
        contactRelationshipRepository,
        profileDirectory,
      );

      await useCase.execute({ requesterId: 'user-requester', limit });

      expect(
        contactRelationshipRepository.findPendingByRequester,
      ).toHaveBeenCalledWith({
        requesterId: 'user-requester',
        take: expectedTake,
      });
    },
  );

  it.each([
    ['zero', '0'],
    ['above the maximum', '51'],
    ['negative', '-1'],
    ['a decimal', '1.5'],
    ['non-numeric', 'abc'],
    ['empty', ''],
    ['signed', '+5'],
    ['padded with a space', ' 5'],
    ['in exponent notation', '1e1'],
    ['hexadecimal', '0x14'],
    ['a repeated query key', ['5', '6']],
    ['a number instead of a string', 5],
    ['null', null],
  ])(
    'rejects a limit that is %s without querying the repository',
    async (_label, limit) => {
      const contactRelationshipRepository = createRepository();
      const useCase = new ListOutgoingContactRequestsUseCase(
        contactRelationshipRepository,
        profileDirectory,
      );

      const error: unknown = await useCase
        .execute({ requesterId: 'user-requester', limit })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(InvalidIncomingListLimitError);
      expect((error as Error).message).toBe(
        'limit must be an integer from 1 to 50.',
      );
      expect(
        contactRelationshipRepository.findPendingByRequester,
      ).not.toHaveBeenCalled();
    },
  );

  const encodeRaw = (value: string) =>
    Buffer.from(value, 'utf8').toString('base64url');

  it.each([
    ['empty', ''],
    ['not base64url', 'not a cursor!'],
    ['base64 with padding', `${encodeRaw('v1:relationship-1')}=`],
    ['plain text', 'relationship-1'],
    ['an unsupported version', encodeRaw('v2:relationship-1')],
    ['missing the version', encodeRaw('relationship-1')],
    ['missing the id', encodeRaw('v1:')],
    ['an id containing a NUL character', encodeRaw('v1:relationship-\u0000-1')],
    ['a repeated query key', [encodeRaw('v1:relationship-1'), 'x']],
    ['a number instead of a string', 5],
    ['null', null],
  ])(
    'rejects a cursor that is %s without querying the repository',
    async (_label, cursor) => {
      const contactRelationshipRepository = createRepository();
      const useCase = new ListOutgoingContactRequestsUseCase(
        contactRelationshipRepository,
        profileDirectory,
      );

      const error: unknown = await useCase
        .execute({ requesterId: 'user-requester', cursor })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(InvalidIncomingListCursorError);
      expect((error as Error).message).toBe('cursor must be a valid cursor.');
      expect(
        contactRelationshipRepository.findPendingByRequester,
      ).not.toHaveBeenCalled();
    },
  );

  it('reports the invalid limit and not the invalid cursor when both are invalid', async () => {
    const contactRelationshipRepository = createRepository();
    const useCase = new ListOutgoingContactRequestsUseCase(
      contactRelationshipRepository,
      profileDirectory,
    );

    const error: unknown = await useCase
      .execute({ requesterId: 'user-requester', limit: '0', cursor: '' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(InvalidIncomingListLimitError);
    expect(
      contactRelationshipRepository.findPendingByRequester,
    ).not.toHaveBeenCalled();
  });

  it('looks up the recipient profiles once and gives each item its own recipient display name regardless of the returned order', async () => {
    const requesterId = 'user-requester';
    const relationships = [1, 2].map((number) =>
      ContactRelationship.reconstitute({
        id: `relationship-${number}`,
        requesterId,
        recipientId: `user-recipient-${number}`,
        status: 'pending',
      }),
    );
    const contactRelationshipRepository = createRepository({
      findPendingByRequester: jest.fn().mockResolvedValue(relationships),
    });
    const directory = createProfileDirectory({
      findProfiles: jest.fn().mockResolvedValue([
        { userId: 'user-recipient-2', displayName: 'Bob' },
        { userId: 'user-recipient-1', displayName: 'Alice' },
      ]),
    });
    const useCase = new ListOutgoingContactRequestsUseCase(
      contactRelationshipRepository,
      directory,
    );

    const result = await useCase.execute({ requesterId });

    expect(directory.findProfiles).toHaveBeenCalledTimes(1);
    expect(directory.findProfiles).toHaveBeenCalledWith([
      'user-recipient-1',
      'user-recipient-2',
    ]);
    expect(result.items).toMatchObject([
      { id: 'relationship-1', displayName: 'Alice' },
      { id: 'relationship-2', displayName: 'Bob' },
    ]);
  });

  it('lists a request with a null display name when its recipient has no profile and keeps the other names matched by user id', async () => {
    const requesterId = 'user-requester';
    const relationships = [1, 2, 3].map((number) =>
      ContactRelationship.reconstitute({
        id: `relationship-${number}`,
        requesterId,
        recipientId: `user-recipient-${number}`,
        status: 'pending',
      }),
    );
    const contactRelationshipRepository = createRepository({
      findPendingByRequester: jest.fn().mockResolvedValue(relationships),
    });
    const directory = createProfileDirectory({
      findProfiles: jest.fn().mockResolvedValue([
        { userId: 'user-recipient-3', displayName: 'Carol' },
        { userId: 'user-recipient-1', displayName: 'Alice' },
      ]),
    });
    const useCase = new ListOutgoingContactRequestsUseCase(
      contactRelationshipRepository,
      directory,
    );

    const result = await useCase.execute({ requesterId });

    expect(result.items).toMatchObject([
      { id: 'relationship-1', displayName: 'Alice' },
      { id: 'relationship-2', displayName: null },
      { id: 'relationship-3', displayName: 'Carol' },
    ]);
  });

  it('sends at most 50 recipient ids to the profile directory and excludes the lookahead row at the maximum limit', async () => {
    const requesterId = 'user-requester';
    const relationships = Array.from({ length: 51 }, (_, index) =>
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

    const result = await useCase.execute({ requesterId, limit: '50' });

    expect(profileDirectory.findProfiles).toHaveBeenCalledTimes(1);
    const requestedIds = profileDirectory.findProfiles.mock
      .calls[0][0] as string[];
    expect(requestedIds).toHaveLength(50);
    expect(requestedIds).not.toContain('user-recipient-51');
    expect(result.items).toHaveLength(50);
    expect(result.nextCursor).toEqual(expect.any(String));
  });

  it('returns an empty page without calling the profile directory when there are no pending requests', async () => {
    const contactRelationshipRepository = createRepository({
      findPendingByRequester: jest.fn().mockResolvedValue([]),
    });
    const useCase = new ListOutgoingContactRequestsUseCase(
      contactRelationshipRepository,
      profileDirectory,
    );

    const result = await useCase.execute({ requesterId: 'user-requester' });

    expect(result).toEqual({ items: [], nextCursor: null });
    expect(profileDirectory.findProfiles).not.toHaveBeenCalled();
  });

  it('reports the listing as unavailable without calling the profile directory when the repository fails', async () => {
    const contactRelationshipRepository = createRepository({
      findPendingByRequester: jest
        .fn()
        .mockRejectedValue(new Error('database connection lost')),
    });
    const useCase = new ListOutgoingContactRequestsUseCase(
      contactRelationshipRepository,
      profileDirectory,
    );

    const error: unknown = await useCase
      .execute({ requesterId: 'user-requester' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(OutgoingContactRequestListingUnavailableError);
    expect((error as Error).message).toBe(
      'Outgoing Contact requests are temporarily unavailable.',
    );
    expect(profileDirectory.findProfiles).not.toHaveBeenCalled();
  });

  it('reports the listing as unavailable and returns no partial list when the profile directory fails', async () => {
    const contactRelationshipRepository = createRepository({
      findPendingByRequester: jest.fn().mockResolvedValue([
        ContactRelationship.reconstitute({
          id: 'relationship-1',
          requesterId: 'user-requester',
          recipientId: 'user-recipient-1',
          status: 'pending',
        }),
      ]),
    });
    const directory = createProfileDirectory({
      findProfiles: jest.fn().mockRejectedValue(new Error('identity down')),
    });
    const useCase = new ListOutgoingContactRequestsUseCase(
      contactRelationshipRepository,
      directory,
    );

    const error: unknown = await useCase
      .execute({ requesterId: 'user-requester' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(OutgoingContactRequestListingUnavailableError);
    expect((error as Error).message).toBe(
      'Outgoing Contact requests are temporarily unavailable.',
    );
  });
});
