# Identity HTTP Contract

Status: Implemented with documented transitional behavior  
Last verified against source: 2026-08-07

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
  "password": "correct-horse-battery"
}
```

Validation:

| Field      | Requirement                       |
| ---------- | --------------------------------- |
| `email`    | Valid email                       |
| `password` | String with a minimum length of 8 |

Current success:

```http
201 Created
```

Current response:

```json
{
  "id": "user-id",
  "email": "ada@example.com",
  "verificationToken": "verification-token"
}
```

Current errors:

| Situation                         | Status |
| --------------------------------- | -----: |
| Invalid request                   |    400 |
| Email already registered          |    409 |
| Unexpected infrastructure failure |    500 |

### Transitional Security Note

Returning `verificationToken` is an explicit temporary Phase 1 behavior that stands in for authentication-critical Email delivery.

It must be removed from the public response when real verification Email delivery exists.

The final intended response must not expose the verification token.

Phase 2 also adds the required `displayName` field defined by the Identity Context. The request and response contract must be updated with that implementation.

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

Current errors:

| Situation                             | Status |
| ------------------------------------- | -----: |
| Invalid or expired verification token |    400 |
| Unexpected infrastructure failure     |    500 |

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

Current errors:

| Situation                         | Status |
| --------------------------------- | -----: |
| Invalid request                   |    400 |
| Invalid email or password         |    401 |
| Email is not verified             |    401 |
| Unexpected infrastructure failure |    500 |

Authentication errors must not reveal unnecessary account-existence details.

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

Current errors:

| Situation                                           | Status |
| --------------------------------------------------- | -----: |
| Invalid request                                     |    400 |
| Missing, unknown, expired, or revoked refresh token |    401 |
| Unexpected infrastructure failure                   |    500 |

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

Current errors:

| Situation                             | Status |
| ------------------------------------- | -----: |
| Invalid request                       |    400 |
| Invalid or missing access token       |    401 |
| Refresh token belongs to another user |    401 |
| Unexpected infrastructure failure     |    500 |

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

Current errors:

| Situation                              | Status |
| -------------------------------------- | -----: |
| Provider authentication fails          |    401 |
| Provider email cannot be safely linked |    401 |
| Unexpected infrastructure failure      |    500 |

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

Current errors:

| Situation                              | Status |
| -------------------------------------- | -----: |
| Provider authentication fails          |    401 |
| Provider email cannot be safely linked |    401 |
| Unexpected infrastructure failure      |    500 |

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

Current errors:

| Situation                                 | Status |
| ----------------------------------------- | -----: |
| Missing, invalid, or expired access token |    401 |
| Unexpected infrastructure failure         |    500 |

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
