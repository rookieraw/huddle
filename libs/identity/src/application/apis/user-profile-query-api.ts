import type { UserRepository } from '../ports/user.repository.port';
import {
  MAX_PROFILE_QUERY_USER_IDS,
  ProfileQueryLimitExceededError,
} from '../public-api/profile-query-api';
import type {
  ProfileQueryApi,
  ProfileQueryResult,
} from '../public-api/profile-query-api';

export class UserProfileQueryApi implements ProfileQueryApi {
  constructor(private readonly userRepository: UserRepository) {}

  async getProfiles(userIds: string[]): Promise<ProfileQueryResult> {
    if (userIds.length > MAX_PROFILE_QUERY_USER_IDS) {
      throw new ProfileQueryLimitExceededError();
    }

    const normalizedUserIds = [...new Set(userIds)];
    const users = await Promise.all(
      normalizedUserIds.map((userId) => this.userRepository.findById(userId)),
    );
    const profiles: ProfileQueryResult['profiles'] = [];
    const missingUserIds: string[] = [];

    users.forEach((user, index) => {
      if (!user) {
        missingUserIds.push(normalizedUserIds[index]);
        return;
      }

      profiles.push({
        userId: user.id,
        displayName: user.getDisplayName(),
      });
    });

    return {
      profiles,
      missingUserIds,
    };
  }
}
