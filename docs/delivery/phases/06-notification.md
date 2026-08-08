# Phase 6 — Notification

Status: Later  
Depends on: Phase 5 — Meetings  
Next phase: Phase 7 — Hardening and Portfolio Preparation

## Objective

Deliver durable in-app Notifications and a minimal Pro-only Slack integration from selected committed cross-context Integration Events.

Phase 6 demonstrates:

- provider-owned Integration Events;
- Transactional Outbox expansion for real consumers;
- idempotent asynchronous consumption;
- durable Notification state;
- realtime presentation;
- offline recovery;
- external-channel delivery;
- retry and failure isolation;
- Billing-backed Slack entitlement enforcement.

Product-event Email Notification is not part of this phase.

## Implementation Authority

Phase 6 may implement only the Notification capabilities authorized by this document and defined in:

- [`../../contexts/notification.md`](../../contexts/notification.md)
- [`../../product/tiers.md`](../../product/tiers.md)

The Notification Context defines target behavior.

This phase defines which parts of that target may be implemented now.

Phase 6 must not:

- publish every Domain Event;
- expose provider aggregates as event payloads;
- add an Outbox without a real Notification consumer;
- build a generic event platform;
- add product-event Email delivery;
- build a comprehensive preference matrix;
- synchronize Huddle Messages with Slack;
- introduce Workspace-owned Slack behavior;
- add Kafka or another broker without measured need.

Identity-owned authentication Email remains outside Notification.

## Entry Criteria

Phase 6 begins only after Phase 5 has delivered:

- Identity, Chat, Calling, Billing, and Meeting capabilities;
- real Billing-backed entitlements;
- provider-owned public application APIs;
- versioned Integration Event contracts;
- working Transactional Outbox infrastructure;
- idempotent Chat event consumption;
- durable Meeting and Call lifecycle state;
- deployment and recovery procedures;
- operational visibility for pending asynchronous work.

Before Notification event implementation begins, the initial Notification event catalog must be accepted and documented in:

`contexts/notification.md`

Until that catalog exists, no provider event may be treated as creating a Notification.

## Required Documents by Task

| Task                 | Read these documents                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Notification model   | This phase file and `contexts/notification.md`                                                                         |
| Producer event       | This phase file, the producer Context, `contracts/integration-events.md`, and ADR 0004                                 |
| Transactional Outbox | This phase file, the producer Context, and `architecture/data-and-consistency.md`                                      |
| In-app Notification  | This phase file, `contexts/notification.md`, and `contracts/http.md`                                                   |
| Realtime delivery    | This phase file, `contexts/notification.md`, the relevant realtime contract, and `architecture/security.md`            |
| Slack connection     | This phase file, `contexts/notification.md`, `product/tiers.md`, `contexts/billing.md`, and `architecture/security.md` |
| Slack delivery       | This phase file, `contexts/notification.md`, `operations/runbook.md`, and the accepted event catalog                   |
| Tests                | Relevant task documents and `engineering/testing.md`                                                                   |

Do not load every producer Context for an ordinary Notification query or read-state task.

## Event-Catalog Gate

Before implementation, define a deliberately small initial event catalog.

For each selected Notification type, document:

- provider Context;
- provider Integration Event;
- intended recipient source;
- safe user-facing summary;
- whether an in-app Notification is created;
- whether Slack delivery is supported;
- deduplication identity;
- ordering requirement where applicable;
- fields prohibited from the event or summary.

The initial catalog should select only enough events to demonstrate the end-to-end architecture.

Possible candidate families include:

- Contact or Group invitation;
- missed or unanswered Call;
- Meeting invitation;
- selected Meeting lifecycle change;
- selected Billing lifecycle change.

This candidate list does not authorize all listed events.

A separate accepted catalog decision is required before implementation.

Every selected event does not need to support Slack.

## Included Scope

### Notification Model

Implement:

- durable Notification;
- recipient ownership;
- source event reference;
- Notification type;
- safe presentation payload;
- creation timestamp;
- read timestamp;
- event-consumption deduplication;
- delivery attempt records where required.

Exact domain rules come from:

`contexts/notification.md`

A Notification must not persist:

- an entire provider aggregate;
- raw Stripe webhook payload;
- credentials;
- provider access tokens;
- unnecessary private Message content.

### Producer Integration

For each event selected by the accepted catalog:

- the provider owns the Integration Event meaning;
- the provider defines a minimal versioned contract;
- the provider persists an Outbox record with its committed business change;
- Notification consumes the event idempotently;
- Notification failure does not roll back the provider transaction.

Do not publish a provider's internal Domain Event object directly.

Only producers with a selected Notification event add or extend an Outbox.

### In-App Notifications

Implement:

- list the authenticated user's Notifications;
- bounded cursor pagination;
- unread state;
- mark one Notification as read;
- mark an explicitly bounded set of Notifications as read where required;
- authenticated realtime delivery;
- reconnect and query missed Notifications;
- backend recipient authorization.

The durable Notification record is authoritative.

Realtime delivery is an optimization.

An offline user or failed socket delivery does not erase or fail the durable Notification.

### Slack Connection

Implement a minimal user-owned Slack integration.

The initial scope supports:

- at most one active Slack connection per Huddle user;
- at most one supported Slack destination per user;
- Slack OAuth;
- OAuth state validation;
- server-controlled scopes;
- protected token persistence;
- connection status;
- revocation handling;
- disconnect;
- reconnect.

The initial implementation does not include arbitrary routing or multiple destinations.

Slack access tokens must:

- remain server-side;
- be encrypted or equivalently protected at rest;
- never appear in public API responses;
- never appear in ordinary logs.

### Slack Entitlement

Slack integration is Pro-only.

Use the real Billing capability introduced in Phase 4.

Entitlement is checked when:

- connecting Slack;
- modifying the supported Slack connection;
- performing a new Slack delivery.

Required behavior:

- confirmed Pro permits the protected Slack operation;
- confirmed Free rejects or disables the protected operation;
- Billing failure does not mean Pro;
- Billing failure does not mean confirmed Free;
- internal durable Notification creation may still succeed;
- protected Slack delivery fails safely or remains retryable according to the documented failure policy.

A downgrade is non-destructive:

- the stored Slack connection is preserved;
- new Slack delivery is disabled;
- in-app Notifications remain available;
- returning to Pro may restore eligible Slack delivery;
- the user does not need a new connection solely because the tier changed.

### Slack Delivery

Slack delivers selected safe summaries from the accepted event catalog.

Implement:

- one supported destination;
- safe summary construction;
- destination authorization established through the accepted Slack connection;
- delivery-attempt recording;
- bounded retry;
- rate-limit handling;
- temporary failure classification;
- permanent failure classification;
- revoked-authorization handling;
- idempotent retry behavior;
- observable exhausted retry.

Slack failure must not:

- roll back the provider's business operation;
- delete the durable in-app Notification;
- create duplicate Notifications;
- expose private Message content;
- grant access to the referenced Huddle resource.

Following a Slack link back to Huddle still requires normal Huddle authentication and resource authorization.

### No General Preference Matrix

Phase 6 does not implement a generic:

```text
notification type
× delivery channel
× per-user preference
```

configuration system.

The accepted event catalog determines which selected events support:

- in-app delivery;
- Slack delivery.

The user's active Slack connection controls whether Slack delivery is possible.

Disconnecting Slack disables future Slack delivery.

A future generalized preference model requires explicit product scope and phase authorization.

## Delivery Processing

The accepted high-level processing flow is:

```text
Receive Integration Event
→ validate contract version
→ deduplicate
→ create durable in-app Notification
→ determine whether the event supports Slack
→ resolve Slack connection and entitlement when required
→ create Slack DeliveryAttempt
→ deliver asynchronously
→ record the result
```

Notification creation and marking the provider event consumed should occur atomically within Notification-owned PostgreSQL persistence.

External delivery occurs after the durable Notification intent exists.

Redis and BullMQ may coordinate processing, but they are not the only durable record of accepted Notification work.

## Idempotency and Ordering

Notification must tolerate:

- duplicate Integration Events;
- worker restart;
- failure after local commit;
- queue redelivery;
- older lifecycle facts arriving after newer ones;
- Slack retry after an unknown provider result.

A stable logical Notification identity includes the applicable:

- provider event identifier;
- Notification type;
- recipient identifier.

Channel retry does not recreate the Notification.

Ordering-sensitive events use the provider lifecycle version or another documented authoritative ordering mechanism.

Exactly-once external delivery is not claimed.

## Failure Isolation

Distinguish at least:

- duplicate Integration Event;
- unsupported event version;
- invalid event payload;
- Notification persistence unavailable;
- Slack not entitled;
- Billing unavailable;
- Slack connection missing;
- Slack authorization revoked;
- Slack rate-limited;
- temporary Slack failure;
- permanent Slack failure;
- recipient offline;
- delivery retries exhausted.

An offline realtime recipient is normal and does not represent durable Notification failure.

Slack or Billing failure must not erase a valid in-app Notification.

Notification failure must not roll back the provider's already-committed business operation.

## Contracts

Create or update contracts for:

- Notification list;
- Notification cursor;
- mark-as-read command;
- bounded bulk read command if included;
- Notification realtime event;
- Slack connection initiation;
- Slack OAuth callback;
- Slack connection status;
- Slack disconnect;
- provider Integration Events selected by the catalog;
- Notification and Slack failure responses.

Exact payloads belong in `contracts/`.

## Persistence Introduced

### PostgreSQL

Store Notification-owned durable state such as:

- Notification;
- consumed provider event identity;
- read state;
- Slack connection metadata;
- encrypted Slack credentials;
- Slack DeliveryAttempt;
- retry and terminal-failure state.

### Redis and BullMQ

Use Redis and BullMQ only for recoverable asynchronous coordination.

PostgreSQL remains authoritative for:

- durable Notification existence;
- consumed-event identity;
- Slack connection state;
- delivery-attempt history;
- terminal failure visibility.

A Redis restart must not permanently lose accepted Notification work.

## Operations

Update operational documentation for:

- pending provider Outbox events;
- Notification consumer backlog;
- unsupported event versions;
- Slack retry backlog;
- revoked Slack authorization;
- terminal delivery failure;
- Redis or worker restart;
- safe event replay;
- credential rotation;
- observability without sensitive payload logging.

Exact procedures belong in `operations/runbook.md`.

## Required Verification

### Domain and Application

Verify:

- Notification recipient ownership;
- read and unread transitions;
- stable Notification deduplication;
- invalid event rejection;
- unsupported version handling;
- Slack connection lifecycle;
- Slack Pro requirement;
- non-destructive downgrade;
- reconnect after returning to Pro;
- separation of durable Notification and external delivery.

### Producer Integration

Verify for each selected event:

- provider state and Outbox atomicity;
- versioned Integration Event contract;
- Outbox recovery;
- duplicate delivery;
- Notification consumer restart;
- idempotent Notification creation;
- stale-event protection;
- provider transaction remains committed during Notification failure.

### In-App Delivery

Verify:

- durable Notification persistence;
- authenticated listing;
- cross-user read rejection;
- cursor pagination;
- mark-as-read authorization;
- realtime online delivery;
- offline recipient recovery;
- reconnect without duplicate Notification creation.

### Slack

Verify:

- Free connection rejection;
- Pro connection success;
- Billing-unavailable behavior;
- OAuth state validation;
- server-controlled scopes;
- encrypted credential persistence;
- no token exposure;
- one-connection and one-destination limit;
- supported safe summary;
- successful delivery;
- duplicate delivery retry;
- rate-limit retry;
- temporary failure;
- permanent failure;
- revoked authorization;
- downgrade disables new delivery;
- durable in-app Notification survives Slack failure.

External-provider tests use controlled adapters or test environments and must not send unintended real messages.

### Recovery

Verify:

- Redis restart;
- worker interruption;
- pending delivery recovery;
- exhausted-retry visibility;
- safe authorized replay;
- no loss of durable Notification state.

## Definition of Done

Phase 6 is complete only when:

- the initial event catalog is accepted;
- only catalog-selected Integration Events are exposed;
- required producer Outboxes are implemented;
- Integration Event consumption is idempotent;
- in-app Notifications are durable;
- recipient authorization is enforced;
- read and unread behavior works;
- realtime delivery works without becoming the durable source;
- offline recovery works;
- one minimal Pro-only Slack connection works;
- one supported Slack destination works;
- Slack downgrade behavior is non-destructive;
- Slack and Billing failures do not erase in-app Notifications;
- retry and terminal failures are observable;
- secrets and private content are protected;
- recovery procedures are documented and verified;
- contracts and Context documentation are updated;
- [`../status.md`](../status.md) is updated.

## Explicitly Deferred

Do not implement during Phase 6:

- product-event Email Notification;
- marketing Email;
- full event-by-channel preference matrix;
- multiple Slack Workspaces per user;
- multiple Slack destinations per user;
- arbitrary Slack channel routing;
- Huddle and Slack Message synchronization;
- Workspace-owned Slack administration;
- arbitrary outgoing webhooks;
- SMS;
- mobile push Notification;
- Enterprise Notification administration;
- Kafka;
- multi-region delivery;
- exactly-once delivery claims.
