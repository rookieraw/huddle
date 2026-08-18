export const DIRECTORY_API = Symbol('DIRECTORY_API');

export interface DirectoryApi {
  userExists(userId: string): Promise<boolean>;
}
