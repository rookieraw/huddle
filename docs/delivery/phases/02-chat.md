# Phase 2 — Contacts and Chat

Status: In progress — Contact-request creation and Application acceptance implemented; HTTP acceptance contract accepted
Depends on: Phase 1 — Identity  
Next gate: Phase 2.5 — CI/CD and Deployment Foundation

## Objective

Deliver persistent, authenticated Direct and Group messaging between registered Huddle users through the backend and responsive web experience required to operate it.

Phase 2 introduces:

- the Chat bounded context;
- Contact relationships;
- Direct Conversations;
- Group Conversations;
- Group administration;
- persistent Messages;
- authenticated realtime messaging;
- controlled PostgreSQL and MongoDB persistence;
- the minimum Identity public capabilities required by Chat;
- the frontend foundation and user-visible Contacts and Chat journey.

Calling, Meetings, Billing, and Notification are not part of this phase.

## Implementation Authority

Phase 2 may implement only the Chat and user-visible capabilities authorized by this document.

Target behavior is defined in:

- [`../../contexts/chat.md`](../../contexts/chat.md)
- [`../../contexts/identity.md`](../../contexts/identity.md)
- [`../../product/user-experience.md`](../../product/user-experience.md)

The Context documents define Domain and public-capability behavior.

The User Experience document defines cross-capability experience principles.

This phase defines which parts of those targets may be implemented now.

The existence of a future interface, journey, navigation seam, Conversation type, Integration Event, entitlement, or extension point does not authorize its early implementation.

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

A completed Phase 1 backend does not automatically establish a browser-safe Authentication flow. The applicable frontend gate in this document must be satisfied before Authentication UI implementation begins.

## Required Documents by Task

| Task                   | Read these documents                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity `displayName` | This phase file and `contexts/identity.md`                                                                                                     |
| Contacts               | This phase file, `contexts/chat.md`, `contracts/http.md`, and `contracts/chat-http.md`                                                         |
| Direct Conversation    | This phase file, `contexts/chat.md`, and `contracts/http.md`                                                                                   |
| Group Conversation     | This phase file, `contexts/chat.md`, and `product/tiers.md` when quota-related                                                                 |
| Message persistence    | This phase file, `contexts/chat.md`, `architecture/data-and-consistency.md`, and ADR 0003                                                      |
| Realtime messaging     | This phase file, `contexts/chat.md`, `contracts/chat-realtime.md`, and `architecture/security.md`                                              |
| Identity lookup        | This phase file, `contexts/identity.md`, `contexts/chat.md`, and ADR 0004                                                                      |
| Quota enforcement      | This phase file, `product/tiers.md`, `contexts/chat.md`, and `contexts/billing.md`                                                             |
| Frontend experience    | This phase file, `product/user-experience.md`, applicable HTTP or realtime contracts, `architecture/security.md`, and `engineering/testing.md` |
| Tests                  | Relevant task documents and `engineering/testing.md`                                                                                           |

Do not load Calling, Meeting, Stripe, or Notification documents for an ordinary Phase 2 Chat or frontend task.

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

The Contact-request Domain/Application core and Chat-owned PostgreSQL
persistence are implemented. The Domain supports recipient-only
pending-to-accepted transition, and the repository persists and reloads pending
or accepted relationships. The existing creation use case creates pending
requests between distinct users, checks the untrusted target through a
Chat-owned port, classifies target-lookup and repository unavailability, and
reuses a pending or accepted current relationship for sequential duplicate or
opposing requests.

The Application acceptance command loads an existing relationship by opaque
identifier, uses only the accepting actor `userId` as authority, permits only
the original recipient to accept it while pending, and saves the accepted
state. Named Application outcomes distinguish missing relationships,
unauthorized actors, repeated acceptance, and repository unavailability.

PostgreSQL enforces one pending-or-accepted current relationship per unordered user pair. Real PostgreSQL integration tests verify additive migration, exact status enforcement, repository mapping, unordered lookup, precise collision handling, and genuinely concurrent same-direction and opposing request convergence.

The API Gateway application composition boundary now delivers authenticated
Contact-request creation over HTTP and truthfully returns a reused pending or
accepted current relationship. The exact route, requester authority,
validation, response, error, and evidence boundaries belong to
[`../../contracts/chat-http.md`](../../contracts/chat-http.md). The Application
acceptance command now has an accepted exact HTTP contract, but it is not yet
composed or delivered over HTTP. Its API Gateway composition, endpoint,
transport evidence, and frontend flow remain pending, as do the remaining
Contacts lifecycle capabilities.

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

Shared HTTP conventions belong in `contracts/http.md`. Exact request, response,
pagination, and transport-error shapes belong in the owning Context-specific
HTTP contract, including `contracts/chat-http.md` for Chat.

The first Phase 2 Chat controller and exact contract are implemented. Before
an additional Chat controller or consuming frontend slice:

- the stable shared error envelope must be accepted;
- its exact Chat HTTP contract must be created;
- the implemented subset must be registered;
- applicable pagination behavior must be defined.

A target user journey is not an HTTP contract.

### Frontend Experience

Phase 2 establishes the responsive web foundation required to operate its authorized Identity, Contacts, Conversation, Message, and realtime behavior.

The target journey is:

```text
Authentication
→ Contacts
→ Direct or Group Conversation
→ Message history
→ realtime Message delivery
→ reconnect and durable reconciliation
```

Cross-capability experience principles belong to:

[`../../product/user-experience.md`](../../product/user-experience.md)

The frontend:

- consumes only accepted public HTTP and realtime contracts;
- treats the backend as authoritative for identity, authorization, membership, roles, entitlements, persistence, and lifecycle state;
- distinguishes pending, confirmed, failed, unavailable, disconnected, reconnecting, and reconciled states where applicable;
- preserves the distinction between Contacts and Conversations;
- does not expose later-Phase capabilities as available;
- does not invent conventional account features absent from Product Scope.

Phase 2 may expose implemented Phase 1 Authentication behavior through the web application without reopening Phase 1 Domain scope.

#### Browser Authentication Gate

Before an Authentication UI implementation outcome, explicitly decide and document:

- browser access-token transport and storage;
- refresh-token transport, storage, and atomic rotation;
- OAuth callback handoff to the frontend;
- applicable cookie, CSRF, XSS, and CORS behavior;
- the user-visible treatment of transitional Email verification.

The decision must update the owning Identity, HTTP-contract, security, implementation, and test sources together where applicable.

This Phase file does not select that transport.

#### Chat Contract Gate

Before a Contacts or Conversation frontend slice consumes backend behavior:

- the required backend capability must be implemented or part of the same authorized vertical outcome;
- the stable shared HTTP error shape must be accepted;
- the exact owning Chat HTTP contract must exist;
- applicable pagination and retry identities must be documented;
- realtime behavior must follow `contracts/chat-realtime.md`.

The frontend must not infer missing transport behavior from Domain or Phase documentation.

#### Client Quality Gate

Before the first frontend implementation outcome, explicitly define:

- the accessibility conformance target;
- supported-browser baseline;
- responsive minimum;
- keyboard and focus evidence;
- applicable component and browser-journey verification.

Selecting a new frontend or test dependency remains a separate dependency-managed implementation decision.

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

Contact relationship persistence supports pending and accepted states through
a Chat-owned schema, additive migration, Prisma repository, and one unordered
current-pair uniqueness constraint across both states. The Application
acceptance command is implemented and its exact HTTP contract is accepted; the
API Gateway composition, endpoint, transport evidence, frontend flow, and the
remaining relational state above are not yet implemented.

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

### Frontend

Verify applicable Phase 2 web behavior through the smallest reliable layer:

- pure presentation and formatting;
- loading, empty, validation, authorization, unavailable, pending, confirmed, and failed component states;
- public HTTP and realtime translation;
- Authentication and session boundaries after the browser transport is accepted;
- Contacts-to-Conversation navigation;
- persistent Message history;
- Message pending, accepted, failed, and reconciled presentation;
- realtime disconnect, reconnect, duplicate or late delivery where applicable, and durable reconciliation;
- keyboard operation and accessibility semantics;
- responsive narrow-screen behavior;
- a small number of critical authenticated browser journeys.

Frontend tests do not replace backend authorization, persistence, concurrency, provider, realtime-contract, or deployment evidence.

Hiding or disabling a control is not proof that the backend rejects an unauthorized operation.

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
- the browser Authentication transport and transitional verification experience are explicitly accepted before their UI is implemented;
- the accessibility, supported-browser, responsive, keyboard, and focus baselines are explicit;
- registered users can complete the authorized Phase 2 Contacts and Chat journeys through the responsive web application;
- critical frontend component, contract-translation, browser-journey, realtime-reconciliation, accessibility, and responsive evidence passes;
- the frontend does not present target-only behavior as available;
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
- native mobile applications;
- complete offline operation;
- a complete Progressive Web App commitment;
- unsupported account settings or password recovery;
- recording;
- anonymous guests;
- Enterprise;
- microservice extraction;
- Kubernetes.
