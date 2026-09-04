import type {
  AcceptContactRequestUseCase,
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

  return {
    controller: new ContactRequestsController(
      sendContactRequestUseCase as unknown as SendContactRequestUseCase,
      acceptContactRequestUseCase as unknown as AcceptContactRequestUseCase,
    ),
    sendExecute: sendContactRequestUseCase.execute,
    acceptExecute: acceptContactRequestUseCase.execute,
  };
}

describe('ContactRequestsController', () => {
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
