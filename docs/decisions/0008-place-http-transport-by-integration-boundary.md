# ADR 0008 — Place HTTP Transport by Integration Boundary

Status: Accepted  
Recorded: 2026-09-03  
Supersedes: None  
Superseded by: None

## Context

Huddle's bounded contexts share one NestJS backend deployment, but an HTTP
interface does not always have the same integration boundary.

Identity currently hosts its provider-local controllers and HTTP DTOs inside
`libs/identity`. Those interfaces deliver Identity capabilities and use
Identity-owned application and infrastructure dependencies.

The current Chat HTTP delivery has a different boundary. It authenticates the
requester through Identity's public Authentication API, translates the verified
principal to the minimal requester identity required by Chat, invokes Chat
application behavior, and maps application outcomes to HTTP responses. The API
Gateway also composes the Identity public APIs, Chat ports, persistence, and use
case providers required by that delivery path.

ADR 0001 allows the API Gateway to host transport interfaces while preserving
bounded-context domain ownership. ADR 0004 defines consumer-owned ports,
provider-owned public APIs, and composition-root adapters. Neither decision
defines how to choose the source location of an HTTP controller, HTTP DTO,
authentication guard, or exception filter when valid integration boundaries
differ between contexts.

Without an explicit placement criterion, the different Identity and Chat
folder structures can be mistaken for incomplete alignment. That encourages
moves or framework abstractions whose only benefit is visual symmetry, even
when they would weaken dependency direction or separate code that changes for
the same transport reason.

## Decision

Huddle places an HTTP transport interface according to its integration
boundary, orchestration responsibility, dependency direction, and reason to
change. Mirrored folder structures are not the criterion for architectural
consistency.

A provider-local HTTP interface may be hosted by the provider context when the
interface delivers that context's capability through provider-owned
dependencies and does not require cross-context transport orchestration.
Identity's current controllers and DTOs are a valid example. Their placement is
not wrong, legacy, or pending migration, but it is not a structural template
that every other context must copy.

An HTTP interface is hosted by the API Gateway when its delivery boundary
requires Gateway-owned authentication translation, cross-context public APIs,
or composition wiring. The current Chat HTTP delivery follows this rule.

### Current Chat Responsibility Split

`libs/chat` owns:

- Contact, Conversation, and Message domain responsibility;
- Chat Domain and Application code;
- consumer-owned ports;
- Chat persistence;
- public Chat application capabilities.

The API Gateway interface layer owns the current Chat:

- controller;
- HTTP request DTO;
- authentication guard;
- exception filter;
- verified-requester translation;
- HTTP response and error mapping.

The API Gateway composition layer owns wiring:

- Identity's public Authentication and Directory APIs;
- Chat's consumer-owned ports;
- Chat persistence providers;
- Chat application use cases;
- the Gateway-hosted transport providers.

The Gateway authenticates the requester through Identity's public
Authentication API and passes only the translated `userId` required by the Chat
application input. Hosting this transport orchestration in the Gateway does not
transfer Contact, Conversation, or Message ownership to the Gateway.

Chat must not directly import Identity controllers, internal guards,
repositories, entities, ORM models, or infrastructure implementations. It also
must not depend on an Identity guard or define NestJS-specific abstract Guard or
Filter extension contracts merely to reproduce another context's folder shape.

### DTO Boundaries

An HTTP DTO is a transport contract for parsing and validating a client request
or formatting an HTTP response. A provider-owned public application DTO or a
consumer-owned application DTO is a cross-context application contract.

These DTOs serve different consumers, dependency directions, and change
reasons. Sharing the term "DTO" does not require them to live in the same
package or layer.

## Rationale

Code that translates one HTTP interaction should remain with the component
responsible for orchestrating that interaction. This keeps authentication,
principal translation, request validation, response mapping, and dependency
wiring visible at the boundary where they are combined.

The rule preserves inward dependency direction for Chat. Chat application code
continues to express its needs through its own ports and inputs, while the
composition root may depend on both Chat and Identity public capabilities. A
folder-symmetry rule would instead encourage Chat to acquire Identity or
NestJS-specific dependencies that its business behavior does not need.

The rule also preserves valid provider-local delivery. Moving Identity solely
to make the repository look uniform would add churn without correcting an
ownership or dependency problem.

Architectural consistency is therefore evaluated by whether equivalent
responsibilities follow the same ownership and dependency principles, not by
whether every bounded-context library has an identical directory tree.

## Consequences

### Positive

- Transport orchestration stays with the boundary that owns its dependencies.
- Chat Domain and Application code remain independent of Identity internals and
  HTTP framework extension contracts.
- Identity may retain cohesive provider-local HTTP delivery.
- Cross-context dependencies remain visible in the composition root.
- HTTP mapping does not obscure or transfer domain ownership.
- Future placement decisions have an explicit criterion beyond directory
  appearance.

### Negative

- Bounded-context libraries may have intentionally different directory trees.
- A developer cannot infer transport ownership from folder symmetry alone and
  must inspect the integration boundary.
- Some tests and transport code for a context-owned capability may live in the
  API Gateway rather than beside the context's application code.
- The API Gateway can accumulate transport concerns and must be reviewed to
  ensure it does not acquire domain rules.

This decision changes no HTTP route, payload, response, error contract,
application behavior, domain ownership, or deployment topology.

## Alternatives Considered

### Move Chat Controllers and DTOs to Mirror Identity

Rejected because matching directory shapes would separate the current Chat
transport from the Gateway-owned authentication translation and composition
boundary. It would add indirection or new dependencies without changing domain
ownership or externally observable behavior.

### Let Chat Depend Directly on an Identity Guard

Rejected because an Identity guard is an internal framework adapter, not a
provider-owned public application capability. The dependency would couple Chat
transport to Identity implementation details and bypass the public
Authentication API boundary.

### Define NestJS-specific Abstract Guard or Filter Contracts in Chat

Rejected because Chat application behavior does not require framework extension
contracts. Introducing them would make Chat own speculative transport
abstractions solely to support a preferred folder shape.

### Wait Until Every Phase 2 API Exists and Move Them Together

Rejected because completing more endpoints would not establish that a move is
architecturally necessary. A later batch move based on the same symmetry goal
would create more churn, not stronger responsibility alignment.

### Restructure Identity to Create One Uniform Directory Layout

Rejected because Identity's provider-local HTTP placement does not currently
create an ownership, dependency, build, deployment, or maintainability problem.
Refactoring it solely for uniformity would disturb a valid boundary without a
demonstrated benefit.

## Revisit When

Reconsider the affected transport placement when one or more of the following
is demonstrated:

- authentication becomes stable global platform middleware rather than
  endpoint-specific translation;
- the API Gateway no longer hosts application transport interfaces;
- Chat is extracted into an independently deployed service;
- multiple contexts demonstrate a common transport abstraction with the same
  responsibility and change reason;
- the current placement causes an observable ownership, build, deployment, or
  maintainability problem.

A new folder preference or another context's directory shape is not, by itself,
a revisit condition.

## Related Documentation

- [System Architecture](../architecture/system.md)
- [DDD Modular Monolith](0001-modular-monolith.md)
- [Cross-context Integration](0004-cross-context-integration.md)
- [Identity Context](../contexts/identity.md)
- [Chat Context](../contexts/chat.md)
- [Shared HTTP Contract](../contracts/http.md)
- [Chat HTTP Contract](../contracts/chat-http.md)
