import type { RequesterProfile, RequesterProfileDirectory } from '@huddle/chat';
import type { ProfileQueryApi } from '@huddle/identity';

export class IdentityRequesterProfileDirectoryAdapter implements RequesterProfileDirectory {
  constructor(private readonly profileQueryApi: ProfileQueryApi) {}

  async findProfiles(userIds: string[]): Promise<RequesterProfile[]> {
    const { profiles } = await this.profileQueryApi.getProfiles(userIds);

    return profiles.map(({ userId, displayName }) => ({ userId, displayName }));
  }
}
