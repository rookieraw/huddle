# Data and Consistency

Status: Accepted target architecture  
Last reviewed: 2026-08-07

## Purpose

This document defines Huddle's system-wide:

- datastore responsibilities;
- transaction boundaries;
- consistency expectations;
- retry principles;
- idempotency principles;
- durable asynchronous-processing patterns;
- recovery expectations.

It does not define Context-specific schemas, exact indexes, domain lifecycle rules, or transport payloads.

## Core Principles

Huddle follows these rules:

1. Every durable business fact has one authoritative owner.
2. Transactions remain local to one Context and authoritative datastore.
3. Cross-Context and cross-database work does not use distributed transactions.
4. Eventual consistency is explicit, observable, and recoverable.
5. Retried operations are bounded and idempotent where required.
6. Redis is not the only source of durable business truth.
7. External-system completion is not inferred solely from a browser redirect or network acknowledgement.
8. Clients do not determine authoritative identity, time, tier, capacity, or lifecycle state.
9. Persistence failures are not converted into confirmed absence.
10. Exactly-once delivery is not claimed without evidence.

## Datastore Responsibilities

| Datastore          | Primary responsibility                                                         |
| ------------------ | ------------------------------------------------------------------------------ |
| PostgreSQL         | Relational invariants, transactional Context state, durable processing records |
| MongoDB            | Chat-owned append-oriented Conversation entries                                |
| Redis              | Recoverable live state, queues, and short-lived coordination                   |
| External providers | Provider-owned external state reconciled through Context adapters              |
| Process memory     | Temporary runtime resources that can be recreated or terminated safely         |

Polyglot persistence is selected by bounded use case rather than used as a repository-wide default.

## PostgreSQL

PostgreSQL is authoritative for relational and transactional state.

It is preferred when behavior depends on:

- uniqueness;
- referential integrity;
- relational constraints;
- transactional state transitions;
- concurrency-safe resource limits;
- durable processing state;
- Outbox or Inbox records.

Contexts may share one PostgreSQL server while retaining:

- Context-owned tables or schemas;
- Context-owned migrations;
- Context-owned repositories;
- no cross-context ORM relations;
- no cross-context repository queries;
- no cross-context database joins.

Shared infrastructure does not create shared domain ownership.

## MongoDB

MongoDB is authoritative for Chat-owned append-oriented Conversation entries.

The accepted use includes:

- Messages;
- Call timeline entries when implemented;
- Meeting timeline entries when implemented.

MongoDB does not own:

- Conversation membership;
- Group ownership;
- authorization;
- relational quotas;
- CallSession lifecycle;
- Meeting lifecycle.

The reason for using MongoDB belongs to ADR 0003.

Exact document schemas, indexes, cursor behavior, and idempotency rules belong to:

- [`../contexts/chat.md`](../contexts/chat.md);
- executable persistence configuration;
- migrations;
- integration tests.

## Redis

The initial architecture uses:

- one Redis instance;
- Redis database `0`;
- Context-owned key namespaces.

A key namespace follows a convention equivalent to:

```text
huddle:<context>:<capability>:<identifier>
```

Redis may store:

- socket presence;
- live participant presence;
- socket-to-session mappings;
- lobby presence;
- short-lived signaling coordination;
- BullMQ state;
- temporary coordination;
- recoverable cache data when explicitly justified.

Redis must not be the only authoritative source for:

- user identity;
- Conversation membership;
- Messages;
- CallSession existence;
- Meeting lifecycle;
- effective Subscription state;
- accepted external webhook receipt;
- Integration Events awaiting delivery;
- Notification history.

After Redis loss, durable state must remain recoverable from its authoritative store.

A separate Redis instance or database requires a demonstrated need involving:

- eviction policy;
- durability;
- security isolation;
- resource contention;
- failure isolation;
- operational ownership.

## Process Memory

Process memory may store live runtime objects such as:

- active socket connections;
- mediasoup Workers;
- Routers;
- transports;
- Producers;
- Consumers.

Process-memory objects are not durable business state.

A process restart may end active media or realtime connections, but it must not erase durable:

- Call or Meeting lifecycle;
- Messages;
- subscription state;
- accepted webhook work;
- pending Integration Events;
- Notification history.

## Local Transaction Boundary

Complete a business invariant inside one local transaction when the authoritative state belongs to the same Context and datastore.

Examples include:

```text
Update provider aggregate
+ insert provider Outbox record
in one PostgreSQL transaction
```

```text
Apply external-event state
+ mark durable Inbox record processed
in one PostgreSQL transaction
```

```text
Validate relational invariant
+ perform protected relational mutation
in one PostgreSQL transaction
```

Do not split a same-Context invariant into asynchronous steps without a concrete reason.

A local strong transaction does not imply global consistency across every Context.

## Cross-Context and Cross-Database Boundaries

Huddle does not use distributed transactions across:

- bounded contexts;
- PostgreSQL and MongoDB;
- PostgreSQL and Redis;
- PostgreSQL and Stripe;
- database state and Slack;
- database state and browser delivery;
- durable state and process-bound media.

Cross-boundary consistency uses the appropriate combination of:

- stable identifiers;
- unique constraints;
- idempotency keys;
- optimistic versions;
- Transactional Outbox;
- durable Inbox;
- consumer deduplication;
- bounded retries;
- reconciliation;
- observable pending state.

A provider transaction remains valid when an asynchronous consumer has not yet caught up.

## Consistency Expectations

| Capability category                        | Consistency expectation                                  |
| ------------------------------------------ | -------------------------------------------------------- |
| Identity uniqueness and credential state   | Strong within Identity PostgreSQL transaction            |
| Chat relational invariants                 | Strong within Chat PostgreSQL transaction                |
| Quota-protected Chat growth                | Strong within the protected Chat transaction             |
| Message acceptance                         | Durable within the MongoDB write before broadcast        |
| Conversation summary projection            | Eventual                                                 |
| Call and Meeting lifecycle                 | Strong within Conferencing PostgreSQL transaction        |
| Conferencing lifecycle projected into Chat | Eventual and idempotent                                  |
| Billing state transition                   | Strong within Billing PostgreSQL transaction             |
| Stripe-to-Huddle synchronization           | Eventual and reconciled                                  |
| Notification delivery                      | Eventual, retryable, and observable                      |
| Realtime presence                          | Recoverable and temporary                                |
| Process-bound media                        | Temporary; reconciled to durable lifecycle after failure |

“Strong” refers to the authoritative local boundary.

It does not mean globally serializable behavior across all Contexts and datastores.

## Persist Before Broadcast

When a user-facing fact must be durable, persistence occurs before a successful realtime broadcast.

General sequence:

```text
Authenticate
→ authorize
→ validate
→ persist authoritative result
→ broadcast persisted result
```

If persistence fails, the system must not report a durable success.

If persistence succeeds but broadcast fails:

- the durable result remains accepted;
- the client may recover it through a query or reconnect;
- the system does not delete the durable fact merely to imitate atomic delivery.

Detailed Message behavior belongs to [`../contexts/chat.md`](../contexts/chat.md).

## Concurrency Control

Select a concurrency mechanism based on the invariant.

Permitted mechanisms include:

- unique constraints;
- optimistic version checks;
- row locking;
- serializable transactions;
- compare-and-set behavior;
- idempotency keys;
- consumer lifecycle versions.

An application-level sequence such as:

```text
read current count
→ compare with limit
→ insert resource
```

is insufficient when concurrent requests can violate the invariant.

Application checks may improve error messages but do not replace persistence enforcement.

Exact transaction isolation, retry count, and backoff belong to the owning Context.

## Retry Policy

Retries are used only for failures known to be transient and safe to repeat.

Every retry policy defines:

- retryable condition;
- maximum attempts;
- delay strategy;
- jitter where appropriate;
- idempotency requirement;
- exhausted-retry result;
- logging and metrics.

Do not automatically retry:

- validation failure;
- authorization failure;
- confirmed quota failure;
- unsupported lifecycle transition;
- permanent provider rejection;
- unrelated persistence failure.

Retries must not form a silent infinite loop.

Infrastructure error codes are translated before reaching domain or public interface layers.

## Idempotency

Idempotency is scoped to one logical operation.

An idempotency design defines:

- who creates the idempotency identity;
- its uniqueness scope;
- how long the result remains reusable;
- how duplicate attempts are resolved;
- whether concurrent duplicates converge;
- what data is returned for a duplicate;
- how the identity is persisted.

Relevant Huddle operation categories include:

- client Message send;
- outgoing Stripe requests;
- incoming Stripe events;
- Integration Event consumption;
- lifecycle timeline projection;
- Notification creation and delivery.

An idempotency key must not be reused for unrelated operations.

Incoming-event deduplication and outgoing-request idempotency are separate concerns.

Exact idempotency identities belong to the owning Context or contract.

## Transactional Outbox

A Transactional Outbox is used when a committed provider fact requires reliable asynchronous delivery.

The provider owns:

- the Outbox record;
- event meaning;
- event version;
- event payload;
- dispatch state;
- recovery behavior.

Required guarantees:

- provider state and Outbox record commit atomically;
- uncommitted events are not published;
- failed dispatch remains recoverable;
- delivery is treated as at least once;
- consumers are idempotent;
- ordering-sensitive consumers reject stale lifecycle versions;
- consumer failure does not roll back the provider transaction.

An Outbox is introduced only when a real asynchronous consumer exists.

A queue or in-memory Domain Event is not a durable substitute for the Outbox.

The public Integration Event contract remains separate from the provider's internal Domain Event type.

Detailed cross-context rules belong to ADR 0004.

## Durable External-Event Inbox

A durable Inbox is used when an external provider may redeliver an event and processing must survive application or queue failure.

General sequence:

```text
Receive external event
→ validate provider authenticity
→ persist unique Inbox record
→ enqueue or dispatch processing
→ process idempotently
→ reconcile current provider state when required
```

Required guarantees:

- invalid provider authentication is rejected;
- receipt is persisted before durable acknowledgement;
- provider event identity is unique;
- duplicate receipt is an idempotent result;
- pending records can be recovered;
- Redis is not the only record of accepted work;
- processing does not assume arrival order;
- state change and Inbox completion are atomic when they share one datastore;
- job redelivery does not apply the transition twice.

Billing applies this pattern to Stripe webhooks.

Exact HTTP responses, Stripe fields, and Subscription reconciliation belong to [`../contexts/billing.md`](../contexts/billing.md).

## Consumer Deduplication

Every at-least-once consumer must handle:

- duplicate delivery;
- delivery after process restart;
- failure after local commit but before transport acknowledgement;
- consumer timeout followed by redelivery;
- newer lifecycle facts arriving before older ones;
- unsupported event versions.

Durable consumer state or authoritative unique constraints provide deduplication.

An in-memory set is insufficient for durable deduplication.

## Event Ordering

Huddle does not assume that all asynchronous events arrive in business order.

Ordering-sensitive consumers use applicable:

- aggregate version;
- lifecycle version;
- provider timestamp;
- authoritative provider reconciliation.

An older event must not overwrite a newer terminal state.

Global ordering across unrelated aggregates is not required.

## External-System Reconciliation

External systems are outside Huddle's transaction boundary.

Examples include:

- Google OAuth;
- GitHub OAuth;
- Stripe;
- Slack;
- browser WebRTC peers.

Integration distinguishes:

- request accepted;
- provider state committed;
- Huddle state persisted;
- consumer projection updated;
- user-facing delivery completed.

A successful browser redirect or provider request does not always mean Huddle's local projection is current.

Where provider state is authoritative, Huddle reconciles rather than trusting event arrival order alone.

## Time

Backend time is authoritative for:

- accepted persistence timestamps;
- lifecycle deadlines;
- Meeting schedules;
- admission boundaries;
- Subscription period boundaries;
- external-event receipt;
- Notification creation.

Persist timestamps in UTC.

Clients may display localized time but must not determine lifecycle expiry.

Time-dependent domain behavior receives an explicit clock value when practical.

Tests use an injected clock rather than real multi-minute or multi-hour waits.

## Failure Visibility

Eventually consistent work must be observable.

Relevant operational categories include:

- pending Outbox records;
- failed Outbox dispatch;
- pending Inbox records;
- failed external-event processing;
- Notification delivery backlog;
- unsupported event version;
- delayed projection;
- exhausted retry;
- Redis recovery;
- media-session reconciliation.

Exhausted retries require:

- durable or inspectable failure state;
- diagnostic context;
- safe operator action;
- idempotent replay where supported.

Silent loss and infinite retry are prohibited.

## Backup and Recovery

Durable stores require documented backup and recovery.

### PostgreSQL

Recovery must include Context-owned relational state and durable processing records.

### MongoDB

Recovery must include Messages and timeline entries.

### Redis

Redis persistence may improve operational recovery, especially for BullMQ, but it does not replace PostgreSQL Inbox or Outbox recovery.

Exact procedures belong to:

[`../operations/runbook.md`](../operations/runbook.md)

The Portfolio Release must exercise backup and restore rather than only document commands.

## Schema Evolution

Schema evolution preserves Context ownership.

Required principles include:

- migrations are committed;
- migration order is deterministic;
- deployment compatibility is considered;
- destructive changes require backup and explicit planning;
- old MongoDB document versions remain readable during migration;
- Integration Event versions remain independent from internal schemas;
- rollback documentation does not claim every migration is automatically reversible.

Exact migration strategy belongs to the owning Context and deployment procedure.

## Future Service Extraction

When a Context becomes a separate service:

- local transactions remain local;
- Outbox and Inbox patterns remain valid;
- public APIs gain network adapters;
- Integration Events gain a transport;
- database ownership remains unchanged;
- cross-service joins remain prohibited;
- retries, timeouts, idempotency, and observability become more important.

A broker may replace an in-process dispatcher without changing provider event ownership.

## Prohibited Patterns

Do not use:

- cross-context database writes;
- cross-context ORM relationships;
- cross-context database joins;
- distributed transactions across PostgreSQL and MongoDB;
- Redis as the only durable job source;
- broadcast before required persistence;
- browser redirect as payment authority;
- unbounded retry;
- swallowed persistence errors converted into missing data;
- client-generated authoritative identity;
- client-generated authoritative timestamps;
- shared mutable event payloads;
- exactly-once claims without evidence.

## Sources of Truth

This document is the source of truth for:

- datastore responsibilities;
- local transaction boundaries;
- strong versus eventual consistency expectations;
- general concurrency and retry principles;
- general idempotency principles;
- Transactional Outbox guarantees;
- durable Inbox guarantees;
- Redis durability boundaries;
- cross-database consistency;
- asynchronous recovery expectations.

Detailed behavior belongs to:

- Chat persistence: [`../contexts/chat.md`](../contexts/chat.md)
- Conferencing persistence: [`../contexts/conferencing/README.md`](../contexts/conferencing/README.md)
- Billing Inbox and reconciliation: [`../contexts/billing.md`](../contexts/billing.md)
- Notification processing: [`../contexts/notification.md`](../contexts/notification.md)
- MongoDB selection rationale: [`../decisions/0003-message-storage-strategy.md`](../decisions/0003-message-storage-strategy.md)
- Cross-context events: [`../decisions/0004-cross-context-integration.md`](../decisions/0004-cross-context-integration.md)
- Deployment recovery: [`../operations/runbook.md`](../operations/runbook.md)

Exact schemas, indexes, retry values, and event payloads belong to Context documents, contracts, migrations, code, and tests.
