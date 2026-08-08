# Delivery Roadmap

Status: Accepted  
Last reviewed: 2026-08-07  
Current implementation phase: Phase 2 — Contacts and Chat  
Current activity: Documentation migration before Phase 2 implementation

## Purpose

This document is the single source of truth for:

- delivery order;
- phase names;
- phase status;
- phase dependencies;
- major portfolio milestones;
- unscheduled future work.

It does not duplicate detailed phase scope or acceptance criteria.

Those belong to the individual files under `delivery/phases/`.

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

Context and Architecture documents describe accepted target design. They do not authorize early implementation.

The presence of an interface, event, entitlement, enum value, Conversation type, or extension point does not authorize its implementation.

## Roadmap

| Phase     | Outcome                             | Status    | Detailed authority                                                                         |
| --------- | ----------------------------------- | --------- | ------------------------------------------------------------------------------------------ |
| Phase 1   | Identity                            | Completed | [`phases/01-identity.md`](phases/01-identity.md)                                           |
| Phase 2   | Contacts and Chat                   | Next      | [`phases/02-chat.md`](phases/02-chat.md)                                                   |
| Phase 2.5 | CI/CD and Deployment Foundation     | Planned   | [`phases/02.5-deployment-foundation.md`](phases/02.5-deployment-foundation.md)             |
| Phase 3   | Voice and Video Calling             | Planned   | [`phases/03-calling.md`](phases/03-calling.md)                                             |
| Phase 4   | Billing and First Portfolio Release | Planned   | [`phases/04-billing-and-portfolio-release.md`](phases/04-billing-and-portfolio-release.md) |
| Phase 5   | Meetings                            | Later     | [`phases/05-meetings.md`](phases/05-meetings.md)                                           |
| Phase 6   | Notification                        | Later     | [`phases/06-notification.md`](phases/06-notification.md)                                   |
| Phase 7   | Hardening and Portfolio Preparation | Later     | [`phases/07-hardening.md`](phases/07-hardening.md)                                         |

Only one primary implementation Phase should be active at a time.

Phase 2.5 is a deliberate delivery gate between Chat and WebRTC work. It is not a parallel product-feature phase.

## Phase Outcomes

### Phase 1 — Identity

Establish user identity and authentication.

Phase 1 is complete.

Later Identity capabilities required by Chat belong to Phase 2 and do not reopen Phase 1.

### Phase 2 — Contacts and Chat

Deliver persistent authenticated communication through Contacts, Direct Conversations, Group Conversations, MongoDB Messages, and realtime messaging.

Phase 2 also introduces only the minimal Identity capabilities required by Chat.

### Phase 2.5 — CI/CD and Deployment Foundation

Establish repeatable validation, container builds, OCI deployment, HTTPS, WebSocket operation, migration execution, rollback, and secrets handling before introducing media infrastructure.

### Phase 3 — Voice and Video Calling

Deliver Direct and Group voice/video Calls from existing Chat Conversations using WebRTC, coturn, mediasoup, durable CallSession state, and reliable Chat timeline integration.

### Phase 4 — Billing and First Portfolio Release

Replace transitional entitlement adapters with real Stripe-backed Free and Pro Billing, then publish the first reproducible public Portfolio demonstration.

### Phase 5 — Meetings

Add standalone Instant and Scheduled Meetings, registered-user invitations, lobby admission, roles, screen sharing, and persistent Meeting chat.

### Phase 6 — Notification

Add durable in-app Notifications and a minimal user-owned Pro-only Slack delivery integration from selected committed Integration Events.

Product-event Email Notification remains deferred.

### Phase 7 — Hardening and Portfolio Preparation

Review and strengthen the implemented system through security, concurrency, performance, recovery, dependency, documentation, and demonstration validation.

Phase 7 is not a container for adding deferred features.

## First Portfolio Release

The first public Portfolio Release occurs at the end of Phase 4.

Its high-level demonstration includes:

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

Standalone Meetings and Notification are committed post-release capabilities.

## Post-Release Capabilities

Post-release committed work includes:

- Phase 5 standalone Meetings;
- Phase 6 durable in-app Notifications;
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
- independent microservice deployment;
- Kubernetes;
- multi-region infrastructure;
- horizontally scaled media nodes;
- production SLA.

The presence of a future architectural seam does not authorize this work.

Adding an item requires updating, as applicable:

- Product Scope;
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
- relevant Context documentation matches the implementation;
- operations documentation is updated where applicable;
- known deviations and limitations are recorded;
- deferred work has not been introduced silently;
- `delivery/status.md` is updated.

A later Phase must not depend on undocumented behavior from an earlier Phase.

## Status Meanings

| Status    | Meaning                                                                   |
| --------- | ------------------------------------------------------------------------- |
| Completed | Required Phase outcomes have been delivered and recorded                  |
| Next      | Next authorized implementation Phase after the current documentation gate |
| Planned   | Committed and ordered, but not active                                     |
| Later     | Committed post-release work, but not active                               |
| Deferred  | Not assigned to an authorized delivery Phase                              |

A planned or later capability must never be presented as implemented.

## Sources of Truth

This document is the source of truth for:

- delivery order;
- Phase names;
- Phase status;
- high-level Phase outcomes;
- first Portfolio Release timing;
- scheduled versus unscheduled work.

Detailed information belongs to:

- Product capability boundary: [`../product/scope.md`](../product/scope.md)
- Tier entitlements: [`../product/tiers.md`](../product/tiers.md)
- Current implementation status: [`status.md`](status.md)
- Phase specifications: [`phases/`](phases/)
- Context target designs: [`../contexts/`](../contexts/)
