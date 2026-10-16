# Chat HTTP Contract

Status: Contact-request creation Implemented; Contact-request acceptance Implemented; Contact-request rejection Implemented
Last reviewed: 2026-10-15

## Purpose

This document is the authoritative HTTP contract for accepted and implemented
Chat endpoints.

The contract contains implemented authenticated Contact-request creation,
implemented authenticated Contact-request acceptance, and implemented
authenticated Contact-request rejection. A capability appearing in the Chat
Context or Phase 2 does not create another HTTP endpoint automatically.

## Source-of-Truth Boundary

| Concern                                     | Authoritative source                                                                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Exact Chat HTTP contract                    | This document                                                                                                                            |
| Shared HTTP envelope and conventions        | [`http.md`](http.md)                                                                                                                     |
| Contact invariants and application behavior | [`../contexts/chat.md`](../contexts/chat.md)                                                                                             |
| Phase authorization                         | [`../delivery/phases/02-chat.md`](../delivery/phases/02-chat.md)                                                                         |
| Current implementation state                | [`../delivery/status.md`](../delivery/status.md)                                                                                         |
| System-wide security principles             | [`../architecture/security.md`](../architecture/security.md)                                                                             |
| Cross-context integration                   | [`../decisions/0004-cross-context-integration.md`](../decisions/0004-cross-context-integration.md)                                       |
| HTTP transport placement                    | [`../decisions/0008-place-http-transport-by-integration-boundary.md`](../decisions/0008-place-http-transport-by-integration-boundary.md) |
| Executable behavior                         | Chat and API Gateway source code and tests                                                                                               |

An operation retains `Implemented` state only while its controller behavior,
transport tests, shared HTTP conventions, and this document remain aligned. An
`Accepted` operation is a decided transport target, not evidence of an endpoint.

## Delivery State

Authenticated Contact-request creation is implemented through
`POST /contact-requests`. The runtime path includes the request DTO, public
Identity Authentication API binding, verified `userId` to requester
translation, named application errors, controller-scoped error translation,
production NestJS registration, and HTTP transport evidence.

The endpoint creates pending relationships and truthfully returns either a
pending or accepted current relationship when reusing persisted state. It does
not accept a relationship or provide an acceptance command.

Transport E2E boots the real `AppModule` and HTTP server while overriding only
the Authentication API, Directory API, and Chat Prisma client external seams.
It proves route, guard, validation, whitelist, success serialization, exact
status and error envelopes, and information minimization. It is not
PostgreSQL evidence. Existing Chat integration tests separately verify the
real persistence mapping, uniqueness, collision, and concurrency behavior.

Contact-request acceptance is implemented at
`POST /contact-requests/{contactRequestId}/accept`. Its route, request,
response, authorization visibility, errors, and retry semantics are decided
below and implemented through the API Gateway transport boundary. The runtime
path includes the public Identity Authentication API binding, verified `userId`
to accepting-actor translation, opaque path identifier translation, named
application errors, controller-scoped error translation, production NestJS
registration, and authenticated HTTP transport evidence.

The acceptance transport evidence boots the real `AppModule` and HTTP server
while overriding only the Authentication API, Directory API, and Chat Prisma
client external seams. It proves route, guard, no-body success, ignored
unsupported body fields, success serialization, exact status and error
envelopes, authorization visibility, dependency-unavailable mapping, and
information minimization. It is not PostgreSQL evidence.

Contact-request rejection is implemented at
`POST /contact-requests/{contactRequestId}/reject`. Its route, response,
authorization visibility, errors, and retry semantics are decided below and
implemented through the same API Gateway transport boundary as acceptance. The
runtime path adds the rejection Application command, verified `userId` to
rejecting-actor translation, opaque path identifier translation, named
application errors, controller-scoped error translation, production NestJS
registration, and authenticated HTTP transport evidence.

Acceptance and rejection resolve a pending relationship through one
pending-only repository transition, so concurrent resolutions apply at most
one. The rejection transport evidence uses the same real `AppModule` and
external-seam boundary as acceptance and proves route, guard, no-body success,
ignored unsupported body fields, success serialization, exact status and error
envelopes, identical authorization visibility for missing and non-recipient
actors, both state-specific conflicts, dependency-unavailable mapping, and
information minimization. It is not PostgreSQL evidence. Chat integration
tests separately verify the rejected-state persistence, the pending-only
transition, genuinely concurrent resolution, and that a rejected relationship
does not occupy its user pair.

No frontend Contacts flow or remaining Contacts lifecycle endpoint is
implemented by this contract.

## Create or Return a Contact Request

Authentication: Authenticated

```http
POST /contact-requests
Authorization: Bearer <access-token>
Content-Type: application/json
```

### Requester Authority

The requester identifier comes from the verified server-side principal.

This contract describes that identifier semantically. It does not select the
concrete Identity `AuthenticationApi` or Passport principal representation,
and it does not expose principal email as Chat request data.

A body, path, or query value cannot provide or override the requester
identifier. Authentication proves requester identity; Chat remains
authoritative for Contact rules.

Identity Directory lookup is used only for the client-provided target
identifier. The authenticated requester is not separately checked through the
Directory capability.

### Request Body

```json
{
  "targetUserId": "user-target"
}
```

| Field          | Presence | Validation                                        | Consumer meaning                 |
| -------------- | -------- | ------------------------------------------------- | -------------------------------- |
| `targetUserId` | Required | String whose raw length is at least one character | Untrusted target user to contact |

`targetUserId` is an opaque identifier. Clients and servers must not infer
authorization or resource type from its format.

The HTTP boundary does not trim or otherwise normalize `targetUserId`.
Whitespace-only strings therefore satisfy DTO validation; Identity Directory
remains authoritative for whether the supplied opaque identifier exists.

`targetUserId` is the only declared body field. The current shared validation
configuration removes unsupported fields rather than rejecting them. A
client-supplied `requesterId` is therefore unsupported and cannot affect the
authoritative requester.

### Success

The operation uses one success status for both first creation and reuse:

```http
200 OK
```

```json
{
  "id": "relationship-id",
  "requesterId": "user-requester",
  "recipientId": "user-target",
  "status": "pending"
}
```

| Field         | Type                    | Consumer meaning                                               |
| ------------- | ----------------------- | -------------------------------------------------------------- |
| `id`          | string                  | Stable identifier for the returned Contact relationship.       |
| `requesterId` | string                  | Authoritative user who originally requested the relationship.  |
| `recipientId` | string                  | Authoritative user who originally received the request.        |
| `status`      | `pending` or `accepted` | Persisted current status returned truthfully by this endpoint. |

The response contains the persisted relationship. It does not report whether
this invocation inserted a new row or reused an existing result because the
implemented use case does not return that distinction.

For an existing same-direction request, the operation returns that relationship
without creating a duplicate.

For an existing opposing request, the operation also returns `200 OK` and the
same persisted relationship. Its original `requesterId` and `recipientId` are
preserved; the roles are not reversed to match the latest caller.

Reuse is not a `409 Conflict` for this operation. A reused relationship may be
`pending` or `accepted`; the endpoint returns its persisted status without
changing it. A rejected relationship is not current
([`../contexts/chat.md`](../contexts/chat.md)): it is never reused by this
operation, and a request for a pair whose only relationship is rejected
creates a new pending relationship with a new `id`, in either direction.
Removed and other relationship states remain outside this implemented subset.

### Error Responses

Every error uses the stable envelope defined in [`http.md`](http.md).

| Situation                               | HTTP status | Stable code                         | Public message                                        | Consumer action                        |
| --------------------------------------- | ----------: | ----------------------------------- | ----------------------------------------------------- | -------------------------------------- |
| Invalid request body                    |         400 | `VALIDATION_FAILED`                 | Request validation failed.                            | Correct the identified field.          |
| Requester targets themselves            |         400 | `SELF_CONTACT_REQUEST`              | A Contact request cannot target the requester.        | Select another target.                 |
| Authentication is missing or unusable   |         401 | `AUTHENTICATION_REQUIRED`           | Authentication is required.                           | Reauthenticate.                        |
| Target is confirmed missing             |         404 | `CONTACT_TARGET_NOT_FOUND`          | Contact target was not found.                         | Do not retry unchanged.                |
| Target lookup is unavailable            |         503 | `CONTACT_TARGET_LOOKUP_UNAVAILABLE` | Contact target validation is temporarily unavailable. | Retry according to client policy.      |
| Relationship lookup or save unavailable |         503 | `CONTACT_REQUEST_UNAVAILABLE`       | Contact request service is temporarily unavailable.   | Preserve confirmed state and retry.    |
| Unclassified unexpected failure         |         500 | `INTERNAL_ERROR`                    | An unexpected error occurred.                         | Do not assume the operation completed. |

The endpoint does not define an authorization-denial response beyond
authentication because the current Contact-request behavior has no separate
Contact authorization outcome. It does not define a conflict response because
an existing pending or accepted current relationship is a successful reusable
result.

#### Validation Example

```http
400 Bad Request
```

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

Validation details identify only the declared `targetUserId` field and never
repeat its rejected value.

#### Missing-target Example

```http
404 Not Found
```

```json
{
  "error": {
    "code": "CONTACT_TARGET_NOT_FOUND",
    "message": "Contact target was not found."
  }
}
```

`details` is omitted for this non-validation error.

### Information Minimization

Responses must not expose:

- principal email or token claims;
- raw target-directory or repository failures;
- Identity, Prisma, PostgreSQL, NestJS, or provider internals;
- database codes or constraint names;
- stack traces or filesystem paths.

The public error message is selected by this contract. It is not copied from
the caught exception.

## Accept a Contact Request

Contract state: `Implemented`

Authentication: Authenticated with resource authorization

```http
POST /contact-requests/{contactRequestId}/accept
Authorization: Bearer <access-token>
```

The command-style `accept` segment exposes only the bounded acceptance
transition. It does not create a separately addressable acceptance resource or
authorize a general relationship-status mutation.

### Identifier and Actor Authority

`contactRequestId` is a required path parameter. It is the opaque identifier
returned as `id` by Contact-request creation and identifies the persisted
relationship to accept.

Any non-empty routed path segment is treated as an opaque string. Clients must
not infer resource type, ownership, lifecycle state, or authorization from its
format. Possession of the identifier does not authorize acceptance. A request
without the path segment does not target this operation.

The accepting actor comes only from the `userId` produced by Identity's public
Authentication API after access-token verification. A path, body, query, or
other client-controlled value cannot provide or override the accepting actor or
recipient identity.

The API Gateway transport translates the verified principal to the minimum
Chat Application input. This contract does not expose the concrete
Application input type, Domain entity, repository, Prisma model, Identity
internal type, principal email, expiration, or token claims.

### Request Body

This operation has no request body and defines no route-specific request DTO.
Clients should omit the body and do not need to send `Content-Type`.

If a client sends parsed JSON fields, they are unsupported and ignored by this
operation under the current shared unknown-field convention. They must not
affect the actor, identifier, authorization, transition, or response. No
operation-specific `VALIDATION_FAILED` outcome is defined because the operation
has no request fields and no identifier-format rule beyond the required routed
path segment.

### Success

The original recipient accepting a persisted pending relationship receives:

```http
200 OK
```

```json
{
  "id": "relationship-id",
  "requesterId": "user-original-requester",
  "recipientId": "user-original-recipient",
  "status": "accepted"
}
```

| Field         | Type         | Consumer meaning                                                       |
| ------------- | ------------ | ---------------------------------------------------------------------- |
| `id`          | string       | The same stable relationship identity addressed by `contactRequestId`. |
| `requesterId` | string       | The authoritative user who originally created the request.             |
| `recipientId` | string       | The authoritative original recipient who accepted it.                  |
| `status`      | `"accepted"` | The persisted lifecycle state after successful acceptance.             |

Success is returned only after the accepted state is persisted. The response
preserves the original requester and recipient roles, does not reverse them to
match the caller, and does not create a new relationship identity.

### Authorization and Resource Visibility

The operation preserves the Application command's ordering:

1. Look up the relationship by opaque identifier.
2. Return the public not-found outcome if it is missing.
3. Authorize the verified actor as the original recipient.
4. Return the same public not-found outcome if authorization fails.
5. Only for the authorized recipient, attempt the transition from pending to
   accepted atomically.
6. Return the accepted result if the transition applied. If it did not apply
   because the relationship was already resolved, return the authorized
   state-conflict outcome for its actual state.

A requester or unrelated user receives the same public response whether the
identifier is missing, identifies a pending relationship, an accepted
relationship, or a rejected relationship. The selected non-recipient outcome
is `404`, not `403`. An unauthorized actor therefore cannot use this operation
to learn resource existence or distinguish pending, accepted, or rejected
state.

### Error Responses

Every error uses the stable envelope defined in [`http.md`](http.md).
Non-validation errors omit `error.details`.

| Situation                                                          | HTTP status | Stable code                              | Public message                                         | Consumer action                                                                                                      |
| ------------------------------------------------------------------ | ----------: | ---------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Authentication is missing or unusable                              |         401 | `AUTHENTICATION_REQUIRED`                | Authentication is required.                            | Stop the protected interaction and reauthenticate.                                                                   |
| Relationship is missing                                            |         404 | `CONTACT_REQUEST_NOT_FOUND`              | Contact request was not found.                         | Do not retry unchanged; return to a stable Contacts state.                                                           |
| Verified actor is not the original recipient                       |         404 | `CONTACT_REQUEST_NOT_FOUND`              | Contact request was not found.                         | Do not retry unchanged; return to a stable Contacts state.                                                           |
| Original recipient repeats acceptance after it is already accepted |         409 | `CONTACT_REQUEST_ALREADY_ACCEPTED`       | Contact request has already been accepted.             | Reconcile the relationship as accepted and do not repeat acceptance unchanged.                                       |
| Original recipient accepts a relationship that is already rejected |         409 | `CONTACT_REQUEST_ALREADY_REJECTED`       | Contact request has already been rejected.             | Reconcile the relationship as rejected and do not repeat acceptance; a new request would be a new relationship.      |
| Relationship lookup, transition, or re-read is unavailable         |         503 | `CONTACT_REQUEST_ACCEPTANCE_UNAVAILABLE` | Contact request acceptance is temporarily unavailable. | Do not assume completion; preserve confirmed state and retry the same identifier according to bounded client policy. |
| Unclassified unexpected failure                                    |         500 | `INTERNAL_ERROR`                         | An unexpected error occurred.                          | Do not assume whether the operation completed; reconcile before presenting a final state or retrying.                |

The two `404` situations intentionally have the same status, code, message, and
body. The transport maps stable runtime categories rather than inspecting
exception messages.

Repository lookup, transition, and re-read failures share the same
dependency-unavailable outcome. An unexpected inconsistency after a
transition that did not apply (for example the relationship no longer being
readable, or still pending) is reported as this dependency-unavailable
outcome, never as success. Public responses must not disclose raw exception messages, database or
driver codes, constraints, tables, columns, indexes, provider or deployment
details, stack traces, filesystem paths, credentials, tokens, or internal type
names.

Unexpected failures remain `500 INTERNAL_ERROR`; they must not be reported as
not-found, authorization denial, conflict, or success.

### Retry and Reconciliation

A `200 OK` confirms that the identified relationship is persisted as accepted.

For the authorized original recipient,
`409 CONTACT_REQUEST_ALREADY_ACCEPTED` confirms the relationship is already
accepted. The client reconciles its local state as accepted and does not repeat
the unchanged command.

After an uncertain client interruption or
`503 CONTACT_REQUEST_ACCEPTANCE_UNAVAILABLE`, the client may retry the same
operation with the same `contactRequestId` according to bounded client policy:

- A later `200` confirms successful acceptance.
- A later authorized `409 CONTACT_REQUEST_ALREADY_ACCEPTED` reconciles an
  earlier uncertain attempt as accepted.
- A later authorized `409 CONTACT_REQUEST_ALREADY_REJECTED` means the
  recipient's relationship was rejected instead; reconcile as rejected.
- A `404 CONTACT_REQUEST_NOT_FOUND` means the client has no visible actionable
  resource and should return to a stable Contacts state.
- Another `503` remains retryable according to policy.

The contract does not promise automatic retries, an idempotency key, a second
transition, or a success response for repeated acceptance.

Resolution is atomic. Acceptance and rejection of one pending relationship
apply at most one transition, and a concurrent attempt that loses receives the
authorized state-specific `409` for the state that won, never a contradictory
success.

## Reject a Contact Request

Contract state: `Implemented`

Authentication: Authenticated with resource authorization

```http
POST /contact-requests/{contactRequestId}/reject
Authorization: Bearer <access-token>
```

The command-style `reject` segment exposes only the bounded rejection
transition. It does not create a separately addressable rejection resource,
authorize requester cancellation, or authorize a general relationship-status
mutation.

### Identifier and Actor Authority

`contactRequestId` is a required path parameter with the same opaque-identifier
rules as acceptance: any non-empty routed path segment is an opaque string,
clients must not infer type, ownership, lifecycle state, or authorization from
its format, and possession of the identifier does not authorize rejection. A
request without the path segment does not target this operation.

The rejecting actor comes only from the `userId` produced by Identity's public
Authentication API after access-token verification. A path, body, query, or
other client-controlled value cannot provide or override the rejecting actor or
recipient identity. The contract does not expose Application input types,
Domain entities, repositories, Prisma models, Identity internals, principal
email, expiration, or token claims.

### Request Body

This operation has no request body and defines no route-specific request DTO.
Clients should omit the body and do not need to send `Content-Type`. Parsed
JSON fields are unsupported and ignored under the shared unknown-field
convention and cannot affect the actor, identifier, authorization, transition,
or response. No operation-specific `VALIDATION_FAILED` outcome is defined.

### Success

The original recipient rejecting a persisted pending relationship receives:

```http
200 OK
```

```json
{
  "id": "relationship-id",
  "requesterId": "user-original-requester",
  "recipientId": "user-original-recipient",
  "status": "rejected"
}
```

| Field         | Type         | Consumer meaning                                                       |
| ------------- | ------------ | ---------------------------------------------------------------------- |
| `id`          | string       | The same stable relationship identity addressed by `contactRequestId`. |
| `requesterId` | string       | The authoritative user who originally created the request.             |
| `recipientId` | string       | The authoritative original recipient who rejected it.                  |
| `status`      | `"rejected"` | The persisted lifecycle state after successful rejection.              |

Success is returned only after the rejected state is persisted. Original
requester and recipient roles are preserved and no new relationship identity is
created.

### Authorization and Resource Visibility

The operation follows the same ordering as acceptance:

1. Look up the relationship by opaque identifier.
2. Return the public not-found outcome if it is missing.
3. Authorize the verified actor as the original recipient.
4. Return the same public not-found outcome if authorization fails.
5. Only for the authorized recipient, attempt the transition from pending to
   rejected atomically.
6. Return the rejected result if it applied, or the authorized state-specific
   conflict if the relationship was already resolved.

The requester, who cannot reject or cancel their own request through this
operation, and any unrelated user receive the same public response whether the
identifier is missing or identifies a pending, accepted, or rejected
relationship. The non-recipient outcome is `404`, not `403`, so the operation
cannot be used to learn resource existence or state.

### Error Responses

Every error uses the stable envelope defined in [`http.md`](http.md).
Non-validation errors omit `error.details`.

| Situation                                                          | HTTP status | Stable code                             | Public message                                        | Consumer action                                                                                                      |
| ------------------------------------------------------------------ | ----------: | --------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Authentication is missing or unusable                              |         401 | `AUTHENTICATION_REQUIRED`               | Authentication is required.                           | Stop the protected interaction and reauthenticate.                                                                   |
| Relationship is missing                                            |         404 | `CONTACT_REQUEST_NOT_FOUND`             | Contact request was not found.                        | Do not retry unchanged; return to a stable Contacts state.                                                           |
| Verified actor is not the original recipient                       |         404 | `CONTACT_REQUEST_NOT_FOUND`             | Contact request was not found.                        | Do not retry unchanged; return to a stable Contacts state.                                                           |
| Original recipient repeats rejection after it is already rejected  |         409 | `CONTACT_REQUEST_ALREADY_REJECTED`      | Contact request has already been rejected.            | Reconcile the relationship as rejected and do not repeat rejection unchanged.                                        |
| Original recipient rejects a relationship that is already accepted |         409 | `CONTACT_REQUEST_ALREADY_ACCEPTED`      | Contact request has already been accepted.            | Reconcile the relationship as accepted and do not repeat rejection.                                                  |
| Relationship lookup, transition, or re-read is unavailable         |         503 | `CONTACT_REQUEST_REJECTION_UNAVAILABLE` | Contact request rejection is temporarily unavailable. | Do not assume completion; preserve confirmed state and retry the same identifier according to bounded client policy. |
| Unclassified unexpected failure                                    |         500 | `INTERNAL_ERROR`                        | An unexpected error occurred.                         | Do not assume whether the operation completed; reconcile before presenting a final state or retrying.                |

The two `404` situations intentionally have the same status, code, message, and
body, and reuse the acceptance operation's not-found outcome verbatim. The
transport maps stable runtime categories rather than inspecting exception
messages.

Repository lookup, transition, and re-read failures share the same
dependency-unavailable outcome. An unexpected inconsistency after a transition
that did not apply (the relationship no longer readable, or still pending) is
reported as that outcome, never as success. Public responses must not disclose
raw exception messages, database or driver codes, constraints, tables,
columns, indexes, provider or deployment details, stack traces, filesystem
paths, credentials, tokens, or internal type names. Unexpected failures remain
`500 INTERNAL_ERROR` and must not be reported as not-found, authorization
denial, conflict, or success.

The state-specific `409` responses are returned only to the authorized
original recipient, who is a party to the relationship, so they do not
disclose state to any other actor.

### Retry and Reconciliation

A `200 OK` confirms that the identified relationship is persisted as rejected.

After an uncertain client interruption or
`503 CONTACT_REQUEST_REJECTION_UNAVAILABLE`, the client may retry the same
operation with the same `contactRequestId` according to bounded client policy:

- A later `200` confirms successful rejection.
- A later authorized `409 CONTACT_REQUEST_ALREADY_REJECTED` reconciles an
  earlier uncertain attempt as rejected.
- A later authorized `409 CONTACT_REQUEST_ALREADY_ACCEPTED` means the
  relationship was accepted instead; reconcile as accepted and do not repeat
  rejection.
- A `404 CONTACT_REQUEST_NOT_FOUND` means the client has no visible actionable
  resource and should return to a stable Contacts state.
- Another `503` remains retryable according to policy.

The contract does not promise automatic retries, an idempotency key, or a
success response for repeated rejection. Resolution is atomic as described in
the acceptance retry section: a concurrent attempt that loses receives the
state-specific `409`.

### Re-request After Rejection

A rejected relationship is not current. After rejection, a `POST
/contact-requests` for the same pair, in either direction, creates a new
pending relationship with a new `id`. The new `id` indirectly reveals that a
prior request was resolved, and unbounded re-requesting is a known abuse
exposure until the deferred rate-limiting and blocking capabilities exist. The
decision and its limits belong to [`../contexts/chat.md`](../contexts/chat.md).

## Explicitly Outside This Contract

This document does not define:

- incoming or outgoing Contact-request listing;
- requester cancellation of a Contact request;
- accepted-Contact listing or removal;
- Contact blocking, discovery, import, or quotas;
- Direct or Group Conversation behavior;
- Messages, history, realtime, events, or frontend routes;
- generated OpenAPI for implemented Chat endpoints;
- browser token transport, cookie, CSRF, CORS, or storage policy;
- exact rate-limit values;
- any additional runtime capability outside the implemented Contact-request
  endpoints.

Those capabilities require their own Phase-authorized exact contracts and
implementation outcomes.

## Related Documentation

- [Shared HTTP Contract](http.md)
- [Chat Context](../contexts/chat.md)
- [Phase 2 — Contacts and Chat](../delivery/phases/02-chat.md)
- [Current Status](../delivery/status.md)
- [Security Architecture](../architecture/security.md)
- [Cross-context Integration ADR](../decisions/0004-cross-context-integration.md)
- [HTTP Transport Placement ADR](../decisions/0008-place-http-transport-by-integration-boundary.md)
