# Chat Realtime Contract

Status: Accepted Phase 2 contract; not yet implemented  
Last reviewed: 2026-08-07

## Purpose

This document defines Huddle's Socket.IO contract for realtime Chat.

It owns:

- namespace;
- connection authentication;
- Conversation subscription;
- text Message send;
- persisted Message delivery;
- acknowledgements;
- transport error codes;
- token-expiration and reconnection behavior.

It does not define:

- Contact or Group management HTTP operations;
- Message-history HTTP pagination;
- Conferencing signaling;
- Integration Event payloads;
- Chat domain invariants.

Those concerns belong to their respective contract and Context documents.

---

## Delivery Boundary

Phase 2 implements:

- authenticated connection;
- authorized Conversation subscription;
- text Message send;
- persisted Message delivery;
- duplicate-send safety;
- token-expiration disconnect;
- reconnect and history recovery.

Phase 2 does not implement realtime events for:

- Call lifecycle;
- Meeting lifecycle;
- typing indicators;
- read receipts;
- Message editing;
- Message deletion;
- reactions;
- file upload;
- presence UI;
- member online status.

Later phases must update this contract before adding those events.

---

## Namespace

Chat uses:

```text
/chat
```

Example client connection:

```typescript
const socket = io(`${apiOrigin}/chat`, {
  auth: {
    accessToken,
  },
});
```

Access tokens must not be sent through:

- query parameters;
- event payloads;
- Socket.IO room names;
- URL fragments.

---

## Authentication

The connection handshake uses:

```typescript
type ChatHandshakeAuth = {
  accessToken: string;
};
```

Accepted connection sequence:

```text
Read handshake.auth.accessToken
→ verify through Identity authentication capability
→ create minimal trusted principal
→ attach principal to socket state
→ accept connection
```

The trusted socket principal is conceptually:

```typescript
type ChatSocketPrincipal = {
  userId: string;
  expiresAt: string;
};
```

The exact server-side representation remains an implementation detail.

The socket must not store or expose:

- raw password;
- refresh token;
- OAuth provider token;
- password hash;
- Billing data.

## Authentication Failure

An invalid handshake is rejected through Socket.IO's standard `connect_error` behavior.

The public error data is:

```typescript
type ChatConnectionError = {
  code: 'AUTHENTICATION_FAILED';
  message: string;
};
```

The message must not distinguish unnecessarily between:

- malformed token;
- invalid signature;
- expired token;
- missing user;
- unsupported token.

Provider and infrastructure details must not be exposed.

---

## Event Naming

Event names use:

```text
resource:action
```

Phase 2 events are:

### Client to Server

```text
conversation:join
conversation:leave
message:send
```

### Server to Client

```text
conversation:access-revoked
message:created
auth:expired
```

Socket.IO's acknowledgement callback carries the result of client commands.

The server does not emit a generic global error event for ordinary command failures.

---

## Acknowledgement Envelope

Every acknowledged client command uses one of these shapes.

### Success

```typescript
type RealtimeSuccess<T> = {
  ok: true;
  data: T;
};
```

### Failure

```typescript
type RealtimeFailure = {
  ok: false;
  error: {
    code: ChatRealtimeErrorCode;
    message: string;
    retryable: boolean;
  };
};
```

Error codes:

```typescript
type ChatRealtimeErrorCode =
  | 'INVALID_PAYLOAD'
  | 'AUTHENTICATION_EXPIRED'
  | 'CONVERSATION_UNAVAILABLE'
  | 'CONVERSATION_ACCESS_DENIED'
  | 'CONVERSATION_NOT_JOINED'
  | 'MESSAGE_PERSISTENCE_UNAVAILABLE'
  | 'INTERNAL_ERROR';
```

Infrastructure codes and stack traces must not appear in the acknowledgement.

---

# Conversation Subscription

## Join Conversation

Client event:

```text
conversation:join
```

Payload:

```typescript
type JoinConversationCommand = {
  conversationId: string;
};
```

Success acknowledgement:

```typescript
type JoinConversationResult = {
  conversationId: string;
};
```

Example:

```json
{
  "ok": true,
  "data": {
    "conversationId": "conversation-id"
  }
}
```

Before joining the Socket.IO room, the server must:

1. authenticate the socket;
2. validate the payload;
3. load the current Chat authorization facts;
4. confirm that the requester may access the Conversation;
5. join the internal Socket.IO room.

Possessing a `conversationId` does not prove membership.

A Socket.IO room name is transport state, not authorization state.

## Join Errors

| Situation                                | Code                         | Retryable                        |
| ---------------------------------------- | ---------------------------- | -------------------------------- |
| Invalid payload                          | `INVALID_PAYLOAD`            | No                               |
| Token expired                            | `AUTHENTICATION_EXPIRED`     | After HTTP refresh and reconnect |
| Conversation unavailable to requester    | `CONVERSATION_UNAVAILABLE`   | No                               |
| Current Chat authorization denies access | `CONVERSATION_ACCESS_DENIED` | No                               |
| Unexpected dependency or server failure  | `INTERNAL_ERROR`             | Yes                              |

The public interface may use `CONVERSATION_UNAVAILABLE` when distinguishing not-found from forbidden would reveal protected resource existence.

---

## Leave Conversation

Client event:

```text
conversation:leave
```

Payload:

```typescript
type LeaveConversationCommand = {
  conversationId: string;
};
```

Success acknowledgement:

```typescript
type LeaveConversationResult = {
  conversationId: string;
};
```

Leaving the Socket.IO room:

- does not leave the Chat Conversation;
- does not remove membership;
- does not delete Messages;
- does not change Group state.

It only stops realtime delivery to that socket for the selected Conversation.

Leaving an already-unjoined transport room should converge on the same successful result.

---

## Access Revoked

Server event:

```text
conversation:access-revoked
```

Payload:

```typescript
type ConversationAccessRevokedEvent = {
  conversationId: string;
  reason: 'MEMBERSHIP_ENDED' | 'CONVERSATION_UNAVAILABLE';
};
```

When current access is revoked, the server should:

1. remove affected sockets from the internal Conversation room;
2. emit `conversation:access-revoked` where possible;
3. reject later protected operations.

Delivery of this event is a user-experience aid.

It is not the authorization mechanism. Every protected operation still checks current Chat authorization.

---

# Message Send

## Send Text Message

Client event:

```text
message:send
```

Payload:

```typescript
type SendMessageCommand = {
  conversationId: string;
  clientMessageId: string;
  text: string;
};
```

Field rules:

| Field             | Rule                                                             |
| ----------------- | ---------------------------------------------------------------- |
| `conversationId`  | Required opaque Conversation identifier                          |
| `clientMessageId` | Required client-generated UUID retained across retries           |
| `text`            | Required string containing at least one non-whitespace character |
| `text` maximum    | 5,000 characters                                                 |

The client must not send:

- `senderId`;
- accepted timestamp;
- server Message identifier;
- display name;
- tier;
- Conversation membership;
- authoritative Message status.

The server obtains the sender from the trusted socket principal.

## Accepted Processing Order

```text
Authenticate socket
→ validate command
→ verify current Conversation authorization
→ verify socket joined the Conversation channel
→ apply client-message idempotency
→ persist Message in MongoDB
→ acknowledge accepted Message
→ broadcast persisted Message
```

Persistence must occur before accepted acknowledgement and broadcast.

No distributed transaction is introduced between MongoDB and Socket.IO.

---

## Message View

A successfully accepted Message uses:

```typescript
type ChatMessageView = {
  id: string;
  conversationId: string;
  senderId: string;
  clientMessageId: string;
  type: 'TEXT';
  text: string;
  createdAt: string;
};
```

Example:

```json
{
  "id": "message-id",
  "conversationId": "conversation-id",
  "senderId": "user-id",
  "clientMessageId": "39dc2045-c3e7-4e75-bbab-c901d3a1d02e",
  "type": "TEXT",
  "text": "Hello",
  "createdAt": "2026-08-07T12:34:56.000Z"
}
```

The Message payload deliberately does not copy:

- Identity email;
- password data;
- OAuth data;
- avatar;
- stored display name.

Presentation data is resolved through the bounded Identity profile-query capability and appropriate Conversation views.

The frontend decides how safe profile data is rendered.

---

## Send Success Acknowledgement

Success returns the accepted Message:

```typescript
type SendMessageResult = ChatMessageView;
```

Example:

```json
{
  "ok": true,
  "data": {
    "id": "message-id",
    "conversationId": "conversation-id",
    "senderId": "user-id",
    "clientMessageId": "39dc2045-c3e7-4e75-bbab-c901d3a1d02e",
    "type": "TEXT",
    "text": "Hello",
    "createdAt": "2026-08-07T12:34:56.000Z"
  }
}
```

The server also emits `message:created` to authorized subscribed sockets, including other active sockets belonging to the sender.

Clients must upsert Messages by server Message identifier because the originating client may observe both:

- the acknowledgement;
- the broadcast.

---

## Message Created

Server event:

```text
message:created
```

Payload:

```typescript
type MessageCreatedEvent = ChatMessageView;
```

The event is emitted only after durable Message persistence succeeds.

This Socket.IO event is a transport notification.

It is not the Chat Domain Event or a cross-context Integration Event contract.

---

## Idempotent Retry

The Message idempotency scope is:

```text
conversationId
+ authenticated senderId
+ clientMessageId
```

When the same logical send is retried:

- no second Message is created;
- the existing accepted Message is returned;
- no second accepted broadcast is produced;
- the original accepted server timestamp remains authoritative.

A `clientMessageId` must not be reused for different Message content or a different Conversation.

If the server cannot determine whether a disconnected attempt completed, the client retries using the same `clientMessageId`.

The client must not generate a new identifier merely because an acknowledgement was lost.

---

## Send Errors

| Situation                                    | Code                              | Retryable                            |
| -------------------------------------------- | --------------------------------- | ------------------------------------ |
| Invalid identifier or text                   | `INVALID_PAYLOAD`                 | No                                   |
| Token expired                                | `AUTHENTICATION_EXPIRED`          | After HTTP refresh and reconnect     |
| Conversation unavailable                     | `CONVERSATION_UNAVAILABLE`        | No                                   |
| Current membership does not permit send      | `CONVERSATION_ACCESS_DENIED`      | No                                   |
| Socket did not join the Conversation         | `CONVERSATION_NOT_JOINED`         | Yes, after joining                   |
| MongoDB could not durably accept the Message | `MESSAGE_PERSISTENCE_UNAVAILABLE` | Yes, with the same `clientMessageId` |
| Unknown server failure                       | `INTERNAL_ERROR`                  | Yes, with the same `clientMessageId` |

When persistence fails:

- the server must not return success;
- the server must not emit `message:created`;
- the client may retry with the same operation identity.

When persistence succeeds but broadcast fails:

- the Message remains accepted;
- the acknowledgement may still succeed;
- the Message is recoverable through HTTP history;
- reconnect must not create another Message.

---

# Token Expiration

## Expired Authentication Event

Server event:

```text
auth:expired
```

Payload:

```typescript
type ChatAuthenticationExpiredEvent = {
  code: 'AUTHENTICATION_EXPIRED';
};
```

When the access token expires:

1. emit `auth:expired` when possible;
2. disconnect the socket;
3. reject subsequent events from that connection.

The socket must not accept a refresh token.

The client refreshes through HTTP:

```text
POST /auth/refresh
```

Then reconnects with the new access token.

Token refresh does not mutate the authentication state of an existing socket.

---

# Reconnection

After connection loss, the client:

1. determines which Messages were acknowledged;
2. retries unconfirmed sends with their original `clientMessageId`;
3. reconnects with a valid access token;
4. rejoins required Conversations;
5. retrieves Message history through HTTP using its last durable cursor or known Message position;
6. upserts returned Messages by server identifier.

A socket reconnect does not imply that:

- Conversation rooms were restored;
- Message history was replayed automatically;
- membership remains unchanged;
- an unacknowledged Message failed.

The HTTP history query is the durable recovery path.

---

# Ordering

Socket.IO delivery order does not replace durable Message ordering.

The authoritative history order uses the Chat persistence contract and stable cursor ordering.

Message ordering must distinguish equal timestamps through a stable secondary value such as the server Message identifier.

Clients must not use local receipt time as the authoritative Conversation order.

Realtime delivery may temporarily arrive after a newer local UI action. Clients reconcile with the persisted Message view.

---

# Authorization Changes

The server rechecks current authorization before every `message:send`.

Joining once does not permanently authorize future sends.

Examples requiring current authorization checks include:

- Group member removed;
- Group member leaves;
- Meeting Conversation becomes unavailable;
- Conversation access changes during reconnect.

Transport-room membership must never override Chat-owned membership.

Direct Conversation behavior after Contact removal follows the Chat Context: the preserved Direct Conversation remains usable by its participants.

---

# Payload and Privacy Rules

Realtime payloads must not contain:

- access or refresh tokens;
- passwords;
- Identity email for ordinary Chat presentation;
- OAuth provider data;
- Billing Subscription entities;
- client-provided authoritative sender identity;
- full internal domain aggregates;
- MongoDB driver objects;
- stack traces.

Private Message content must not be written indiscriminately to application logs.

Safe diagnostics may include:

- correlation identifier;
- Conversation identifier;
- Message identifier;
- authenticated user identifier;
- client Message identifier;
- error category.

---

# Required Tests

## Connection

Test:

- valid access token;
- missing token;
- invalid token;
- expired token;
- token supplied incorrectly through query parameters;
- disconnect at token expiry;
- HTTP refresh followed by reconnect.

## Conversation Subscription

Test:

- active member joins;
- non-member rejected;
- hidden Conversation does not leak existence;
- repeated leave is safe;
- access revocation removes realtime delivery;
- later send rechecks membership.

## Message Send

Test:

- accepted text Message;
- authoritative sender comes from socket principal;
- client-supplied sender field is ignored or rejected;
- empty and whitespace-only text rejected;
- text beyond maximum rejected;
- Message persisted before broadcast;
- MongoDB failure produces no accepted broadcast;
- broadcast failure preserves the Message;
- sender's other socket receives the Message.

## Idempotency

Test:

- same `clientMessageId` creates one Message;
- duplicate retry returns the original Message;
- duplicate retry does not rebroadcast;
- same `clientMessageId` cannot represent unrelated content;
- reconnect retry converges on the accepted Message.

## Recovery

Test:

- reconnect requires Conversation rejoin;
- HTTP history recovers a missed broadcast;
- client upsert handles acknowledgement and broadcast of the same Message;
- equal timestamps retain stable history ordering.

---

# Explicitly Deferred Events

The following event names are not reserved as active contracts:

```text
typing:start
typing:stop
message:read
message:edit
message:delete
message:react
presence:update
member:online
member:offline
```

Phase 3 and Phase 5 may introduce Chat timeline transport behavior only when a real frontend consumer requires it.

Shared Conferencing connection, participant, and lifecycle events remain in:

```text
contracts/conferencing-realtime.md
```

Capability-specific signaling remains in:

- Direct Call P2P signaling: `contracts/conferencing-p2p.md`
- Group Call and Meeting SFU signaling: `contracts/conferencing-sfu.md`
- Meeting lobby and Meeting state: `contracts/meeting-realtime.md`

Chat realtime events must not duplicate any Conferencing signaling contract.

Cross-context lifecycle facts must remain in:

```text
contracts/integration-events.md
```

---

# Legacy Mapping Note

The legacy documents used:

```text
join-room
leave-room
send-message
message-received
```

The new contract replaces those names with:

```text
conversation:join
conversation:leave
message:send
message:created
```

Reason:

- Chat's domain term is `Conversation`;
- `room` is ambiguous between Group Conversation, Socket.IO room, Call, and Meeting;
- namespaced events are easier to extend without collision;
- `message:created` identifies an accepted persisted result rather than an uncommitted send attempt.

Legacy `member-joined`, `member-left`, `call-started`, and `call-ended` events are not carried into Phase 2.

They require a real consumer and an owning Phase before becoming public realtime contracts.

---

# Source-of-Truth Boundaries

This document is the source of truth for:

- `/chat` namespace;
- Chat handshake shape;
- Phase 2 event names;
- event payloads;
- acknowledgement envelopes;
- realtime error codes;
- Message-send retry behavior;
- token expiration and reconnect behavior.

This document is not the source of truth for:

- Contact and Conversation invariants;
- Group authorization;
- Message database schema;
- HTTP Message-history cursor;
- Identity token issuance;
- Call or Meeting signaling;
- cross-context Integration Events;
- current implementation status.

Those concerns belong to Context documents, other contracts, executable persistence, tests, and `delivery/status.md`.
