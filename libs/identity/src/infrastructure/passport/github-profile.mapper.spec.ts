import { mapGithubProfile, GithubOAuthProfile } from './github-profile.mapper';

function buildProfile(
  overrides: Partial<GithubOAuthProfile> = {},
): GithubOAuthProfile {
  return {
    id: 'github-id-456',
    emails: [{ value: 'ada@example.com', primary: true, verified: true }],
    ...overrides,
  };
}

describe('mapGithubProfile', () => {
  it('extracts the provider id from profile.id', () => {
    const result = mapGithubProfile(buildProfile());

    expect(result.providerId).toBe('github-id-456');
  });

  it('extracts the primary email when multiple emails are present', () => {
    const result = mapGithubProfile(
      buildProfile({
        emails: [
          { value: 'old@example.com', primary: false, verified: true },
          { value: 'ada@example.com', primary: true, verified: true },
        ],
      }),
    );

    expect(result.email).toBe('ada@example.com');
  });

  it('reports emailVerified true when GitHub marks the primary email verified', () => {
    const result = mapGithubProfile(
      buildProfile({
        emails: [{ value: 'ada@example.com', primary: true, verified: true }],
      }),
    );

    expect(result.emailVerified).toBe(true);
  });

  it('reports emailVerified false when GitHub marks the primary email unverified', () => {
    const result = mapGithubProfile(
      buildProfile({
        emails: [{ value: 'ada@example.com', primary: true, verified: false }],
      }),
    );

    expect(result.emailVerified).toBe(false);
  });

  it('falls back to the first email if none is marked primary', () => {
    const result = mapGithubProfile(
      buildProfile({
        emails: [{ value: 'only@example.com', verified: true }],
      }),
    );

    expect(result.email).toBe('only@example.com');
  });

  it('throws when the profile has no email address', () => {
    expect(() => mapGithubProfile(buildProfile({ emails: [] }))).toThrow();
  });
});
