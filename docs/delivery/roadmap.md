# Delivery Roadmap

Status: Accepted

Last reviewed: 2026-08-22

Current implementation phase: Phase 2 — Contacts and Chat

## Purpose

This document is the single source of truth for:

- delivery order;
- phase names;
- phase status;
- phase dependencies;
- major portfolio milestones;
- phase-level user-visible delivery;
- unscheduled future work.

It does not duplicate detailed phase scope, current activity, or acceptance criteria.

Those belong to:

- [`status.md`](status.md) for current activity and implementation state;
- the individual files under [`phases/`](phases/) for detailed Phase scope and completion criteria.

## Implementation Authorization

A capability may be implemented only when all three conditions are satisfied:

1. it belongs to the committed Product Scope;
2. it is included by the active Phase document;
3. it is included by the current task.

The rules are:

```text
Product Scope
∩ Active Phase
∩ Current Task
=
Authorized Implementation
```

A task may narrow an active Phase.

A task must not broaden an active Phase.

Context, Architecture, and User Experience documents describe accepted target design. They do not authorize early implementation.

The presence of an interface, journey, navigation seam, event, entitlement, enum value, Conversation type, or extension point does not authorize its implementation.

## User-visible Delivery Model

Huddle delivers user-visible product behavior incrementally with its owning Product Phase.

Frontend work is not postponed wholesale until the first Portfolio Release.

The rules are:

- each Product Phase defines the web experience necessary to operate and demonstrate its authorized behavior;
- the applicable Phase file owns detailed frontend authorization and completion evidence;
- [`../product/user-experience.md`](../product/user-experience.md) owns cross-capability experience principles, not Phase authorization;
- exact HTTP and realtime contracts must exist before a frontend slice depends on them;
- accepted target experience must not be described as implemented;
- future navigation or layout seams do not authorize later-Phase capabilities.

Phase 2 is the frontend transition point.

It may establish the shared web foundation and expose already-implemented Phase 1 Authentication behavior without reopening Phase 1 Domain scope.

Phase 2.5 remains responsible for repeatable validation, packaging, and deployment of the Next.js application with the HTTP and WebSocket foundation.

Before Phases 3 through 6 begin, their Phase documents must define the user-visible scope and verification required for their capabilities.

Phase 7 hardens implemented experience. It is not authorization to add omitted product journeys.

## Roadmap

| Phase     | Outcome                             | Status      | Detailed authority                                                                         |
| --------- | ----------------------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| Phase 1   | Identity                            | Completed   | [`phases/01-identity.md`](phases/01-identity.md)                                           |
| Phase 2   | Contacts and Chat                   | In progress | [`phases/02-chat.md`](phases/02-chat.md)                                                   |
| Phase 2.5 | CI/CD and Deployment Foundation     | Planned     | [`phases/02.5-deployment-foundation.md`](phases/02.5-deployment-foundation.md)             |
| Phase 3   | Voice and Video Calling             | Planned     | [`phases/03-calling.md`](phases/03-calling.md)                                             |
| Phase 4   | Billing and First Portfolio Release | Planned     | [`phases/04-billing-and-portfolio-release.md`](phases/04-billing-and-portfolio-release.md) |
| Phase 5   | Meetings                            | Later       | [`phases/05-meetings.md`](phases/05-meetings.md)                                           |
| Phase 6   | Notification                        | Later       | [`phases/06-notification.md`](phases/06-notification.md)                                   |
| Phase 7   | Hardening and Portfolio Preparation | Later       | [`phases/07-hardening.md`](phases/07-hardening.md)                                         |

Only one primary implementation Phase should be active at a time.

Phase 2.5 is a deliberate delivery gate between Chat and WebRTC work. It is not a parallel product-feature phase.

## Phase Outcomes

### Phase 1 — Identity

Establish user identity and authentication.

Phase 1 is complete.

Later Identity capabilities required by Chat belong to Phase 2 and do not reopen Phase 1.

Phase 2 may expose implemented Phase 1 Authentication behavior through the web application after the required browser-security and contract decisions are accepted.

### Phase 2 — Contacts and Chat

Deliver persistent authenticated communication through Contacts, Direct Conversations, Group Conversations, MongoDB Messages, realtime messaging, and the responsive web experience required to operate them.

Phase 2 also introduces only the minimal Identity capabilities required by Chat.

### Phase 2.5 — CI/CD and Deployment Foundation

Establish repeatable validation, container builds, Next.js and API delivery, OCI deployment, HTTPS, WebSocket operation, migration execution, rollback, and secrets handling before introducing media infrastructure.

### Phase 3 — Voice and Video Calling

Deliver Direct and Group voice/video Calls from existing Chat Conversations using WebRTC, coturn, mediasoup, durable CallSession state, reliable Chat timeline integration, and the user-visible controls required to operate them.

Detailed Calling UI authorization must be added to the Phase 3 specification before implementation begins.

### Phase 4 — Billing and First Portfolio Release

Replace transitional entitlement adapters with real Stripe-backed Free and Pro Billing, complete the user-visible upgrade journey, and publish the first reproducible public Portfolio demonstration.

Phase 4 integrates previously delivered web journeys. It is not a catch-all for omitted Phase 2 or Phase 3 frontend work.

### Phase 5 — Meetings

Add standalone Instant and Scheduled Meetings, registered-user invitations, lobby admission, roles, screen sharing, persistent Meeting chat, and the corresponding user-visible Meeting experience.

Detailed Meeting UI authorization must be added to the Phase 5 specification before implementation begins.

### Phase 6 — Notification

Add durable in-app Notifications, their user-visible recovery and read-state experience, and a minimal user-owned Pro-only Slack delivery integration from selected committed Integration Events.

Product-event Email Notification remains deferred.

Detailed Notification UI authorization must be added to the Phase 6 specification before implementation begins.

### Phase 7 — Hardening and Portfolio Preparation

Review and strengthen the implemented system and user experience through security, accessibility, responsive behavior, concurrency, performance, recovery, dependency, documentation, and demonstration validation.

Phase 7 is not a container for adding deferred features or missing earlier-Phase product journeys.

## First Portfolio Release

The first public Portfolio Release occurs at the end of Phase 4.

Its high-level demonstration includes:

- an operable integrated web journey;
- Identity;
- Contacts;
- Direct and Group Chat;
- Direct and Group voice/video Calling;
- WebRTC and TURN fallback;
- Free and Pro entitlement differences;
- Stripe Billing;
- durable webhook processing;
- automated validation;
- CI/CD;
- reproducible OCI deployment;
- architecture and operations documentation.

Detailed release acceptance belongs to:

[`phases/04-billing-and-portfolio-release.md`](phases/04-billing-and-portfolio-release.md)

The exact demonstration sequence belongs to:

[`../operations/portfolio-demo.md`](../operations/portfolio-demo.md)

Standalone Meetings and Notification are committed post-release capabilities.

## Post-Release Capabilities

Post-release committed work includes:

- Phase 5 standalone Meetings and their user-visible experience;
- Phase 6 durable in-app Notifications and their user-visible experience;
- Phase 6 minimal Pro-only Slack integration;
- Phase 7 hardening and final portfolio preparation.

“Post-release” means after the first Portfolio Release. It does not mean optional or currently implemented.

## Unscheduled Deferred Work

The following work has no authorized delivery Phase:

- Enterprise tier;
- Workspace or organization ownership;
- SAML Enterprise SSO;
- product-event Email Notification;
- comprehensive Notification preference matrix;
- multiple Slack Workspaces or destinations per user;
- Slack and Huddle Message synchronization;
- anonymous Meeting guests;
- calendar integration;
- recording;
- recording storage quotas;
- advanced Meeting moderation;
- native mobile applications;
- complete offline operation;
- a complete Progressive Web App commitment;
- independent microservice deployment;
- Kubernetes;
- multi-region infrastructure;
- horizontally scaled media nodes;
- production SLA.

The presence of a future architectural or user-interface seam does not authorize this work.

Adding an item requires updating, as applicable:

- Product Scope;
- User Experience;
- tier entitlements;
- this Roadmap;
- a Phase document;
- the relevant Context;
- an ADR when the decision is architectural.

## Phase Transition Rules

A Phase may move to `Completed` only when:

- its required behavior is implemented;
- critical tests pass;
- required contracts are documented;
- required user-visible journeys work where the Phase includes frontend delivery;
- relevant Context documentation matches the implementation;
- operations documentation is updated where applicable;
- known deviations and limitations are recorded;
- deferred work has not been introduced silently;
- `delivery/status.md` is updated.

A later Phase must not depend on undocumented behavior from an earlier Phase.

A high-level user-visible Roadmap outcome does not replace detailed authorization and evidence in the applicable Phase file.

## Status Meanings

| Status      | Meaning                                                  |
| ----------- | -------------------------------------------------------- |
| Completed   | Required Phase outcomes have been delivered and recorded |
| In progress | The Phase is active and has implemented or active work   |
| Planned     | Committed and ordered, but not active                    |
| Later       | Committed post-release work, but not active              |
| Deferred    | Not assigned to an authorized delivery Phase             |

An in-progress Phase may contain both implemented and pending behavior.

Use [`status.md`](status.md) for detailed current implementation state.

A planned or later capability must never be presented as implemented.

## Sources of Truth

This document is the source of truth for:

- delivery order;
- Phase names;
- Phase status;
- high-level Phase outcomes;
- phase-level user-visible delivery;
- first Portfolio Release timing;
- scheduled versus unscheduled work.

Detailed information belongs to:

- Product capability boundary: [`../product/scope.md`](../product/scope.md)
- Cross-capability user experience: [`../product/user-experience.md`](../product/user-experience.md)
- Tier entitlements: [`../product/tiers.md`](../product/tiers.md)
- Current implementation status: [`status.md`](status.md)
- Phase specifications: [`phases/`](phases/)
- Context target designs: [`../contexts/`](../contexts/)
- Exact transport contracts: [`../contracts/`](../contracts/)
- Portfolio demonstration: [`../operations/portfolio-demo.md`](../operations/portfolio-demo.md)
