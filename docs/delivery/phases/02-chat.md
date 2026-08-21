# Phase 2 — Contacts and Chat

Status: In progress — Contact-request core and PostgreSQL persistence implemented
Depends on: Phase 1 — Identity  
Next gate: Phase 2.5 — CI/CD and Deployment Foundation

## Objective

Deliver persistent, authenticated Direct and Group messaging between registered Huddle users.

Phase 2 introduces:

- the Chat bounded context;
- Contact relationships;
- Direct Conversations;
- Group Conversations;
- Group administration;
- persistent Messages;
- authenticated realtime messaging;
- controlled PostgreSQL and MongoDB persistence;
- the minimum Identity public capabilities required by Chat.

Calling, Meetings, Billing, and Notification are not part of this phase.

## Implementation Authority

Phase 2 may implement only the Chat capabilities authorized by this document.

Target Chat behavior is defined in:

- [`../../contexts/chat.md`](../../contexts/chat.md)
- [`../../contexts/identity.md`](../../contexts/identity.md)

The Context documents define the target behavior.

This phase defines which parts of that target may be implemented now.

The existence of a future interface, Conversation type, Integration Event, entitlement, or extension point does not authorize its early implementation.

## Entry Criteria

Phase 2 begins only after:

- Phase 1 Identity use cases are complete;
- credential authentication works;
- Google OAuth works;
- GitHub OAuth works;
- access-token verification is available;
- Identity persistence is stable;
- Phase 1 tests pass;
- the documentation migration establishes the required Context, contract, architecture, and testing documents.

Any required Identity migration for `displayName` must be explicitly designed before applying it to existing Phase 1 users.

## Required Documents by Task

| Task                   | Read these documents                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| Identity `displayName` | This phase file and `contexts/identity.md`                                                        |
| Contacts               | This phase file, `contexts/chat.md`, and `contracts/http.md`                                      |
| Direct Conversation    | This phase file, `contexts/chat.md`, and `contracts/http.md`                                      |
| Group Conversation     | This phase file, `contexts/chat.md`, and `product/tiers.md` when quota-related                    |
| Message persistence    | This phase file, `contexts/chat.md`, `architecture/data-and-consistency.md`, and ADR 0003         |
| Realtime messaging     | This phase file, `contexts/chat.md`, `contracts/chat-realtime.md`, and `architecture/security.md` |
| Identity lookup        | This phase file, `contexts/identity.md`, `contexts/chat.md`, and ADR 0004                         |
| Quota enforcement      | This phase file, `product/tiers.md`, `contexts/chat.md`, and `contexts/billing.md`                |
| Tests                  | Relevant task documents and `engineering/testing.md`                                              |

Do not load Calling, Meeting, Stripe, or Notification documents for an ordinary Phase 2 Chat task.

ADR 0003 is needed when working on the persistence strategy or its implementation boundary. ADR 0004 is needed when designing or changing a cross-context adapter, not for every Chat use case.

## Included Scope

### Minimum Identity Support

Phase 2 may extend Identity only as required by Chat.

The minimum Identity support for Phase 2 is implemented and verified:

- the accepted `displayName` model;
- valid `displayName` population for new credential registrations;
- valid `displayName` population for first-time OAuth users;
- an explicit migration or population strategy for existing Phase 1 users;
- a minimal access-token authentication capability;
- a minimal directory-existence capability;
- a minimal batched profile-query capability;
- intentional NestJS provider exports for those public capabilities.

The exact Identity rules and public DTOs come from:

`contexts/identity.md`

Chat must not read Identity:

- repositories;
- entities;
- OAuth identities;
- credentials;
- password data;
- persistence models.

Do not introduce an Identity Outbox, profile projection, event bus, or profile cache during Phase 2.

### Contacts

The Contact-request Domain/Application core and Chat-owned PostgreSQL persistence are implemented. The current implementation creates pending requests between distinct users, checks the untrusted target through a Chat-owned port, preserves dependency and persistence failures, and reuses the persisted relationship for sequential duplicate or opposing requests.

PostgreSQL enforces one current relationship per unordered user pair. Real PostgreSQL integration tests verify migration, repository mapping, unordered lookup, precise collision handling, and genuinely concurrent same-direction and opposing request convergence.

This implementation is not operational. The production Identity composition adapter, NestJS wiring, HTTP delivery, and the remaining Contacts lifecycle are still pending.

The full Phase 2 Contacts scope includes:

- send a Contact request;
- list incoming Contact requests;
- list outgoing Contact requests;
- accept a Contact request;
- reject a Contact request;
- list accepted Contacts;
- remove a Contact;
- open the existing Direct Conversation for a Contact;
- create a Direct Conversation when none exists.

Contact invariants and the relationship between Contacts and Conversations come only from:

`contexts/chat.md`

Blocking, user discovery, Contact import, and Contact quotas are not included.

### Direct Conversations

Implement:

- create or return the unique Direct Conversation for an eligible pair;
- list the requester's Conversations;
- read an authorized Direct Conversation;
- send and retrieve Direct Conversation Messages;
- concurrency-safe Direct Conversation creation;
- backend membership authorization.

Direct Conversation rules come only from:

`contexts/chat.md`

### Group Conversations

Implement:

- create a Group Conversation;
- invite an eligible Contact;
- accept or decline an invitation;
- list Group members;
- leave a Group;
- remove a member;
- grant or revoke member invitation permission;
- promote a member to administrator;
- demote a non-owner administrator;
- transfer ownership.

Group ownership, administrator authority, delegated invitation permission, invitation behavior, and leave rules come only from:

`contexts/chat.md`

### Quota Enforcement

Implement the Free and Pro Chat restrictions defined in:

`product/tiers.md`

Protected operations use a consumer-owned entitlement port.

Before real Billing exists, the Portfolio runtime binding is:

```text
Chat EntitlementsPort
→ StaticFreeEntitlementsAdapter
```

The static adapter:

- is an explicit implementation at the application composition root;
- returns deliberate Free entitlements;
- is not inline controller logic;
- is not an error fallback;
- cannot be selected by the client.

Automated tests inject both Free and Pro entitlement fixtures.

Implement the concurrency-safe transaction and bounded-retry policy defined in:

`contexts/chat.md`

The Phase file does not redefine tier values, transaction isolation, retry count, or backoff.

### Message Persistence

Implement the controlled polyglot persistence boundary selected by ADR 0003.

PostgreSQL owns relational Chat state.

MongoDB owns durable user Message entries.

Phase 2 creates the initial Chat-owned MongoDB collection for Messages.

Call timeline and Meeting timeline entries are not implemented yet, even if the collection design allows later entry types.

Implement:

- validated text Messages;
- persist-before-broadcast behavior;
- stable server-generated Message identity;
- authenticated sender authority;
- client-operation idempotency;
- bounded cursor history;
- Conversation-scoped chronological queries;
- required MongoDB schema validation;
- executable indexes supporting the implemented query patterns.

Do not introduce a distributed transaction between PostgreSQL and MongoDB.

Exact persistence behavior comes from:

- `contexts/chat.md`
- ADR 0003
- executable schema and index configuration.

### Realtime Messaging

Implement authenticated Socket.IO messaging for Phase 2 Chat.

Implement:

- authenticated connection;
- authorized Conversation-channel join;
- Message send;
- persisted Message delivery;
- invalid-payload rejection;
- unauthorized access rejection;
- duplicate-send safety;
- token-expiration handling;
- HTTP refresh followed by socket reconnect;
- reconnect without duplicating accepted Messages.

The verified principal is authoritative.

Client payloads must not supply the authoritative sender identity.

Exact event names, payloads, acknowledgements, and transport errors belong only in:

`contracts/chat-realtime.md`

### Identity Profile Resolution

Messages store `senderId`, not copied Identity profile data.

For current display needs, Chat uses the bounded Identity profile-query capability defined in:

`contexts/identity.md`

Phase 2 does not introduce:

- copied display names on every Message;
- avatar storage;
- email as ordinary Chat display data;
- Chat-owned user-profile projection;
- Identity profile Integration Events;
- Redis profile cache.

Frontend presentation decisions remain outside the Chat domain.

### HTTP Contracts

Create or update public HTTP contracts for:

- Contacts;
- Contact requests;
- Direct Conversations;
- Group Conversations;
- invitations;
- membership and Group administration;
- Message history;
- entitlement and concurrency failures.

Exact request, response, pagination, and transport-error shapes belong in:

`contracts/http.md`

## Persistence Introduced

### PostgreSQL

Add Chat-owned relational persistence for:

- Contact relationships;
- Conversations;
- memberships;
- Group ownership;
- administrators;
- invitation permissions;
- invitations;
- relational quota state.

Contact relationship persistence is implemented with a Chat-owned schema, migration, Prisma repository, and unordered current-pair uniqueness constraint. The remaining relational state above is not yet implemented.

### MongoDB

Add the initial Chat-owned collection for:

- Phase 2 user Messages.

The collection must have:

- schema validation;
- stable identifiers;
- Message idempotency enforcement;
- Conversation-local chronological indexing;
- stable cursor ordering.

### Redis

Redis may hold recoverable realtime state such as:

- socket presence;
- Conversation-channel coordination;
- short-lived connection metadata.

Redis is not the durable source of Message history.

## Cross-Context Boundary

Phase 2 uses:

```text
Chat-owned port
→ composition adapter
→ Identity public application API
```

Identity may answer whether an untrusted target identifier exists.

Chat remains responsible for:

- Contact eligibility;
- Conversation membership;
- invitation authority;
- Group administration;
- Message authorization.

The authenticated requester's verified principal does not require a redundant existence lookup.

Phase 2 does not introduce Chat Integration Events or a Chat Outbox without a real asynchronous consumer.

## Required Verification

### Domain and Application

Verify the Phase 2 portions of `contexts/chat.md`, including:

- Contact invariants;
- Direct Conversation invariants;
- Group ownership and administration;
- invitation behavior;
- ownership transfer;
- Free and Pro quota behavior;
- non-destructive downgrade behavior;
- entitlement failure before protected mutation.

### PostgreSQL Integration

Verify:

- Contact pair uniqueness;
- opposing concurrent Contact requests;
- Direct Conversation uniqueness;
- membership persistence;
- Group ownership invariants;
- concurrent quota enforcement;
- successful serialization retry;
- bounded retry exhaustion;
- application-level error translation.

Contact pair uniqueness and same-direction and opposing concurrent Contact-request convergence are implemented and verified against real PostgreSQL. The remaining items above are still required as their capabilities are implemented.

Mocks alone are insufficient for database concurrency and unique constraints.

### MongoDB Integration

Verify:

- collection schema validation;
- executable indexes;
- cursor history;
- duplicate client-operation handling;
- Conversation-local ordering;
- persist-before-broadcast behavior;
- recovery through Message history after broadcast failure.

Mocks alone are insufficient for MongoDB schema and index behavior.

### Cross-Context Integration

Verify:

- Identity directory lookup for untrusted target IDs;
- no redundant lookup for the authenticated principal;
- bounded profile query;
- minimal returned profile data;
- Chat authorization remains inside Chat;
- no imports of Identity internal layers;
- intended NestJS public provider tokens are exported.

### Realtime

Verify:

- missing, invalid, and expired access tokens;
- authenticated connection;
- unauthorized Conversation join;
- authorized Conversation join;
- sender-spoofing rejection;
- persisted Message delivery;
- duplicate-send safety;
- token-expiration disconnect;
- reconnect behavior.

## Definition of Done

Phase 2 is complete only when:

- the required Identity support is implemented and migrated safely;
- Contact use cases work;
- Direct Conversation use cases work;
- Group Conversation and administration use cases work;
- behavior matches the Phase 2 portions of `contexts/chat.md`;
- Free runtime and Pro fixture quota behavior are verified;
- quota concurrency and bounded retry behavior are verified;
- PostgreSQL and MongoDB integration tests pass;
- authenticated realtime messaging works;
- Message idempotency and persist-before-broadcast behavior work;
- no Chat code imports Identity internals;
- no client-controlled tier or sender identity exists;
- HTTP and realtime contracts are documented;
- excluded future capabilities have not been introduced;
- [`../status.md`](../status.md) is updated;
- Phase 2.5 deployment prerequisites are documented.

## Explicitly Deferred

Do not implement during Phase 2:

- Calls;
- Call signaling;
- Call timeline entries;
- WebRTC;
- mediasoup;
- coturn;
- Meeting Conversations;
- Meeting messages;
- Billing persistence;
- Stripe SDK integration;
- Stripe Checkout;
- Stripe webhooks;
- Identity profile projections;
- Identity Integration Events;
- Chat Outbox without a real consumer;
- Notification delivery;
- Slack integration;
- recording;
- anonymous guests;
- Enterprise;
- microservice extraction;
- Kubernetes.
