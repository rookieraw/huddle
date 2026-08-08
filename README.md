# Huddle

Huddle is a backend-focused collaboration platform built as a long-term portfolio project.

The project applies Domain-Driven Design and a modular-monolith architecture to identity, chat, realtime communication, WebRTC conferencing, subscription billing, and notification delivery.

Huddle is under active development. Accepted target capabilities are documented separately from implemented behavior.

## Current Status

Phase 1 — Identity is complete.

Implemented capabilities include:

- Email and password registration
- Email verification
- Credential login
- Google OAuth login
- GitHub OAuth login
- JWT access tokens
- Refresh-token rotation
- Logout and token revocation
- PostgreSQL Identity persistence
- Unit, integration, and E2E tests

The next implementation phase is Phase 2 — Contacts and Chat.

See the current implementation state in:

[`docs/delivery/status.md`](docs/delivery/status.md)

## Product Direction

The accepted product direction includes:

- Contacts
- Direct and Group Conversations
- Realtime messaging
- Direct voice and video Calls
- Group voice and video Calls
- Standalone Meetings
- Free and Pro subscriptions
- Stripe Billing
- Durable in-app Notifications
- Minimal Pro-only Slack integration

A documented capability is not necessarily implemented.

Committed, deferred, and stretch scope is defined in:

[`docs/product/scope.md`](docs/product/scope.md)

Free and Pro entitlements are defined in:

[`docs/product/tiers.md`](docs/product/tiers.md)

## Architecture

Huddle begins as a DDD modular monolith.

Primary Bounded Contexts:

- Identity
- Chat
- Conferencing
- Billing
- Notification

The architecture follows these boundaries:

- Each Context owns its domain behavior.
- Each Context owns its persistence mappings and migrations.
- Contexts do not import another Context's domain or repository internals.
- Synchronous cross-context reads use consumer-owned ports and provider-owned Public APIs.
- Reliable asynchronous integration uses versioned Integration Events and provider-owned Transactional Outboxes.
- The application composition root wires Contexts together.
- Future service extraction replaces adapters without transferring domain ownership.

Architecture documentation:

- [System Architecture](docs/architecture/system.md)
- [Context Map](docs/architecture/context-map.md)
- [Data and Consistency](docs/architecture/data-and-consistency.md)
- [Security Architecture](docs/architecture/security.md)
- [Architecture Decision Records](docs/decisions/README.md)

## Technology

### Application

- NestJS
- TypeScript
- Next.js
- React
- pnpm workspaces

### Persistence and Infrastructure

- PostgreSQL with Prisma
- MongoDB with Mongoose
- Redis
- BullMQ
- Docker Compose

### Realtime and Media

- Socket.IO
- WebRTC
- mediasoup
- coturn

### External Integrations

- Google OAuth
- GitHub OAuth
- Stripe
- Slack

Some technologies belong to later delivery phases and may be installed or planned before their product capability is implemented.

Exact dependency declarations and resolved versions belong to the workspace manifests and lockfile.

## Application Structure

```text
Huddle/
├── apps/
│   ├── api-gateway/       NestJS application and composition root
│   └── web/               Next.js frontend
└── libs/
    ├── shared-kernel/
    ├── identity/
    ├── chat/
    ├── conferencing/
    ├── billing/
    └── notification/
```

The libraries represent bounded-context or shared-kernel ownership. They are not independent deployed microservices in the current architecture.

## Getting Started

Prerequisites and the complete local setup procedure are documented in:

[Local Development Setup](docs/engineering/setup.md)

The expected local applications are:

- Web: `http://localhost:3000`
- API Gateway: `http://localhost:4000`

Local Docker Compose provides PostgreSQL, MongoDB, and Redis.

A running infrastructure container does not mean its later-phase product capability has already been implemented.

## Testing

Huddle uses different test layers according to risk:

- pure domain tests;
- application use-case tests;
- persistence integration tests with real containers;
- HTTP and realtime contract tests;
- application E2E tests;
- provider and media validation where required.

The project uses risk-based coverage and regression protection rather than a blanket percentage target.

See:

[Testing Strategy](docs/engineering/testing.md)

## Delivery Roadmap

The delivery sequence is:

1. Identity
2. Contacts and Chat
3. CI/CD and deployment foundation
4. Voice and video Calling
5. Billing and first Portfolio Release
6. Standalone Meetings
7. Notification and Slack
8. Hardening and portfolio preparation

The authoritative roadmap and Phase specifications are available under:

[`docs/delivery/`](docs/delivery/)

The first Portfolio Release is targeted at the end of the Billing phase. Meetings and Notification remain later work.

## Deployment Direction

The accepted Portfolio deployment targets a low-traffic OCI Ampere A1 environment using Docker Compose on a single Linux host.

The target supports the networking control required by:

- HTTPS
- WebSocket
- mediasoup media transport
- coturn listener and relay traffic

The deployment does not claim:

- high availability;
- multi-region resilience;
- zero-downtime releases;
- production SLA;
- production-scale media capacity.

See:

[Portfolio Deployment](docs/operations/deployment.md)

## Documentation

See the [Documentation Index](docs/README.md) for product scope, architecture, Contexts, contracts, decisions, delivery plans, engineering guidance, and operations.
