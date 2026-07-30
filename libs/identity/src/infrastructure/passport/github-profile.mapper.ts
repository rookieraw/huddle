import { OAuthProfileResult } from './oauth-profile-result';

export interface GithubOAuthProfile {
  id: string;
  emails?: Array<{ value: string; primary?: boolean; verified?: boolean }>;
}

export function mapGithubProfile(
  profile: GithubOAuthProfile,
): OAuthProfileResult {
  const emails = profile.emails ?? [];
  const primaryEmail = emails.find((e) => e.primary) ?? emails[0];
  if (!primaryEmail) {
    throw new Error('GitHub profile did not include an email address');
  }

  return {
    providerId: profile.id,
    email: primaryEmail.value,
    emailVerified: Boolean(primaryEmail.verified),
  };
}
