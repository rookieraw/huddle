import * as chatPackage from '@huddle/chat';
import type { RequesterProfileDirectory } from '@huddle/chat';

describe('@huddle/chat public package boundary for incoming listing', () => {
  it('exposes the RequesterProfileDirectory port and its injection token', () => {
    const directory: RequesterProfileDirectory = {
      findProfiles: jest.fn(() =>
        Promise.resolve([{ userId: 'user-requester-1', displayName: 'Alice' }]),
      ),
    };

    expect(chatPackage.REQUESTER_PROFILE_DIRECTORY).toBeDefined();
    expect(chatPackage.ListIncomingContactRequestsUseCase).toBeDefined();
    expect(directory).toBeDefined();
  });
});
