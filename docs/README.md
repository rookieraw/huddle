# Huddle Documentation

## Purpose

This directory contains Huddle's project documentation.

The repository-root [`README.md`](../README.md) introduces the project, summarizes its capabilities and technology stack, and provides the quickest path to running it.

This document provides:

- documentation navigation;
- source-of-truth boundaries;
- task-based reading paths;
- document maintenance rules.

---

## Documentation Principles

### Single Source of Truth

Each kind of information has one authoritative location.

Documents may link to another source, but they should not copy its complete rules for convenience.

Examples:

- tier values belong in `product/tiers.md`;
- current progress belongs in `delivery/status.md`;
- exact payloads belong in `contracts/`;
- package versions belong in executable package manifests and the lockfile;
- operational procedures belong in `operations/`;
- decision rationale belongs in Architecture Decision Records.

### Task-oriented Reading

Read only the documents relevant to the current question or task.

The usual implementation context is:

```text
Current status
+ active Phase
+ owning Context
+ relevant Contract
+ applicable cross-cutting architecture
```

Additional documents should be opened only when the task crosses their responsibility.

### Target Is Not Implementation

An accepted target design does not mean that the feature exists.

Use [`delivery/status.md`](delivery/status.md) to determine what is implemented now.

Use the active Phase file to determine what may be implemented next.

### Avoid Over-fragmentation

A document should have one coherent responsibility, but related rules should remain together when separating them would make ordinary work harder.

Examples:

- Calls and Meetings have separate capability documents but share one Conferencing Context;
- all HTTP contracts currently remain in one file;
- realtime Chat and Conferencing contracts are separate because their transports and payloads differ.

Split a document only when readers repeatedly need unrelated sections or its ownership becomes ambiguous.

---

# Start Here

## Project Overview

Read:

1. [`../README.md`](../README.md)
2. [`product/scope.md`](product/scope.md)
3. [`product/user-experience.md`](product/user-experience.md)
4. [`delivery/status.md`](delivery/status.md)

This path explains what Huddle is, its accepted product boundary, how users should experience its capabilities, and what currently exists.

## Architecture

Read:

1. [`architecture/system.md`](architecture/system.md)
2. [`architecture/context-map.md`](architecture/context-map.md)
3. [`decisions/README.md`](decisions/README.md)

Open a detailed Context, cross-cutting architecture document, or ADR only for the topic being examined.

## Starting Implementation Work

Read:

1. [`delivery/status.md`](delivery/status.md)
2. the active file under [`delivery/phases/`](delivery/phases/)
3. the owning file under [`contexts/`](contexts/)
4. the relevant file under [`contracts/`](contracts/)
5. [`engineering/testing.md`](engineering/testing.md)

For frontend work, also read [`product/user-experience.md`](product/user-experience.md) and the applicable security and transport contracts.

## Local Development

Read:

1. [`engineering/setup.md`](engineering/setup.md)
2. [`engineering/dependencies.md`](engineering/dependencies.md)
3. [`engineering/testing.md`](engineering/testing.md)

## Deployment and Recovery

Read:

1. [`operations/deployment.md`](operations/deployment.md)
2. [`operations/runbook.md`](operations/runbook.md)
3. the active delivery Phase
4. the affected Context when diagnosing product behavior

## Portfolio Review

Read:

1. [`../README.md`](../README.md)
2. [`product/scope.md`](product/scope.md)
3. [`product/user-experience.md`](product/user-experience.md)
4. [`architecture/system.md`](architecture/system.md)
5. [`architecture/context-map.md`](architecture/context-map.md)
6. [`decisions/README.md`](decisions/README.md)
7. [`operations/portfolio-demo.md`](operations/portfolio-demo.md)

---

# Documentation Map

## Product

| Document                                                   | Responsibility                                                                   | Update when                                                  |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [`product/scope.md`](product/scope.md)                     | Committed, deferred, stretch, and non-goal product boundary                      | A capability enters, leaves, or changes scope                |
| [`product/user-experience.md`](product/user-experience.md) | Cross-capability journeys, information architecture, and shared UI-state meaning | A cross-capability journey or shared experience rule changes |
| [`product/tiers.md`](product/tiers.md)                     | Free and Pro features, prices, limits, and downgrade policy                      | A user-facing entitlement or quota changes                   |

Product documents answer:

```text
What should the product permit?
+
How should users experience those capabilities?
```

They do not answer when a capability is delivered or whether it is implemented.

---

## Architecture

| Document                                                                       | Responsibility                                                                             | Update when                                                                        |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| [`architecture/system.md`](architecture/system.md)                             | System boundaries, runtime components, and high-level data flow                            | A major system component or system boundary changes                                |
| [`architecture/context-map.md`](architecture/context-map.md)                   | Bounded Context ownership and dependency direction                                         | Context ownership or integration direction changes                                 |
| [`architecture/data-and-consistency.md`](architecture/data-and-consistency.md) | Datastore roles, transactions, eventual consistency, retries, Inbox, and Outbox principles | A system-wide persistence or consistency rule changes                              |
| [`architecture/security.md`](architecture/security.md)                         | System-wide trust boundaries and security principles                                       | Authentication transport, public boundary, provider, or security principle changes |

Architecture documents answer:

```text
How is the system divided, and which cross-cutting rules apply?
```

They do not contain exact endpoint payloads or current Phase progress.

---

## Contexts

| Document                                                                 | Responsibility                                                                                    | Update when                                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [`contexts/identity.md`](contexts/identity.md)                           | Identity ownership, authentication capability, directory and profile boundaries                   | Identity domain behavior or public capability changes   |
| [`contexts/chat.md`](contexts/chat.md)                                   | Contacts, Conversations, membership, Group administration, quotas, Messages, and Chat persistence | Chat invariants or owned behavior changes               |
| [`contexts/conferencing/README.md`](contexts/conferencing/README.md)     | Shared Conferencing media architecture and live-session responsibility                            | Shared Call and Meeting media behavior changes          |
| [`contexts/conferencing/calls.md`](contexts/conferencing/calls.md)       | Conversation Call lifecycle, capacity, deadlines, leave, and rejoin                               | Call product lifecycle changes                          |
| [`contexts/conferencing/meetings.md`](contexts/conferencing/meetings.md) | Standalone Meeting lifecycle, roles, invitations, lobby, and Meeting Chat eligibility             | Meeting domain behavior changes                         |
| [`contexts/billing.md`](contexts/billing.md)                             | BillingAccount, Subscription, effective tier, Stripe, Inbox, and entitlement API                  | Billing lifecycle or public capability changes          |
| [`contexts/notification.md`](contexts/notification.md)                   | Durable Notifications, selected event consumption, and Slack delivery                             | Notification behavior or accepted event catalog changes |

Context documents answer:

```text
Which Context owns this rule, and what invariants must it preserve?
```

They do not own exact HTTP paths, Socket.IO event names, or tier values.

---

## Contracts

| Document                                                                   | Responsibility                                                                | Update when                                        |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------- |
| [`contracts/http.md`](contracts/http.md)                                   | Shared HTTP conventions, errors, pagination, and Context contract registry    | A shared HTTP convention or registry entry changes |
| [`contracts/identity-http.md`](contracts/identity-http.md)                 | Implemented Identity HTTP endpoints and transitional behavior                 | An Identity HTTP endpoint changes                  |
| [`contracts/chat-realtime.md`](contracts/chat-realtime.md)                 | `/chat` namespace, Message events, acknowledgements, and reconnect behavior   | Chat realtime behavior changes                     |
| [`contracts/conferencing-realtime.md`](contracts/conferencing-realtime.md) | Shared `/conferencing` connection, session, participant, and lifecycle events | Shared Conferencing realtime behavior changes      |
| [`contracts/conferencing-p2p.md`](contracts/conferencing-p2p.md)           | Direct Call SDP offer, answer, and ICE signaling                              | Direct Call P2P signaling changes                  |
| [`contracts/conferencing-sfu.md`](contracts/conferencing-sfu.md)           | mediasoup transport, Producer, and Consumer signaling                         | Group Call or Meeting SFU signaling changes        |
| [`contracts/meeting-realtime.md`](contracts/meeting-realtime.md)           | Meeting lobby and Meeting-specific realtime notifications                     | Meeting realtime behavior changes                  |
| [`contracts/integration-events.md`](contracts/integration-events.md)       | Versioned cross-context event envelope, catalog, payloads, and consumers      | An Integration Event is added or changed           |

Contracts answer:

```text
What crosses a public or Context boundary?
```

A contract must be updated in the same change as its implementation.

A Domain Event class, controller DTO, or queue job is not automatically a public contract.

Do not create an empty Context-specific HTTP contract before its first exact endpoint is designed.

---

## Architecture Decision Records

| Document                                                                                             | Responsibility                                                                 | Update when                                                |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| [`decisions/README.md`](decisions/README.md)                                                         | ADR index, status rules, and ADR template                                      | An ADR is added, superseded, or reclassified               |
| [`decisions/0001-modular-monolith.md`](decisions/0001-modular-monolith.md)                           | Why Huddle begins as a DDD modular monolith                                    | Deployment or service-boundary strategy changes materially |
| [`decisions/0002-context-owned-persistence.md`](decisions/0002-context-owned-persistence.md)         | Why persistence remains owned by each Context                                  | Data ownership strategy changes materially                 |
| [`decisions/0003-message-storage-strategy.md`](decisions/0003-message-storage-strategy.md)           | Why Chat Messages use controlled MongoDB persistence                           | Chat Message storage strategy changes materially           |
| [`decisions/0004-cross-context-integration.md`](decisions/0004-cross-context-integration.md)         | Why consumers own ports and providers expose narrow public contracts           | Cross-context integration pattern changes materially       |
| [`decisions/0005-billing-entitlement-model.md`](decisions/0005-billing-entitlement-model.md)         | Why BillingAccount, paid Subscription, and effective entitlements are separate | Billing model strategy changes materially                  |
| [`decisions/0006-call-and-meeting-lifecycle.md`](decisions/0006-call-and-meeting-lifecycle.md)       | Why CallSession, Meeting, and ConferenceSession are separate                   | Conferencing domain separation changes materially          |
| [`decisions/0007-portfolio-deployment-topology.md`](decisions/0007-portfolio-deployment-topology.md) | Why the Portfolio deployment targets one OCI VM                                | Hosting strategy changes materially                        |

ADRs answer:

```text
Why was a durable architectural choice made?
```

They do not replace current Context rules or operational procedures.

A materially different decision should supersede the existing ADR.

---

## Delivery

| Document                                                                                                     | Responsibility                                                            | Update when                                               |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | --------------------------------------------------------- |
| [`delivery/roadmap.md`](delivery/roadmap.md)                                                                 | Delivery order, gates, and Portfolio Release sequence                     | Phase order or milestone boundary changes                 |
| [`delivery/status.md`](delivery/status.md)                                                                   | Current implementation state, current activity, next work, and blockers   | Implementation state or active work changes materially    |
| [`delivery/phases/01-identity.md`](delivery/phases/01-identity.md)                                           | Historical boundary and completion record for Identity                    | A correction to the historical Phase boundary is required |
| [`delivery/phases/02-chat.md`](delivery/phases/02-chat.md)                                                   | Authorized Phase 2 Identity additions, Contacts, Chat, and web experience | Phase 2 scope or gate changes                             |
| [`delivery/phases/02.5-deployment-foundation.md`](delivery/phases/02.5-deployment-foundation.md)             | CI/CD and deployable HTTP and Chat foundation                             | Deployment-foundation gate changes                        |
| [`delivery/phases/03-calling.md`](delivery/phases/03-calling.md)                                             | Authorized Direct and Group Calling work                                  | Phase 3 scope or gate changes                             |
| [`delivery/phases/04-billing-and-portfolio-release.md`](delivery/phases/04-billing-and-portfolio-release.md) | Billing implementation and first Portfolio Release                        | Phase 4 scope or release boundary changes                 |
| [`delivery/phases/05-meetings.md`](delivery/phases/05-meetings.md)                                           | Authorized standalone Meeting work                                        | Phase 5 scope or gate changes                             |
| [`delivery/phases/06-notification.md`](delivery/phases/06-notification.md)                                   | Authorized Notification and minimal Slack integration                     | Phase 6 scope or event-catalog gate changes               |
| [`delivery/phases/07-hardening.md`](delivery/phases/07-hardening.md)                                         | Security, performance, failure, and portfolio hardening                   | Final validation boundary changes                         |

Delivery documents answer:

```text
What may be implemented now, in which order, and what is already complete?
```

A future Phase document is not authorization to implement its features early.

---

## Engineering

| Document                                                     | Responsibility                                                                                                        | Update when                                                 |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [`engineering/setup.md`](engineering/setup.md)               | Local installation, environment, infrastructure, database initialization, and startup                                 | Local setup or executable development configuration changes |
| [`engineering/testing.md`](engineering/testing.md)           | Test layers, risk-based coverage, frontend, concurrency, provider, realtime, media, and failure-recovery verification | Test strategy or CI quality gate changes                    |
| [`engineering/dependencies.md`](engineering/dependencies.md) | Dependency ownership, update policy, build approval, and verification                                                 | Dependency policy or approved exception changes             |

Engineering documents describe repeatable development practices.

They do not duplicate exact dependency versions from manifests.

---

## Operations

| Document                                                       | Responsibility                                                                | Update when                                        |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------- |
| [`operations/deployment.md`](operations/deployment.md)         | OCI topology, exposure, deployment sequence, backups, rollback, and evolution | Executable deployment behavior or topology changes |
| [`operations/runbook.md`](operations/runbook.md)               | Failure diagnosis, safe recovery, replay, restoration, and rollback decisions | A recoverable failure mode or procedure changes    |
| [`operations/portfolio-demo.md`](operations/portfolio-demo.md) | One-operator demonstration setup, sequence, evidence, and contingency         | Demonstration behavior or Portfolio scope changes  |

Operations documents answer:

```text
How is the implemented system deployed, recovered, and demonstrated?
```

Planned procedures must remain labeled as planned until exercised.

---

# Task-based Reading Guide

| Task                                 | Minimum documents                                                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Check what exists now                | `delivery/status.md`                                                                                                       |
| Plan the next implementation         | `delivery/status.md` and the active Phase                                                                                  |
| Plan a frontend journey              | `product/user-experience.md`, `delivery/status.md`, active Phase, and applicable contracts                                 |
| Implement a frontend slice           | `product/user-experience.md`, active Phase, applicable contracts, `architecture/security.md`, and `engineering/testing.md` |
| Change product scope                 | `product/scope.md` and `delivery/roadmap.md`                                                                               |
| Change a tier limit                  | `product/tiers.md`, affected Context, and active Phase                                                                     |
| Change a domain invariant            | Owning Context, active Phase, and tests                                                                                    |
| Add an HTTP endpoint                 | `contracts/http.md`, owning Context-specific HTTP contract, owning Context, and active Phase                               |
| Change an Identity HTTP endpoint     | `contracts/identity-http.md`, `contexts/identity.md`, and relevant Phase                                                   |
| Change a shared HTTP convention      | `contracts/http.md`, affected Context contracts, and affected tests                                                        |
| Add Chat Socket.IO behavior          | `contracts/chat-realtime.md`, `contexts/chat.md`, and active Phase                                                         |
| Add shared Conferencing behavior     | `contracts/conferencing-realtime.md`, relevant Conferencing Context document, and active Phase                             |
| Add Direct Call P2P signaling        | `contracts/conferencing-realtime.md`, `contracts/conferencing-p2p.md`, `contexts/conferencing/calls.md`, and Phase 3       |
| Add Group Call SFU signaling         | `contracts/conferencing-realtime.md`, `contracts/conferencing-sfu.md`, Conferencing Context, and Phase 3                   |
| Add Meeting realtime behavior        | Applicable shared or SFU contract, `contracts/meeting-realtime.md`, `contexts/conferencing/meetings.md`, and Phase 5       |
| Add a synchronous cross-context read | Consumer Context, provider Context, and ADR 0004                                                                           |
| Add an Integration Event             | Producer Context, consumer Context, `contracts/integration-events.md`, and ADR 0004                                        |
| Change persistence ownership         | Owning Context, `architecture/data-and-consistency.md`, and ADR 0002                                                       |
| Implement Stripe behavior            | `contexts/billing.md`, Phase 4, and applicable Contract                                                                    |
| Change deployment                    | `operations/deployment.md`, active Phase, and ADR 0007 when strategy changes                                               |
| Diagnose a deployed failure          | `operations/runbook.md` and affected Context                                                                               |
| Prepare the portfolio demonstration  | `operations/portfolio-demo.md` and `delivery/status.md`                                                                    |

An ADR is not required reading for every routine implementation after its pattern is established.

---

# Conflict Handling

When documents disagree:

1. identify the conflicting statements;
2. identify which document owns each concern;
3. do not silently combine or correct them;
4. resolve the intended rule;
5. update every affected reference in the same documentation change.

Do not use a general precedence list to overwrite clear ownership.

Examples:

- `product/tiers.md` owns numeric entitlements;
- `contexts/billing.md` owns Subscription lifecycle;
- `delivery/status.md` owns current implementation state;
- `contracts/http.md` owns HTTP status mapping;
- executable Compose configuration owns actual deployed service definitions.

For implemented runtime behavior, source code and tests provide evidence of what currently executes.

A disagreement between implementation and its owning contract is a defect to resolve, not a reason to preserve two permanent sources.

---

# Documentation Change Checklist

When changing documentation, verify:

- the owning document is updated;
- copied rules were not introduced elsewhere;
- target behavior is not described as implemented;
- current status remains in `delivery/status.md`;
- future work remains constrained by its Phase;
- public contracts match implementation where implemented;
- an implementation-status change is followed by a search for stale planned, deferred, not-implemented, and current-activity statements in every affected owning document;
- no affected document contains internally contradictory implementation-state statements;
- relative links resolve;
- superseded ADR status is correct;
- obsolete paths are not reintroduced.

A documentation-only change must not silently change executable product behavior.

---

# New Document Rule

A new Markdown file requires a distinct long-term responsibility.

Before adding one, ask:

1. Which concern does it own?
2. Why can an existing document not own that concern?
3. Who needs to open it independently?
4. What event causes it to be updated?
5. Would removing it create ambiguity or duplicated information?

If those questions do not have clear answers, update an existing authoritative document instead.
