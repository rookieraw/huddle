import { ContactRelationship } from '../../domain/contact-relationship.entity';
import {
  encodeCursor,
  InvalidContactListCursorError,
  InvalidContactListLimitError,
} from './contact-list-pagination';
import {
  AcceptedContactListingUnavailableError,
  ListAcceptedContactsUseCase,
} from './list-accepted-contacts.use-case';

type ContactRelationshipRepositoryMock = {
  findAcceptedByUser: jest.Mock;
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
    findAcceptedByUser: jest.fn(),
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

describe('ListAcceptedContactsUseCase', () => {
  let profileDirectory: ProfileDirectoryMock;

  beforeEach(() => {
    profileDirectory = createProfileDirectory();
  });

  it('lists the requester as a Contact when the acting user is the recipient of an accepted relationship', async () => {
    const userId = 'user-recipient';
    const relationship = ContactRelationship.reconstitute({
      id: 'relationship-1',
      requesterId: 'user-requester',
      recipientId: userId,
      status: 'accepted',
    });
    const contactRelationshipRepository = createRepository({
      findAcceptedByUser: jest.fn().mockResolvedValue([relationship]),
    });
    const directory = createProfileDirectory({
      findProfiles: jest
        .fn()
        .mockResolvedValue([
          { userId: 'user-requester', displayName: 'Requester Name' },
        ]),
    });
    const useCase = new ListAcceptedContactsUseCase(
      contactRelationshipRepository,
      directory,
    );

    const result = await useCase.execute({ userId });

    expect(result.items).toEqual([
      { userId: 'user-requester', displayName: 'Requester Name' },
    ]);
  });

  it('lists the recipient as a Contact when the acting user is the requester of an accepted relationship', async () => {
    const userId = 'user-requester';
    const relationship = ContactRelationship.reconstitute({
      id: 'relationship-1',
      requesterId: userId,
      recipientId: 'user-recipient',
      status: 'accepted',
    });
    const contactRelationshipRepository = createRepository({
      findAcceptedByUser: jest.fn().mockResolvedValue([relationship]),
    });
    const directory = createProfileDirectory({
      findProfiles: jest
        .fn()
        .mockResolvedValue([
          { userId: 'user-recipient', displayName: 'Recipient Name' },
        ]),
    });
    const useCase = new ListAcceptedContactsUseCase(
      contactRelationshipRepository,
      directory,
    );

    const result = await useCase.execute({ userId });

    expect(result.items).toEqual([
      { userId: 'user-recipient', displayName: 'Recipient Name' },
    ]);
  });

  it('requests one more row than the default limit of 20 from the repository', async () => {
    const contactRelationshipRepository = createRepository({
      findAcceptedByUser: jest.fn().mockResolvedValue([]),
    });
    const useCase = new ListAcceptedContactsUseCase(
      contactRelationshipRepository,
      profileDirectory,
    );

    await useCase.execute({ userId: 'user-actor' });

    expect(
      contactRelationshipRepository.findAcceptedByUser,
    ).toHaveBeenCalledTimes(1);
    expect(
      contactRelationshipRepository.findAcceptedByUser,
    ).toHaveBeenCalledWith({ userId: 'user-actor', take: 21 });
  });

  it('returns only the first 20 items and drops the lookahead row when the repository returns 21', async () => {
    const userId = 'user-actor';
    const relationships = Array.from({ length: 21 }, (_, index) =>
      ContactRelationship.reconstitute({
        id: `relationship-${index + 1}`,
        requesterId: `user-contact-${index + 1}`,
        recipientId: userId,
        status: 'accepted',
      }),
    );
    const contactRelationshipRepository = createRepository({
      findAcceptedByUser: jest.fn().mockResolvedValue(relationships),
    });
    const useCase = new ListAcceptedContactsUseCase(
      contactRelationshipRepository,
      profileDirectory,
    );

    const result = await useCase.execute({ userId });

    expect(result.items).toHaveLength(20);
    expect(result.items.map((item) => item.userId)).toEqual(
      relationships
        .slice(0, 20)
        .map((relationship) => relationship.requesterId),
    );
    expect(result.items.map((item) => item.userId)).not.toContain(
      'user-contact-21',
    );
  });

  it('returns a null nextCursor when the repository returns no more than the limit', async () => {
    const userId = 'user-actor';
    const relationships = Array.from({ length: 20 }, (_, index) =>
      ContactRelationship.reconstitute({
        id: `relationship-${index + 1}`,
        requesterId: `user-contact-${index + 1}`,
        recipientId: userId,
        status: 'accepted',
      }),
    );
    const contactRelationshipRepository = createRepository({
      findAcceptedByUser: jest.fn().mockResolvedValue(relationships),
    });
    const useCase = new ListAcceptedContactsUseCase(
      contactRelationshipRepository,
      profileDirectory,
    );

    const result = await useCase.execute({ userId });

    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).toBeNull();
  });

  it('returns an opaque non-null nextCursor for the last kept item when a lookahead row exists', async () => {
    const userId = 'user-actor';
    const relationships = Array.from({ length: 21 }, (_, index) =>
      ContactRelationship.reconstitute({
        id: `relationship-${index + 1}`,
        requesterId: `user-contact-${index + 1}`,
        recipientId: userId,
        status: 'accepted',
      }),
    );
    const contactRelationshipRepository = createRepository({
      findAcceptedByUser: jest.fn().mockResolvedValue(relationships),
    });
    const useCase = new ListAcceptedContactsUseCase(
      contactRelationshipRepository,
      profileDirectory,
    );

    const result = await useCase.execute({ userId });

    expect(result.nextCursor).toEqual(expect.any(String));
    expect(result.nextCursor).not.toBe('relationship-20');
    expect(result.nextCursor).not.toContain('relationship-20');
  });

  it('passes the id decoded from a returned nextCursor to the repository as the continuation point', async () => {
    const userId = 'user-actor';
    const relationships = Array.from({ length: 21 }, (_, index) =>
      ContactRelationship.reconstitute({
        id: `relationship-${index + 1}`,
        requesterId: `user-contact-${index + 1}`,
        recipientId: userId,
        status: 'accepted',
      }),
    );
    const contactRelationshipRepository = createRepository({
      findAcceptedByUser: jest
        .fn()
        .mockResolvedValueOnce(relationships)
        .mockResolvedValueOnce([]),
    });
    const useCase = new ListAcceptedContactsUseCase(
      contactRelationshipRepository,
      profileDirectory,
    );

    const firstPage = await useCase.execute({ userId });
    await useCase.execute({ userId, cursor: firstPage.nextCursor });

    expect(
      contactRelationshipRepository.findAcceptedByUser,
    ).toHaveBeenCalledTimes(2);
    expect(
      contactRelationshipRepository.findAcceptedByUser,
    ).toHaveBeenLastCalledWith({
      userId,
      take: 21,
      afterRelationshipId: 'relationship-20',
    });
  });

  it('uses an explicit limit for the page size and the lookahead row', async () => {
    const userId = 'user-actor';
    const relationships = Array.from({ length: 6 }, (_, index) =>
      ContactRelationship.reconstitute({
        id: `relationship-${index + 1}`,
        requesterId: `user-contact-${index + 1}`,
        recipientId: userId,
        status: 'accepted',
      }),
    );
    const contactRelationshipRepository = createRepository({
      findAcceptedByUser: jest.fn().mockResolvedValue(relationships),
    });
    const useCase = new ListAcceptedContactsUseCase(
      contactRelationshipRepository,
      profileDirectory,
    );

    const result = await useCase.execute({ userId, limit: '5' });

    expect(
      contactRelationshipRepository.findAcceptedByUser,
    ).toHaveBeenCalledWith({ userId, take: 6 });
    expect(result.items.map((item) => item.userId)).toEqual([
      'user-contact-1',
      'user-contact-2',
      'user-contact-3',
      'user-contact-4',
      'user-contact-5',
    ]);
    expect(result.nextCursor).toEqual(encodeCursor('relationship-5'));
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
    ['hexadecimal', '0x14'],
    ['a repeated query key', ['5', '6']],
    ['a number instead of a string', 5],
    ['null', null],
  ])(
    'rejects a limit that is %s without querying the repository',
    async (_label, limit) => {
      const contactRelationshipRepository = createRepository();
      const useCase = new ListAcceptedContactsUseCase(
        contactRelationshipRepository,
        profileDirectory,
      );

      const error: unknown = await useCase
        .execute({ userId: 'user-actor', limit })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(InvalidContactListLimitError);
      expect((error as Error).message).toBe(
        'limit must be an integer from 1 to 50.',
      );
      expect(
        contactRelationshipRepository.findAcceptedByUser,
      ).not.toHaveBeenCalled();
      expect(profileDirectory.findProfiles).not.toHaveBeenCalled();
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
      const useCase = new ListAcceptedContactsUseCase(
        contactRelationshipRepository,
        profileDirectory,
      );

      const error: unknown = await useCase
        .execute({ userId: 'user-actor', cursor })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(InvalidContactListCursorError);
      expect((error as Error).message).toBe('cursor must be a valid cursor.');
      expect(
        contactRelationshipRepository.findAcceptedByUser,
      ).not.toHaveBeenCalled();
      expect(profileDirectory.findProfiles).not.toHaveBeenCalled();
    },
  );

  it('reports the invalid limit and not the invalid cursor when both are invalid', async () => {
    const contactRelationshipRepository = createRepository();
    const useCase = new ListAcceptedContactsUseCase(
      contactRelationshipRepository,
      profileDirectory,
    );

    const error: unknown = await useCase
      .execute({ userId: 'user-actor', limit: '0', cursor: '' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(InvalidContactListLimitError);
    expect(
      contactRelationshipRepository.findAcceptedByUser,
    ).not.toHaveBeenCalled();
  });

  it('looks up the Contact profiles once and gives each item its own display name regardless of the returned order and direction', async () => {
    const userId = 'user-actor';
    const relationships = [1, 2].map((number) =>
      ContactRelationship.reconstitute({
        id: `relationship-${number}`,
        requesterId: number === 1 ? `user-contact-${number}` : userId,
        recipientId: number === 1 ? userId : `user-contact-${number}`,
        status: 'accepted',
      }),
    );
    const contactRelationshipRepository = createRepository({
      findAcceptedByUser: jest.fn().mockResolvedValue(relationships),
    });
    const directory = createProfileDirectory({
      findProfiles: jest.fn().mockResolvedValue([
        { userId: 'user-contact-2', displayName: 'Bob' },
        { userId: 'user-contact-1', displayName: 'Alice' },
      ]),
    });
    const useCase = new ListAcceptedContactsUseCase(
      contactRelationshipRepository,
      directory,
    );

    const result = await useCase.execute({ userId });

    expect(directory.findProfiles).toHaveBeenCalledTimes(1);
    expect(directory.findProfiles).toHaveBeenCalledWith([
      'user-contact-1',
      'user-contact-2',
    ]);
    expect(result.items).toEqual([
      { userId: 'user-contact-1', displayName: 'Alice' },
      { userId: 'user-contact-2', displayName: 'Bob' },
    ]);
  });

  it('lists a Contact with a null display name when it has no profile and keeps the other names matched by user id', async () => {
    const userId = 'user-actor';
    const relationships = Array.from({ length: 3 }, (_, index) =>
      ContactRelationship.reconstitute({
        id: `relationship-${index + 1}`,
        requesterId: `user-contact-${index + 1}`,
        recipientId: userId,
        status: 'accepted',
      }),
    );
    const contactRelationshipRepository = createRepository({
      findAcceptedByUser: jest.fn().mockResolvedValue(relationships),
    });
    const directory = createProfileDirectory({
      findProfiles: jest.fn().mockResolvedValue([
        { userId: 'user-contact-3', displayName: 'Carol' },
        { userId: 'user-contact-1', displayName: 'Alice' },
      ]),
    });
    const useCase = new ListAcceptedContactsUseCase(
      contactRelationshipRepository,
      directory,
    );

    const result = await useCase.execute({ userId });

    expect(result.items).toEqual([
      { userId: 'user-contact-1', displayName: 'Alice' },
      { userId: 'user-contact-2', displayName: null },
      { userId: 'user-contact-3', displayName: 'Carol' },
    ]);
  });

  it('sends at most 50 Contact ids to the profile directory and excludes the lookahead row at the maximum limit', async () => {
    const userId = 'user-actor';
    const relationships = Array.from({ length: 51 }, (_, index) =>
      ContactRelationship.reconstitute({
        id: `relationship-${index + 1}`,
        requesterId: `user-contact-${index + 1}`,
        recipientId: userId,
        status: 'accepted',
      }),
    );
    const contactRelationshipRepository = createRepository({
      findAcceptedByUser: jest.fn().mockResolvedValue(relationships),
    });
    const useCase = new ListAcceptedContactsUseCase(
      contactRelationshipRepository,
      profileDirectory,
    );

    const result = await useCase.execute({ userId, limit: '50' });

    expect(profileDirectory.findProfiles).toHaveBeenCalledTimes(1);
    const requestedIds = profileDirectory.findProfiles.mock
      .calls[0][0] as string[];
    expect(requestedIds).toHaveLength(50);
    expect(requestedIds).not.toContain('user-contact-51');
    expect(result.items).toHaveLength(50);
    expect(result.nextCursor).toEqual(encodeCursor('relationship-50'));
  });

  it('reports the listing as unavailable without calling the profile directory when the repository fails', async () => {
    const contactRelationshipRepository = createRepository({
      findAcceptedByUser: jest
        .fn()
        .mockRejectedValue(new Error('database connection lost')),
    });
    const useCase = new ListAcceptedContactsUseCase(
      contactRelationshipRepository,
      profileDirectory,
    );

    const error: unknown = await useCase
      .execute({ userId: 'user-actor' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AcceptedContactListingUnavailableError);
    expect((error as Error).message).toBe(
      'Accepted Contacts are temporarily unavailable.',
    );
    expect(profileDirectory.findProfiles).not.toHaveBeenCalled();
  });

  it('reports the listing as unavailable and returns no partial list when the profile directory fails', async () => {
    const userId = 'user-actor';
    const relationship = ContactRelationship.reconstitute({
      id: 'relationship-1',
      requesterId: 'user-contact-1',
      recipientId: userId,
      status: 'accepted',
    });
    const contactRelationshipRepository = createRepository({
      findAcceptedByUser: jest.fn().mockResolvedValue([relationship]),
    });
    const directory = createProfileDirectory({
      findProfiles: jest.fn().mockRejectedValue(new Error('identity down')),
    });
    const useCase = new ListAcceptedContactsUseCase(
      contactRelationshipRepository,
      directory,
    );

    const error: unknown = await useCase
      .execute({ userId })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AcceptedContactListingUnavailableError);
    expect((error as Error).message).toBe(
      'Accepted Contacts are temporarily unavailable.',
    );
  });

  it('returns an empty page without calling the profile directory when there are no accepted Contacts', async () => {
    const contactRelationshipRepository = createRepository({
      findAcceptedByUser: jest.fn().mockResolvedValue([]),
    });
    const useCase = new ListAcceptedContactsUseCase(
      contactRelationshipRepository,
      profileDirectory,
    );

    const result = await useCase.execute({ userId: 'user-actor' });

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
        findAcceptedByUser: jest.fn().mockResolvedValue([]),
      });
      const useCase = new ListAcceptedContactsUseCase(
        contactRelationshipRepository,
        profileDirectory,
      );

      await useCase.execute({ userId: 'user-actor', limit });

      expect(
        contactRelationshipRepository.findAcceptedByUser,
      ).toHaveBeenCalledWith({
        userId: 'user-actor',
        take: expectedTake,
      });
    },
  );
});
