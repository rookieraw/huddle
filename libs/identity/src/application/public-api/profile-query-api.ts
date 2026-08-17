export const PROFILE_QUERY_API = Symbol('PROFILE_QUERY_API');

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
