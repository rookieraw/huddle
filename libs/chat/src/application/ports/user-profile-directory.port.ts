export const USER_PROFILE_DIRECTORY = Symbol('USER_PROFILE_DIRECTORY');

export type UserProfile = {
  userId: string;
  displayName: string;
};

export interface UserProfileDirectory {
  /**
   * Returns the found profiles for the given user ids, at most 50 ids per
   * call. A user id without a profile is absent from the result; the order of
   * the result is not guaranteed.
   */
  findProfiles(userIds: string[]): Promise<UserProfile[]>;
}
