// Placeholder values only. The Identity module needs them to start, and the
// OpenAPI specs must never depend on, or print, real credentials.
const placeholderEnvironment: Record<string, string> = {
  JWT_SECRET: 'test-placeholder-jwt-secret',
  GOOGLE_CLIENT_ID: 'test-placeholder-google-client-id',
  GOOGLE_CLIENT_SECRET: 'test-placeholder-google-client-secret',
  GOOGLE_CALLBACK_URL: 'http://localhost:4000/auth/oauth/google/callback',
  GITHUB_CLIENT_ID: 'test-placeholder-github-client-id',
  GITHUB_CLIENT_SECRET: 'test-placeholder-github-client-secret',
  GITHUB_CALLBACK_URL: 'http://localhost:4000/auth/oauth/github/callback',
};

/**
 * Sets the placeholder values in `process.env`, where they take precedence
 * over the root `.env`, and returns a function that restores the previous
 * values.
 */
export function applyPlaceholderIdentityEnvironment(): () => void {
  const previous: Record<string, string | undefined> = {};

  for (const [name, value] of Object.entries(placeholderEnvironment)) {
    previous[name] = process.env[name];
    process.env[name] = value;
  }

  return () => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  };
}
