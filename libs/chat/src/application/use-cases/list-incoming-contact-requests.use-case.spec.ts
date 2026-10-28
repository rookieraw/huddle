import { ContactRelationship } from '../../domain/contact-relationship.entity';
import {
  ContactRequestListingUnavailableError,
  InvalidIncomingListCursorError,
  InvalidIncomingListLimitError,
  ListIncomingContactRequestsUseCase,
} from './list-incoming-contact-requests.use-case';

type ContactRelationshipRepositoryMock = {
  findCurrentByUserPair: jest.Mock;
  findById: jest.Mock;
  findPendingByRecipient: jest.Mock;
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
    save: jest.fn(),
    transitionFromPending: jest.fn(),
    ...overrides,
  };
}

type RequesterProfileDirectoryMock = {
  findProfiles: jest.Mock;
};

function createProfileDirectory(
  overrides: Partial<RequesterProfileDirectoryMock> = {},
): RequesterProfileDirectoryMock {
  return {
    findProfiles: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('ListIncomingContactRequestsUseCase', () => {
  let requesterProfileDirectory: RequesterProfileDirectoryMock;

  beforeEach(() => {
    requesterProfileDirectory = createProfileDirectory();
  });

  it('queries the repository for pending relationships addressed to the actor and returns them as page items', async () => {
    const recipientId = 'user-recipient';
    const first = ContactRelationship.reconstitute({
      id: 'relationship-1',
      requesterId: 'user-requester-1',
      recipientId,
      status: 'pending',
    });
    const second = ContactRelationship.reconstitute({
      id: 'relationship-2',
      requesterId: 'user-requester-2',
      recipientId,
      status: 'pending',
    });
    const contactRelationshipRepository = createRepository({
      findPendingByRecipient: jest.fn().mockResolvedValue([first, second]),
    });
    const useCase = new ListIncomingContactRequestsUseCase(
      contactRelationshipRepository,
      requesterProfileDirectory,
    );

    const result = await useCase.execute({ recipientId });

    expect(
      contactRelationshipRepository.findPendingByRecipient,
    ).toHaveBeenCalledTimes(1);
    expect(
      contactRelationshipRepository.findPendingByRecipient,
    ).toHaveBeenCalledWith(expect.objectContaining({ recipientId }));
    expect(result.items).toMatchObject([
      { id: 'relationship-1', requesterId: 'user-requester-1' },
      { id: 'relationship-2', requesterId: 'user-requester-2' },
    ]);
    expect(contactRelationshipRepository.findById).not.toHaveBeenCalled();
    expect(contactRelationshipRepository.save).not.toHaveBeenCalled();
    expect(
      contactRelationshipRepository.transitionFromPending,
    ).not.toHaveBeenCalled();
  });

  it('requests one more row than the default limit of 20 from the repository', async () => {
    const contactRelationshipRepository = createRepository({
      findPendingByRecipient: jest.fn().mockResolvedValue([]),
    });
    const useCase = new ListIncomingContactRequestsUseCase(
      contactRelationshipRepository,
      requesterProfileDirectory,
    );

    await useCase.execute({ recipientId: 'user-recipient' });

    expect(
      contactRelationshipRepository.findPendingByRecipient,
    ).toHaveBeenCalledTimes(1);
    expect(
      contactRelationshipRepository.findPendingByRecipient,
    ).toHaveBeenCalledWith({ recipientId: 'user-recipient', take: 21 });
  });

  it('returns only the first 20 items and drops the lookahead row when the repository returns 21', async () => {
    const recipientId = 'user-recipient';
    const relationships = Array.from({ length: 21 }, (_, index) =>
      ContactRelationship.reconstitute({
        id: `relationship-${index + 1}`,
        requesterId: `user-requester-${index + 1}`,
        recipientId,
        status: 'pending',
      }),
    );
    const contactRelationshipRepository = createRepository({
      findPendingByRecipient: jest.fn().mockResolvedValue(relationships),
    });
    const useCase = new ListIncomingContactRequestsUseCase(
      contactRelationshipRepository,
      requesterProfileDirectory,
    );

    const result = await useCase.execute({ recipientId });

    expect(result.items).toHaveLength(20);
    expect(result.items.map((item) => item.id)).toEqual(
      relationships.slice(0, 20).map((relationship) => relationship.id),
    );
    expect(result.items.map((item) => item.id)).not.toContain(
      'relationship-21',
    );
  });

  it('returns a null nextCursor when the repository returns no more than the limit', async () => {
    const recipientId = 'user-recipient';
    const relationships = Array.from({ length: 20 }, (_, index) =>
      ContactRelationship.reconstitute({
        id: `relationship-${index + 1}`,
        requesterId: `user-requester-${index + 1}`,
        recipientId,
        status: 'pending',
      }),
    );
    const contactRelationshipRepository = createRepository({
      findPendingByRecipient: jest.fn().mockResolvedValue(relationships),
    });
    const useCase = new ListIncomingContactRequestsUseCase(
      contactRelationshipRepository,
      requesterProfileDirectory,
    );

    const result = await useCase.execute({ recipientId });

    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).toBeNull();
  });

  it('returns an opaque non-null nextCursor for the last kept item when a lookahead row exists', async () => {
    const recipientId = 'user-recipient';
    const relationships = Array.from({ length: 21 }, (_, index) =>
      ContactRelationship.reconstitute({
        id: `relationship-${index + 1}`,
        requesterId: `user-requester-${index + 1}`,
        recipientId,
        status: 'pending',
      }),
    );
    const contactRelationshipRepository = createRepository({
      findPendingByRecipient: jest.fn().mockResolvedValue(relationships),
    });
    const useCase = new ListIncomingContactRequestsUseCase(
      contactRelationshipRepository,
      requesterProfileDirectory,
    );

    const result = await useCase.execute({ recipientId });

    expect(result.nextCursor).toEqual(expect.any(String));
    expect(result.nextCursor).not.toBe('relationship-20');
    expect(result.nextCursor).not.toContain('relationship-20');
  });

  it('passes the id decoded from a returned nextCursor to the repository as the continuation point', async () => {
    const recipientId = 'user-recipient';
    const relationships = Array.from({ length: 21 }, (_, index) =>
      ContactRelationship.reconstitute({
        id: `relationship-${index + 1}`,
        requesterId: `user-requester-${index + 1}`,
        recipientId,
        status: 'pending',
      }),
    );
    const contactRelationshipRepository = createRepository({
      findPendingByRecipient: jest
        .fn()
        .mockResolvedValueOnce(relationships)
        .mockResolvedValueOnce([]),
    });
    const useCase = new ListIncomingContactRequestsUseCase(
      contactRelationshipRepository,
      requesterProfileDirectory,
    );

    const firstPage = await useCase.execute({ recipientId });
    await useCase.execute({ recipientId, cursor: firstPage.nextCursor });

    expect(
      contactRelationshipRepository.findPendingByRecipient,
    ).toHaveBeenCalledTimes(2);
    expect(
      contactRelationshipRepository.findPendingByRecipient,
    ).toHaveBeenLastCalledWith({
      recipientId,
      take: 21,
      afterRelationshipId: 'relationship-20',
    });
  });

  it('uses an explicit limit for the page size and the lookahead row', async () => {
    const recipientId = 'user-recipient';
    const relationships = Array.from({ length: 6 }, (_, index) =>
      ContactRelationship.reconstitute({
        id: `relationship-${index + 1}`,
        requesterId: `user-requester-${index + 1}`,
        recipientId,
        status: 'pending',
      }),
    );
    const contactRelationshipRepository = createRepository({
      findPendingByRecipient: jest.fn().mockResolvedValue(relationships),
    });
    const useCase = new ListIncomingContactRequestsUseCase(
      contactRelationshipRepository,
      requesterProfileDirectory,
    );

    const result = await useCase.execute({ recipientId, limit: '5' });

    expect(
      contactRelationshipRepository.findPendingByRecipient,
    ).toHaveBeenCalledWith({ recipientId, take: 6 });
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
    ['zero', '0'],
    ['above the maximum', '51'],
    ['negative', '-1'],
    ['a decimal', '1.5'],
    ['non-numeric', 'abc'],
    ['empty', ''],
    ['signed', '+5'],
    ['padded with a space', ' 5'],
    ['in exponent notation', '1e1'],
    ['a repeated query key', ['5', '6']],
    ['a number instead of a string', 5],
    ['null', null],
  ])(
    'rejects a limit that is %s without querying the repository',
    async (_label, limit) => {
      const contactRelationshipRepository = createRepository();
      const useCase = new ListIncomingContactRequestsUseCase(
        contactRelationshipRepository,
        requesterProfileDirectory,
      );

      const error: unknown = await useCase
        .execute({ recipientId: 'user-recipient', limit })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(InvalidIncomingListLimitError);
      expect((error as Error).message).toBe(
        'limit must be an integer from 1 to 50.',
      );
      expect(
        contactRelationshipRepository.findPendingByRecipient,
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
      const useCase = new ListIncomingContactRequestsUseCase(
        contactRelationshipRepository,
        requesterProfileDirectory,
      );

      const error: unknown = await useCase
        .execute({ recipientId: 'user-recipient', cursor })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(InvalidIncomingListCursorError);
      expect((error as Error).message).toBe('cursor must be a valid cursor.');
      expect(
        contactRelationshipRepository.findPendingByRecipient,
      ).not.toHaveBeenCalled();
    },
  );

  it('reports the invalid limit and not the invalid cursor when both are invalid', async () => {
    const contactRelationshipRepository = createRepository();
    const useCase = new ListIncomingContactRequestsUseCase(
      contactRelationshipRepository,
      requesterProfileDirectory,
    );

    const error: unknown = await useCase
      .execute({ recipientId: 'user-recipient', limit: '0', cursor: '' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(InvalidIncomingListLimitError);
    expect(
      contactRelationshipRepository.findPendingByRecipient,
    ).not.toHaveBeenCalled();
  });

  it('looks up the requester profiles once and gives each item its own requester display name regardless of the returned order', async () => {
    const recipientId = 'user-recipient';
    const relationships = [1, 2].map((number) =>
      ContactRelationship.reconstitute({
        id: `relationship-${number}`,
        requesterId: `user-requester-${number}`,
        recipientId,
        status: 'pending',
      }),
    );
    const contactRelationshipRepository = createRepository({
      findPendingByRecipient: jest.fn().mockResolvedValue(relationships),
    });
    const profileDirectory = createProfileDirectory({
      findProfiles: jest.fn().mockResolvedValue([
        { userId: 'user-requester-2', displayName: 'Bob' },
        { userId: 'user-requester-1', displayName: 'Alice' },
      ]),
    });
    const useCase = new ListIncomingContactRequestsUseCase(
      contactRelationshipRepository,
      profileDirectory,
    );

    const result = await useCase.execute({ recipientId });

    expect(profileDirectory.findProfiles).toHaveBeenCalledTimes(1);
    expect(profileDirectory.findProfiles).toHaveBeenCalledWith([
      'user-requester-1',
      'user-requester-2',
    ]);
    expect(result.items).toMatchObject([
      { id: 'relationship-1', displayName: 'Alice' },
      { id: 'relationship-2', displayName: 'Bob' },
    ]);
  });

  it('lists a request with a null display name when its requester has no profile and keeps the other names matched by user id', async () => {
    const recipientId = 'user-recipient';
    const relationships = [1, 2, 3].map((number) =>
      ContactRelationship.reconstitute({
        id: `relationship-${number}`,
        requesterId: `user-requester-${number}`,
        recipientId,
        status: 'pending',
      }),
    );
    const contactRelationshipRepository = createRepository({
      findPendingByRecipient: jest.fn().mockResolvedValue(relationships),
    });
    const profileDirectory = createProfileDirectory({
      findProfiles: jest.fn().mockResolvedValue([
        { userId: 'user-requester-3', displayName: 'Carol' },
        { userId: 'user-requester-1', displayName: 'Alice' },
      ]),
    });
    const useCase = new ListIncomingContactRequestsUseCase(
      contactRelationshipRepository,
      profileDirectory,
    );

    const result = await useCase.execute({ recipientId });

    expect(result.items).toMatchObject([
      { id: 'relationship-1', displayName: 'Alice' },
      { id: 'relationship-2', displayName: null },
      { id: 'relationship-3', displayName: 'Carol' },
    ]);
  });

  it('sends at most 50 requester ids to the profile directory and excludes the lookahead row at the maximum limit', async () => {
    const recipientId = 'user-recipient';
    const relationships = Array.from({ length: 51 }, (_, index) =>
      ContactRelationship.reconstitute({
        id: `relationship-${index + 1}`,
        requesterId: `user-requester-${index + 1}`,
        recipientId,
        status: 'pending',
      }),
    );
    const contactRelationshipRepository = createRepository({
      findPendingByRecipient: jest.fn().mockResolvedValue(relationships),
    });
    const profileDirectory = createProfileDirectory();
    const useCase = new ListIncomingContactRequestsUseCase(
      contactRelationshipRepository,
      profileDirectory,
    );

    const result = await useCase.execute({ recipientId, limit: '50' });

    expect(profileDirectory.findProfiles).toHaveBeenCalledTimes(1);
    const requestedIds = profileDirectory.findProfiles.mock
      .calls[0][0] as string[];
    expect(requestedIds).toHaveLength(50);
    expect(requestedIds).not.toContain('user-requester-51');
    expect(result.items).toHaveLength(50);
    expect(result.nextCursor).toEqual(expect.any(String));
  });

  it('reports the listing as unavailable without calling the profile directory when the repository fails', async () => {
    const contactRelationshipRepository = createRepository({
      findPendingByRecipient: jest
        .fn()
        .mockRejectedValue(new Error('database connection lost')),
    });
    const profileDirectory = createProfileDirectory();
    const useCase = new ListIncomingContactRequestsUseCase(
      contactRelationshipRepository,
      profileDirectory,
    );

    const error: unknown = await useCase
      .execute({ recipientId: 'user-recipient' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ContactRequestListingUnavailableError);
    expect((error as Error).message).toBe(
      'Incoming Contact requests are temporarily unavailable.',
    );
    expect(profileDirectory.findProfiles).not.toHaveBeenCalled();
  });

  it('reports the listing as unavailable and returns no partial list when the profile directory fails', async () => {
    const contactRelationshipRepository = createRepository({
      findPendingByRecipient: jest.fn().mockResolvedValue([
        ContactRelationship.reconstitute({
          id: 'relationship-1',
          requesterId: 'user-requester-1',
          recipientId: 'user-recipient',
          status: 'pending',
        }),
      ]),
    });
    const profileDirectory = createProfileDirectory({
      findProfiles: jest.fn().mockRejectedValue(new Error('identity down')),
    });
    const useCase = new ListIncomingContactRequestsUseCase(
      contactRelationshipRepository,
      profileDirectory,
    );

    const error: unknown = await useCase
      .execute({ recipientId: 'user-recipient' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ContactRequestListingUnavailableError);
    expect((error as Error).message).toBe(
      'Incoming Contact requests are temporarily unavailable.',
    );
  });

  it('returns an empty page without calling the profile directory when there are no pending requests', async () => {
    const contactRelationshipRepository = createRepository({
      findPendingByRecipient: jest.fn().mockResolvedValue([]),
    });
    const profileDirectory = createProfileDirectory();
    const useCase = new ListIncomingContactRequestsUseCase(
      contactRelationshipRepository,
      profileDirectory,
    );

    const result = await useCase.execute({ recipientId: 'user-recipient' });

    expect(result).toEqual({ items: [], nextCursor: null });
    expect(profileDirectory.findProfiles).not.toHaveBeenCalled();
  });

  it.each([
    ['1', 2],
    ['50', 51],
  ])(
    'accepts the limit %s and asks the repository for take %i',
    async (limit, expectedTake) => {
      const contactRelationshipRepository = createRepository({
        findPendingByRecipient: jest.fn().mockResolvedValue([]),
      });
      const useCase = new ListIncomingContactRequestsUseCase(
        contactRelationshipRepository,
        requesterProfileDirectory,
      );

      await useCase.execute({ recipientId: 'user-recipient', limit });

      expect(
        contactRelationshipRepository.findPendingByRecipient,
      ).toHaveBeenCalledWith({
        recipientId: 'user-recipient',
        take: expectedTake,
      });
    },
  );
});
