import type { Profile } from 'passport-google-oauth20';
import { mapGoogleProfile } from './google-profile.mapper';

function buildProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    provider: 'google',
    id: 'google-sub-123',
    profileUrl: 'https://plus.google.com/123',
    emails: [{ value: 'ada@example.com', verified: true }],
    _raw: '{}',
    _json: {} as Profile['_json'],
    ...overrides,
  } as Profile;
}

describe('mapGoogleProfile', () => {
  it('extracts the provider id from profile.id', () => {
    const result = mapGoogleProfile(buildProfile());

    expect(result.providerId).toBe('google-sub-123');
  });

  it('extracts the primary email address', () => {
    const result = mapGoogleProfile(buildProfile());

    expect(result.email).toBe('ada@example.com');
  });

  it('reports emailVerified true when Google asserts the email is verified', () => {
    const result = mapGoogleProfile(
      buildProfile({ emails: [{ value: 'ada@example.com', verified: true }] }),
    );

    expect(result.emailVerified).toBe(true);
  });

  it('reports emailVerified false when Google does not assert verification', () => {
    const result = mapGoogleProfile(
      buildProfile({ emails: [{ value: 'ada@example.com', verified: false }] }),
    );

    expect(result.emailVerified).toBe(false);
  });

  it('throws when the profile has no email address', () => {
    expect(() =>
      mapGoogleProfile(buildProfile({ emails: undefined })),
    ).toThrow();
  });
});
