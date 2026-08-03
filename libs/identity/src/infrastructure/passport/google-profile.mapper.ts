import type { Profile } from 'passport-google-oauth20';
import { OAuthProfileResult } from './oauth-profile-result';

export function mapGoogleProfile(profile: Profile): OAuthProfileResult {
  const primaryEmail = profile.emails?.[0];
  if (!primaryEmail) {
    throw new Error('Google profile did not include an email address');
  }

  return {
    providerId: profile.id,
    email: primaryEmail.value,
    emailVerified: primaryEmail.verified,
  };
}
