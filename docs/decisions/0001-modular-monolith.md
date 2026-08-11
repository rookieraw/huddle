# ADR 0001 — Use a DDD Modular Monolith

Status: Accepted  
Recorded: 2026-08-07  
Supersedes: None  
Superseded by: None

## Context

Huddle contains several distinct business areas:

- Identity
- Chat
- Conferencing
- Billing
- Notification

These areas have different domain rules and may eventually require different scaling, deployment, or ownership boundaries.

Starting with independently deployed microservices would introduce network contracts, distributed failure handling, service discovery, observability, and deployment overhead before those costs are justified.

A conventional layered monolith would be operationally simpler but would make it easier for business boundaries to erode through shared entities, repositories, and unrestricted imports.

Huddle needs explicit domain boundaries and future extraction seams while remaining practical for one developer to build, test, deploy, and demonstrate.

## Decision

Huddle uses a Domain-Driven Design modular monolith.

The backend initially runs as one NestJS application composed from bounded-context libraries.

The accepted bounded contexts are:

- Identity
- Chat
- Conferencing
- Billing
- Notification

Each bounded context owns its:

- Domain model
- Application use cases
- Ports and adapters
- Persistence access
- Public application capabilities

Contexts must not access another context’s internal repositories, entities, ORM models, or infrastructure adapters.

Cross-context collaboration uses explicit application contracts or Integration Events according to the rules recorded in ADR 0004.

The API Gateway is the application composition root, not a bounded context. It may bind adapters, host transport interfaces, and compose responses that belong to no single context, but it must not own domain rules.

The Next.js application remains a separate client and is not part of the backend bounded-context model.

## Rationale

This approach provides:

- Explicit domain ownership
- One primary backend deployment unit
- Straightforward local development and debugging
- Context-local transactions
- Lower deployment and operational cost
- Visible cross-context dependencies
- Practical future service-extraction seams
- An architecture proportionate to a single-developer portfolio project

It demonstrates that service boundaries begin with ownership and contracts rather than the number of deployed processes.

## Consequences

### Positive

- Business rules remain grouped by bounded context.
- Most development and testing can run in one process.
- Context-local transactions remain straightforward.
- Cross-context dependencies must be represented explicitly.
- A future service extraction can preserve existing ports and contracts.
- Deployment remains manageable for one developer.

### Negative

- A process failure may affect several contexts.
- Contexts initially share one release cadence.
- Poorly controlled imports can still erode boundaries.
- In-process calls may conceal latency and failure concerns that appear after service extraction.
- Boundary enforcement requires architecture tests, import rules, documentation, and review.

## Boundary Enforcement

The project enforces the decision through:

- Context-oriented directory structure
- Public provider exports
- Consumer-owned ports
- Composition-root adapters
- Context-owned persistence
- TypeScript import restrictions where practical
- Architecture tests where practical
- ADR review for boundary changes

A technically possible TypeScript import is not necessarily architecturally permitted.

## Alternatives Considered

### Independently Deployed Microservices from the Start

Rejected because the project has not demonstrated a need for independent scaling, deployment cadence, team ownership, or failure isolation sufficient to justify distributed-system complexity.

### Conventional Layered Monolith

Rejected as the system-level structure because global controller, service, and repository layers would make bounded-context ownership easier to violate.

Layered or hexagonal structure may still be used inside each bounded context.

### Shared Domain Model

Rejected because similarly named concepts have different meanings and invariants in different contexts.

For example, an Identity User, Chat member, Billing user reference, and Conferencing participant must not become one shared mutable entity.

### Event-driven Integration for Every Interaction

Rejected because synchronous application queries remain appropriate when a consumer needs current information and no asynchronous consistency requirement exists.

Events are introduced only when there is a real asynchronous consumer and an explicit delivery requirement.

## Future Service Extraction

Service extraction is not part of the current committed roadmap.

A context may be extracted only after a concrete operational, scaling, security, deployment, or ownership need is demonstrated.

An extraction must preserve:

- Bounded-context ownership
- Context-owned persistence
- Consumer-owned ports
- Provider-owned public contracts
- Versioned Integration Events
- Explicit timeout, retry, observability, and failure behavior

The extraction must be recorded in a new ADR.

## Revisit When

Reconsider this decision when one or more of the following are demonstrated:

- A context requires independent scaling.
- A context requires an independent deployment cadence.
- A stronger process or host failure boundary is required.
- A security requirement demands physical isolation.
- Multiple teams require independent ownership.
- Media workloads materially interfere with application workloads.
- A context’s resource profile cannot be operated effectively in the shared application.
- Modular boundaries cannot be enforced adequately in one codebase.

A demonstrated problem should lead to extracting the affected context, not automatically converting the entire system to microservices.

## Related Documentation

- [System Architecture](../architecture/system.md)
- [Context Map](../architecture/context-map.md)
- [Context-owned Persistence](0002-context-owned-persistence.md)
- [Cross-context Integration](0004-cross-context-integration.md)
- [Portfolio Deployment Topology](0007-portfolio-deployment-topology.md)
- [Roadmap](../delivery/roadmap.md)
