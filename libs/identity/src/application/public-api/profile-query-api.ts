export const PROFILE_QUERY_API = Symbol('PROFILE_QUERY_API');
export const MAX_PROFILE_QUERY_USER_IDS = 50;

export class ProfileQueryLimitExceededError extends Error {
  constructor() {
    super('Profile query accepts at most 50 user identifiers');
    this.name = 'ProfileQueryLimitExceededError';
  }
}

export interface PublicUserProfile {
  userId: string;
  displayName: string;
}

export interface ProfileQueryResult {
  profiles: PublicUserProfile[];
  missingUserIds: string[];
}

export interface ProfileQueryApi {
  getProfiles(userIds: string[]): Promise<ProfileQueryResult>;
}
