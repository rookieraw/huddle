export interface ContactTargetDirectory {
  targetUserExists(targetUserId: string): Promise<boolean>;
}
