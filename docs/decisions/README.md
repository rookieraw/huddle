# Architecture Decision Records

## Purpose

Architecture Decision Records preserve the context, decision, alternatives, and consequences of significant Huddle architecture choices.

An ADR explains why a decision was made.

It is not the current operational guide and must not duplicate:

- Tier values
- API payloads
- Realtime event schemas
- Current deployment commands
- Current implementation status
- Detailed domain models

Those concerns belong to their active source-of-truth documents.

## Decision Index

| ADR                                           | Decision                                                               | Status   |
| --------------------------------------------- | ---------------------------------------------------------------------- | -------- |
| [0001](0001-modular-monolith.md)              | Use a DDD modular monolith                                             | Accepted |
| [0002](0002-context-owned-persistence.md)     | Enforce context-owned persistence                                      | Accepted |
| [0003](0003-message-storage-strategy.md)      | Use controlled polyglot persistence for Chat messages                  | Accepted |
| [0004](0004-cross-context-integration.md)     | Use consumer-owned ports and provider-owned public contracts           | Accepted |
| [0005](0005-billing-entitlement-model.md)     | Separate BillingAccount, paid Subscription, and effective entitlements | Accepted |
| [0006](0006-call-and-meeting-lifecycle.md)    | Separate conversation calls, Meetings, and live ConferenceSessions     | Accepted |
| [0007](0007-portfolio-deployment-topology.md) | Use a single-host OCI Portfolio deployment                             | Accepted |

## Status Values

### Proposed

The decision is under review and must not be treated as implementation authority.

### Accepted

The decision is approved and applies to relevant future work.

Accepted does not mean fully implemented.

### Superseded

A later ADR replaces this decision.

The original record remains unchanged except for:

- Status
- Superseded-by link
- Minor factual or formatting correction

### Rejected

The proposal was considered and intentionally not adopted.

A rejected ADR may remain when preserving the reasoning has long-term value.

## ADR Lifecycle

### Creating an ADR

Create an ADR when a decision materially affects:

- Bounded-context boundaries
- Dependency direction
- Persistence strategy
- Consistency model
- Cross-context contracts
- Security architecture
- Billing model
- Media topology
- Deployment topology
- A difficult-to-reverse technology choice

Do not create an ADR for:

- Routine refactoring
- A small implementation detail
- A temporary task
- A package patch update
- Information already owned by an active context or contract document

### Updating an ADR

Before acceptance, an ADR may be edited as the proposal evolves.

After acceptance:

- Preserve the original decision and reasoning.
- Correct only clear factual or formatting errors.
- Update its status when superseded.
- Create a new ADR for a materially different decision.

Do not rewrite history to make an old decision appear to have anticipated later information.

### Superseding an ADR

A replacement ADR must identify:

- The ADR it supersedes
- The changed assumptions
- The new decision
- Migration consequences

The previous ADR must link to the replacement.

## ADR Template

Use this structure:

```markdown
# ADR NNNN — Decision Title

Status: Proposed | Accepted | Superseded | Rejected  
Recorded: YYYY-MM-DD  
Supersedes: None or ADR link  
Superseded by: None or ADR link

## Context

Describe the forces, constraints, and problem.

## Decision

State the accepted decision clearly.

## Rationale

Explain why this option was selected.

## Consequences

Describe positive, negative, and operational consequences.

## Alternatives Considered

Describe credible alternatives and why they were not selected.

## Revisit When

List concrete conditions that justify reconsidering the decision.

## Related Documentation

Link active source-of-truth documents without copying their contents.
```

## Relationship to Active Documentation

| Information                   | Source of truth            |
| ----------------------------- | -------------------------- |
| Decision rationale            | Relevant ADR               |
| Current product limits        | `product/tiers.md`         |
| Current phase boundary        | `delivery/phases/`         |
| Current implementation status | `delivery/status.md`       |
| Current architecture          | `architecture/`            |
| Current domain design         | `contexts/`                |
| Current contracts             | `contracts/`               |
| Current deployment procedure  | `operations/deployment.md` |
| Current operational recovery  | `operations/runbook.md`    |

If an ADR and active documentation appear inconsistent:

1. Check whether a later ADR supersedes the decision.
2. Check the current delivery phase.
3. Treat the inconsistency as a documentation defect.
4. Do not silently choose one version.
5. Correct the active source or record a new decision.

## Task-Based Reading Guide

Read only the ADRs relevant to the current change.

Examples:

| Task                              | Relevant ADRs                   |
| --------------------------------- | ------------------------------- |
| Add a Chat repository             | 0002, 0003                      |
| Add a cross-context lookup        | 0004                            |
| Enforce a subscription capability | 0004, 0005                      |
| Add call signaling                | 0004, 0006                      |
| Add Meeting chat                  | 0004, 0006                      |
| Change deployment topology        | 0007                            |
| Extract a microservice            | 0001, 0002, 0004, and a new ADR |

Reading the entire ADR collection is not required for every change.

## Naming

ADR files use:

```text
NNNN-short-kebab-case-title.md
```

Numbers are never reused, even when an ADR is rejected or superseded.
