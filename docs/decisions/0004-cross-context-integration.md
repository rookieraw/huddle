# ADR 0004 — Use Consumer-owned Ports and Provider-owned Public Contracts

Status: Accepted  
Recorded: 2026-08-07  
Supersedes: None  
Superseded by: None

## Context

Huddle bounded contexts require selected facts or committed events from one another.

Because the contexts initially run inside one NestJS modular monolith, one context could technically import another context's:

- repository;
- persistence entity;
- internal application service;
- infrastructure adapter;
- domain aggregate.

Doing so would create hidden coupling:

- consumers would depend on provider persistence;
- provider entities would leak across boundaries;
- authorization ownership would become unclear;
- context libraries could form circular imports;
- service extraction would require rewriting use cases;
- broad shared services could become accidental God interfaces.

Huddle needs an integration pattern that remains lightweight inside the modular monolith while preserving explicit context ownership and a future network seam.

## Decision

Huddle uses:

- consumer-owned ports;
- provider-owned public application APIs;
- composition-root adapters;
- provider-owned versioned Integration Events;
- explicit selection between synchronous and asynchronous integration;
- gateway-level composition for responses combining multiple contexts.

Contexts do not directly access another context's:

- repositories;
- persistence entities;
- domain aggregates;
- controllers;
- infrastructure adapters;
- internal application services.

## Choosing an Integration Style

Use synchronous integration when an operation requires a current answer before it may continue.

Typical cases include:

- existence validation;
- current authorization facts;
- effective entitlements;
- current profile presentation data.

Use asynchronous integration when a consumer reacts to a committed provider fact and temporary delay is acceptable.

Typical cases include:

- lifecycle timeline projections;
- Notification delivery;
- local read-model updates;
- cross-context side effects that must not roll back the provider transaction.

Use gateway composition when one client response combines views owned by multiple contexts.

The integration style is selected per capability. A bounded context does not use one universal integration style for all interactions.

## Synchronous Integration

A synchronous cross-context call follows:

```text
Consumer use case
→ consumer-owned port
→ composition adapter
→ provider-owned public application API
```

### Consumer-owned Port

The consumer defines the capability it needs using consumer language.

The port should describe the required fact rather than the provider's storage or domain model.

It must not expose:

- provider entities;
- provider repositories;
- ORM models;
- external SDK objects;
- provider infrastructure exceptions.

A consumer-owned port allows the use case to remain stable when the integration adapter later changes from an in-process call to a network call or local projection.

### Provider-owned Public API

The provider exposes an intentionally supported application capability.

A provider public API:

- preserves provider ownership;
- returns a minimal DTO;
- validates provider-owned rules;
- hides internal aggregates and persistence;
- defines supported failure outcomes;
- may later become a network-facing service contract.

A context must not expose one broad API merely because several consumers need unrelated capabilities.

Public APIs are split by capability.

### Composition Adapter

The adapter connects the consumer port to the provider public API.

It may:

- translate identifiers;
- translate DTOs;
- translate application-level failures;
- add timeout or transport behavior after service extraction.

It does not own business rules belonging to either context.

The adapter is wired at the application composition boundary.

The provider context must not implement the consumer's port inside its domain merely to reverse the dependency direction.

## Existence Is Not Authorization

Confirming that an identifier exists does not authorize access to another context's resource.

For example, an Identity capability may confirm that a user identifier exists.

It does not decide whether that user may:

- read a Conversation;
- invite a Group member;
- join a Call;
- administer a Meeting;
- access another context's protected resource.

Authorization belongs to the context that owns the protected resource.

The authenticated requester is identified by the verified principal.

A current authenticated principal does not require a redundant Identity existence lookup merely because its `userId` appears in a use case.

Existence lookup is primarily required for untrusted target identifiers supplied by a client or external system.

## Minimal Public Contracts

A public cross-context contract exposes only facts required by a real consumer.

It must not promise domain state that the provider does not currently model.

For example, a provider that models only user existence must not claim to answer whether an account is active, suspended, or deleted.

Public DTOs must not expose unnecessary:

- credentials;
- personal data;
- authorization internals;
- payment objects;
- persistence structure;
- aggregate behavior.

Presentation data and authorization data should not be combined merely for convenience.

## Asynchronous Integration

A committed provider fact with a real asynchronous consumer follows:

```text
Provider state change
+ provider-owned Outbox record
in one transaction

→ dispatcher or transport
→ provider-owned Integration Event
→ consumer adapter
→ consumer-owned application command
```

### Provider Responsibility

The provider owns:

- event meaning;
- event type;
- contract version;
- stable event identifier;
- aggregate reference;
- occurrence timestamp;
- lifecycle version when required;
- minimal committed payload.

### Consumer Responsibility

The consumer owns:

- deduplication;
- idempotent local updates;
- stale-event protection;
- consumer-side persistence;
- retry-safe processing;
- consumer-specific authorization or validation where required.

Delivery is assumed to be at least once unless another guarantee is explicitly established.

Consumers must therefore tolerate duplicate delivery.

## Domain Events and Integration Events

A Domain Event:

- belongs inside one bounded context;
- may evolve with the provider's internal model;
- may contain internal concepts;
- is not automatically durable;
- is not automatically a public contract.

An Integration Event:

- represents a committed provider fact;
- is an intentional public contract;
- has a stable identifier;
- is versioned;
- uses a minimal payload;
- supports at-least-once delivery;
- requires idempotent consumption.

An internal Domain Event object must not be published directly as the Integration Event contract.

The provider explicitly translates committed domain meaning into the public Integration Event.

Returning a Domain Event from a use case, or creating one in memory, does not prove reliable cross-context delivery.

## Transactional Outbox

When reliable asynchronous delivery is required, the provider writes:

- its domain state change;
- its Outbox record;

inside the same provider-owned transaction.

The Outbox prevents:

- committing the business change while losing the integration fact;
- publishing a fact for a transaction that later rolls back.

The Outbox belongs to the producing context.

A dispatcher or queue is not the durable substitute for an Outbox record when loss of the integration fact would violate the accepted consistency model.

## No Infrastructure Without a Consumer

Huddle introduces an Outbox, broker, projection, or event-processing path only when a real consumer requires it.

The existence of a Domain Event does not by itself justify:

- an Outbox;
- a message broker;
- a local projection;
- a distributed event platform.

Integration infrastructure must be tied to an implemented consumer and a documented consistency requirement.

This prevents speculative event architecture from expanding every context prematurely.

## Gateway Composition

A response that combines multiple context-owned views belongs outside the contributing contexts.

The composition shape is:

```text
Gateway or application composer
├─ provider capability A
└─ provider capability B
```

The composer:

- owns the combined response shape;
- invokes the required public capabilities;
- applies the endpoint's partial-failure policy;
- does not transfer fact ownership between contexts.

A provider controller must not import another context merely to disguise cross-context composition as one provider's endpoint.

Availability coupling of a composed endpoint does not mean one provider owns or depends on the other provider's domain.

## Failure Semantics

Cross-context contracts distinguish:

- confirmed absence;
- confirmed denial;
- invalid request;
- dependency unavailable;
- retryable concurrency failure;
- provider failure.

A provider or composition adapter translates infrastructure failures into explicit application-level outcomes.

The following must not leak into consumer domain logic:

- PostgreSQL error codes;
- MongoDB driver errors;
- Stripe SDK exceptions;
- NestJS internal exceptions;
- transport-specific failures.

A caught dependency error must not be silently converted into:

- not found;
- confirmed Free;
- confirmed authorization denial;
- successful empty data.

Fail-open or fail-closed behavior must be explicitly defined by the protected operation's owning context.

## NestJS Module Boundary

A context module intentionally exports only the provider tokens required by its public application APIs.

Exporting a TypeScript module class such as:

```typescript
export class IdentityModule {}
```

makes that class importable from the TypeScript file.

It does not automatically make every NestJS provider inside that module injectable by another module.

The NestJS module's `exports` metadata must explicitly expose the intended public provider token.

The TypeScript setting:

```json
{
  "esModuleInterop": true
}
```

does not change NestJS dependency-injection visibility.

Public cross-context capabilities should use intentional provider tokens and minimal DTO contracts rather than exporting internal services broadly.

## Avoiding Context Library Cycles

Two contexts may have logical relationships in opposite directions without importing each other's internal libraries.

For example:

- one context may synchronously query another context's public capability;
- the provider may asynchronously publish an Integration Event consumed by the first context.

This must not produce mutual internal-library imports.

Instead:

- the consumer owns its port;
- the provider owns its public API;
- the event provider owns its Integration Event contract;
- the event consumer owns its application command;
- the composition root connects both sides.

The composition root may depend on both contexts without transferring domain ownership.

## Future Service Extraction

After a context is extracted into a separately deployed service:

- consumer ports remain conceptually stable;
- in-process adapters become HTTP, gRPC, messaging, or projection adapters;
- provider APIs become service contracts;
- timeouts and circuit behavior become explicit;
- Integration Events use an external transport;
- distributed tracing becomes more important;
- no service reads another service's database.

This pattern reduces extraction cost but does not make service extraction automatic or free.

Service extraction still requires operational, failure, deployment, and data-migration decisions.

## Rationale

This pattern provides:

- explicit dependency direction;
- context-owned language;
- minimal data exposure;
- clear authorization ownership;
- testable use cases;
- future transport replacement;
- protection against shared repositories;
- protection against broad public services;
- selective synchronous and asynchronous integration;
- controlled infrastructure growth.

It allows the modular monolith to remain operationally simple without treating in-process calls as boundary-free.

## Consequences

### Positive

- consumer use cases depend on stable ports;
- providers control exposed capabilities;
- internal entities remain private;
- tests can substitute consumer ports;
- service extraction changes adapters rather than domain use cases;
- cross-context dependencies remain visible;
- synchronous current-state reads stay simple;
- projections can be introduced later behind stable ports.

### Negative

- more interfaces and adapters are required;
- DTO translation adds code;
- composition-root wiring becomes important;
- poorly designed ports may still leak provider language;
- synchronous calls create operation-level availability coupling;
- asynchronous flows require idempotency and recovery;
- public contracts require compatibility discipline.

## Alternatives Considered

### Import Another Context's Repository

Rejected because it bypasses provider rules and couples the consumer to provider persistence.

### Inject an Internal Provider Service

Rejected because an internal service is not necessarily a deliberately supported public contract and may expose excessive capability.

### Use One Public API per Context

Rejected because a broad interface encourages consumers to depend on unrelated capabilities.

### Let the Provider Own Every Consumer Port

Rejected as the default because the consumer should express the capability it requires using its own language.

The provider still owns the public API it offers.

### Use Events for Every Cross-Context Read

Rejected because authorization and other current-state decisions often require a current synchronous answer.

### Use Synchronous Calls for Every Read

Rejected as a universal rule because high-volume or availability-sensitive presentation data may later justify a local projection.

### Put Combined Responses in a Provider Context

Rejected because response composition does not transfer ownership of the contributing facts.

### Share Domain Models in a Common Contract Package

Rejected because provider domain models would become shared mutable dependencies.

A narrow public contract package may contain stable DTOs and Integration Event schemas, but not provider aggregates.

## Sources of Truth

This ADR owns the general cross-context integration pattern.

Specific capabilities and policies belong to:

- Context relationships: [`../architecture/context-map.md`](../architecture/context-map.md)
- Persistence and event consistency: [`../architecture/data-and-consistency.md`](../architecture/data-and-consistency.md)
- Security boundaries: [`../architecture/security.md`](../architecture/security.md)
- Identity capabilities: [`../contexts/identity.md`](../contexts/identity.md)
- Chat capabilities: [`../contexts/chat.md`](../contexts/chat.md)
- Billing capabilities: [`../contexts/billing.md`](../contexts/billing.md)
- Conferencing capabilities: [`../contexts/conferencing/README.md`](../contexts/conferencing/README.md)
- Notification capabilities: [`../contexts/notification.md`](../contexts/notification.md)

Concrete HTTP, realtime, and Integration Event payloads belong in `contracts/`.

## Revisit When

Reconsider a specific integration when:

- call frequency creates measured latency;
- provider availability creates unacceptable failure;
- a local projection is justified;
- a context is extracted;
- freshness requirements change;
- security requires stronger isolation;
- a public API becomes too broad;
- a legitimate batch use case exceeds the current contract;
- a new asynchronous consumer requires reliable delivery.

Changing one adapter does not require abandoning the overall pattern.
