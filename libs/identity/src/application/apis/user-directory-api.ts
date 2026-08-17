import type { UserRepository } from '../ports/user.repository.port';
import type { DirectoryApi } from '../public-api/directory-api';

export class UserDirectoryApi implements DirectoryApi {
  constructor(private readonly userRepository: UserRepository) {}

  async userExists(userId: string): Promise<boolean> {
    const user = await this.userRepository.findById(userId);

    return user !== null;
  }
}
