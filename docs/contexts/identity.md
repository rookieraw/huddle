# Identity Context

Status: Phase 1 implemented; Phase 2 display-name and Public APIs (Authentication, Directory, Profile Query) implemented  
Last reviewed: 2026-08-18

## Responsibility

Identity owns authentication and the identity facts required to recognize a registered Huddle user.

Identity owns:

- User identity
- Email identity
- Credential authentication
- Email verification
- Google OAuth identity
- GitHub OAuth identity
- Access-token behavior
- Refresh-token behavior
- User-facing display name
- Minimal public identity capabilities

Identity does not own:

- Contacts
- Conversation membership
- Group roles
- Call participation
- Meeting roles
- Subscription state
- Notification preferences

## Delivery State

| Capability                | State                  |
| ------------------------- | ---------------------- |
| Registration              | Implemented in Phase 1 |
| Email verification        | Implemented in Phase 1 |
| Credential login          | Implemented in Phase 1 |
| Google OAuth login        | Implemented in Phase 1 |
| GitHub OAuth login        | Implemented in Phase 1 |
| Access and refresh tokens | Implemented in Phase 1 |
| `displayName`             | Implemented in Phase 2 |
| Authentication Public API | Implemented in Phase 2 |
| Directory Public API      | Implemented in Phase 2 |
| Profile Query Public API  | Implemented in Phase 2 |
| Avatar                    | Deferred               |
| Account suspension state  | Not modeled            |
| Enterprise SSO            | Deferred               |

Source code and tests remain authoritative for exact implemented behavior.

## Core Model

Identity’s model contains concepts equivalent to:

- User
- Email identity
- Credential
- OAuth identity link
- Email-verification state
- Refresh-token state

Exact entities, value objects, fields, and persistence mappings belong to the implementation.

Other contexts must not depend on these internal types.

## User Invariants

A User has:

- One stable Huddle user identifier
- One normalized identity email according to the implemented Identity policy
- A valid user-facing display name after the Phase 2 migration
- Zero or one local credential according to the supported login method
- Zero or more supported OAuth identity links

Required invariants include:

- A credential secret is never stored in plaintext.
- One OAuth provider identity cannot belong to multiple users.
- Email verification follows the implemented single-purpose token policy.
- Internal credentials and provider tokens never cross the Identity boundary.
- Display names are not globally unique.

## Display Name

`displayName` is required after the Phase 2 migration.

Validation:

```text
Trimmed Unicode text
Minimum length: 1 character
Maximum length: 50 characters
Uniqueness: not required
```

### Credential Registration

New credential registration requires the user to provide a valid display name.

The server normalizes and validates it before persistence.

### First-time OAuth User

For a first-time Google or GitHub user:

1. Use the provider’s user-facing display name when it is present and can be normalized into the accepted limit.
2. If no valid provider name is available, generate a non-sensitive fallback from the new Huddle user identifier.
3. Do not derive the fallback from the email local part.

A fallback may use a form equivalent to:

```text
User-<short stable identifier>
```

The exact formatting belongs to the implementation and must remain within the validation limit.

### Existing Phase 1 User

The Phase 2 migration assigns every existing user a valid non-sensitive generated display name.

Required migration behavior:

- No user remains with a null or empty display name.
- The result does not expose the user’s email.
- The migration is deterministic or safely repeatable.
- Duplicate display names are allowed.
- Migration verification is covered by an integration test.

A complete profile-editing feature is not introduced solely by this migration.

## Authentication Capability

Identity exposes a minimal authentication application capability for trusted consumers.

Conceptual request:

```typescript
verifyAccessToken(accessToken: string)
```

Conceptual result:

```typescript
type AuthenticatedPrincipal = {
  userId: string;
  expiresAt: Date;
};
```

The exact contract belongs to the relevant authentication contract and code.

Required behavior:

- Verify signature.
- Verify expiration.
- Verify supported token type.
- Verify required claims.
- Return a minimal trusted principal.
- Reject invalid or expired tokens.
- Do not return credentials, OAuth links, or refresh-token data.

HTTP and realtime consumers define their own verifier ports.

The composition adapter calls Identity’s public capability.

## Directory Capability

Identity exposes a minimal directory capability for validating an untrusted target identifier.

Conceptual operation:

```typescript
userExists(userId: string): Promise<boolean>
```

Use this for client-supplied target identifiers such as:

- Contact target
- Direct-conversation target
- Group invitation target

Do not call it redundantly for the authenticated requester whose identity already comes from a verified principal.

Identity currently confirms existence only.

It must not claim to answer whether an account is active, suspended, or permitted to use another context until such account state is modeled.

Existence is not authorization.

## Profile Query Capability

Identity exposes a bounded profile query for presentation data.

Conceptual request:

```typescript
getProfiles(userIds: string[])
```

Constraints:

- Maximum 50 identifiers per request
- Duplicate identifiers normalized before lookup
- Empty input handled explicitly
- Missing users distinguishable from returned profiles
- No required preservation of input ordering

Conceptual result:

```typescript
type UserProfile = {
  userId: string;
  displayName: string;
};
```

The profile query does not return:

- Email
- Password data
- OAuth identity
- OAuth token
- Refresh-token data
- Billing tier
- Chat role

Chat stores `senderId` and resolves display names through this capability.

The frontend may create initials or placeholder avatars from `displayName`.

## Public Provider Exposure

Identity’s NestJS module exports only intentionally supported provider tokens.

Implemented capability tokens:

- Authentication API (`AUTHENTICATION_API`)
- Directory API (`DIRECTORY_API`)
- Profile Query API (`PROFILE_QUERY_API`)

A provider token should use a stable Symbol or equivalent explicit token.

Exporting the TypeScript class:

```typescript
export class IdentityModule {}
```

does not automatically export internal NestJS providers.

The module’s NestJS `exports` metadata must expose the intended public provider token.

The Identity package entrypoint exports the supported public contracts and tokens, while implementations, repositories, entities, controllers, ORM models, and provider SDK types remain internal.

The TypeScript `esModuleInterop` setting does not affect NestJS provider visibility.

## Consumer Integration

The permitted dependency shape is:

```text
Consumer-owned port
→ composition adapter
→ Identity public application API
```

Consumers must not import:

- Identity repository
- Identity domain entity
- Identity ORM model
- Internal Identity application service
- Identity controller
- Credential infrastructure

## OAuth Boundary

Google and GitHub login are social authentication integrations.

They do not represent:

- SAML enterprise SSO
- Workspace identity federation
- Enterprise identity administration

Provider-specific payloads are translated inside the Identity infrastructure boundary.

Other contexts receive only the Huddle user identifier and explicitly supported public profile data.

## Persistence

Identity persists its owned relational state in PostgreSQL.

Identity owns:

- Persistence mappings
- Repositories
- Constraints
- Indexes
- Migrations
- Infrastructure error translation

Other contexts must not query Identity tables directly.

Exact schema details belong to code and migrations.

## Events

Identity Domain Events remain internal.

Phase 2 does not add:

- Identity Transactional Outbox
- User-profile Integration Events
- Profile projection
- Event bus

Phase 6 may introduce selected versioned Identity Integration Events when Notification has a concrete consumer.

A Domain Event object must not be exposed directly as an Integration Event.

## Failure Behavior

Identity public capabilities distinguish:

- Existing user
- Missing user
- Invalid token
- Expired token
- Unsupported token
- Dependency unavailable
- Invalid profile-query input

Infrastructure errors must not be converted into “user missing.”

Consumers translate Identity application outcomes into their own interface errors.

## Security Rules

- Credentials remain inside Identity.
- Provider tokens remain inside Identity.
- Email is not ordinary Chat display data.
- Token identity comes from verified claims.
- OAuth callback and state validation remain server controlled.
- Authentication errors avoid unnecessary account enumeration.
- Sensitive values do not appear in logs.
- External inputs are validated before persistence.

System-wide rules are defined in:

```text
architecture/security.md
```

## Required Tests

Identity additions require tests for:

- Display-name trimming
- Minimum and maximum length
- Unicode values
- Non-unique display names
- Credential registration with display name
- OAuth provider display name
- OAuth fallback display name
- Existing-user migration
- No email-derived fallback
- Valid access-token verification
- Invalid token
- Expired token
- User existence
- Missing user
- Profile batch bound
- Duplicate profile identifiers
- Missing profile identifiers
- Provider export and composition wiring
- Persistence failure not translated into missing user

## Deferred

Identity does not currently include:

- Avatar storage
- Full profile management
- Account suspension
- Account deletion lifecycle
- Blocking
- User search or discovery
- SAML enterprise SSO
- Workspace identity
- Profile Integration Events
- Profile cache
- Profile projection in consumers

These require explicit phase authorization.

## Source-of-truth Boundaries

This document is the source of truth for:

- Identity context responsibility
- Identity public capability categories
- Display-name policy
- Identity cross-context data exposure
- Identity event boundary

This document is not the source of truth for:

- Exact HTTP endpoints
- Exact token payloads
- Exact database schema
- Exact provider SDK configuration
- Current test inventory
- Current implementation status beyond the summarized phase boundary

Those concerns belong to contracts, migrations, code, tests, and `delivery/status.md`.
