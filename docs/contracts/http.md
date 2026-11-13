# HTTP Contracts

Status: Shared conventions accepted; Identity endpoints and first Chat subset implemented
Last reviewed: 2026-11-13
Last verified against source: 2026-11-13

## Purpose

This document is the authoritative source for Huddle’s shared HTTP conventions and the registry of public HTTP capability contracts.

It defines:

- Shared transport conventions
- Authentication-principal rules
- Validation behavior
- Shared error categories
- Pagination requirements
- Contract states
- The location and delivery state of Context-specific HTTP contracts
- Implemented, accepted, and planned capability groups and their exact contract locations
- The relationship between human-maintained HTTP contracts and future generated
  OpenAPI documentation

Exact accepted and implemented endpoint paths, methods, payloads, and status
behavior belong to the relevant Context-specific contract file.

A capability appearing in a Context or Phase document does not create an HTTP endpoint automatically.

Before implementing a new controller operation:

1. Confirm that the active Phase authorizes the capability.
2. Define its exact contract in the owning Context’s HTTP contract file (for
   Chat, the file that [`chat-http.md`](chat-http.md) lists for the capability).
3. Register that contract in this document.
4. Implement the controller and DTO.
5. Add contract, controller, and E2E tests.
6. Mark the contract as Implemented only after verification.

## Source-of-Truth Boundary

| Concern                                      | Authoritative source                                                                                                                                                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared HTTP conventions and error categories | This document                                                                                                                                                                                        |
| Implemented Identity endpoints               | [`identity-http.md`](identity-http.md)                                                                                                                                                               |
| Context-specific HTTP contracts              | Owning contract file registered in this document                                                                                                                                                     |
| Context invariants and authorization         | Owning file under [`../contexts/`](../contexts/)                                                                                                                                                     |
| Delivery timing                              | Active file under [`../delivery/phases/`](../delivery/phases/)                                                                                                                                       |
| Current implementation status                | [`../delivery/status.md`](../delivery/status.md)                                                                                                                                                     |
| System-wide security principles              | [`../architecture/security.md`](../architecture/security.md)                                                                                                                                         |
| Executable behavior                          | Controllers, DTOs, guards, and tests                                                                                                                                                                 |
| OpenAPI documentation and exposure           | This document; the generated description, served or committed, remains derived from implemented executable behavior and owning HTTP contracts and is not authoritative                               |
| Chat realtime events                         | [`chat-realtime.md`](chat-realtime.md)                                                                                                                                                               |
| Conferencing realtime contracts              | [`conferencing-realtime.md`](conferencing-realtime.md), [`conferencing-p2p.md`](conferencing-p2p.md), [`conferencing-sfu.md`](conferencing-sfu.md), and [`meeting-realtime.md`](meeting-realtime.md) |
| Integration Events                           | [`integration-events.md`](integration-events.md)                                                                                                                                                     |

When a contract document and executable behavior disagree, treat the discrepancy as a defect. Verify the intended behavior and update both in the same change.

## Contract States

| State        | Meaning                                                                                |
| ------------ | -------------------------------------------------------------------------------------- |
| Implemented  | Route and behavior exist and have been verified against source or tests                |
| Transitional | Implemented behavior exists but is intentionally replaced by a later Phase             |
| Accepted     | Transport behavior is decided but may not yet have an implementing endpoint            |
| Planned      | Product or Phase requires the capability, but exact transport shape is not yet defined |
| Deferred     | No endpoint may be introduced without new Phase authorization                          |

A Planned capability name is not a stable public route.

## Contract Registry

| Context or capability | State                                                                                                                                                                                  | Contract document                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Identity              | Implemented with transitional behavior                                                                                                                                                 | [`identity-http.md`](identity-http.md)                                                      |
| Chat                  | Contact-request creation, acceptance, rejection, incoming listing, outgoing listing, accepted Contact listing, and Contact removal Implemented; remaining Phase 2 capabilities Planned | [`chat-http.md`](chat-http.md) (index) and [`chat-contacts-http.md`](chat-contacts-http.md) |
| Calling               | Planned for Phase 3                                                                                                                                                                    | Create only if a required HTTP capability is identified                                     |
| Billing               | Planned for Phase 4                                                                                                                                                                    | Create when the exact Billing HTTP contract is defined                                      |
| Meetings              | Planned for Phase 5                                                                                                                                                                    | Create when the exact Meeting HTTP contract is defined                                      |
| Notification          | Planned for Phase 6                                                                                                                                                                    | Create when the exact Notification HTTP contract is defined                                 |

Do not create empty Context contract files merely to satisfy this registry.

A Context-specific contract file is created when its first exact endpoint is
designed as part of an authorized contract or implementation task. A Context
may list several contract files through its own index file; when to split a
document is governed by
[Avoid Over-fragmentation](../README.md#avoid-over-fragmentation).

## OpenAPI Documentation Direction

Huddle plans a machine-readable OpenAPI description so consumers and reviewers
can discover the implemented HTTP surface, inspect request and response shapes,
and use the result as portfolio evidence without reconstructing every operation
from controller source.

The generated description is derived documentation. It is not a separate
source of truth:

- This document owns shared HTTP conventions and the relationship between
  generated documentation and Huddle's HTTP contracts.
- Context-specific contract files own accepted and implemented endpoint paths,
  methods, payloads, status behavior, and resource-specific semantics.
- Controllers, DTOs, guards, configuration, and tests evidence executable
  behavior.
- Generated OpenAPI operations and schemas must describe only implemented
  endpoints and must agree with both executable behavior and the owning
  contracts.

### Initial Foundation

The initial OpenAPI foundation is a generated OpenAPI description with a
Swagger UI presentation. It is authorized as an early slice of
[Phase 2](../delivery/phases/02-chat.md#initial-openapi-foundation) and may be
delivered in increments. Whatever is not delivered while Phase 2 is active,
and any exposure of the documentation in a deployed environment, remains with
[Phase 2.5](../delivery/phases/02.5-deployment-foundation.md#openapi-documentation-foundation).

The following subsections define accepted rules for the foundation. They are
not evidence that it exists; see [Current State](#current-state).

### Described Operations

The initial foundation describes:

- the implemented Contacts operations in
  [`chat-contacts-http.md`](chat-contacts-http.md);
- the implemented Identity endpoints in [`identity-http.md`](identity-http.md).

An operation implemented before the first increment of the foundation is
merged appears only once it is fully described. Until then it is omitted,
never published with incomplete schemas. The root route `GET /` has no
contract and is never described. Planned and Accepted operations without an
implementing endpoint never appear.

Identity endpoints are described as their contract states them, and each
transitional behavior is marked as transitional:

- Identity error responses use a separate schema for the framework-generated
  body described under
  [Transitional Identity Error Envelope](#transitional-identity-error-envelope).
  That schema is descriptive, not normative: `message` may be a string or an
  array of strings, `error` may be absent, and `statusCode` carries the HTTP
  status. It is never presented as the stable application error envelope.
- The registration response field `verificationToken` and the hardcoded Free
  tier of the current-user response are marked transitional.
- The OAuth start and callback routes are described as browser redirects and
  provider callbacks, not as operations a documentation client can complete.

### Schema Source

The running API Gateway generates the description from request and response
types owned by the HTTP transport layer. No standalone OpenAPI file is
maintained by hand.

Domain and Application code carries no OpenAPI metadata. Documentation
metadata lives in the HTTP transport layer wherever
[ADR 0008](../decisions/0008-place-http-transport-by-integration-boundary.md)
places it: the API Gateway for Chat, and Identity's own HTTP interface for
Identity.

The owning contract files remain authoritative for semantics.

### Committed Description

The generated description is also committed to the repository as
`docs/api/openapi.json`. The `docs/api/` folder is dedicated to OpenAPI and
holds only generated output.

- The committed copy comes from the same generation the documentation route
  serves, through a repeatable command, and is never edited by hand.
- Generation is deterministic: the output contains no timestamp and no host,
  port, or other environment-dependent value.
- The committed copy is derived, not an authority. When it, the HTTP transport
  layer, and the owning contract disagree, the transport layer or the contract
  is corrected and the description is regenerated.
- The committed copy is public with the repository in every environment. It
  follows the same information-minimization rules as the served description
  and exposes nothing beyond the public contract files.

### Documentation Routes and Exposure

The `/docs/api` path prefix is reserved for OpenAPI documentation:

| Route                        | Content                                       |
| ---------------------------- | --------------------------------------------- |
| `GET /docs/api`              | Swagger UI presentation and its static assets |
| `GET /docs/api/openapi.json` | Machine-readable OpenAPI description (JSON)   |

No documentation route exists outside this prefix, including `/docs`, and no
other description format is served. While enabled, the routes belong to the
`public` category of
[HTTP Authentication](../architecture/security.md#http-authentication) and
require no authentication. When disabled, they are not registered and respond
like any unregistered path.

One explicit opt-in API Gateway configuration value enables the routes. It is
read at startup and:

- enables the routes only when set to its explicit enable value; an absent,
  empty, or any other value disables them;
- is not derived from `NODE_ENV` or any other general mode value;
- cannot be set by a client or changed at runtime.

The environments are named:

| Environment | Meaning                                                                                   | Documentation routes                                                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local       | A developer's own machine                                                                 | Enabled through the local environment template                                                                                                          |
| Test        | Automated tests, locally and in CI                                                        | Enabled only explicitly                                                                                                                                 |
| Deployment  | The cloud deployment defined in [`operations/deployment.md`](../operations/deployment.md) | Disabled unless a Phase selects a deployed boundary; see [Phase 2.5](../delivery/phases/02.5-deployment-foundation.md#openapi-documentation-foundation) |

### Information Minimization in Generated Documentation

The [Information Minimization](#information-minimization) rules apply to every
OpenAPI description, example, and schema, whether served or committed. In
addition:

- only described operations appear;
- each documented error response lists only the outcomes the owning contract
  lists for that operation; Chat operations use the stable application error
  envelope and codes, and Identity operations use the transitional schema
  described under [Described Operations](#described-operations);
- examples use placeholder values only;
- no `servers` entry carries a host or port;
- schema component names are HTTP transport names, not Domain, Application,
  persistence, or provider type names;
- Swagger UI does not persist entered access tokens in browser storage.

### Keeping the Description Current

The maintenance rule starts when the first increment of the initial foundation
is merged. From then on:

- a change that implements a new HTTP endpoint adds it to the generated
  description, fully described, in the same change;
- a change to an operation already in the description updates and verifies the
  description in the same change.

### Current State

Currently, the API Gateway declares the `@nestjs/swagger` dependency, but it
does not generate an OpenAPI description or configure Swagger UI. Dependency
presence is not implementation evidence. Current state remains owned by
[`delivery/status.md`](../delivery/status.md).

## General Conventions

### Transport

Public application traffic uses HTTPS in the Portfolio deployment.

Request and response bodies use JSON unless an external-provider callback requires another verified representation.

Stripe webhook signature verification requires the unmodified raw request body. It must not be treated as ordinary parsed JSON controller input before verification.

### Identifiers

Identifiers are opaque strings.

Clients must not:

- Infer resource type from identifier format.
- Generate authoritative database identifiers unless a contract explicitly permits a client operation identifier.
- Derive authorization from possession of an identifier.

### Timestamps

Public timestamps use ISO 8601 UTC strings.

Example:

```json
{
  "createdAt": "2026-08-07T12:34:56.000Z"
}
```

Clients must not provide authoritative creation or lifecycle timestamps.

### Authentication

Protected endpoints use:

```http
Authorization: Bearer <access-token>
```

The authenticated actor comes from the verified token principal.

A request body, path parameter, or query parameter must not override the authenticated actor.

Identity's existing Passport-protected HTTP path attaches:

```typescript
type PassportAuthenticatedPrincipal = {
  id: string;
  email: string;
};
```

The implemented Chat Contact-request endpoints instead consume Identity's
public Authentication API, whose verified result contains:

```typescript
type AuthenticationApiPrincipal = {
  userId: string;
  expiresAt: Date;
};
```

Their API Gateway-owned guard attaches only `userId` to the Contact request.
These are separate integration paths; this document does not merge their
principal types or expose email, expiration, or token claims as Chat requester
authority.

The JWT currently carries equivalent claims:

```typescript
type JwtPayload = {
  sub: string;
  email: string;
};
```

These are current implementation details, not permission claims for another Context.

Authentication proves who the requester is. The owning Context still authorizes access to each protected resource.

### Validation

The API Gateway currently applies a global validation pipe with:

```typescript
{
  whitelist: true,
  transform: true
}
```

DTO-declared fields are accepted and validated.

Unsupported body fields are removed by the current configuration rather than rejected.

A future decision to reject unknown fields must update the global configuration, this contract, and affected tests together.

### Successful Empty Response

An operation that succeeds without a response body uses:

```http
204 No Content
```

The response must not include a JSON body.

## Error Contract

### Transitional Identity Error Envelope

Identity currently uses NestJS framework exceptions.

The current response commonly has a framework-generated form equivalent to:

```json
{
  "message": "Invalid email or password",
  "error": "Unauthorized",
  "statusCode": 401
}
```

Validation errors may return `message` as an array.

The exact framework-generated body is not the stable application error
envelope defined below.

The existing Identity endpoints remain transitional and have not implemented
the stable envelope. Adopting it for Identity requires a separately authorized
implementation change with updated Identity contract and transport evidence.
This shared decision must not be used to describe unchanged Identity responses
as already migrated.

### Stable Application Error Envelope

New Context-specific HTTP contracts use this envelope for application errors:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed.",
    "details": [
      {
        "field": "targetUserId",
        "message": "targetUserId must be a non-empty string."
      }
    ]
  }
}
```

The envelope fields are:

| Field                     | Presence                      | Consumer meaning                                                                 |
| ------------------------- | ----------------------------- | -------------------------------------------------------------------------------- |
| `error`                   | Required                      | Distinguishes the error response and contains its public application semantics.  |
| `error.code`              | Required                      | Stable machine-readable code used for programmatic client behavior.              |
| `error.message`           | Required                      | Safe human-readable explanation or fallback presentation.                        |
| `error.details`           | Optional                      | Safe field-level corrections for a validation failure; omitted for other errors. |
| `error.details[].field`   | Required when a detail exists | Declared client field that needs correction.                                     |
| `error.details[].message` | Required when a detail exists | Safe human-readable explanation for that field.                                  |

Clients branch on `error.code`, not `error.message`.

`error.details`:

- is present only when `error.code` is `VALIDATION_FAILED` and safe,
  client-correctable field information exists;
- contains only fields declared by the applicable public request contract;
- does not repeat rejected values or expose DTO class names, validation-library
  objects, internal property paths, or implementation rules;
- is omitted rather than returned as an empty array when no safe detail exists.

An owning Context contract defines the exact safe validation messages required
by its consumer. It must not reflect arbitrary client input into the response.

### Shared Error Codes and Status Mappings

The following codes are the stable shared defaults:

| Category               | Stable code               | HTTP status | Consumer semantics                                      |
| ---------------------- | ------------------------- | ----------: | ------------------------------------------------------- |
| Validation failure     | `VALIDATION_FAILED`       |         400 | Correct the request before retrying.                    |
| Authentication failure | `AUTHENTICATION_REQUIRED` |         401 | Stop protected interaction and reauthenticate.          |
| Authorization failure  | `FORBIDDEN`               |         403 | Do not retry unchanged.                                 |
| Resource not found     | `RESOURCE_NOT_FOUND`      |         404 | Do not retry unchanged; return to a stable resource.    |
| State conflict         | `CONFLICT`                |         409 | Follow the owning operation's reconciliation guidance.  |
| Dependency unavailable | `DEPENDENCY_UNAVAILABLE`  |         503 | Preserve confirmed state and retry according to policy. |
| Unexpected failure     | `INTERNAL_ERROR`          |         500 | Do not assume whether the operation completed safely.   |

An owning Context contract may define a narrower stable code only when its
consumer must distinguish that outcome. The narrower code retains this
envelope and the shared category's status and information-minimization rules.
It must not expose an internal exception class or infrastructure identifier.

`AUTHENTICATION_REQUIRED` does not distinguish whether authentication was
missing, invalid, expired, or otherwise unusable unless an owning accepted
contract establishes a safe consumer requirement.

### Accepted Specialized Error Categories

The following semantic mappings remain accepted for the owning contracts to
define when their capabilities are introduced:

| Application error               | Meaning                                            | HTTP status | Retry guidance                                |
| ------------------------------- | -------------------------------------------------- | ----------: | --------------------------------------------- |
| `QuotaExceededError`            | Confirmed usage is at or above the effective limit |         403 | Retry only after usage or tier changes        |
| `ConcurrentQuotaUpdateError`    | Bounded serialization retries were exhausted       |         409 | Retry the logical operation later             |
| `EntitlementsUnavailableError`  | Effective entitlement could not be determined      |         503 | Retry after the dependency recovers           |
| Message persistence unavailable | Durable Message acceptance failed                  |         503 | Retry with the same client operation identity |
| Media unavailable               | Required media infrastructure is unavailable       |         503 | Retry according to session state              |

The application code used for a specialized category belongs to its exact
owning contract. It must follow the stable envelope and must not change the
status mapping above where the category already corresponds to a shared
default.

### Information Minimization

Public error messages and details disclose only what the client needs to
recover or present the result safely.

They must not expose:

- raw internal exception messages;
- database or driver codes;
- database constraint, table, column, collection, or index names;
- provider or SDK internals;
- stack traces;
- filesystem paths;
- secrets, credentials, tokens, or private payloads;
- internal network or deployment topology;
- account existence during authentication;
- hidden-resource existence or another user's membership unless an owning
  authorization contract explicitly permits that fact.

Infrastructure error codes remain internal.

Examples that remain internal include:

- PostgreSQL `40001`
- PostgreSQL constraint names
- MongoDB driver errors
- Redis errors
- Stripe SDK errors
- Filesystem paths
- Stack traces

Context-specific authorization determines whether a hidden resource is
represented as `403` or `404`.

## Context HTTP Capability Subsets

### Phase 2 — Chat

The current Chat HTTP subset distinguishes implemented delivery from remaining
planned target behavior:

| Capability                       | State         | Contract                                         | Implementation state                 |
| -------------------------------- | ------------- | ------------------------------------------------ | ------------------------------------ |
| Contact-request creation         | `Implemented` | [`chat-contacts-http.md`](chat-contacts-http.md) | Authenticated HTTP delivery verified |
| Contact-request acceptance       | `Implemented` | [`chat-contacts-http.md`](chat-contacts-http.md) | Authenticated HTTP delivery verified |
| Contact-request rejection        | `Implemented` | [`chat-contacts-http.md`](chat-contacts-http.md) | Authenticated HTTP delivery verified |
| Incoming Contact-request listing | `Implemented` | [`chat-contacts-http.md`](chat-contacts-http.md) | Authenticated HTTP delivery verified |
| Outgoing Contact-request listing | `Implemented` | [`chat-contacts-http.md`](chat-contacts-http.md) | Authenticated HTTP delivery verified |
| Accepted Contact listing         | `Implemented` | [`chat-contacts-http.md`](chat-contacts-http.md) | Authenticated HTTP delivery verified |
| Contact removal                  | `Implemented` | [`chat-contacts-http.md`](chat-contacts-http.md) | Authenticated HTTP delivery verified |

The implemented subset defines `POST /contact-requests`,
`POST /contact-requests/{contactRequestId}/accept`,
`POST /contact-requests/{contactRequestId}/reject`,
`GET /contact-requests/incoming`, which lists pending Contact requests
addressed to the verified actor with cursor pagination,
`GET /contact-requests/outgoing`, which lists pending Contact requests created
by the verified actor with the same pagination, and `GET /contacts`, which
lists the verified actor's accepted Contacts with the same pagination, and
`DELETE /contacts/{contactUserId}`, which removes an accepted Contact and is
defined in [`chat-contacts-http.md`](chat-contacts-http.md). No other Contacts,
Conversation, Group, Message-history, or frontend capability is accepted or
implemented here.

## Planned HTTP Capability Registry

The following capabilities are authorized by their delivery phases, but their
exact routes and payloads are not yet contracts. The implemented subset above
is not repeated in this planned registry.

This registry does not authorize endpoints that are absent from the owning
Context contract.

The exact contract must be added to an owning Context-specific contract file
as part of an authorized contract or implementation task.

### Phase 2 — Chat

Exact contracts remain required for the following Phase-authorized
capabilities.

#### Conversations

- Create or return the unique Direct Conversation for an eligible Contact
- List authorized Conversations
- Read one authorized Conversation
- Retrieve cursor-paginated Message history

#### Group Conversations

- Create Group Conversation
- Invite an eligible Contact
- List invitations required by the implemented interface
- Accept or decline invitation
- List members
- Leave Group
- Remove member
- Grant or revoke invitation permission
- Promote member to administrator
- Demote an eligible administrator
- Transfer ownership

The Phase 2 contract must define:

- Exact paths and methods
- Resource identifiers
- Idempotent create behavior
- Pagination bounds
- Invitation state
- Membership views
- Public profile presentation
- Authorization errors
- `QuotaExceededError`
- `ConcurrentQuotaUpdateError`
- `EntitlementsUnavailableError`
- Message-history failure behavior

Message send belongs primarily to [`chat-realtime.md`](chat-realtime.md).

### Phase 3 — Calling

Define only HTTP operations genuinely required alongside realtime signaling, such as:

- A Call history query not already represented through Chat
- TURN credential issuance
- Media capability or configuration discovery where required

Realtime signaling payloads do not belong in an HTTP contract.

### Phase 4 — Billing

Exact contracts are required for:

- Authenticated Stripe Checkout creation
- Stripe webhook receipt
- Current subscription or entitlement query
- Composed current-user response

Accepted Stripe webhook status behavior:

| Situation                                                      | Status |
| -------------------------------------------------------------- | -----: |
| Invalid payload or signature                                   |    400 |
| New event durably accepted                                     |    200 |
| Duplicate event already accepted                               |    200 |
| Durable Inbox persistence fails                                |    503 |
| Required enqueueing fails without an established recovery path |    503 |

The browser return from Checkout is not authoritative payment state.

No public endpoint may directly set a user’s tier.

### Phase 5 — Meetings

Exact contracts are required for implemented Meeting commands and queries that are not realtime signaling, including applicable:

- Schedule Meeting
- Update allowed Meeting metadata
- Invite participant
- Manage co-organizer role
- Cancel Meeting
- Read Meeting details
- List eligible Meetings
- Retrieve Meeting Conversation history

Meeting admission and media signaling belong to the relevant Conferencing realtime contracts.

### Phase 6 — Notification

Exact contracts are required for:

- List Notifications
- Mark one Notification read
- A bounded bulk-read operation if included
- Start Slack connection
- Process Slack OAuth callback
- Inspect Slack connection state
- Disconnect Slack
- Configure the single supported Slack destination

Product-event Email Notification is deferred and has no HTTP contract.

## Pagination Contract Rule

Before the first paginated endpoint is implemented, the shared contract must define:

- Cursor parameter name
- Limit parameter
- Default limit
- Maximum limit
- Response envelope
- Stable ordering
- Invalid-cursor response
- End-of-list representation

Decided shared convention (first consumer: incoming Contact-request listing,
[`chat-contacts-http.md`](chat-contacts-http.md)):

| Item                  | Decision                                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cursor parameter      | `cursor` query parameter: a single, opaque value previously returned as `nextCursor`.                                                                                                       |
| Limit parameter       | `limit` query parameter: a single value of ASCII digits and an integer from 1 to the maximum.                                                                                               |
| Default limit         | `20`.                                                                                                                                                                                       |
| Maximum limit         | `50`. A larger value is rejected, not clamped. An owning contract may set a lower maximum, never a higher one.                                                                              |
| Response envelope     | `{ "items": [...], "nextCursor": string \| null }`. The owning contract defines the item shape.                                                                                             |
| Stable ordering       | Defined by the owning contract and applied identically across consecutive pages.                                                                                                            |
| Invalid-cursor result | `400 VALIDATION_FAILED` with one detail naming `cursor`; the rejected value is never repeated. An invalid `limit` likewise names `limit`. When both are invalid, `limit` is reported first. |
| End-of-list           | `nextCursor` is `null`.                                                                                                                                                                     |

The default and maximum are defined once here and are not selected
independently by a controller.

Cursors must be opaque to clients.

Offset pagination is not the primary strategy for Message history.

Pagination limits must not be selected independently in multiple controllers.

The shared pagination convention belongs in this document. Resource-specific cursor fields and response payloads belong in the owning Context contract.

## Contract Testing Requirements

Each implemented endpoint requires applicable tests for:

- Successful response
- Request validation
- Authentication
- Authorization
- Resource visibility
- Duplicate request behavior
- Concurrency outcome
- Persistence failure translation
- Dependency-unavailable behavior
- Absence of sensitive response fields

External-provider redirects and callbacks require controlled provider tests or explicitly documented environment validation.

A TypeScript interface written only inside a test does not establish a public contract. Controller behavior, tests, the shared conventions, and the owning Context contract must agree.

## Deferred HTTP Capabilities

The following do not have authorized HTTP contracts:

- Enterprise administration
- Workspace management
- SAML SSO
- Recording
- Recording storage management
- Calendar integration
- Anonymous Meeting guests
- Public tier override
- Unauthenticated demonstration reset
- Generic Notification preference matrix
- Product-event Email Notification

A new endpoint for one of these capabilities requires an explicit Product Scope and Roadmap decision.

## Related Documentation

- [Identity HTTP Contract](identity-http.md)
- [Chat HTTP Contract](chat-http.md)
- [Chat Contacts HTTP Contract](chat-contacts-http.md)
- [Chat Realtime Contract](chat-realtime.md)
- [Shared Conferencing Realtime Contract](conferencing-realtime.md)
- [Conferencing P2P Contract](conferencing-p2p.md)
- [Conferencing SFU Contract](conferencing-sfu.md)
- [Meeting Realtime Contract](meeting-realtime.md)
- [Integration Events](integration-events.md)
- [Security Architecture](../architecture/security.md)
- [Delivery Roadmap](../delivery/roadmap.md)
- [Current Status](../delivery/status.md)
