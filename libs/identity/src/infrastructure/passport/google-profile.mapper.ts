import type { Profile } from 'passport-google-oauth20';
import { OAuthProfileResult } from './oauth-profile-result';
import { DisplayName } from '../../domain/value-objects/display-name.vo';

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
