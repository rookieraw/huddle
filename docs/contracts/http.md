# HTTP Contracts

Status: Shared conventions accepted; Identity endpoints and first Chat subset implemented
Last reviewed: 2026-11-18
Last verified against source: 2026-11-18

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
- The relationship between human-maintained HTTP contracts and generated
  OpenAPI documentation
- The adopted HTTP standards and the register of known deviations from them

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

### Known Defects and Decided Changes

An owning contract may record two kinds of difference between implemented
behavior and the behavior it defines:

| Kind           | Meaning                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| Known defect   | Implemented behavior contradicts the contract; the contract states the intended behavior and today's behavior |
| Decided change | An accepted change to Implemented behavior, recorded in the contract before the change is implemented         |

The owning contract records both before the implementing change and removes
the record in that change. How these interact with contract changes is
described in
[Brownfield Migration Principles](../engineering/brownfield-migration.md#3-change-contracts-expand-then-contract).

## Contract Registry

| Context or capability | State                                                                                                                                                                                  | Contract document                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Identity              | Implemented with transitional behavior; stable application error envelope Accepted, not implemented                                                                                    | [`identity-http.md`](identity-http.md)                                                      |
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

Huddle provides a machine-readable OpenAPI description, delivered in increments, so consumers and reviewers
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
  It is retired when Identity adopts the stable envelope, as described in
  that section.
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

The stable application error envelope is described by one schema component,
which every Context that uses the envelope references. No Context defines a
parallel envelope schema. The API Gateway hosts the component because it
assembles the description. Chat references it today; Identity's reference is
Accepted, not implemented.

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
- outcomes of [Requests Rejected Before Routing](#requests-rejected-before-routing)
  are the one exception: they apply to every operation, so they are not
  documented per operation;
- every documented `401` lists the `WWW-Authenticate` response header
  ([Error Response Headers](#error-response-headers); Accepted, not
  implemented);
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

The initial foundation is implemented for every implemented operation that has
an HTTP contract: the seven Contacts operations and the ten Identity
endpoints. The root route `GET /` has no contract and is never described. The
API Gateway generates an OpenAPI description of them, serves it with Swagger UI
under `/docs/api` only when the opt-in API Gateway configuration value has its
explicit enable value, read from the process environment or the root `.env`
(the local environment template enables it for Local), and commits the
generated copy as `docs/api/openapi.json`, regenerated with
`pnpm --filter api-gateway openapi:generate`. Identity errors are described
with the transitional schema in
[Described Operations](#described-operations), and the registration
`verificationToken` and the hardcoded Free tier are marked transitional.
Exposure in a deployed environment remains with
[Phase 2.5](../delivery/phases/02.5-deployment-foundation.md#openapi-documentation-foundation).
Current state remains owned by [`delivery/status.md`](../delivery/status.md).

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

Public timestamps use RFC 3339 §5.6 `date-time` strings in UTC, with the `Z`
offset.

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

Validation failure reporting (Accepted, not implemented): the global
validation pipe reports which declared top-level fields failed, as structured
data, and contributes no public text. Each Context's error handling selects
the fixed detail message for each field from its owning contract. Today the
pipe's failure carries only the validation library's message strings, which
are never public text. Chat's validation responses do not change.

The pipe runs inside the route, after authentication. A body that cannot be
parsed never reaches it; see
[Requests Rejected Before Routing](#requests-rejected-before-routing).

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
the stable envelope. Identity's adoption of the stable envelope is Accepted,
not implemented: its codes, fixed messages, validation details, and route
outcomes are defined in
[`identity-http.md`](identity-http.md#error-responses). The implementation is
a separately authorized change with Identity transport evidence. Until it is
verified, unchanged Identity responses must not be described as migrated.

The implementing change retires the transitional form in the same change, per
[Keeping the Description Current](#keeping-the-description-current):

- Identity error responses in the generated description reference the one
  stable envelope component (see [Schema Source](#schema-source)); the
  transitional schema and its string-or-array `message` are removed.
- Each Identity error response lists its stable codes, with one example per
  code and one validation example per field, using the same fixed messages as
  the responses.
- Response descriptions match `identity-http.md`, and the documented
  responses change where it records a decided change or a known defect: the
  verification `400` gains `VALIDATION_FAILED`; the OAuth callbacks document
  `401` and `500` and no redirect; the OAuth start routes keep their redirect
  and gain `401` and `500`; login and logout each gain a `403`.
- Every documented `401` lists the `WWW-Authenticate` header
  ([Error Response Headers](#error-response-headers)).
- Each newly documented response is exercised by a response-agreement test,
  or named as not arrangeable with a reason.
- This section and the transitional-schema statements under
  [Described Operations](#described-operations),
  [Information Minimization in Generated Documentation](#information-minimization-in-generated-documentation),
  and [Current State](#current-state) are removed. The transitional markers
  for `verificationToken` and the hardcoded Free tier stay.

### Stable Application Error Envelope

New Context-specific HTTP contracts use this envelope for application errors.
Chat implements it; Identity's adoption is Accepted, not implemented (see
[Transitional Identity Error Envelope](#transitional-identity-error-envelope)).
Its shape is:

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

The current API version uses this envelope rather than RFC 9457 Problem
Details; the decision and its revisit condition are recorded in
[ADR 0009](../decisions/0009-adopt-named-standards-and-brownfield-migration-principles.md#problem-details-rfc-9457).

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

| Category                     | Stable code               | HTTP status | Public message                                              | Consumer semantics                                                                               |
| ---------------------------- | ------------------------- | ----------: | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Validation failure           | `VALIDATION_FAILED`       |         400 | Request validation failed.                                  | Correct the request before retrying.                                                             |
| Authentication failure       | `AUTHENTICATION_REQUIRED` |         401 | Authentication is required.                                 | Stop protected interaction and reauthenticate.                                                   |
| Authorization failure        | `FORBIDDEN`               |         403 | Access is not allowed.                                      | Do not retry unchanged.                                                                          |
| Resource not found           | `RESOURCE_NOT_FOUND`      |         404 | Resource was not found.                                     | Do not retry unchanged; return to a stable resource.                                             |
| State conflict               | `CONFLICT`                |         409 | Defined when first used                                     | Follow the owning operation's reconciliation guidance.                                           |
| Request too large            | `PAYLOAD_TOO_LARGE`       |         413 | Request body is too large.                                  | Reduce the request body before retrying.                                                         |
| Unsupported request encoding | `UNSUPPORTED_MEDIA_TYPE`  |         415 | Request content type, charset or encoding is not supported. | Send the body in a supported charset and content coding (see `Accept-Encoding`) before retrying. |
| Dependency unavailable       | `DEPENDENCY_UNAVAILABLE`  |         503 | Defined when first used                                     | Preserve confirmed state and retry according to policy.                                          |
| Unexpected failure           | `INTERNAL_ERROR`          |         500 | An unexpected error occurred.                               | Do not assume whether the operation completed safely.                                            |

Each shared code in use has one fixed public message, shown above. A shared
code without one gets it when it is first used. No public message or detail
comes from an exception, a validation library, an authentication library, the
database, or the body parser, and client input is never echoed.

`VALIDATION_FAILED`, `AUTHENTICATION_REQUIRED`, and `INTERNAL_ERROR` are
implemented by Chat with these messages. The messages for `FORBIDDEN` and
`RESOURCE_NOT_FOUND`, and the codes `PAYLOAD_TOO_LARGE` and
`UNSUPPORTED_MEDIA_TYPE`, are Accepted, not implemented. The last two are
returned only for
[Requests Rejected Before Routing](#requests-rejected-before-routing).

An owning Context contract may define a narrower stable code only when its
consumer must distinguish that outcome. The narrower code retains this
envelope and the shared category's status and information-minimization rules.
It must not expose an internal exception class or infrastructure identifier.

`AUTHENTICATION_REQUIRED` does not distinguish whether authentication was
missing, invalid, expired, or otherwise unusable unless an owning accepted
contract establishes a safe consumer requirement.

### Error Response Headers

State: Accepted, not implemented, for every Context. Today no `401` or `415`
response carries these headers.

- Every `401` response carries `WWW-Authenticate: Bearer realm="huddle"`.
  RFC 9110 §15.5.2 requires a challenge on every `401`, and RFC 6750 §3
  (adopted by analogy) defines the `Bearer` scheme. A `Bearer` challenge does
  not open a browser's built-in login dialog.
- The RFC 6750 §3.1 (adopted by analogy) `error` attribute is not used. It
  would distinguish a missing token from an invalid one, which
  `AUTHENTICATION_REQUIRED` deliberately does not. This is a recorded
  deviation; see [HTTP Standards Deviations](#http-standards-deviations).
- Every `415` response carries `Accept-Encoding`, listing the content codings
  the API accepts for request bodies (RFC 9110 §15.5.16).
- The generated description lists the `WWW-Authenticate` header on every
  documented `401`. A `415` occurs only before routing, so it is not
  documented per operation.

### Requests Rejected Before Routing

State: Accepted, not implemented. Current state is owned by
[`delivery/status.md`](../delivery/status.md).

Some requests are rejected before any route's own error handling runs: a body
the API cannot parse or accept, a path segment that cannot be decoded, and an
unknown method and path. A documentation route that is disabled responds like
any unknown path. One API-wide handler gives them the stable envelope. It
classifies each rejection by its HTTP status alone and never by message text:

| Rejection                                                                                                                                                                  | Status | Stable code              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -----: | ------------------------ |
| Unknown method and path                                                                                                                                                    |    404 | `RESOURCE_NOT_FOUND`     |
| Body over the size limit, or too many form parameters                                                                                                                      |    413 | `PAYLOAD_TOO_LARGE`      |
| Unsupported body charset or content coding                                                                                                                                 |    415 | `UNSUPPORTED_MEDIA_TYPE` |
| Any other client error status, for example malformed JSON, an undecodable path segment, a body nested too deeply, an aborted or truncated body, or a decompression failure |    400 | `VALIDATION_FAILED`      |
| Any other failure                                                                                                                                                          |    500 | `INTERNAL_ERROR`         |

- Messages are the fixed shared messages in
  [Shared Error Codes and Status Mappings](#shared-error-codes-and-status-mappings).
  The `400` carries no `details`.
- The response never contains parser text, the method or path, header values,
  or any part of the body.
- A `415` carries `Accept-Encoding`
  ([Error Response Headers](#error-response-headers)).
- Precedence: a rejection before routing comes before every
  operation-specific outcome of the owning contract, including
  authentication.
- Reach: these rejections on every route, and any failure on a route without
  its own Context error handling (today only the root route `GET /`, which has
  no contract). Errors raised inside a route that has Context error handling
  are unaffected.
- The handler is a backstop. A future operation that needs another client
  error meaning defines it in its owning contract and its own error handling.

Owning contracts do not repeat these outcomes per operation. A contract
statement that an operation defines no `400`, or that orders the operation's
outcomes, covers only the operation-specific outcomes. The generated
description does not list them per operation
([Information Minimization in Generated Documentation](#information-minimization-in-generated-documentation)).

Current behavior (observed 2026-11-18): these requests get the framework's
error bodies. Several echo client input, against
[Information Minimization](#information-minimization):

| Request                                  | Status | Body today                                                                                                  |
| ---------------------------------------- | -----: | ----------------------------------------------------------------------------------------------------------- |
| Body `not json` with a JSON content type |    400 | `{"message":"Unexpected token 'n', \"not json\" is not valid JSON","error":"Bad Request","statusCode":400}` |
| Truncated JSON                           |    400 | `{"message":"Unexpected end of JSON input","error":"Bad Request","statusCode":400}`                         |
| Path segment `%FF`                       |    400 | `{"message":"Failed to decode param '%FF'","error":"Bad Request","statusCode":400}`                         |
| `charset=latin9`                         |    415 | `{"statusCode":415,"message":"unsupported charset \"LATIN9\""}`                                             |
| Body over the size limit                 |    413 | `{"statusCode":413,"message":"request entity too large"}`                                                   |
| Unknown path                             |    404 | `{"message":"Cannot GET /auth/nope","error":"Not Found","statusCode":404}`                                  |

A wrong method on a known path is an unknown method and path, so it returns
`404`, not `405`.

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

Error logging (Accepted, not implemented): unexpected failures,
provider-call failures, and authentication and access-control failures are
logged with their error type or outcome code and their location, without
request values, tokens, or library message text. Other client errors are not
logged. The rule applies to every Context. The accepted changes implement it
for Identity routes and for
[Requests Rejected Before Routing](#requests-rejected-before-routing). Chat
routes log nothing yet, so the rule is not met there until a later change.

## Standards Conformance

Huddle's adopted standards, the roles they apply to, the citation rule, and
what counts as a deviation are decided in
[ADR 0009](../decisions/0009-adopt-named-standards-and-brownfield-migration-principles.md).
This section lists the clauses that govern HTTP behavior and records known
deviations from them.

### HTTP Standards

| Standard      | Applies to                                                | Basis                                                                                                                                                        |
| ------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RFC 9110      | Methods, status codes, and headers of every route         | Applied directly                                                                                                                                             |
| RFC 3339      | Public timestamps ([Timestamps](#timestamps))             | Applied directly                                                                                                                                             |
| RFC 6750      | Huddle's bearer access tokens and their `401` challenge   | Adopted by analogy                                                                                                                                           |
| RFC 6749 §5.1 | Responses that carry Huddle's tokens or other credentials | Adopted by analogy                                                                                                                                           |
| RFC 9457      | Error responses                                           | Not used by the current API version; see [ADR 0009](../decisions/0009-adopt-named-standards-and-brownfield-migration-principles.md#problem-details-rfc-9457) |

Every other RFC 6749 clause, and the OAuth, JWT, and ASVS standards, are
listed in the
[security architecture](../architecture/security.md#standards-conformance).

### HTTP Standards Deviations

This register lists the known deviations from the clauses above. It is not
the result of a conformance assessment. Its format, placement, and lifecycle
are defined in
[Brownfield Migration Principles](../engineering/brownfield-migration.md#deviation-records).

| Behavior                                                                                                                                                                                                                                                                                                                                                    | Standard and clause                                                    | Current behavior                                                                                                             | Reason                                                                                                                                                               | Decision date | Plan                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A request whose method the path does not support                                                                                                                                                                                                                                                                                                            | RFC 9110 §9.1 (SHOULD respond `405`)                                   | Returns `404`, as an unknown method and path; see [Requests Rejected Before Routing](#requests-rejected-before-routing)      | Routing matches method and path together, so a wrong method is an unknown route; the accepted handling of requests rejected before routing keeps that classification | 2026-11-18    | Accepted permanently                                                                                                                                                                                                                                   |
| Responses that carry tokens or a verification token: [Register](identity-http.md#register-with-email-and-password), [Credential Login](identity-http.md#credential-login), [Refresh](identity-http.md#refresh-authentication-tokens), [Google](identity-http.md#google-oauth-callback) and [GitHub](identity-http.md#github-oauth-callback) OAuth callbacks | RFC 6749 §5.1 (MUST; adopted by analogy); ASVS 5.0 V14.3.2 (Level 2)   | Neither `Cache-Control: no-store` nor `Pragma: no-cache` is sent                                                             | Not part of the implemented Identity responses                                                                                                                       | 2026-11-18    | A separate Identity change adds both headers                                                                                                                                                                                                           |
| [Verify Email](identity-http.md#verify-email)                                                                                                                                                                                                                                                                                                               | RFC 9110 §9.2.1 (MUST); ASVS 5.0 V3.5.3 (Level 1)                      | `GET /auth/verify` verifies the email and consumes the token                                                                 | The verification link is opened directly; no browser flow exists yet to confirm verification with an unsafe method                                                   | 2026-11-18    | Decided with the browser Authentication flow, which moves the state change to an unsafe method                                                                                                                                                         |
| Every `401` response, on Identity and Chat routes                                                                                                                                                                                                                                                                                                           | RFC 9110 §15.5.2 (MUST); RFC 6750 §3 (MUST; adopted by analogy)        | No `401` carries a challenge; see [Error Response Headers](#error-response-headers)                                          | The challenge is Accepted, not implemented                                                                                                                           | 2026-11-18    | Identity: the Identity error envelope delivery. Chat: the delivery for requests rejected before routing. Both are in [HTTP Error Envelope Alignment](../delivery/phases/02-chat.md#http-error-envelope-alignment); the row stays until both are closed |
| A `401` for a presented access token that fails authentication                                                                                                                                                                                                                                                                                              | RFC 6750 §3 (SHOULD include the `error` attribute; adopted by analogy) | No `error` attribute is sent, and the accepted challenge carries none; see [Error Response Headers](#error-response-headers) | `AUTHENTICATION_REQUIRED` deliberately does not distinguish a missing token from an invalid one                                                                      | 2026-11-18    | Accepted permanently                                                                                                                                                                                                                                   |

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
- [ADR 0009 — Adopt Named Standards and Brownfield Migration Principles](../decisions/0009-adopt-named-standards-and-brownfield-migration-principles.md)
- [Brownfield Migration Principles](../engineering/brownfield-migration.md)
- [Delivery Roadmap](../delivery/roadmap.md)
- [Current Status](../delivery/status.md)
