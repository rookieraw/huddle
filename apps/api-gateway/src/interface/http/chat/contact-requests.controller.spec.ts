import type {
  AcceptContactRequestUseCase,
  ListIncomingContactRequestsUseCase,
  RejectContactRequestUseCase,
  SendContactRequestUseCase,
} from '@huddle/chat';
import { ContactRequestsController } from './contact-requests.controller';

function createSubject() {
  const sendContactRequestUseCase = {
    execute: jest.fn(),
  };
  const acceptContactRequestUseCase = {
    execute: jest.fn(),
  };
  const rejectContactRequestUseCase = {
    execute: jest.fn(),
  };
  const listIncomingContactRequestsUseCase = {
    execute: jest.fn(),
  };

  return {
    controller: new ContactRequestsController(
      sendContactRequestUseCase as unknown as SendContactRequestUseCase,
      acceptContactRequestUseCase as unknown as AcceptContactRequestUseCase,
      rejectContactRequestUseCase as unknown as RejectContactRequestUseCase,
      listIncomingContactRequestsUseCase as unknown as ListIncomingContactRequestsUseCase,
    ),
    sendExecute: sendContactRequestUseCase.execute,
    acceptExecute: acceptContactRequestUseCase.execute,
    rejectExecute: rejectContactRequestUseCase.execute,
    listIncomingExecute: listIncomingContactRequestsUseCase.execute,
  };
}

describe('ContactRequestsController', () => {
  it('delegates incoming listing with the verified recipient and raw limit and cursor, ignoring client-supplied actor values, and returns the page unchanged', async () => {
    const { controller, listIncomingExecute } = createSubject();
    const page = {
      items: [
        {
          id: 'relationship-1',
          requesterId: 'user-requester-1',
          displayName: 'Alice',
          status: 'pending' as const,
        },
      ],
      nextCursor: 'opaque-cursor',
    };
    listIncomingExecute.mockResolvedValueOnce(page);

    await expect(
      controller.listIncomingContactRequests(
        {
          headers: {},
          user: { userId: 'user-recipient' },
        },
        {
          limit: '5',
          cursor: 'opaque-cursor-in',
          recipientId: 'user-other',
          userId: 'user-other',
        },
      ),
    ).resolves.toBe(page);
    expect(listIncomingExecute).toHaveBeenCalledTimes(1);
    expect(listIncomingExecute).toHaveBeenCalledWith({
      recipientId: 'user-recipient',
      limit: '5',
      cursor: 'opaque-cursor-in',
    });
  });

  it('delegates rejection with the verified recipient and path identifier and maps the exact rejected response', async () => {
    const { controller, rejectExecute } = createSubject();
    rejectExecute.mockResolvedValueOnce({
      id: 'relationship-id',
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
      isPending: () => false,
      isAccepted: () => false,
      isRejected: () => true,
    });

    await expect(
      controller.rejectContactRequest(
        {
          headers: {},
          user: { userId: 'user-original-recipient' },
        },
        'relationship-id',
      ),
    ).resolves.toEqual({
      id: 'relationship-id',
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
      status: 'rejected',
    });
    expect(rejectExecute).toHaveBeenCalledTimes(1);
    expect(rejectExecute).toHaveBeenCalledWith({
      rejectingUserId: 'user-original-recipient',
      relationshipId: 'relationship-id',
    });
  });

  it('delegates acceptance with the verified recipient and path identifier and maps the exact accepted response', async () => {
    const { controller, acceptExecute } = createSubject();
    acceptExecute.mockResolvedValueOnce({
      id: 'relationship-id',
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
      isPending: () => false,
      isAccepted: () => true,
    });

    await expect(
      controller.acceptContactRequest(
        {
          headers: {},
          user: { userId: 'user-original-recipient' },
        },
        'relationship-id',
      ),
    ).resolves.toEqual({
      id: 'relationship-id',
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
      status: 'accepted',
    });
    expect(acceptExecute).toHaveBeenCalledTimes(1);
    expect(acceptExecute).toHaveBeenCalledWith({
      acceptingUserId: 'user-original-recipient',
      relationshipId: 'relationship-id',
    });
  });

  it('maps an accepted current relationship to a truthful accepted response', async () => {
    const { controller, sendExecute } = createSubject();
    sendExecute.mockResolvedValueOnce({
      id: 'relationship-accepted',
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
      isPending: () => false,
      isAccepted: () => true,
    });

    await expect(
      controller.createContactRequest(
        {
          headers: {},
          user: { userId: 'user-original-recipient' },
        },
        { targetUserId: 'user-original-requester' },
      ),
    ).resolves.toEqual({
      id: 'relationship-accepted',
      requesterId: 'user-original-requester',
      recipientId: 'user-original-recipient',
      status: 'accepted',
    });
  });

  it('delegates the verified requester and maps the exact pending response', async () => {
    const { controller, sendExecute } = createSubject();
    sendExecute.mockResolvedValueOnce({
      id: 'relationship-1',
      requesterId: 'user-requester',
      recipientId: 'user-target',
      isPending: () => true,
      isAccepted: () => false,
    });

    await expect(
      controller.createContactRequest(
        {
          headers: {},
          user: { userId: 'user-requester' },
        },
        { targetUserId: 'user-target' },
      ),
    ).resolves.toEqual({
      id: 'relationship-1',
      requesterId: 'user-requester',
      recipientId: 'user-target',
      status: 'pending',
    });
    expect(sendExecute).toHaveBeenCalledWith({
      requesterId: 'user-requester',
      targetUserId: 'user-target',
    });
  });

  it('preserves the persisted roles for an opposing request', async () => {
    const { controller, sendExecute } = createSubject();
    sendExecute.mockResolvedValueOnce({
      id: 'relationship-1',
      requesterId: 'user-original-requester',
      recipientId: 'user-current-requester',
      isPending: () => true,
      isAccepted: () => false,
    });

    await expect(
      controller.createContactRequest(
        {
          headers: {},
          user: { userId: 'user-current-requester' },
        },
        { targetUserId: 'user-original-requester' },
      ),
    ).resolves.toEqual({
      id: 'relationship-1',
      requesterId: 'user-original-requester',
      recipientId: 'user-current-requester',
      status: 'pending',
    });
    expect(sendExecute).toHaveBeenCalledWith({
      requesterId: 'user-current-requester',
      targetUserId: 'user-original-requester',
    });
  });
});
