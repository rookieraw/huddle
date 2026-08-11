# HTTP Contracts

Status: Shared conventions accepted; Identity endpoints implemented  
Last verified against source: 2026-08-07

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
- Planned capability groups whose exact HTTP contracts are not yet defined

Exact implemented endpoint paths, methods, payloads, and status behavior belong to the relevant Context-specific contract file.

A capability appearing in a Context or Phase document does not create an HTTP endpoint automatically.

Before implementing a new controller operation:

1. Confirm that the active Phase authorizes the capability.
2. Define its exact contract in the owning Context’s HTTP contract file.
3. Register that contract in this document.
4. Implement the controller and DTO.
5. Add contract, controller, and E2E tests.
6. Mark the contract as Implemented only after verification.

## Source-of-Truth Boundary

| Concern                                      | Authoritative source                                                                                                                                                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared HTTP conventions and error categories | This document                                                                                                                                                                                        |
| Implemented Identity endpoints               | [`identity-http.md`](identity-http.md)                                                                                                                                                               |
| Future exact Context-specific HTTP contracts | Owning contract file registered in this document                                                                                                                                                     |
| Context invariants and authorization         | Owning file under [`../contexts/`](../contexts/)                                                                                                                                                     |
| Delivery timing                              | Active file under [`../delivery/phases/`](../delivery/phases/)                                                                                                                                       |
| Current implementation status                | [`../delivery/status.md`](../delivery/status.md)                                                                                                                                                     |
| System-wide security principles              | [`../architecture/security.md`](../architecture/security.md)                                                                                                                                         |
| Executable behavior                          | Controllers, DTOs, guards, and tests                                                                                                                                                                 |
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

| Context or capability | State                                  | Contract document                                           |
| --------------------- | -------------------------------------- | ----------------------------------------------------------- |
| Identity              | Implemented with transitional behavior | [`identity-http.md`](identity-http.md)                      |
| Chat                  | Planned for Phase 2                    | Create when the first exact Chat HTTP contract is defined   |
| Calling               | Planned for Phase 3                    | Create only if a required HTTP capability is identified     |
| Billing               | Planned for Phase 4                    | Create when the exact Billing HTTP contract is defined      |
| Meetings              | Planned for Phase 5                    | Create when the exact Meeting HTTP contract is defined      |
| Notification          | Planned for Phase 6                    | Create when the exact Notification HTTP contract is defined |

Do not create empty Context contract files merely to satisfy this registry.

A Context-specific contract file is created when its first exact endpoint is designed as part of an authorized implementation task.

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

The currently implemented access-token principal contains:

```typescript
type AuthenticatedPrincipal = {
  id: string;
  email: string;
};
```

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

### Current Implemented Error Envelope

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

The exact framework-generated body has not been adopted as a stable cross-context error envelope.

Before Phase 2 adds public Chat endpoints, the project should introduce and test a stable application error shape rather than allowing each controller to invent one independently.

The resulting shared error-envelope decision must be recorded in this document and applied consistently to Context-specific contract files.

### Accepted Error Categories

The following semantic mappings are accepted for implementing endpoints:

| Application error               | Meaning                                            | HTTP status | Retry guidance                                |
| ------------------------------- | -------------------------------------------------- | ----------: | --------------------------------------------- |
| Validation failure              | Request shape or value is invalid                  |         400 | Correct the request                           |
| Authentication failure          | Authentication is absent, invalid, or expired      |         401 | Reauthenticate                                |
| Authorization failure           | Actor is known but cannot perform the operation    |         403 | Do not retry unchanged                        |
| Resource not found              | Visible resource does not exist                    |         404 | Do not retry unchanged                        |
| Duplicate or state conflict     | Requested state conflicts with committed state     |         409 | Depends on operation                          |
| `QuotaExceededError`            | Confirmed usage is at or above the effective limit |         403 | Retry only after usage or tier changes        |
| `ConcurrentQuotaUpdateError`    | Bounded serialization retries were exhausted       |         409 | Retry the logical operation later             |
| `EntitlementsUnavailableError`  | Effective entitlement could not be determined      |         503 | Retry after the dependency recovers           |
| Dependency unavailable          | Required dependency could not serve the operation  |         503 | Retry according to client policy              |
| Message persistence unavailable | Durable Message acceptance failed                  |         503 | Retry with the same client operation identity |
| Media unavailable               | Required media infrastructure is unavailable       |         503 | Retry according to session state              |
| Unexpected server failure       | Unhandled internal failure                         |         500 | Do not assume the operation failed safely     |

Exact public error codes and the stable response envelope must be defined before the first Phase 2 Chat controller is implemented.

Infrastructure error codes must not be exposed directly.

Examples that remain internal include:

- PostgreSQL `40001`
- PostgreSQL constraint names
- MongoDB driver errors
- Redis errors
- Stripe SDK errors
- Filesystem paths
- Stack traces

### Security-sensitive Errors

Public error handling must avoid unnecessary disclosure of:

- Whether a hidden resource exists
- Another user’s membership
- Account existence during authentication
- Provider credentials
- Database structure
- Internal network state

Context-specific authorization determines whether a hidden resource is represented as `403` or `404`.

## Planned HTTP Capability Registry

The following capabilities are authorized by their delivery phases, but their exact routes and payloads are not yet contracts.

This registry does not authorize endpoints that are absent from the owning Context contract.

The exact contract must be added to an owning Context-specific contract file as part of the authorized implementation task.

### Phase 2 — Chat

Exact contracts are required for the implemented subset of the following capabilities.

#### Contacts

- Send Contact request
- List incoming Contact requests
- List outgoing Contact requests
- Accept Contact request
- Reject Contact request
- List accepted Contacts
- Remove Contact

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
- [Chat Realtime Contract](chat-realtime.md)
- [Shared Conferencing Realtime Contract](conferencing-realtime.md)
- [Conferencing P2P Contract](conferencing-p2p.md)
- [Conferencing SFU Contract](conferencing-sfu.md)
- [Meeting Realtime Contract](meeting-realtime.md)
- [Integration Events](integration-events.md)
- [Security Architecture](../architecture/security.md)
- [Delivery Roadmap](../delivery/roadmap.md)
- [Current Status](../delivery/status.md)
