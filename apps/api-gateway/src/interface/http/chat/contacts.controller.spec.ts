import type {
  ListAcceptedContactsUseCase,
  RemoveContactUseCase,
} from '@huddle/chat';
import { ContactsController } from './contacts.controller';

function createSubject() {
  const listAcceptedContactsUseCase = {
    execute: jest.fn(),
  };
  const removeContactUseCase = {
    execute: jest.fn(),
  };

  return {
    controller: new ContactsController(
      listAcceptedContactsUseCase as unknown as ListAcceptedContactsUseCase,
      removeContactUseCase as unknown as RemoveContactUseCase,
    ),
    listAcceptedExecute: listAcceptedContactsUseCase.execute,
    removeExecute: removeContactUseCase.execute,
  };
}

describe('ContactsController', () => {
  it('delegates accepted Contact listing with the verified user and raw limit and cursor, ignoring client-supplied actor values, and returns the page unchanged', async () => {
    const { controller, listAcceptedExecute } = createSubject();
    const page = {
      items: [{ userId: 'user-contact-1', displayName: 'Alice' }],
      nextCursor: 'opaque-cursor',
    };
    listAcceptedExecute.mockResolvedValueOnce(page);

    await expect(
      controller.listAcceptedContacts(
        {
          headers: {},
          user: { userId: 'user-actor' },
        },
        {
          limit: '5',
          cursor: 'opaque-cursor-in',
          userId: 'user-other',
          requesterId: 'user-other',
          recipientId: 'user-other',
        },
      ),
    ).resolves.toBe(page);
    expect(listAcceptedExecute).toHaveBeenCalledTimes(1);
    expect(listAcceptedExecute).toHaveBeenCalledWith({
      userId: 'user-actor',
      limit: '5',
      cursor: 'opaque-cursor-in',
    });
  });

  it('delegates Contact removal with the verified user and the routed contact id and returns no body', async () => {
    const { controller, removeExecute } = createSubject();
    removeExecute.mockResolvedValueOnce(undefined);

    await expect(
      controller.removeContact(
        {
          headers: {},
          user: { userId: 'user-actor' },
        },
        'user-contact',
      ),
    ).resolves.toBeUndefined();
    expect(removeExecute).toHaveBeenCalledTimes(1);
    expect(removeExecute).toHaveBeenCalledWith({
      removingUserId: 'user-actor',
      contactUserId: 'user-contact',
    });
  });
});
