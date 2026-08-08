# ADR 0003 — Use Controlled Polyglot Persistence for Chat Messages

Status: Accepted  
Recorded: 2026-08-07  
Supersedes: None  
Superseded by: None

## Context

Chat contains two substantially different persistence workloads.

Relational Chat state includes:

- Contact relationships;
- Conversations;
- membership;
- Group ownership and administration;
- invitation permissions;
- invitations;
- quota-protected mutations.

Conversation entries include:

- user messages;
- Call timeline entries;
- Meeting timeline entries where required;
- append-oriented conversation history;
- evolving controlled payload types.

Using only one datastore would reduce operational complexity, but PostgreSQL and MongoDB provide different fits for these two workloads.

The project also has a secondary learning objective of gaining practical MongoDB experience.

That objective is acceptable only when MongoDB is restricted to a defensible product use case. MongoDB must not be introduced into unrelated contexts or selected only as a portfolio keyword.

## Decision

Huddle uses controlled polyglot persistence inside the Chat bounded context.

### PostgreSQL

PostgreSQL stores relational Chat state, including:

- Contacts;
- Conversations;
- memberships;
- Direct Conversation uniqueness;
- Group ownership and administrators;
- invitation permissions;
- invitations;
- quota-related relational state.

### MongoDB

MongoDB stores durable append-oriented Conversation entries, including:

- user messages;
- Call timeline entries;
- Meeting timeline entries where required.

Phase 2 begins with one Chat-owned collection.

Additional collections require a demonstrated difference in:

- query pattern;
- indexing;
- lifecycle;
- retention;
- scaling;
- operational ownership.

### Redis

Redis may store recoverable live or operational state.

Redis is not the durable source of Message history.

## Consistency Boundary

PostgreSQL and MongoDB do not participate in one distributed transaction.

Message sending follows the consistency rule:

```text
Authorize using committed Chat membership
→ persist the Message in MongoDB
→ broadcast the persisted Message
```

A Message is not considered accepted before durable persistence succeeds.

If persistence succeeds but realtime broadcast fails, the Message remains accepted and can be recovered through history.

Conversation-list summaries may be updated eventually. A temporarily stale summary does not invalidate a Message already persisted in MongoDB.

Cross-context lifecycle projections use provider-owned Integration Events rather than direct writes into another context's persistence.

## Rationale

MongoDB is a reasonable fit for the selected Conversation-entry workload because it is:

- append-oriented;
- primarily queried by Conversation;
- naturally represented by controlled documents;
- suitable for multiple versioned entry payloads;
- independent from relational membership invariants.

PostgreSQL remains the stronger fit for Contacts, membership, roles, ownership, invitations, and quotas because those rules depend on:

- relational constraints;
- uniqueness;
- transactional concurrency;
- authoritative aggregate state.

The decision is based on bounded persistence needs, not on assigning one database technology to an entire context indiscriminately.

## Guardrails

The initial decision is intentionally constrained:

- one Chat-owned MongoDB collection;
- explicit schema validation;
- executable indexes matched to real queries;
- cursor-based bounded history;
- client-operation idempotency;
- Integration Event idempotency;
- no MongoDB use outside a justified context requirement;
- no generic repository shared between PostgreSQL and MongoDB;
- no MongoDB change streams;
- no sharding;
- no event sourcing;
- no speculative CQRS infrastructure;
- no Kafka or other broker introduced by this decision;
- required integration tests;
- documented backup and restore.

Exact document fields, indexes, cursor format, and idempotency keys belong to the Chat Context, contracts, migrations, and executable persistence configuration.

## Operational Consequences

MongoDB adds responsibility for:

- deployment;
- persistent storage;
- backup;
- restore;
- schema validation;
- index management;
- monitoring;
- health checks;
- ARM64 compatibility;
- integration-test infrastructure;
- connection management.

MongoDB must not be exposed publicly by the Portfolio deployment.

These costs are accepted only while the bounded Chat use case continues to justify them.

## Consequences

### Positive

- append-oriented entries use a suitable document model;
- evolving controlled entry payloads remain practical;
- conversation-local history remains explicit;
- relational invariants stay in PostgreSQL;
- MongoDB experience is tied to a real use case;
- Chat retains ownership across both datastores.

### Negative

- the deployment operates another durable datastore;
- backup and restore become more complex;
- PostgreSQL and MongoDB cannot share one transaction;
- some projections are eventually consistent;
- integration tests require both databases;
- cross-store reporting is more difficult;
- the team must understand two persistence models.

## Alternatives Considered

### Store All Chat State in PostgreSQL

This is a valid and operationally simpler alternative.

It was not selected because the initial append-oriented, evolving Conversation-entry model provides a bounded MongoDB use case.

PostgreSQL remains a viable future replacement if MongoDB's operational cost outweighs its value.

### Store All Chat State in MongoDB

Rejected because Contacts, membership, ownership, invitations, and quotas benefit from PostgreSQL constraints and transactions.

### Store Messages in Redis

Rejected because Redis is not the durable source of Message history.

### Use Event Sourcing

Rejected because Huddle does not require aggregate reconstruction, temporal replay, or event-sourced projections.

### Create One Collection per Entry Type Immediately

Rejected because it fragments persistence before distinct access patterns or lifecycle requirements are demonstrated.

### Use MongoDB Change Streams

Deferred because no current consumer requires database-level change-stream infrastructure.

Provider-owned Integration Events remain the cross-context mechanism.

## Migration Consequence

If Messages later move to PostgreSQL:

- Chat remains their owner;
- public Chat contracts remain stable;
- persistence adapters change;
- stable Message identities must be preserved;
- client-operation idempotency must be preserved;
- cursor behavior must remain compatible or be versioned;
- timeline lifecycle versions must be preserved;
- migration, backup, rollback, and verification must be explicit.

Such a migration requires a new ADR.

## Sources of Truth

This ADR records why the persistence technologies were selected.

Current behavior belongs to:

- Chat domain and persistence behavior: [`../contexts/chat.md`](../contexts/chat.md)
- System consistency model: [`../architecture/data-and-consistency.md`](../architecture/data-and-consistency.md)
- Persistence ownership decision: [`0002-context-owned-persistence.md`](0002-context-owned-persistence.md)
- Cross-context integration: [`0004-cross-context-integration.md`](0004-cross-context-integration.md)
- Phase 2 implementation scope: [`../delivery/phases/02-chat.md`](../delivery/phases/02-chat.md)

Exact schemas and indexes belong to code, migrations, and integration tests.

## Revisit When

Reconsider this decision when:

- MongoDB operational cost is disproportionate;
- backup or restore reliability is inadequate;
- query patterns become strongly relational;
- cross-store consistency creates unacceptable behavior;
- the initial collection becomes difficult to evolve;
- retention requirements differ materially by entry type;
- measured volume requires another partitioning strategy;
- service extraction changes the persistence trade-off;
- evidence supports a simpler PostgreSQL-only design.
