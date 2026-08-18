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
    if (normalizedUserIds.length === 0) {
      return { profiles: [], missingUserIds: [] };
    }

    const profiles =
      await this.userRepository.findProfilesByIds(normalizedUserIds);
    const resolvedUserIds = new Set(profiles.map((profile) => profile.userId));
    const missingUserIds = normalizedUserIds.filter(
      (userId) => !resolvedUserIds.has(userId),
    );

    return {
      profiles,
      missingUserIds,
    };
  }
}
