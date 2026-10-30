import type { ProfileQueryApi } from '@huddle/identity';
import { IdentityRequesterProfileDirectoryAdapter } from './identity-requester-profile-directory.adapter';

describe('IdentityRequesterProfileDirectoryAdapter', () => {
  it('forwards the exact user ids once and returns only the found profile entries', async () => {
    const getProfiles = jest.fn(() =>
      Promise.resolve({
        profiles: [
          { userId: 'user-requester-2', displayName: 'Bob' },
          { userId: 'user-requester-1', displayName: 'Alice' },
        ],
        missingUserIds: ['user-requester-3'],
      }),
    );
    const profileQueryApi: ProfileQueryApi = { getProfiles };
    const adapter = new IdentityRequesterProfileDirectoryAdapter(
      profileQueryApi,
    );

    await expect(
      adapter.findProfiles([
        'user-requester-1',
        'user-requester-2',
        'user-requester-3',
      ]),
    ).resolves.toEqual([
      { userId: 'user-requester-2', displayName: 'Bob' },
      { userId: 'user-requester-1', displayName: 'Alice' },
    ]);
    expect(getProfiles).toHaveBeenCalledTimes(1);
    expect(getProfiles).toHaveBeenCalledWith([
      'user-requester-1',
      'user-requester-2',
      'user-requester-3',
    ]);
  });

  it('preserves an Identity profile query rejection', async () => {
    const profileFailure = new Error('Identity profile query unavailable');
    const getProfiles = jest.fn(() => Promise.reject(profileFailure));
    const profileQueryApi: ProfileQueryApi = { getProfiles };
    const adapter = new IdentityRequesterProfileDirectoryAdapter(
      profileQueryApi,
    );

    await expect(adapter.findProfiles(['user-requester-1'])).rejects.toBe(
      profileFailure,
    );
  });
});
