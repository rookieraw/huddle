export const CONTACT_TARGET_DIRECTORY = Symbol('CONTACT_TARGET_DIRECTORY');

export interface ContactTargetDirectory {
  targetUserExists(targetUserId: string): Promise<boolean>;
}
