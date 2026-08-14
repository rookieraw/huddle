import { OAuthProfileResult } from './oauth-profile-result';
import { DisplayName } from '../../domain/value-objects/display-name.vo';

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
  try {
    return DisplayName.create(raw).value;
  } catch {
    return undefined;
  }
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
