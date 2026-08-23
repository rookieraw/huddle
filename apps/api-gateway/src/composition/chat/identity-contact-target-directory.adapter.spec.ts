import type { DirectoryApi } from '@huddle/identity';
import { IdentityContactTargetDirectoryAdapter } from './identity-contact-target-directory.adapter';

describe('IdentityContactTargetDirectoryAdapter', () => {
  it('forwards the exact target once and returns an existing-user result', async () => {
    const userExists = jest.fn(() => Promise.resolve(true));
    const directoryApi: DirectoryApi = { userExists };
    const adapter = new IdentityContactTargetDirectoryAdapter(directoryApi);

    await expect(adapter.targetUserExists('user-target')).resolves.toBe(true);
    expect(userExists).toHaveBeenCalledTimes(1);
    expect(userExists).toHaveBeenCalledWith('user-target');
  });

  it('returns false when Identity confirms that the target is missing', async () => {
    const userExists = jest.fn(() => Promise.resolve(false));
    const directoryApi: DirectoryApi = { userExists };
    const adapter = new IdentityContactTargetDirectoryAdapter(directoryApi);

    await expect(adapter.targetUserExists('missing-user')).resolves.toBe(false);
  });

  it('preserves an Identity dependency rejection', async () => {
    const directoryFailure = new Error('Identity directory unavailable');
    const userExists = jest.fn(() => Promise.reject(directoryFailure));
    const directoryApi: DirectoryApi = { userExists };
    const adapter = new IdentityContactTargetDirectoryAdapter(directoryApi);

    await expect(adapter.targetUserExists('user-target')).rejects.toBe(
      directoryFailure,
    );
  });
});
