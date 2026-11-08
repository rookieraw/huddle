import type { ListAcceptedContactsUseCase } from '@huddle/chat';
import { ContactsController } from './contacts.controller';

function createSubject() {
  const listAcceptedContactsUseCase = {
    execute: jest.fn(),
  };

  return {
    controller: new ContactsController(
      listAcceptedContactsUseCase as unknown as ListAcceptedContactsUseCase,
    ),
    listAcceptedExecute: listAcceptedContactsUseCase.execute,
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
});
