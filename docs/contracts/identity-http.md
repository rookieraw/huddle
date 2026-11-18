# Identity HTTP Contract

Status: Implemented with documented transitional behavior; stable error envelope Accepted, not implemented  
Last verified against source: 2026-11-18

## Purpose

This document is the authoritative HTTP contract for implemented Identity endpoints.

It defines:

- Exact Identity HTTP paths and methods
- Request and response payloads
- Authentication requirements
- Identity-specific status behavior
- Transitional implemented behavior

Common HTTP conventions, shared error categories, validation behavior, and the planned capability registry are maintained in [`http.md`](http.md).

A capability appearing in the Identity Context or a delivery Phase does not create an HTTP endpoint automatically.

## Source-of-Truth Boundary

| Concern                                      | Authoritative source                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| Exact implemented Identity HTTP contracts    | This document                                                            |
| Shared HTTP conventions and error categories | [`http.md`](http.md)                                                     |
| Identity invariants and application behavior | [`../contexts/identity.md`](../contexts/identity.md)                     |
| Identity delivery state                      | [`../delivery/phases/01-identity.md`](../delivery/phases/01-identity.md) |
| Current project status                       | [`../delivery/status.md`](../delivery/status.md)                         |
| System-wide security principles              | [`../architecture/security.md`](../architecture/security.md)             |
| Executable behavior                          | Controllers, DTOs, guards, and tests                                     |

When this document and executable behavior disagree, treat the discrepancy as a defect. Verify the intended behavior and update both in the same change.

## Implementation Location

The endpoints in this document are currently implemented under:

```text
libs/identity/src/interface/http/
```

Their behavior has been checked against the controllers, DTOs, controller tests, and available E2E tests.

## Error Responses

State: Accepted, not implemented. Today every Identity error uses the
framework-generated body described under
[Transitional Identity Error Envelope](http.md#transitional-identity-error-envelope).
The statuses in each operation's error table are implemented, except where a
note under the table records a known defect or a decided change.

### Envelope and Messages

Every Identity error uses the
[stable application error envelope](http.md#stable-application-error-envelope)
unchanged: `{ "error": { "code", "message", "details"? } }`. Clients branch on
`error.code`.

Each code has exactly one status and one fixed public message. No public
message or detail comes from a Domain error, a framework exception, the
validation library, an authentication library, the database, or the body
parser, and client input is never echoed. A failure that no rule below
classifies is `500 INTERNAL_ERROR`, never a guessed client error.

| Code                          | Status | Public message                            | Consumer action                                                                                                                                                                                                     |
| ----------------------------- | -----: | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VALIDATION_FAILED`           |    400 | Request validation failed.                | Correct the fields named in `details`, then retry. Without `details`, correct the request format.                                                                                                                   |
| `EMAIL_ALREADY_REGISTERED`    |    409 | Email is already registered.              | Do not retry unchanged. Offer sign-in, or registration with another email.                                                                                                                                          |
| `VERIFICATION_TOKEN_INVALID`  |    400 | Verification token is invalid or expired. | Do not retry the same token. If the token was used before, or an earlier attempt ended in `INTERNAL_ERROR`, the email may already be verified, so offer sign-in. Otherwise the user needs a new verification token. |
| `INVALID_CREDENTIALS`         |    401 | Email or password is invalid.             | Let the user correct the email or password. Never say which one is wrong.                                                                                                                                           |
| `EMAIL_NOT_VERIFIED`          |    403 | Email address is not verified.            | Tell the user to verify their email before signing in.                                                                                                                                                              |
| `REFRESH_TOKEN_INVALID`       |    401 | Refresh token is invalid or expired.      | Discard the stored token pair and sign in again.                                                                                                                                                                    |
| `AUTHENTICATION_REQUIRED`     |    401 | Authentication is required.               | Get a new access token (refresh it, or sign in again), then retry.                                                                                                                                                  |
| `FORBIDDEN`                   |    403 | Access is not allowed.                    | Do not retry unchanged. The session stays valid, so keep the stored token pair.                                                                                                                                     |
| `OAUTH_AUTHENTICATION_FAILED` |    401 | Provider authentication failed.           | Offer to start provider sign-in again.                                                                                                                                                                              |
| `INTERNAL_ERROR`              |    500 | An unexpected error occurred.             | Do not assume whether the operation completed. Reconcile before retrying, as the operation's notes describe.                                                                                                        |

`VALIDATION_FAILED`, `AUTHENTICATION_REQUIRED`, `FORBIDDEN`, and
`INTERNAL_ERROR` are shared codes owned by
[`http.md`](http.md#shared-error-codes-and-status-mappings); the consumer
actions above are their meaning on Identity routes. The other codes are
Identity's.

How a user obtains a new verification token is decided with the browser
authentication flow.

### Validation Details

`VALIDATION_FAILED` carries one detail per failing declared field, in the
order of the operation's validation table. Each field appears at most once,
with one fixed message, whichever rule failed. The rejected value is never
repeated, and undeclared fields, which are removed, are never reported.

| Field          | Operation                  | Detail message                                           |
| -------------- | -------------------------- | -------------------------------------------------------- |
| `email`        | Register, Credential Login | email must be a valid email address.                     |
| `password`     | Register                   | password must be a string of at least 8 characters.      |
| `password`     | Credential Login           | password must be a string.                               |
| `displayName`  | Register                   | displayName must have 1 to 50 characters after trimming. |
| `refreshToken` | Refresh, Logout            | refreshToken must be a string.                           |
| `token`        | Verify Email               | token must be a single non-empty value.                  |

### Account Non-Disclosure

- Validation details describe only the format of the request. They are
  produced before any account lookup and never state whether an account
  exists, whether its email is verified, or whether a password matches.
  Credential Login's `password` rule is "must be a string", with no length
  rule.
- A `401` or `403` never carries `details`.
- An unknown email, a wrong password, and an account without a password are
  indistinguishable: the same status, code, message, and body.
- `EMAIL_NOT_VERIFIED` is distinct, and is reachable only after the correct
  password.
- Registration's `409 EMAIL_ALREADY_REGISTERED` is a stated, accepted
  disclosure.
- Every OAuth callback failure shares `OAUTH_AUTHENTICATION_FAILED`,
  including a refused account link. The shared code does not hide account
  existence: a person who controls a provider account showing a given email
  can tell from success or failure whether a Huddle account with that email
  exists. That is a limit of the current account-linking rules.

### Precedence

On every Identity route:

1. A request rejected before routing gets the outcome in
   [Requests Rejected Before Routing](http.md#requests-rejected-before-routing).
   This includes a body that cannot be parsed, even on a route that needs an
   access token. Those outcomes are not repeated per operation below, and a
   statement below about an operation's outcomes covers only its
   operation-specific outcomes.
2. An access-token failure gets `AUTHENTICATION_REQUIRED`.
3. A format failure gets `VALIDATION_FAILED`.
4. The operation's own outcomes follow.

Every `401` carries `WWW-Authenticate`, as
[Error Response Headers](http.md#error-response-headers) defines.

### Known Defects and Decided Changes

These rows differ from today's implemented behavior. Each operation's table
shows the decided outcome; the note under it gives today's behavior.

| Behavior                                                                                                        | Today                        | Decided                                                                       | Kind           |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------- | -------------- |
| Verify Email without `token`                                                                                    | 500                          | 400 `VALIDATION_FAILED`, detail `token`                                       | Known defect   |
| OAuth callback with a provider `error` other than `access_denied`                                               | 500                          | 401 `OAUTH_AUTHENTICATION_FAILED`                                             | Known defect   |
| OAuth callback with no provider result                                                                          | 302 to the provider          | 401 `OAUTH_AUTHENTICATION_FAILED`                                             | Known defect   |
| `displayName` that passes request validation but exceeds 50 code points (for example with a variation selector) | 409 with Domain text         | 400 `VALIDATION_FAILED`, detail `displayName`                                 | Known defect   |
| OAuth provider profile without an email                                                                         | 500                          | 401 `OAUTH_AUTHENTICATION_FAILED`                                             | Known defect   |
| OAuth provider rejects the `code`, or another provider call fails                                               | 500                          | 401 `OAUTH_AUTHENTICATION_FAILED`                                             | Known defect   |
| Concurrent registration, or concurrent first OAuth sign-in, with the same new email                             | 500                          | 409 `EMAIL_ALREADY_REGISTERED`, or 401 `OAUTH_AUTHENTICATION_FAILED` on OAuth | Known defect   |
| OAuth start route that receives a provider result                                                               | 401, 500, or a code exchange | 401 `OAUTH_AUTHENTICATION_FAILED`                                             | Known defect   |
| Credential Login with the correct password and an unverified email                                              | 401                          | 403 `EMAIL_NOT_VERIFIED`                                                      | Decided change |
| Logout with a refresh token that belongs to another user                                                        | 401                          | 403 `FORBIDDEN`                                                               | Decided change |

The concurrent-registration fix depends on the database reporting which
unique field was violated. If it does not, the race stays
`500 INTERNAL_ERROR`, and this contract records that as a known limit when
the change is implemented.

## Register with Email and Password

State: Transitional implementation  
Authentication: Public

```http
POST /auth/register
Content-Type: application/json
```

Request:

```json
{
  "email": "ada@example.com",
  "password": "correct-horse-battery",
  "displayName": "Ada Lovelace"
}
```

Validation:

| Field         | Requirement                                         |
| ------------- | --------------------------------------------------- |
| `email`       | Valid email                                         |
| `password`    | String with a minimum length of 8                   |
| `displayName` | String, trimmed non-blank, 1–50 Unicode code points |

Request validation must count `displayName` in Unicode code points, exactly
as this table states. Today it does not count a character followed by a
variation selector, which is the known defect noted under this operation's
errors.

Current success:

```http
201 Created
```

Current response:

```json
{
  "id": "user-id",
  "email": "ada@example.com",
  "displayName": "Ada Lovelace",
  "verificationToken": "verification-token"
}
```

Errors (codes and messages in [Error Responses](#error-responses)):

| Situation                                                                                               | Status | Code                       | Consumer action                                                                  |
| ------------------------------------------------------------------------------------------------------- | -----: | -------------------------- | -------------------------------------------------------------------------------- |
| A declared field is missing or has the wrong format                                                     |    400 | `VALIDATION_FAILED`        | Correct the fields named in `details`, then retry.                               |
| Email already registered, including a concurrent registration of the same new email that loses the race |    409 | `EMAIL_ALREADY_REGISTERED` | Offer sign-in, or registration with another email.                               |
| Unexpected failure, including an unavailable database                                                   |    500 | `INTERNAL_ERROR`           | The account may already exist, so a retry can return `EMAIL_ALREADY_REGISTERED`. |

Known defects today: a `displayName` that passes request validation but
exceeds 50 code points returns `409` with Domain text, and the lost
concurrent registration returns `500`. See
[Known Defects and Decided Changes](#known-defects-and-decided-changes).

### Transitional Security Note

Returning `verificationToken` is an explicit temporary Phase 1 behavior that stands in for authentication-critical Email delivery.

It must be removed from the public response when real verification Email delivery exists.

The final intended response must not expose the verification token.

## Verify Email

State: Implemented  
Authentication: Public

```http
GET /auth/verify?token=<verification-token>
```

Success:

```http
200 OK
```

Response:

```json
{
  "id": "user-id",
  "email": "ada@example.com",
  "verified": true
}
```

Validation:

| Field   | Requirement               |
| ------- | ------------------------- |
| `token` | One non-empty query value |

Errors (codes and messages in [Error Responses](#error-responses)):

| Situation                               | Status | Code                         | Consumer action                                                                                                   |
| --------------------------------------- | -----: | ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `token` absent, empty, or repeated      |    400 | `VALIDATION_FAILED`          | Use the verification link as received.                                                                            |
| Token unknown, expired, or already used |    400 | `VERIFICATION_TOKEN_INVALID` | Do not retry the same token; offer sign-in, or a new verification token.                                          |
| Unexpected failure                      |    500 | `INTERNAL_ERROR`             | The first attempt may have verified the email, so a retry can return `VERIFICATION_TOKEN_INVALID`; offer sign-in. |

Known defect today: a request without `token` returns `500`. An empty or
repeated `token` already returns `400`, with the transitional body. See
[Known Defects and Decided Changes](#known-defects-and-decided-changes).

The token is single-purpose and time-bounded according to Identity behavior.

The current use of a query parameter is implemented behavior. Reverse-proxy and application logs must not record verification-token values indiscriminately.

## Credential Login

State: Implemented  
Authentication: Public

```http
POST /auth/login
Content-Type: application/json
```

Request:

```json
{
  "email": "ada@example.com",
  "password": "correct-horse-battery"
}
```

Validation:

| Field      | Requirement |
| ---------- | ----------- |
| `email`    | Valid email |
| `password` | String      |

Success:

```http
200 OK
```

Response:

```json
{
  "accessToken": "jwt-access-token",
  "refreshToken": "opaque-refresh-token"
}
```

Errors (codes and messages in [Error Responses](#error-responses)):

| Situation                                                    | Status | Code                  | Consumer action                                                       |
| ------------------------------------------------------------ | -----: | --------------------- | --------------------------------------------------------------------- |
| A declared field is missing or has the wrong format          |    400 | `VALIDATION_FAILED`   | Correct the fields named in `details`, then retry.                    |
| Unknown email, wrong password, or account without a password |    401 | `INVALID_CREDENTIALS` | Let the user correct the email or password; never say which is wrong. |
| Correct password, email not verified                         |    403 | `EMAIL_NOT_VERIFIED`  | Tell the user to verify their email before signing in.                |
| Unexpected failure                                           |    500 | `INTERNAL_ERROR`      | Do not assume whether sign-in completed; retry sign-in.               |

Decided change: the unverified-email outcome returns `401` today. It becomes
`403`, because the credentials are valid and the sign-in is refused (RFC 9110
§15.5.4), which also keeps it apart from a client's `401` handling. See
[Known Defects and Decided Changes](#known-defects-and-decided-changes).

Authentication errors must not reveal unnecessary account-existence details;
see [Account Non-Disclosure](#account-non-disclosure).

## Refresh Authentication Tokens

State: Implemented  
Authentication: Refresh token in request body

```http
POST /auth/refresh
Content-Type: application/json
```

Request:

```json
{
  "refreshToken": "current-refresh-token"
}
```

Success:

```http
200 OK
```

Response:

```json
{
  "accessToken": "new-jwt-access-token",
  "refreshToken": "new-refresh-token"
}
```

Validation:

| Field          | Requirement |
| -------------- | ----------- |
| `refreshToken` | String      |

Errors (codes and messages in [Error Responses](#error-responses)):

| Situation                                                                                            | Status | Code                    | Consumer action                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------- | -----: | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `refreshToken` missing or not a string                                                               |    400 | `VALIDATION_FAILED`     | Correct the request before retrying.                                                                                                                                                                    |
| Unknown, expired, revoked, or reused token (including an empty string), or its user no longer exists |    401 | `REFRESH_TOKEN_INVALID` | Discard the stored token pair and sign in again.                                                                                                                                                        |
| Unexpected failure                                                                                   |    500 | `INTERNAL_ERROR`        | If the first attempt already rotated the token, a retry with the same token counts as reuse, which revokes the user's refresh tokens and returns `REFRESH_TOKEN_INVALID`; the user then signs in again. |

A missing `refreshToken` fails request validation and returns `400`, as the
implementation does.

The successful operation rotates the refresh token.

Reuse of a revoked refresh token triggers revocation of the user's known refresh tokens according to the current Identity implementation.

Clients must replace the previous token pair atomically after a successful response.

## Logout

State: Implemented  
Authentication: Bearer access token

```http
POST /auth/logout
Authorization: Bearer <access-token>
Content-Type: application/json
```

Request:

```json
{
  "refreshToken": "refresh-token-to-revoke"
}
```

Success:

```http
204 No Content
```

Current behavior:

- An unknown refresh token is treated idempotently.
- A token owned by the authenticated user is revoked.
- A token owned by another user is rejected.

Validation:

| Field          | Requirement |
| -------------- | ----------- |
| `refreshToken` | String      |

Errors (codes and messages in [Error Responses](#error-responses)):

| Situation                                                         | Status | Code                      | Consumer action                                                                 |
| ----------------------------------------------------------------- | -----: | ------------------------- | ------------------------------------------------------------------------------- |
| Access token missing or unusable (checked before body validation) |    401 | `AUTHENTICATION_REQUIRED` | Get a new access token, then retry.                                             |
| `refreshToken` missing or not a string                            |    400 | `VALIDATION_FAILED`       | Correct the request before retrying.                                            |
| Refresh token belongs to another user; it is not revoked          |    403 | `FORBIDDEN`               | Do not retry unchanged. The session stays valid, so keep the stored token pair. |
| Unexpected failure                                                |    500 | `INTERNAL_ERROR`          | Do not assume whether the refresh token was revoked.                            |

Decided change: a refresh token that belongs to another user returns `401`
today. It becomes `403`, because the caller is authenticated and the action is
refused. See
[Known Defects and Decided Changes](#known-defects-and-decided-changes).

Logout does not accept a body-supplied actor identifier.

## Google OAuth Start

State: Implemented; provider-environment dependent  
Authentication: Public

```http
GET /auth/oauth/google
```

Expected behavior:

```http
302 Redirect
```

The Google Passport guard redirects the browser to Google's authorization flow.

Errors (codes and messages in [Error Responses](#error-responses)):

| Situation                                                                              | Status | Code                          | Consumer action                        |
| -------------------------------------------------------------------------------------- | -----: | ----------------------------- | -------------------------------------- |
| A provider result is present: `error` in the query, or `code` in the query or the body |    401 | `OAUTH_AUTHENTICATION_FAILED` | Offer to start provider sign-in again. |
| Unexpected failure                                                                     |    500 | `INTERNAL_ERROR`              | Offer to start provider sign-in again. |

Only a request without a provider result redirects. A start route never
completes or fails a provider sign-in on its own.

Known defect today: a start route processes a provider result like a
callback. `error=access_denied` returns `401`, any other `error` returns
`500`, and a `code` is exchanged with the provider. See
[Known Defects and Decided Changes](#known-defects-and-decided-changes).

The requested provider scopes currently include:

```text
email
profile
```

Exact provider URL and query parameters are provider and Passport infrastructure details, not Huddle's public application contract.

## Google OAuth Callback

State: Implemented; provider-environment dependent  
Authentication: Verified Google OAuth callback

```http
GET /auth/oauth/google/callback
```

Current success:

```http
200 OK
```

Current response:

```json
{
  "accessToken": "jwt-access-token",
  "refreshToken": "opaque-refresh-token"
}
```

Errors (codes and messages in [Error Responses](#error-responses)):

| Situation                                                                                                                                                                                                                                                                                                                                 | Status | Code                          | Consumer action                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -----: | ----------------------------- | ---------------------------------------------------------------------------------------------- |
| Any of: a provider `error` in the query, including `access_denied`; no provider result at all; the provider rejects the `code`; another provider call fails; the provider profile has no email; the provider identity cannot be safely linked to an account, including a concurrent first sign-in with the same email that loses the race |    401 | `OAUTH_AUTHENTICATION_FAILED` | Offer to start provider sign-in again.                                                         |
| Unexpected failure, including a malformed provider profile response                                                                                                                                                                                                                                                                       |    500 | `INTERNAL_ERROR`              | Do not assume whether an account was created or linked; offer to start provider sign-in again. |

The callback never starts a new provider flow.

Known defects today: a provider `error` other than `access_denied`, a
rejected `code` or other provider-call failure, a profile without email, and
a lost first sign-in race return `500`; a request with no provider result
redirects to the provider. See
[Known Defects and Decided Changes](#known-defects-and-decided-changes).

Current account-linking behavior requires the provider email and existing Huddle email to satisfy Identity's verification rules.

The callback currently returns the token pair as JSON. If a future frontend redirect or cookie-based handoff replaces this behavior, its security and contract must be reviewed explicitly.

## GitHub OAuth Start

State: Implemented; provider-environment dependent  
Authentication: Public

```http
GET /auth/oauth/github
```

Expected behavior:

```http
302 Redirect
```

The GitHub Passport guard redirects the browser to GitHub's authorization flow.

Errors and known defects: as for [Google OAuth Start](#google-oauth-start).

The requested provider scope currently includes:

```text
user:email
```

## GitHub OAuth Callback

State: Implemented; provider-environment dependent  
Authentication: Verified GitHub OAuth callback

```http
GET /auth/oauth/github/callback
```

Current success:

```http
200 OK
```

Current response:

```json
{
  "accessToken": "jwt-access-token",
  "refreshToken": "opaque-refresh-token"
}
```

Errors and known defects: as for
[Google OAuth Callback](#google-oauth-callback). For GitHub, an empty email
list is an unexpected failure (`500`).

The callback currently returns JSON tokens and follows the same Identity account-linking rules as Google OAuth.

## Get Current User

State: Transitional implementation  
Authentication: Bearer access token

```http
GET /users/me
Authorization: Bearer <access-token>
```

Current success:

```http
200 OK
```

Current response:

```json
{
  "id": "user-id",
  "email": "ada@example.com",
  "tier": "free"
}
```

Errors (codes and messages in [Error Responses](#error-responses)):

| Situation                                 | Status | Code                      | Consumer action                       |
| ----------------------------------------- | -----: | ------------------------- | ------------------------------------- |
| Missing, invalid, or expired access token |    401 | `AUTHENTICATION_REQUIRED` | Get a new access token, then retry.   |
| Unexpected failure                        |    500 | `INTERNAL_ERROR`          | Retry reading the current user later. |

### Transitional Ownership Note

The current endpoint is implemented by `UsersController` inside Identity and returns a hardcoded Free tier.

This is temporary.

The accepted Phase 4 target is a composed current-user endpoint outside both Identity and Billing:

```text
Application composition root
├── Identity profile-query capability
└── Billing current-subscription or entitlement capability
```

Required target behavior:

- Identity does not import Billing.
- Billing does not import Identity for profile data.
- The authenticated principal supplies the requester identity.
- Billing failure causes the composite endpoint to return `503`.
- Pure Identity authentication endpoints remain independent.

Before Phase 4, the composition root must use a dedicated static Free adapter rather than an inline controller literal.

The Phase 4 response contract must be finalized before replacing the current endpoint.

## Contract Testing Requirements

Each implemented Identity endpoint requires applicable tests for:

- Successful response
- Request validation
- Authentication
- Authorization
- Duplicate request behavior
- Persistence failure translation
- Absence of sensitive response fields

OAuth provider redirects and callbacks require controlled provider tests or an explicitly documented environment validation.

A TypeScript interface written only inside a test does not establish a public HTTP contract. The controller behavior and this document must agree.

## Related Documentation

- [Shared HTTP Contract](http.md)
- [Identity Context](../contexts/identity.md)
- [Identity Phase](../delivery/phases/01-identity.md)
- [Current Status](../delivery/status.md)
- [Security Architecture](../architecture/security.md)
