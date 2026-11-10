# Chat Contacts HTTP Contract

Status: Contact-request creation Implemented; Contact-request acceptance Implemented; Contact-request rejection Implemented; incoming Contact-request listing Implemented; outgoing Contact-request listing Implemented; accepted Contact listing Implemented; Contact removal Accepted, not implemented
Last reviewed: 2026-11-10

## Purpose

This document is the authoritative HTTP contract for accepted and implemented
Contact endpoints. Each operation carries its own contract state; an
`Accepted` operation is a decided target and not evidence of an endpoint.

Rules that apply to more than one Chat contract file, and the index of Chat
HTTP contract files, are in [`chat-http.md`](chat-http.md).

## Source-of-Truth Boundary

| Concern                                     | Authoritative source                         |
| ------------------------------------------- | -------------------------------------------- |
| Exact Contact HTTP operations               | This document                                |
| Contact invariants and application behavior | [`../contexts/chat.md`](../contexts/chat.md) |

## Create or Return a Contact Request

Contract state: `Implemented`

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
Contact removal is an accepted target that is not implemented
([Remove a Contact](#remove-a-contact)); once it exists, a removed relationship
is likewise not current and is never reused. Other relationship states remain
outside this implemented subset.

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

## List Incoming Contact Requests

Contract state: `Implemented`

Authentication: Authenticated; results are scoped to the verified actor

```http
GET /contact-requests/incoming?limit=20&cursor=<opaque-cursor>
Authorization: Bearer <access-token>
```

The operation returns the pending Contact requests addressed to the verified
actor so the recipient can obtain the opaque `contactRequestId` required by
acceptance and rejection. It is a read-only query. It does not list outgoing
requests, accepted Contacts, or relationships in any other state, and it does
not accept, reject, or otherwise change a relationship.

### Actor Authority

The recipient comes only from the `userId` produced by Identity's public
Authentication API after access-token verification. A path, query, or body
value cannot provide or override it. Undeclared query parameters, including
`recipientId` or `userId`, are ignored: the operation reads only `limit` and
`cursor`. The contract does not expose Application input types, Domain
entities, repositories, Prisma models, Identity internals, principal email,
expiration, or token claims.

Because the list is scoped to the actor, there is no addressable resource
whose existence could be hidden. The operation therefore defines no `403` or
`404` response.

### Query Parameters

| Parameter | Presence | Rule                                                                                                                                                                 |
| --------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `limit`   | Optional | A single value made only of ASCII digits whose integer value is from 1 to 50. Default `20` when absent. A larger value is rejected, not clamped.                     |
| `cursor`  | Optional | A single value previously returned as `nextCursor`. Opaque to clients; clients must not construct, parse, or modify it. A value the server cannot decode is invalid. |

A `limit` that is empty, repeated, signed, padded with whitespace,
hexadecimal, exponential, decimal, zero, negative, or above 50 is invalid. A
`cursor` that is empty, repeated, malformed, or of an unsupported version is
invalid.

The shared pagination convention in [`http.md`](http.md) owns the parameter
names, default, and maximum. This operation does not lower the maximum.

An invalid value returns `400 VALIDATION_FAILED`. When both parameters are
invalid, `limit` is validated first and the response carries exactly one
detail, for `limit`. The `401` for a missing or unusable access token takes
precedence over any `400`, because authentication runs before query
validation.

### Success

```http
200 OK
```

```json
{
  "items": [
    {
      "id": "relationship-id",
      "requesterId": "user-requester",
      "displayName": "Requester Name",
      "status": "pending"
    }
  ],
  "nextCursor": "opaque-cursor"
}
```

| Field                 | Type             | Consumer meaning                                                                                                           |
| --------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `items`               | array            | At most `limit` pending requests addressed to the verified actor, in the order below. Empty when there are none.           |
| `items[].id`          | string           | The `contactRequestId` to use with acceptance and rejection.                                                               |
| `items[].requesterId` | string           | The authoritative user who created the request. This, not `displayName`, identifies the requester.                         |
| `items[].displayName` | string or `null` | Current presentation text from Identity's public Profile Query API. `null` when Identity has no profile for the requester. |
| `items[].status`      | `"pending"`      | Always `pending`; no other state is listed.                                                                                |
| `nextCursor`          | string or `null` | Pass it as `cursor` to read the next page. `null` marks the end of the list.                                               |

`recipientId` is omitted because it is always the verified actor.

`displayName` is non-unique, user-controlled presentation text. It is not an
identifier and must not be used to authorize or distinguish requesters;
clients must treat it as untrusted text. A requester without a profile still
appears in the list with `displayName` present and `null`.

`displayName` comes only from Identity's public Profile Query API under
[`../decisions/0004-cross-context-integration.md`](../decisions/0004-cross-context-integration.md).
Chat does not copy it into Chat storage. A Profile Query failure fails the
whole request; the operation never returns a partially filled list.

### Ordering and Pagination

Items are returned in a stable, server-defined ascending order of the request
`id`. For unchanged data, consecutive pages contain no duplicates and no gaps.
The order carries **no chronological meaning**: identifiers are opaque and
random, and the contract promises no creation-time ordering and no string
collation a client can reproduce.

The list is paginated rather than bounded. A user can receive an unbounded
number of pending requests (no rate limiting or blocking exists yet), and a
fixed cap without a cursor would silently hide requests.

`nextCursor` is non-null exactly when more pending requests exist after the
returned page and is `null` on the last page. A cursor continues after the last
returned request. Continuation does not require that request to still exist or
still be pending, and a cursor from another actor's listing is not an error
because results stay scoped to the verified actor.

There is no snapshot guarantee. A request created or resolved while a client
traverses the list may be missed or may disappear. A client discovers new
requests by restarting from the first page.

### Empty Result

A user with no pending incoming requests receives:

```http
200 OK
```

```json
{
  "items": [],
  "nextCursor": null
}
```

An empty result is distinct from `503`: it confirms there is nothing to
display, not that the lookup failed.

### Error Responses

Every error uses the stable envelope defined in [`http.md`](http.md).
Non-validation errors omit `error.details`.

| Situation                                           | HTTP status | Stable code                           | Public message                                         | Consumer action                                                             |
| --------------------------------------------------- | ----------: | ------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------- |
| Authentication is missing or unusable               |         401 | `AUTHENTICATION_REQUIRED`             | Authentication is required.                            | Stop the protected interaction and reauthenticate.                          |
| `limit` is invalid                                  |         400 | `VALIDATION_FAILED`                   | Request validation failed.                             | Correct `limit`.                                                            |
| `cursor` is invalid (and `limit` is valid)          |         400 | `VALIDATION_FAILED`                   | Request validation failed.                             | Discard the cursor and restart from the first page.                         |
| Relationship lookup or Profile Query is unavailable |         503 | `CONTACT_REQUEST_LISTING_UNAVAILABLE` | Incoming Contact requests are temporarily unavailable. | Retry the same request according to bounded client policy.                  |
| Unclassified unexpected failure                     |         500 | `INTERNAL_ERROR`                      | An unexpected error occurred.                          | Do not assume the list is complete; reload before presenting a final state. |

#### Validation Examples

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
        "field": "limit",
        "message": "limit must be an integer from 1 to 50."
      }
    ]
  }
}
```

An invalid `cursor` returns the same envelope with `field` set to `cursor` and
`message` set to `cursor must be a valid cursor.` Validation details name only
`limit` or `cursor` and never repeat the rejected value.

Repository unavailability and Profile Query unavailability share one status,
code, and public message because the consumer action is identical. The
operation is read-only, so retrying it is safe. An empty list is never
reported as `503`, and a `503` is never reported as an empty list.

### Information Minimization

Responses must not expose:

- principal email or token claims;
- the recipient identifier, or accepted, rejected, or outgoing relationships;
- any Identity data other than `displayName`;
- raw repository or Profile Query failures;
- Identity, Prisma, PostgreSQL, NestJS, or provider internals;
- database codes, constraint names, stack traces, or filesystem paths.

Public error messages are selected by this contract and never copied from a
caught exception or echoed from client input.

## List Outgoing Contact Requests

Contract state: `Implemented`

Authentication: Authenticated; results are scoped to the verified actor

```http
GET /contact-requests/outgoing?limit=20&cursor=<opaque-cursor>
Authorization: Bearer <access-token>
```

The operation returns the pending Contact requests created by the verified
actor so the requester can see which sent requests are still waiting for a
response. It is a read-only query. It does not list incoming requests,
accepted Contacts, or relationships in any other state, and it does not
cancel, accept, reject, or otherwise change a relationship.

### Actor Authority

The requester comes only from the `userId` produced by Identity's public
Authentication API after access-token verification. A path, query, or body
value cannot provide or override it. Undeclared query parameters, including
`requesterId` or `userId`, are ignored: the operation reads only `limit` and
`cursor`. The contract does not expose Application input types, Domain
entities, repositories, Prisma models, Identity internals, principal email,
expiration, or token claims.

Because the list is scoped to the actor, there is no addressable resource
whose existence could be hidden. The operation therefore defines no `403` or
`404` response.

### Query Parameters

| Parameter | Presence | Rule                                                                                                                                                                 |
| --------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `limit`   | Optional | A single value made only of ASCII digits whose integer value is from 1 to 50. Default `20` when absent. A larger value is rejected, not clamped.                     |
| `cursor`  | Optional | A single value previously returned as `nextCursor`. Opaque to clients; clients must not construct, parse, or modify it. A value the server cannot decode is invalid. |

A `limit` that is empty, repeated, signed, padded with whitespace,
hexadecimal, exponential, decimal, zero, negative, or above 50 is invalid. A
`cursor` that is empty, repeated, malformed, or of an unsupported version is
invalid.

The shared pagination convention in [`http.md`](http.md) owns the parameter
names, default, and maximum. This operation does not lower the maximum.

An invalid value returns `400 VALIDATION_FAILED`. When both parameters are
invalid, `limit` is validated first and the response carries exactly one
detail, for `limit`. The `401` for a missing or unusable access token takes
precedence over any `400`, because authentication runs before query
validation.

### Success

```http
200 OK
```

```json
{
  "items": [
    {
      "id": "relationship-id",
      "recipientId": "user-recipient",
      "displayName": "Recipient Name",
      "status": "pending"
    }
  ],
  "nextCursor": "opaque-cursor"
}
```

| Field                 | Type             | Consumer meaning                                                                                                           |
| --------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `items`               | array            | At most `limit` pending requests created by the verified actor, in the order below. Empty when there are none.             |
| `items[].id`          | string           | The opaque identifier of the Contact request.                                                                              |
| `items[].recipientId` | string           | The authoritative user the request was sent to. This, not `displayName`, identifies the recipient.                         |
| `items[].displayName` | string or `null` | Current presentation text from Identity's public Profile Query API. `null` when Identity has no profile for the recipient. |
| `items[].status`      | `"pending"`      | Always `pending`; no other state is listed.                                                                                |
| `nextCursor`          | string or `null` | Pass it as `cursor` to read the next page. `null` marks the end of the list.                                               |

`requesterId` is omitted because it is always the verified actor.

`displayName` is non-unique, user-controlled presentation text. It is not an
identifier and must not be used to authorize or distinguish recipients;
clients must treat it as untrusted text. A recipient without a profile still
appears in the list with `displayName` present and `null`.

`displayName` comes only from Identity's public Profile Query API under
[`../decisions/0004-cross-context-integration.md`](../decisions/0004-cross-context-integration.md).
Chat does not copy it into Chat storage. A Profile Query failure fails the
whole request; the operation never returns a partially filled list.

### Ordering and Pagination

Items are returned in a stable, server-defined ascending order of the request
`id`. For unchanged data, consecutive pages contain no duplicates and no gaps.
The order carries **no chronological meaning**: identifiers are opaque and
random, and the contract promises no creation-time ordering and no string
collation a client can reproduce.

The list is paginated rather than bounded. A user can send an unbounded number
of requests (no rate limiting or blocking exists yet), and a fixed cap without
a cursor would silently hide requests.

`nextCursor` is non-null exactly when more pending requests exist after the
returned page and is `null` on the last page. A cursor continues after the last
returned request. Continuation does not require that request to still exist or
still be pending, and a cursor from another actor's listing is not an error
because results stay scoped to the verified actor.

There is no snapshot guarantee. A request created or resolved while a client
traverses the list may be missed or may disappear. A request that its
recipient accepts or rejects stops being pending and no longer appears; the
list does not say which of the two happened. A client discovers new requests
by restarting from the first page.

### Empty Result

A user with no pending outgoing requests receives:

```http
200 OK
```

```json
{
  "items": [],
  "nextCursor": null
}
```

An empty result is distinct from `503`: it confirms there is nothing to
display, not that the lookup failed.

### Error Responses

Every error uses the stable envelope defined in [`http.md`](http.md).
Non-validation errors omit `error.details`.

| Situation                                           | HTTP status | Stable code                                    | Public message                                         | Consumer action                                                             |
| --------------------------------------------------- | ----------: | ---------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------- |
| Authentication is missing or unusable               |         401 | `AUTHENTICATION_REQUIRED`                      | Authentication is required.                            | Stop the protected interaction and reauthenticate.                          |
| `limit` is invalid                                  |         400 | `VALIDATION_FAILED`                            | Request validation failed.                             | Correct `limit`.                                                            |
| `cursor` is invalid (and `limit` is valid)          |         400 | `VALIDATION_FAILED`                            | Request validation failed.                             | Discard the cursor and restart from the first page.                         |
| Relationship lookup or Profile Query is unavailable |         503 | `OUTGOING_CONTACT_REQUEST_LISTING_UNAVAILABLE` | Outgoing Contact requests are temporarily unavailable. | Retry the same request according to bounded client policy.                  |
| Unclassified unexpected failure                     |         500 | `INTERNAL_ERROR`                               | An unexpected error occurred.                          | Do not assume the list is complete; reload before presenting a final state. |

#### Validation Examples

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
        "field": "limit",
        "message": "limit must be an integer from 1 to 50."
      }
    ]
  }
}
```

An invalid `cursor` returns the same envelope with `field` set to `cursor` and
`message` set to `cursor must be a valid cursor.` Validation details name only
`limit` or `cursor` and never repeat the rejected value.

Repository unavailability and Profile Query unavailability share one status,
code, and public message because the consumer action is identical. The
operation is read-only, so retrying it is safe. An empty list is never
reported as `503`, and a `503` is never reported as an empty list.

### Information Minimization

Responses must not expose:

- principal email or token claims;
- the requester identifier, or accepted, rejected, or incoming relationships;
- whether a request that is no longer pending was accepted or rejected;
- any Identity data other than `displayName`;
- raw repository or Profile Query failures;
- Identity, Prisma, PostgreSQL, NestJS, or provider internals;
- database codes, constraint names, stack traces, or filesystem paths.

A pending-only list lets the requester observe that a sent request is no
longer pending. The listing reveals no more than that: it does not distinguish
accepted from rejected, and accepted and rejected relationships are never
listed. This decision applies to this operation only. Accepted-Contact
visibility is decided separately and is not authorized by this operation.

Public error messages are selected by this contract and never copied from a
caught exception or echoed from client input.

## List Accepted Contacts

Contract state: `Implemented`

Authentication: Authenticated; results are scoped to the verified actor

```http
GET /contacts?limit=20&cursor=<opaque-cursor>
Authorization: Bearer <access-token>
```

The operation returns the accepted Contacts of the verified actor, so the user
can see who they are connected to. It is a read-only query. It does not list
Contact requests or relationships in any other state, and it does not create,
accept, reject, remove, or otherwise change a relationship.

An accepted Contact is the other party of an accepted relationship, whichever
user sent the original request. The operation does not distinguish the two
directions.

### Actor Authority

The user comes only from the `userId` produced by Identity's public
Authentication API after access-token verification. A path, query, or body
value cannot provide or override it. Undeclared query parameters, including
`userId`, `requesterId`, or `recipientId`, are ignored: the operation reads
only `limit` and `cursor`. The contract does not expose Application input
types, Domain entities, repositories, Prisma models, Identity internals,
principal email, expiration, or token claims.

Because the list is scoped to the actor, there is no addressable resource
whose existence could be hidden. The operation therefore defines no `403` or
`404` response.

### Query Parameters

| Parameter | Presence | Rule                                                                                                                                                                 |
| --------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `limit`   | Optional | A single value made only of ASCII digits whose integer value is from 1 to 50. Default `20` when absent. A larger value is rejected, not clamped.                     |
| `cursor`  | Optional | A single value previously returned as `nextCursor`. Opaque to clients; clients must not construct, parse, or modify it. A value the server cannot decode is invalid. |

A `limit` that is empty, repeated, signed, padded with whitespace,
hexadecimal, exponential, decimal, zero, negative, or above 50 is invalid. A
`cursor` that is empty, repeated, malformed, or of an unsupported version is
invalid.

The shared pagination convention in [`http.md`](http.md) owns the parameter
names, default, and maximum. This operation does not lower the maximum.

An invalid value returns `400 VALIDATION_FAILED`. When both parameters are
invalid, `limit` is validated first and the response carries exactly one
detail, for `limit`. The `401` for a missing or unusable access token takes
precedence over any `400`, because authentication runs before query
validation.

### Success

```http
200 OK
```

```json
{
  "items": [
    {
      "userId": "user-contact",
      "displayName": "Contact Name"
    }
  ],
  "nextCursor": "opaque-cursor"
}
```

| Field                 | Type             | Consumer meaning                                                                                                      |
| --------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| `items`               | array            | At most `limit` accepted Contacts of the verified actor, in the order below. Empty when there are none.               |
| `items[].userId`      | string           | The authoritative user who is the Contact. This, not `displayName`, identifies the Contact.                           |
| `items[].displayName` | string or `null` | Current presentation text from Identity's public Profile Query API. `null` when Identity has no profile for the user. |
| `nextCursor`          | string or `null` | Pass it as `cursor` to read the next page. `null` marks the end of the list.                                          |

The item carries the Contact's `userId` and `displayName` only. The
relationship identifier, the direction of the original request, the
acceptance time, and the status are omitted; see Information Minimization.
In this list a Contact is identified by `userId`. This operation does not
decide how any other operation addresses a Contact.

`displayName` is non-unique, user-controlled presentation text. It is not an
identifier and must not be used to authorize or distinguish Contacts;
clients must treat it as untrusted text. A Contact without a profile still
appears in the list with `displayName` present and `null`.

`displayName` comes only from Identity's public Profile Query API under
[`../decisions/0004-cross-context-integration.md`](../decisions/0004-cross-context-integration.md).
Chat does not copy it into Chat storage. A Profile Query failure fails the
whole request; the operation never returns a partially filled list.

### Ordering and Pagination

Items are returned in a stable, server-defined order that the response does
not expose: ascending order of the identifier of each Contact's underlying
relationship, applied to the user's accepted relationships as one sequence
regardless of which user sent the original request. For unchanged data,
consecutive pages contain no duplicates and no gaps. The order carries **no
chronological meaning**: identifiers are opaque and random, so a Contact's
position says nothing about when the relationship began, and a client cannot
reproduce the order from `userId` or `displayName`.

The list is paginated rather than bounded, as for the other Contact listings
under the shared convention in [`http.md`](http.md).

`nextCursor` is non-null exactly when more accepted Contacts exist after the
returned page and is `null` on the last page. A cursor continues after the
last returned Contact. Continuation does not require that Contact to still
exist or still be accepted, and a cursor from another actor's listing is not
an error because results stay scoped to the verified actor.

There is no snapshot guarantee. A Contact created or ended while a client
traverses the list may be missed or may disappear. A client discovers new
Contacts by restarting from the first page.

### Contacts and Conversations

The list shows the user's **current** accepted relationships. It is not the
set of people the user can converse with. A Direct Conversation does not end
when a Contact relationship ends, so a user may converse with someone who is
not, or is no longer, a Contact.

A Contact that is no longer accepted stops appearing in the list. The other
user observes that only by disappearance: the list does not say who ended a
relationship or how. Contact removal, and the identity of a relationship
established again after removal, are defined by
[Remove a Contact](#remove-a-contact), not by this operation.

### Empty Result

A user with no accepted Contacts receives:

```http
200 OK
```

```json
{
  "items": [],
  "nextCursor": null
}
```

An empty result is distinct from `503`: it confirms there is nothing to
display, not that the lookup failed.

### Error Responses

Every error uses the stable envelope defined in [`http.md`](http.md).
Non-validation errors omit `error.details`.

| Situation                                           | HTTP status | Stable code                            | Public message                                 | Consumer action                                                             |
| --------------------------------------------------- | ----------: | -------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------- |
| Authentication is missing or unusable               |         401 | `AUTHENTICATION_REQUIRED`              | Authentication is required.                    | Stop the protected interaction and reauthenticate.                          |
| `limit` is invalid                                  |         400 | `VALIDATION_FAILED`                    | Request validation failed.                     | Correct `limit`.                                                            |
| `cursor` is invalid (and `limit` is valid)          |         400 | `VALIDATION_FAILED`                    | Request validation failed.                     | Discard the cursor and restart from the first page.                         |
| Relationship lookup or Profile Query is unavailable |         503 | `ACCEPTED_CONTACT_LISTING_UNAVAILABLE` | Accepted Contacts are temporarily unavailable. | Retry the same request according to bounded client policy.                  |
| Unclassified unexpected failure                     |         500 | `INTERNAL_ERROR`                       | An unexpected error occurred.                  | Do not assume the list is complete; reload before presenting a final state. |

#### Validation Examples

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
        "field": "limit",
        "message": "limit must be an integer from 1 to 50."
      }
    ]
  }
}
```

An invalid `cursor` returns the same envelope with `field` set to `cursor` and
`message` set to `cursor must be a valid cursor.` Validation details name only
`limit` or `cursor` and never repeat the rejected value.

Repository unavailability and Profile Query unavailability share one status,
code, and public message because the consumer action is identical. The
operation is read-only, so retrying it is safe. An empty list is never
reported as `503`, and a `503` is never reported as an empty list.

### Information Minimization

Responses must not expose:

- principal email or token claims;
- the relationship identifier, the direction of the original request, the
  acceptance time, or the relationship status;
- pending or rejected relationships, or any other user's relationships;
- any Identity data other than `displayName`;
- raw repository or Profile Query failures;
- Identity, Prisma, PostgreSQL, NestJS, or provider internals;
- database codes, constraint names, stack traces, or filesystem paths.

Accepted Contacts are visible by design: a requester must be able to see who
accepted. A user who compares this list with the pending outgoing listing can
therefore infer, by elimination, that a request absent from both was rejected
or, once Contact removal exists, was accepted and later removed. This is an
inference and not a statement of the API. No response names a rejection or a
removal, and rejected and removed relationships are never listed. The contract
does not claim that a rejected or removed relationship is indistinguishable
from other absences, and this accepted limit applies to Contact-request
visibility generally. The
statement in List Outgoing Contact Requests that the pending listing does not
distinguish accepted from rejected concerns that listing only and is
unchanged.

Public error messages are selected by this contract and never copied from a
caught exception or echoed from client input.

## Remove a Contact

Contract state: `Accepted` — not implemented

Authentication: Authenticated; scoped to the verified actor's own Contacts

```http
DELETE /contacts/{contactUserId}
Authorization: Bearer <access-token>
```

This operation is a decided target. No controller, Application command,
repository operation, or test exists for it, and this section is not evidence
of an endpoint. It becomes `Implemented` only under the alignment rule in
[`chat-http.md`](chat-http.md), and current state is recorded in
[`../delivery/status.md`](../delivery/status.md).

The operation ends the accepted relationship between the verified actor and
the Contact identified by `contactUserId`. It removes one relationship. It does
not delete Conversations or Messages, does not end an existing Direct
Conversation, does not cancel a pending Contact request, and does not block
anyone. The Context rules are in [`../contexts/chat.md`](../contexts/chat.md).

### Identifier and Actor Authority

`contactUserId` is a required path parameter. It is the opaque `userId` that
`GET /contacts` returns as `items[].userId`. The relationship identifier is not
part of the route and is never exposed.

Any non-empty routed path segment is treated as an opaque string. Clients must
not infer resource type, ownership, lifecycle state, or authorization from its
format. A request without the path segment does not target this operation.

The removing actor comes only from the `userId` produced by Identity's public
Authentication API after access-token verification. A path, body, query, or
other client-controlled value cannot provide or override it. Either user of an
accepted relationship may remove it: the server resolves the unordered pair of
the verified actor and `contactUserId`, and the roles of original requester and
recipient are not consulted. The contract does not expose Application input
types, Domain entities, repositories, Prisma models, Identity internals,
principal email, expiration, or token claims.

### Request Body

This operation has no request body and defines no route-specific request DTO.
Clients should omit the body and do not need to send `Content-Type`. Parsed
JSON fields are unsupported and ignored under the shared unknown-field
convention and cannot affect the actor, identifier, authorization, transition,
or response. No operation-specific `VALIDATION_FAILED` outcome is defined
because the operation has no request fields and no identifier-format rule
beyond the required routed path segment.

### Success

Removing a current accepted Contact receives:

```http
204 No Content
```

The response has no body. Success is returned only after the removed state is
persisted. It confirms that the pair is no longer a Contact. The response
carries no relationship identifier, status, removing user, or removal time,
because the client already holds the `userId` it sent and none of the rest is
public. A client drops the Contact from its local accepted-Contact view and
reconciles by reading the accepted-Contact listing again.

### Resource Visibility

The operation follows this order:

1. Look up the current accepted relationship for the unordered pair of the
   verified actor and `contactUserId`. The Identity Directory is not consulted.
2. If there is none, return the public not-found outcome.
3. Otherwise attempt the transition from accepted to removed atomically,
   recording the removing user and the removal time.
4. Return success if the transition applied. If it did not apply because the
   relationship was no longer accepted, for example because a concurrent
   removal won, return the same public not-found outcome.

The public not-found outcome is identical whether the pair has a pending,
rejected, or already removed relationship, never had a relationship, involves a
user unknown to Identity, or is the verified actor paired with themselves. The
operation therefore cannot be used to learn whether a user exists or to
distinguish pending, rejected, or removed state. Because the Directory is not
consulted, removal has no target-lookup outcome.

A requester cannot cancel a pending request through this operation; a pending
relationship returns the not-found outcome.

### Error Responses

Every error uses the stable envelope defined in [`http.md`](http.md).
Non-validation errors omit `error.details`. Authentication is evaluated first.

| Situation                                                 | HTTP status | Stable code                   | Public message                              | Consumer action                                                                                                    |
| --------------------------------------------------------- | ----------: | ----------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Authentication is missing or unusable                     |         401 | `AUTHENTICATION_REQUIRED`     | Authentication is required.                 | Stop the protected interaction and reauthenticate.                                                                 |
| The pair has no current accepted relationship (see above) |         404 | `CONTACT_NOT_FOUND`           | Contact was not found.                      | Do not retry unchanged; treat the person as not a current Contact and return to a stable Contacts state.           |
| Relationship lookup or removal transition is unavailable  |         503 | `CONTACT_REMOVAL_UNAVAILABLE` | Contact removal is temporarily unavailable. | Do not assume completion; preserve confirmed state and retry the same route according to bounded client policy.    |
| Unclassified unexpected failure                           |         500 | `INTERNAL_ERROR`              | An unexpected error occurred.               | Do not assume whether the removal completed; reload the Contacts list before presenting a final state or retrying. |

The operation defines no `400`, `403`, or `409` response. `contactUserId` is an
opaque non-empty segment with no validation rule, every pair that is not a
current accepted Contact shares the one `404`, and a repeated or lost removal
is that same `404` rather than a conflict. `CONTACT_NOT_FOUND` is distinct from
`CONTACT_TARGET_NOT_FOUND` of Contact-request creation and from
`CONTACT_REQUEST_NOT_FOUND` of acceptance and rejection.

The transport maps stable runtime categories rather than inspecting exception
messages. Repository lookup and transition failures share the one
dependency-unavailable outcome. Public responses must not disclose raw
exception messages, database or driver codes, constraints, tables, columns,
indexes, provider or deployment details, stack traces, filesystem paths,
credentials, tokens, or internal type names. Unexpected failures remain
`500 INTERNAL_ERROR`; they must not be reported as not-found, conflict, or
success.

### Retry and Reconciliation

A `204 No Content` confirms that the pair is persisted as no longer a Contact.

After an uncertain client interruption or
`503 CONTACT_REMOVAL_UNAVAILABLE`, the client may retry the same route
according to bounded client policy:

- A later `204` confirms removal.
- A later `404 CONTACT_NOT_FOUND` means the person is not a current Contact.
  The client reconciles as removed. It cannot tell whether its own earlier
  attempt succeeded or the other user removed the Contact first, and that
  ambiguity is intentional.
- Another `503` remains retryable according to policy.

The contract does not promise automatic retries, an idempotency key, or a
success response for repeated removal. Removal is atomic: concurrent removals
of one relationship, including by both users at once, apply at most one
transition. The loser receives the same `404`, and the Contact is already
removed.

### Effect on Other Operations

- **Accepted Contact listing.** The removed Contact stops appearing for both
  users. A cursor that continued after it remains valid, as for any Contact
  that stops being accepted.
- **Contact-request creation.** A removed relationship is not current and is
  never reused. A `POST /contact-requests` for the same pair, in either
  direction and from either user, creates a new pending relationship with a new
  `id`. Creation never changes a removed relationship. If creation finds the
  accepted relationship before removal applies, it returns that accepted
  relationship with `200 OK`; if removal applies first, creation makes a new
  pending relationship.
- **Acceptance and rejection.** A removed relationship is no longer a Contact
  request. Acceptance and rejection treat its former identifier as missing and
  return `404 CONTACT_REQUEST_NOT_FOUND`. They define no removed-specific
  conflict. Removal and these operations cannot both apply to one
  relationship, because they act on accepted and pending relationships
  respectively.
- **Incoming and outgoing listings.** Unchanged. Both list pending requests
  only, and a removed relationship is never listed.
- **Conversations.** Unchanged. An existing Direct Conversation and its history
  remain and stay writable. Until a new accepted relationship exists, neither
  user can create a new Direct Conversation with the other or invite the other
  to a Group.

### Re-request After Removal

After removal, a new Contact request between the same users starts a new
pending relationship that follows the ordinary acceptance and rejection rules.
The new `id` indirectly reveals that a prior relationship existed and ended.
Unbounded re-requesting, including by the removed user, is a known abuse
exposure until the deferred rate-limiting and blocking capabilities exist. The
decision and its limits belong to [`../contexts/chat.md`](../contexts/chat.md).

### What the Other User Can Observe

The other user observes a removal only as the Contact disappearing from their
accepted-Contact listing. No response says who ended the relationship, when, or
how. A user who compares the accepted-Contact listing with the pending outgoing
listing can infer by elimination that a request absent from both was rejected
or was accepted and later removed. This is an inference and not a statement of
the API; no response names a rejection or a removal, and the contract does not
claim that either is indistinguishable from other absences.

### Information Minimization

Responses must not expose:

- principal email or token claims;
- the relationship identifier, the removed state, the removing user, or the
  removal time;
- whether the pair had a pending, rejected, or already removed relationship, or
  whether the supplied user exists;
- any Identity data;
- raw repository failures;
- Identity, Prisma, PostgreSQL, NestJS, or provider internals;
- database codes, constraint names, stack traces, or filesystem paths.

Public error messages are selected by this contract and never copied from a
caught exception or echoed from client input.

## Related Documentation

- [Shared HTTP Contract](http.md)
- [Chat HTTP Contract](chat-http.md)
- [Chat Context](../contexts/chat.md)
- [Phase 2 — Contacts and Chat](../delivery/phases/02-chat.md)
- [Current Status](../delivery/status.md)
- [Security Architecture](../architecture/security.md)
- [Cross-context Integration ADR](../decisions/0004-cross-context-integration.md)
- [HTTP Transport Placement ADR](../decisions/0008-place-http-transport-by-integration-boundary.md)
