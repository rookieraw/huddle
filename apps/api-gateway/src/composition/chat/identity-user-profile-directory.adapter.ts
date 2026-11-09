import type { UserProfile, UserProfileDirectory } from '@huddle/chat';
import type { ProfileQueryApi } from '@huddle/identity';

export class IdentityUserProfileDirectoryAdapter implements UserProfileDirectory {
  constructor(private readonly profileQueryApi: ProfileQueryApi) {}

  async findProfiles(userIds: string[]): Promise<UserProfile[]> {
    const { profiles } = await this.profileQueryApi.getProfiles(userIds);

    return profiles.map(({ userId, displayName }) => ({ userId, displayName }));
  }
}
