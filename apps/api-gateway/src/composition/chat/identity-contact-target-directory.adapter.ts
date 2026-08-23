import type { ContactTargetDirectory } from '@huddle/chat';
import type { DirectoryApi } from '@huddle/identity';

export class IdentityContactTargetDirectoryAdapter implements ContactTargetDirectory {
  constructor(private readonly directoryApi: DirectoryApi) {}

  targetUserExists(targetUserId: string): Promise<boolean> {
    return this.directoryApi.userExists(targetUserId);
  }
}
