# ADR 0002 — Enforce Context-owned Persistence

Status: Accepted  
Recorded: 2026-08-07  
Supersedes: None  
Superseded by: None

## Context

Huddle’s bounded contexts may refer to the same identifiers while assigning them different domain meanings.

Examples include:

- Identity owns a User.
- Chat stores sender and member identifiers.
- Conferencing stores participant identifiers.
- Billing stores a user identifier.
- Notification stores recipient identifiers.

If contexts share repositories, entities, ORM relations, or persistence models, one context can bypass another context’s rules and become coupled to its schema.

Huddle initially shares database infrastructure to control operational cost, but shared infrastructure must not imply shared domain ownership.

## Decision

Every bounded context owns its persistence model and all access to that persistence.

Ownership includes:

- Tables and collections
- Schema definitions
- Migrations
- Repositories
- ORM and ODM models
- Indexes and constraints
- Transaction boundaries
- Persistence-specific error translation
- Data-retention decisions

A context must not directly read or write another context’s owned persistence.

Cross-context information must be obtained through explicit application contracts or Integration Events.

## Shared Infrastructure

Contexts may initially share:

- One PostgreSQL deployment
- One MongoDB deployment
- One Redis deployment

This is infrastructure sharing, not data ownership sharing.

Logical ownership must remain identifiable through:

- Context-owned migration locations
- Context-owned persistence adapters
- Context-specific tables, schemas, or collections
- Redis key namespaces
- Explicit application contracts

Physical separation may be introduced later without changing the ownership rule.

## Persistence Responsibilities

The accepted high-level responsibilities are:

- Identity owns credential, verification, refresh-token, and OAuth identity persistence.
- Chat owns contact, conversation, membership, invitation, message, and conversation-timeline persistence.
- Conferencing owns call, meeting, live-session, and Conferencing Outbox persistence.
- Billing owns billing-account, subscription, and Stripe Webhook Inbox persistence.
- Notification owns durable in-app notifications, Slack connections, and delivery-attempt persistence.

The detailed datastore assignments and consistency policies are maintained in the Data and Consistency document.

## External Identifiers

A context may store another context’s identifier as an external reference.

Examples include:

- Chat storing `senderId`
- Billing storing `userId`
- Conferencing storing `conversationId`
- Chat storing `meetingId`
- Notification storing `recipientUserId`

Storing an identifier:

- Does not transfer ownership.
- Does not imply a runtime dependency.
- Does not justify importing the provider’s aggregate.
- Does not justify a cross-context ORM relation.
- Does not guarantee that the referenced resource still exists unless the use case explicitly requires that guarantee.

The consuming context interprets the identifier according to its own domain language.

## Cross-context Referential Integrity

Database-level foreign keys are not used across bounded-context boundaries.

Reference validity is maintained according to the needs of the use case through one or more of:

- Trusted authentication data
- Provider-owned public application APIs
- Consumer-owned ports
- Integration Events
- Reconciliation
- Explicitly documented eventual consistency

Context-local foreign keys remain appropriate when both sides belong to the same bounded context.

## Repository Boundaries

Repository interfaces belong to the context that owns the aggregate.

A repository must not be exported as a cross-context capability.

Incorrect:

```text
Chat use case
→ Identity UserRepository
```

Correct:

```text
Chat-owned IdentityDirectoryPort
→ composition adapter
→ Identity public Directory API
```

A minimal public application query is not equivalent to exposing a repository.

## Transaction Boundaries

A transaction may directly update only persistence owned by its context and supported by the participating datastore transaction.

A context must not include another context’s table, collection, or repository in its transaction.

Cross-context effects occur only after the provider’s local state has been committed, normally through an Integration Event or a subsequent application call.

Cross-datastore and event-delivery consistency rules are maintained in the Data and Consistency document.

## Redis Boundaries

Contexts share Redis through namespaced keys following this general form:

```text
huddle:<context>:<capability>:<identifier>
```

A context must not:

- Read another context’s keys as an integration API.
- Write or delete another context’s keys.
- Depend on another context’s undocumented key structure.
- Reuse another context’s namespace.

Redis infrastructure sharing does not create a shared cache domain.

## Persistence Error Translation

Database- and library-specific failures remain inside infrastructure adapters.

Examples include:

- PostgreSQL error codes
- MongoDB duplicate-key errors
- Redis connection failures
- ORM exceptions
- ODM exceptions

The owning adapter translates these failures into application-level errors.

Another context must not depend on a provider’s persistence-specific error type.

A missing record and a persistence failure are never interchangeable. In particular, an adapter must not convert a database failure into a resolved `null` result.

## Rationale

Context-owned persistence provides:

- Explicit data ownership
- Protection of domain invariants
- Safer schema evolution
- Visible cross-context dependencies
- Independent repository testing
- Freedom to select an appropriate datastore per capability
- A practical future service-extraction seam

It allows Huddle to use affordable shared infrastructure while preserving logical isolation.

## Consequences

### Positive

- Contexts cannot bypass one another’s rules through repositories.
- Schema changes remain associated with the owning context.
- Cross-context data requirements become explicit.
- Persistence technology can vary between contexts.
- Service extraction becomes more predictable.

### Negative

- Some identifiers or consumer-owned projections may be duplicated.
- Cross-context reads require explicit adapters.
- Cross-context reporting becomes less convenient.
- Eventual consistency must be handled deliberately.
- Shared infrastructure does not physically enforce every ownership rule.

## Alternatives Considered

### Shared Repository Layer

Rejected because it would allow contexts to query and mutate each other’s state without an explicit contract.

### Shared Domain Entities

Rejected because similarly named concepts have different meanings and invariants in different contexts.

### Cross-context ORM Relations

Rejected because they introduce persistence-level coupling and make future extraction more difficult.

### One Physical Database per Context Immediately

Deferred because it would increase deployment and operational cost before physical isolation is required.

Logical ownership is required immediately; physical isolation may evolve later.

### Duplicate Complete Provider Records

Rejected because copying complete provider records into consumers would introduce unnecessary synchronization and privacy risks.

A consumer-owned projection may be introduced only when a demonstrated read pattern justifies it.

## Enforcement

The ownership rule should be enforced through:

- Context-owned repository and migration locations
- No repository exports from public module APIs
- No cross-context ORM metadata
- Import restrictions where practical
- Architecture tests where practical
- Composition adapters outside provider internals
- Documentation and code review

A shared TypeScript workspace does not grant permission to import another context’s persistence implementation.

## Future Service Extraction

When a context is extracted:

- Its owned persistence moves with it.
- Local composition adapters may become network adapters.
- Consumer-owned ports remain stable where practical.
- Provider contracts and Integration Events remain explicit.
- Cross-service database access remains prohibited.
- Distributed failure handling and reconciliation are added where required.

Service extraction must not change which context owns the data.

## Revisit When

Reconsider physical persistence isolation when:

- A context is extracted as an independently deployed service.
- A context requires independent backup or restore.
- Security policy requires separate credentials or encryption boundaries.
- One context’s workload harms another context.
- Retention requirements differ materially.
- Independent datastore scaling is required.

The context-ownership rule remains unless the bounded-context boundary itself changes.

## Related Documentation

- [System Architecture](../architecture/system.md)
- [Context Map](../architecture/context-map.md)
- [Data and Consistency](../architecture/data-and-consistency.md)
- [DDD Modular Monolith](0001-modular-monolith.md)
- [Message Storage Strategy](0003-message-storage-strategy.md)
- [Cross-context Integration](0004-cross-context-integration.md)
