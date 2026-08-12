import type { Profile } from 'passport-google-oauth20';
import { OAuthProfileResult } from './oauth-profile-result';

const MAX_DISPLAY_NAME_LENGTH = 50;

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

export function mapGoogleProfile(profile: Profile): OAuthProfileResult {
  const primaryEmail = profile.emails?.[0];
  if (!primaryEmail) {
    throw new Error('Google profile did not include an email address');
  }

  return {
    providerId: profile.id,
    email: primaryEmail.value,
    emailVerified: primaryEmail.verified,
    displayName: normalizeDisplayName(profile.displayName),
  };
}
