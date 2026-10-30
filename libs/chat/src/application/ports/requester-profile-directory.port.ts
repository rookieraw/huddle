export const REQUESTER_PROFILE_DIRECTORY = Symbol(
  'REQUESTER_PROFILE_DIRECTORY',
);

export type RequesterProfile = {
  userId: string;
  displayName: string;
};

export interface RequesterProfileDirectory {
  /**
   * Returns the found profiles for the given user ids, at most 50 ids per
   * call. A user id without a profile is absent from the result; the order of
   * the result is not guaranteed.
   */
  findProfiles(userIds: string[]): Promise<RequesterProfile[]>;
}
