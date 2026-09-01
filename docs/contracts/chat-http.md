# Chat HTTP Contract

Status: Implemented
Last reviewed: 2026-09-01

## Purpose

This document is the authoritative HTTP contract for accepted and implemented
Chat endpoints.

The currently implemented subset contains only authenticated Contact-request
creation. A capability appearing in the Chat Context or Phase 2 does not create
another HTTP endpoint automatically.

## Source-of-Truth Boundary

| Concern                                     | Authoritative source                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Exact Chat HTTP contract                    | This document                                                                                      |
| Shared HTTP envelope and conventions        | [`http.md`](http.md)                                                                               |
| Contact invariants and application behavior | [`../contexts/chat.md`](../contexts/chat.md)                                                       |
| Phase authorization                         | [`../delivery/phases/02-chat.md`](../delivery/phases/02-chat.md)                                   |
| Current implementation state                | [`../delivery/status.md`](../delivery/status.md)                                                   |
| System-wide security principles             | [`../architecture/security.md`](../architecture/security.md)                                       |
| Cross-context integration                   | [`../decisions/0004-cross-context-integration.md`](../decisions/0004-cross-context-integration.md) |
| Executable behavior                         | Chat and API Gateway source code and tests                                                         |

Controller behavior, transport tests, the shared HTTP conventions, and this
document must remain aligned for the contract to retain `Implemented` state.

## Delivery State

Authenticated Contact-request creation is implemented through
`POST /contact-requests`. The runtime path includes the request DTO, public
Identity Authentication API binding, verified `userId` to requester
translation, named application errors, controller-scoped error translation,
production NestJS registration, and HTTP transport evidence.

Transport E2E boots the real `AppModule` and HTTP server while overriding only
the Authentication API, Directory API, and Chat Prisma client external seams.
It proves route, guard, validation, whitelist, success serialization, exact
status and error envelopes, and information minimization. It is not
PostgreSQL evidence. Existing Chat integration tests separately verify the
real persistence mapping, uniqueness, collision, and concurrency behavior.

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

| Field         | Type      | Consumer meaning                                                     |
| ------------- | --------- | -------------------------------------------------------------------- |
| `id`          | string    | Stable identifier for the returned Contact relationship.             |
| `requesterId` | string    | Authoritative user who originally created the pending relationship.  |
| `recipientId` | string    | Authoritative user who originally received the pending relationship. |
| `status`      | `pending` | Current status supported by this implemented endpoint subset.        |

The response contains the persisted relationship. It does not report whether
this invocation inserted a new row or reused an existing result because the
implemented use case does not return that distinction.

For an existing same-direction request, the operation returns that relationship
without creating a duplicate.

For an existing opposing request, the operation also returns `200 OK` and the
same persisted relationship. Its original `requesterId` and `recipientId` are
preserved; the roles are not reversed to match the latest caller.

Reuse is not a `409 Conflict` for this operation.

This implemented subset supports only `status: "pending"`. It does not define
reuse behavior for future accepted, rejected, removed, or other unimplemented
relationship states.

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
an existing pending relationship is a successful reusable result.

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

## Explicitly Outside This Contract

This document does not define:

- incoming or outgoing Contact-request listing;
- acceptance or rejection;
- accepted-Contact listing or removal;
- Contact blocking, discovery, import, or quotas;
- Direct or Group Conversation behavior;
- Messages, history, realtime, events, or frontend routes;
- browser token transport, cookie, CSRF, CORS, or storage policy;
- exact rate-limit values;
- any additional runtime capability outside the implemented creation endpoint.

Those capabilities require their own Phase-authorized exact contracts and
implementation outcomes.

## Related Documentation

- [Shared HTTP Contract](http.md)
- [Chat Context](../contexts/chat.md)
- [Phase 2 — Contacts and Chat](../delivery/phases/02-chat.md)
- [Current Status](../delivery/status.md)
- [Security Architecture](../architecture/security.md)
- [Cross-context Integration ADR](../decisions/0004-cross-context-integration.md)
