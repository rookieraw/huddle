# Chat Context

Status: Accepted target; Phase 2 Contact-request core and PostgreSQL persistence implemented  
Last reviewed: 2026-08-21

## Responsibility

Chat owns persistent user communication and conversation authorization.

Chat owns:

- Contact relationships
- Direct conversations
- Group conversations
- Meeting conversations
- Conversation memberships
- Group ownership and administration
- Invitations
- Messages
- Conversation timeline entries

Chat does not own:

- Authentication
- Identity credentials
- CallSession or Meeting lifecycle
- Effective subscription state
- Notification delivery

## Delivery State

| Capability                   | Delivery phase |
| ---------------------------- | -------------- |
| Contacts                     | Phase 2        |
| Direct conversations         | Phase 2        |
| Group conversations          | Phase 2        |
| Messages and realtime Chat   | Phase 2        |
| Call timeline integration    | Phase 3        |
| Meeting conversations        | Phase 5        |
| Notification producer events | Phase 6        |

The Phase 2 Contact-request Domain/Application core and Chat-owned PostgreSQL persistence are implemented and tested. Current behavior covers pending request creation, invalid-target rejection, dependency and persistence failure preservation, sequential duplicate reuse, and opposing-request role preservation.

The database constraint enforces one current relationship per unordered user pair. Real PostgreSQL integration tests cover migration, repository mapping, unordered lookup, precise uniqueness-collision handling, and genuinely concurrent same-direction and opposing request convergence.

The API Gateway-owned production Identity composition adapter now connects the Chat-owned target-directory port to Identity's public Directory API. This capability is not yet operational: NestJS and HTTP delivery, the remaining Contacts lifecycle, and frontend delivery are pending.

Accepted target behavior does not imply current implementation.

## Core Concepts

### ContactRelationship

Represents the relationship between two registered Huddle users.

Relevant states are equivalent to:

- Pending
- Accepted
- Rejected or removed according to the use case

Required invariants:

- A user cannot contact themselves.
- One unordered user pair has at most one current relationship.
- Duplicate requests do not create duplicate relationships.
- Opposing simultaneous requests converge on one relationship.
- Only the recipient may accept or reject a pending request.
- Removing a contact does not delete conversations or messages.
- An existing direct conversation remains writable after contact removal.
- Blocking is a separate deferred capability.

Contacts and conversations are separate concepts.

### Conversation

Conversation types are:

- `DIRECT`
- `GROUP`
- `MEETING`

All messages belong to one Conversation.

Conversation type determines membership and lifecycle rules.

### ConversationMembership

Membership grants Chat access according to the Conversation type.

Chat is authoritative for:

- Message-send eligibility
- History-read eligibility
- Conversation-list eligibility
- Group administration
- Meeting-chat visibility boundary

Identity existence does not grant Chat membership.

## Direct Conversations

A Direct Conversation:

- Has exactly two members.
- Is unique for an unordered user pair.
- Has no owner or administrator.
- Does not consume group quota.
- Cannot be converted into another Conversation type.

Creating a new Direct Conversation requires an accepted ContactRelationship.

Concurrent creation requests must converge on one Conversation.

After creation, removing the ContactRelationship:

- Preserves the Direct Conversation.
- Preserves history.
- Does not make the Conversation read-only.
- Does not prevent continued messaging.

A future Block capability may change communication eligibility through a separate accepted policy.

## Group Conversations

A Group Conversation has:

- One owner
- One or more active members
- Zero or more additional administrators
- Per-member invitation permission

### Owner

The owner:

- Is always an active member.
- Is always an administrator.
- Cannot be demoted.
- Cannot be removed.
- Must transfer ownership before leaving.

Ownership transfer requires:

- Current owner authorization
- Active recipient membership
- Recipient eligibility under the owned-group entitlement
- Atomic owner replacement

The owner remains unchanged when validation or persistence fails.

### Administrators

An administrator may:

- Promote an active member to administrator
- Demote another non-owner administrator
- Remove any non-owner member, including another administrator
- Perform other explicitly documented group-management operations

An administrator cannot:

- Demote the owner
- Remove the owner
- Transfer ownership unless they are the owner

### Invitation Permission

A non-administrator member may receive:

```text
canInviteMembers = true
```

This permits the member to invite their own accepted contacts.

It does not grant:

- Member removal
- Administrator management
- Ownership transfer
- Other administrative authority

### Invitations

A Group invitation:

- Targets an existing registered user.
- May be issued only by an authorized member.
- Requires the inviter and target to satisfy the accepted contact rule.
- Does not immediately create membership.
- May be accepted or declined.
- Is idempotent for the relevant group and target.

Pending invitations do not consume member capacity.

Acceptance:

- Rechecks current invitation validity.
- Rechecks target eligibility.
- Rechecks group capacity.
- Creates at most one membership.
- Fails safely if capacity was consumed after invitation creation.

## Meeting Conversations

A Meeting Conversation:

- Has type `MEETING`.
- References one Meeting.
- Is created from a Conferencing Integration Event.
- Never converts into a Group Conversation.
- Does not consume owned-group or group-member quota.

### Formally Invited User

A formal Meeting invitation grants Chat eligibility immediately.

RSVP acceptance or decline does not remove that eligibility.

The user may chat:

- Before the Meeting
- During the Meeting
- After completion

Revocation removes future access without deleting messages already sent.

### Link-admitted User

A user admitted through the lobby receives a membership visibility boundary:

```text
historyVisibleFrom = admission time
```

The backend must prevent access to earlier messages.

### Lifecycle Projection

Chat applies Conferencing-owned lifecycle facts:

| Meeting lifecycle   | Chat behavior                                       |
| ------------------- | --------------------------------------------------- |
| Available or active | Eligible participants may write                     |
| Completed           | Existing eligible participants may continue writing |
| Canceled            | Read-only                                           |
| Archived            | Read-only                                           |

After completion:

- Existing eligibility is preserved.
- No new participant is added.
- The Conversation remains type `MEETING`.

## Quotas

Authoritative tier values are defined only in:

```text
product/tiers.md
```

Chat enforces entitlements for:

- Owned Group Conversation creation
- Group member addition
- Invitation acceptance
- Ownership transfer

The normal invariant is:

```text
Growth is allowed only when current usage < effective limit.
```

Existing over-quota resources are preserved.

Reaching exactly the limit remains at quota.

Meeting Conversations are excluded from Group quotas.

## Quota Concurrency

Quota check and protected PostgreSQL mutation execute in a `SERIALIZABLE` transaction.

Retry policy:

```text
Maximum: 3 total attempts
Retry only: PostgreSQL serialization failure (40001)
Strategy: exponential backoff with jitter
```

Illustrative delay bounds:

```text
Attempt 1: immediate
Attempt 2: random delay up to 50 ms
Attempt 3: random delay up to 100 ms
```

After exhausted retries, infrastructure returns an application-level concurrent quota error.

Do not automatically retry:

- Validation failure
- Authorization failure
- Confirmed quota failure
- Unique-constraint failure
- Unrelated database failure

PostgreSQL error codes do not escape the infrastructure boundary.

## Entitlement Failure

When Billing cannot determine effective entitlements:

- Protected growth fails closed.
- No protected mutation occurs.
- The failure is not interpreted as Free or Pro.

Unrelated behavior remains available where possible:

- Existing eligible message send
- Existing history read
- Existing Conversation read

Before Phase 4, the runtime uses the explicit Static Free entitlement adapter.

## Persistence Ownership

### PostgreSQL

Chat stores relational state in PostgreSQL:

- Contact relationships
- Conversations
- Memberships
- Group ownership
- Administrators
- Invitation permission
- Invitations
- Relational quota state

Contact relationship persistence is implemented in the Chat Context. Conversation, membership, Group administration, invitation, and quota persistence remain target behavior.

### MongoDB

Chat stores append-oriented Conversation entries in one initial Chat-owned collection:

- User messages
- Call timeline entries
- Meeting timeline entries where required

Required persistence behavior:

- Schema validation
- Stable identifiers
- Conversation-local chronological index
- Stable cursor ordering
- Client-message idempotency
- Integration-event idempotency

Exact schemas and indexes remain executable persistence concerns and must match this model.

## Message Send

Initial user messaging supports validated text messages.

Accepted sequence:

```text
Authenticate
→ authorize Conversation membership
→ validate command
→ persist Message in MongoDB
→ broadcast persisted Message
```

The server supplies:

- Authoritative sender from the verified principal
- Accepted timestamp
- Message identifier

The client supplies a retry-safe client message identifier.

Idempotency scope is equivalent to:

```text
conversationId
+ authenticated senderId
+ clientMessageId
```

A duplicate retry:

- Does not create a second Message.
- Does not produce a second accepted broadcast.
- Resolves to the existing accepted result.

If persistence succeeds but broadcast fails, the Message remains accepted and is recoverable through history.

## Message History

History uses bounded cursor pagination.

Required properties:

- Conversation-scoped query
- Stable chronological order
- Duplicate-timestamp disambiguation
- Validated cursor
- Bounded page size
- Membership authorization
- Meeting history-boundary enforcement

Offset pagination is not the primary Message-history strategy.

## Timeline Idempotency

A call timeline entry uses a stable key:

```text
call:<sessionId>
```

A Meeting projection uses an equivalent stable Meeting identity.

Provider lifecycle version prevents an older event from replacing newer Chat state.

Chat is authoritative for the timeline document.

Conferencing remains authoritative for CallSession and Meeting lifecycle.

## Conversation-list Projection

Conversation summary data may lag behind accepted MongoDB entries.

Accepted consistency:

```text
MongoDB entry accepted
→ Conversation-list summary updated eventually
```

A stale summary does not invalidate the Message.

The exact projection mechanism is introduced only when its query requirement is implemented.

## Cross-context Capabilities

### Identity

Chat uses:

- Authentication verification
- Directory existence lookup for untrusted target IDs
- Batched profile query for `userId` and `displayName`

Chat does not receive Identity email or credentials for ordinary presentation.

### Billing

Chat uses effective entitlement DTOs for protected growth.

Chat owns quota enforcement.

### Conferencing

Chat exposes minimal Conversation access facts required for call authorization.

Chat consumes versioned lifecycle Integration Events for:

- Call timeline
- Meeting Conversation
- Meeting membership
- Meeting writable or read-only state

Neither context imports the other’s internal library layers.

### Notification

Phase 6 may consume selected Chat-owned Integration Events, such as Contact or Group invitation facts.

Chat adds an Outbox only for events with a real consumer.

## Realtime Rules

Socket.IO behavior follows:

- Token from `handshake.auth.accessToken`
- Trusted principal stored on socket state
- No authoritative sender ID in event payload
- Membership checked before room join
- Membership checked before message send
- Token expiration disconnect
- HTTP refresh followed by reconnect

Exact event names and payloads belong only to:

```text
contracts/chat-realtime.md
```

## Public Conversation Access Capability

Conferencing may query a minimal Chat public capability for facts equivalent to:

- Conversation exists
- Conversation type
- User is an active member
- User is eligible for a conversation call

This capability does not expose:

- Conversation aggregate
- Membership entity
- Message repository
- Message history
- Group administration internals

## Error Categories

Chat distinguishes:

| Category                        | Meaning                                                |
| ------------------------------- | ------------------------------------------------------ |
| Validation                      | Input violates the accepted contract                   |
| Authorization                   | Actor lacks Chat permission                            |
| Not found                       | Requested Chat resource is unavailable to the use case |
| Quota exceeded                  | Effective limit is definitely reached                  |
| Concurrent quota update         | Serializable retries were exhausted                    |
| Entitlements unavailable        | Effective entitlement cannot be determined             |
| Message persistence unavailable | Durable Message could not be accepted                  |
| Duplicate operation             | Existing idempotent result should be used              |

Transport mappings belong to contract documents.

## Required Tests

Critical tests include:

- Contact pair uniqueness
- Opposing Contact requests
- Direct Conversation uniqueness
- Continued messaging after Contact removal
- Owner invariants
- Administrator authority
- Invitation permission
- Invitation acceptance at capacity
- Ownership transfer quota
- Free and Pro quota behavior
- Serializable conflict and exhausted retry
- MongoDB schema and indexes
- Cursor history
- Duplicate client message
- Persist-before-broadcast
- Meeting history boundary
- Duplicate and out-of-order timeline events
- Cross-context boundary enforcement

## Deferred

Chat does not currently include:

- Blocking
- User discovery
- Message editing
- Message deletion
- File attachments
- Reactions
- Threads
- Full-text search
- Read receipts
- Typing indicators unless separately authorized
- User-profile projection
- MongoDB change streams
- Sharding

These require explicit delivery authorization.

## Source-of-truth Boundaries

This document is the source of truth for:

- Contact and Conversation invariants
- Group ownership and administration
- Meeting Conversation behavior
- Chat quota enforcement
- Chat retry policy
- Message and timeline persistence behavior
- Chat cross-context capabilities

This document is not the source of truth for:

- Tier values
- HTTP payloads
- Realtime payloads
- Exact database schema
- Exact index definitions
- Current implementation status

Those concerns belong to Product, Contracts, code, migrations, tests, and Delivery documentation.
