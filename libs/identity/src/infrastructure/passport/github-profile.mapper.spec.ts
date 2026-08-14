import { mapGithubProfile, GithubOAuthProfile } from './github-profile.mapper';

function buildProfile(
  overrides: Partial<GithubOAuthProfile> = {},
): GithubOAuthProfile {
  return {
    id: 'github-id-456',
    displayName: 'Ada Lovelace',
    username: 'adalovelace',
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

  it('extracts the provider display name when present', () => {
    const result = mapGithubProfile(
      buildProfile({ displayName: 'Ada Lovelace' }),
    );

    expect(result.displayName).toBe('Ada Lovelace');
  });

  it('falls back to username when displayName is absent', () => {
    const result = mapGithubProfile(
      buildProfile({ displayName: undefined, username: 'adalovelace' }),
    );

    expect(result.displayName).toBe('adalovelace');
  });

  it('returns undefined display name when neither displayName nor username is present', () => {
    const result = mapGithubProfile(
      buildProfile({ displayName: undefined, username: undefined }),
    );

    expect(result.displayName).toBeUndefined();
  });

  it('returns undefined display name when the provided name is only whitespace', () => {
    const result = mapGithubProfile(
      buildProfile({ displayName: '   ', username: undefined }),
    );

    expect(result.displayName).toBeUndefined();
  });

  it('returns undefined display name when the provided name exceeds 50 characters', () => {
    const result = mapGithubProfile(
      buildProfile({ displayName: 'A'.repeat(51), username: undefined }),
    );

    expect(result.displayName).toBeUndefined();
  });

  it('accepts exactly 50 astral-plane (surrogate-pair) code points as a display name', () => {
    const astralChar = String.fromCodePoint(0x1f600);
    const result = mapGithubProfile(
      buildProfile({ displayName: astralChar.repeat(50), username: undefined }),
    );

    expect(result.displayName).toBe(astralChar.repeat(50));
  });

  it('returns undefined display name when the provided name has 51 astral-plane code points', () => {
    const astralChar = String.fromCodePoint(0x1f600);
    const result = mapGithubProfile(
      buildProfile({ displayName: astralChar.repeat(51), username: undefined }),
    );

    expect(result.displayName).toBeUndefined();
  });
});
