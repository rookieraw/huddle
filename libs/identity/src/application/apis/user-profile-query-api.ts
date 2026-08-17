import type { UserRepository } from '../ports/user.repository.port';
import type {
  ProfileQueryApi,
  ProfileQueryResult,
} from '../public-api/profile-query-api';

export class UserProfileQueryApi implements ProfileQueryApi {
  constructor(private readonly userRepository: UserRepository) {}

  async getProfiles(userIds: string[]): Promise<ProfileQueryResult> {
    const users = await Promise.all(
      userIds.map((userId) => this.userRepository.findById(userId)),
    );

    return {
      profiles: users.map((user) => ({
        userId: user!.id,
        displayName: user!.getDisplayName(),
      })),
      missingUserIds: [],
    };
  }
}
