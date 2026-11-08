import * as chatPackage from '@huddle/chat';
import type { UserProfileDirectory } from '@huddle/chat';

describe('@huddle/chat public package boundary for incoming listing', () => {
  it('exposes the UserProfileDirectory port and its injection token', () => {
    const directory: UserProfileDirectory = {
      findProfiles: jest.fn(() =>
        Promise.resolve([{ userId: 'user-requester-1', displayName: 'Alice' }]),
      ),
    };

    expect(chatPackage.USER_PROFILE_DIRECTORY).toBeDefined();
    expect(chatPackage.ListIncomingContactRequestsUseCase).toBeDefined();
    expect(directory).toBeDefined();
  });
});
