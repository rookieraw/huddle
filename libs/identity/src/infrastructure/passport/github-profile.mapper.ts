import { OAuthProfileResult } from './oauth-profile-result';

const MAX_DISPLAY_NAME_LENGTH = 50;

export interface GithubOAuthProfile {
  id: string;
  displayName?: string;
  username?: string;
  emails?: Array<{ value: string; primary?: boolean; verified?: boolean }>;
}

function normalizeDisplayName(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
    return undefined;
  }
  return trimmed;
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
    displayName:
      normalizeDisplayName(profile.displayName) ??
      normalizeDisplayName(profile.username),
  };
}
