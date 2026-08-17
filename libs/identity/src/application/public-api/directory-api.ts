export interface DirectoryApi {
  userExists(userId: string): Promise<boolean>;
}
