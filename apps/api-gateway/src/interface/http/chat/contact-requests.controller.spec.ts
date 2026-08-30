import type { SendContactRequestUseCase } from '@huddle/chat';
import { ContactRequestsController } from './contact-requests.controller';

function createSubject() {
  const execute = jest.fn();
  const sendContactRequestUseCase = {
    execute,
  } as unknown as SendContactRequestUseCase;

  return {
    controller: new ContactRequestsController(sendContactRequestUseCase),
    execute,
  };
}

describe('ContactRequestsController', () => {
  it('delegates the verified requester and maps the exact pending response', async () => {
    const { controller, execute } = createSubject();
    execute.mockResolvedValueOnce({
      id: 'relationship-1',
      requesterId: 'user-requester',
      recipientId: 'user-target',
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
    expect(execute).toHaveBeenCalledWith({
      requesterId: 'user-requester',
      targetUserId: 'user-target',
    });
  });

  it('preserves the persisted roles for an opposing request', async () => {
    const { controller, execute } = createSubject();
    execute.mockResolvedValueOnce({
      id: 'relationship-1',
      requesterId: 'user-original-requester',
      recipientId: 'user-current-requester',
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
    expect(execute).toHaveBeenCalledWith({
      requesterId: 'user-current-requester',
      targetUserId: 'user-original-requester',
    });
  });
});
