# Project Status

Last updated: 2026-09-01

Current implementation phase: Phase 2 — Contacts and Chat

Current activity: Authenticated Contact-request creation HTTP delivery implemented and verified

Portfolio Release target: End of Phase 4

## Purpose

This document records Huddle's current implementation state.

It answers:

- what is implemented now;
- what is currently being worked on;
- what begins next;
- whether a blocker prevents progress;
- which validation gates remain ahead.

It does not define target architecture, detailed Phase scope, or task-level work.

## Status Summary

| Area                        | Status                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| Phase 1 Identity            | Completed                                                                                  |
| Phase 2 Identity additions  | `displayName` and the three public application APIs implemented                            |
| Contacts                    | Authenticated creation HTTP endpoint implemented; remaining lifecycle and frontend pending |
| Direct and Group Chat       | Not started                                                                                |
| MongoDB Message persistence | Not started                                                                                |
| Realtime Chat               | Not started                                                                                |
| Deployment foundation       | Planned                                                                                    |
| OpenAPI and Swagger UI      | Dependency declared; generation and UI not configured; planned for Phase 2.5               |
| Voice and Video Calling     | Planned                                                                                    |
| Billing                     | Planned                                                                                    |
| First Portfolio Release     | Planned                                                                                    |
| Meetings                    | Later                                                                                      |
| Notification                | Later                                                                                      |
| Hardening                   | Later                                                                                      |

`Planned` and `Later` do not mean implemented.

Source code and automated tests remain authoritative for exact runtime behavior.

## Implemented

### Phase 1 — Identity

The completed implementation includes:

- user registration;
- email verification;
- credential login;
- Google OAuth login;
- GitHub OAuth login;
- access-token handling;
- refresh-token handling;
- Identity persistence;
- Identity tests;
- NestJS application integration.

Phase 1 does not include the later public capabilities required by Chat.

Its historical boundary is recorded in:

[`phases/01-identity.md`](phases/01-identity.md)

### Phase 2 — Identity `displayName`

The completed implementation includes:

- a validated, trimmed Unicode `displayName` on every credential and OAuth User;
- a required, validated `displayName` field on credential registration;
- provider display-name capture for Google and GitHub OAuth, with a non-sensitive, id-derived fallback when absent;
- preservation of an existing User's display name across repeat login and provider linking;
- a PostgreSQL migration that backfilled every existing Phase 1 User with a valid display name before enforcing the required constraint.

Its detailed boundary is recorded in:

[`../contexts/identity.md`](../contexts/identity.md)  
[`../contracts/identity-http.md`](../contracts/identity-http.md)

### Phase 2 — Identity Public APIs

The completed implementation includes:

- an Authentication API that verifies access-token signature, expiration, supported token type, and required claims, returning only the trusted user identifier and expiration;
- a Directory API that distinguishes an existing user from a missing user without exposing Identity internals;
- a bounded Profile Query API that normalizes duplicate identifiers, distinguishes missing profiles, and returns only `userId` and `displayName`;
- a single batched PostgreSQL profile lookup for at most 50 input identifiers;
- intentional NestJS provider tokens and package-entrypoint exports for all three capabilities;
- compatibility coverage for the existing Passport-protected HTTP path.

The public boundary does not add Chat production adapters, directory or profile HTTP endpoints, Identity Integration Events, an Outbox, profile projections, or caches.

### Phase 2 — Contact-request Creation HTTP Delivery

The authenticated `POST /contact-requests` endpoint is implemented and
verified. It derives requester authority from the verified principal, supports
first creation and pending-relationship reuse, and returns the stable success
and error contract. Exact runtime behavior and evidence boundaries are recorded
in [`../contracts/chat-http.md`](../contracts/chat-http.md).

This implementation does not add another Contacts lifecycle endpoint or a
frontend Contacts flow.

## Current Activity

The minimum Identity support required by Phase 2 is implemented and verified: `displayName`, Authentication, Directory, and Profile Query.

The Contact-request Domain/Application core and Chat-owned PostgreSQL persistence are implemented and verified. The implementation creates pending relationships, rejects self-directed and confirmed missing-target requests, classifies Directory and repository unavailability, and reuses the persisted relationship for sequential duplicate or opposing requests.

PostgreSQL enforces one current relationship per unordered user pair. Real PostgreSQL integration tests verify schema migration, repository mapping, unordered lookup, collision handling, and genuinely concurrent same-direction and opposing request convergence.

The API Gateway application composition boundary now delivers authenticated
Contact-request creation over HTTP. The remaining Contacts lifecycle and
frontend delivery are still pending.

The remaining Phase 2 implementation includes:

- remaining Contacts lifecycle and frontend delivery;
- Direct and Group Conversations;
- MongoDB Message persistence;
- authenticated realtime Chat;
- concurrency-safe quota enforcement;
- browser Authentication experience after its security and transport gates are accepted;
- the responsive frontend foundation and authorized Contacts and Chat web journeys.

Accepted target documentation is not evidence of implementation for the remaining items above.

## Next Implementation Work

Further Phase 2 implementation continues with the remaining Contacts delivery, followed by the remaining Chat capabilities and their authorized frontend slices in:

[`phases/02-chat.md`](phases/02-chat.md)

Its remaining high-level outcome is:

- remaining Contacts delivery;
- Direct Conversations;
- Group Conversations;
- remaining PostgreSQL Chat metadata;
- MongoDB Messages;
- authenticated realtime Chat;
- concurrency-safe quota enforcement;
- the transitional static Free entitlement adapter;
- browser Authentication experience after its security and transport gates are accepted;
- the responsive frontend foundation and authorized Contacts and Chat web journeys.

The Phase file is authoritative for the detailed implementation boundary.

## Current Blockers

There are no known product or architecture blockers preventing continued Phase 2 implementation.

The public documentation restructure that previously gated Phase 2 is complete.

## Future Validation Gates

The following are future validation gates rather than current blockers:

| Gate                                              | Required by |
| ------------------------------------------------- | ----------- |
| OCI ARM64 application build                       | Phase 2.5   |
| HTTPS and WebSocket deployment                    | Phase 2.5   |
| OpenAPI and Swagger UI contract alignment         | Phase 2.5   |
| mediasoup ARM64 execution                         | Phase 3     |
| Direct WebRTC validation                          | Phase 3     |
| TURN relay validation                             | Phase 3     |
| Free and Pro Group Call capacity evidence         | Phase 3     |
| Stripe webhook deployment validation              | Phase 4     |
| Backup and restore exercise                       | Phase 4     |
| Reproducible one-operator Portfolio demonstration | Phase 4     |

Failure at a future gate must be recorded when discovered. It must not be reported as a current blocker before validation occurs.

## Not Yet Implemented

Do not currently assume the existence of:

- remaining Contact management endpoints and frontend delivery;
- Direct or Group Chat;
- MongoDB Message persistence;
- Chat Socket.IO events;
- generated OpenAPI documentation or Swagger UI;
- voice or video Calls;
- mediasoup;
- coturn;
- Stripe Billing;
- Free-to-Pro upgrade;
- standalone Meetings;
- durable in-app Notifications;
- Slack integration;
- Enterprise;
- product-event Email Notification;
- recording;
- microservices;
- Kubernetes.

Accepted target documentation is not evidence of implementation.

## Update Rules

Update this document when:

- the current activity changes materially;
- Phase 2 implementation begins;
- a significant Phase milestone is completed;
- the active delivery Phase changes;
- a real blocker is discovered or resolved;
- a planned capability becomes implemented;
- the Portfolio Release boundary changes.

When a Phase completes:

1. update its Phase status;
2. update this status summary;
3. record relevant validation evidence;
4. update affected Context delivery-state summaries;
5. ensure public documentation does not describe planned behavior as implemented.

Keep this document limited to project-level implementation state. Detailed work items belong in the active Phase specification, and operational diagnostics belong in the runbook.

## Navigation

- Product boundary: [`../product/scope.md`](../product/scope.md)
- Tier values: [`../product/tiers.md`](../product/tiers.md)
- Delivery order: [`roadmap.md`](roadmap.md)
- Active Phase specification: [`phases/02-chat.md`](phases/02-chat.md)
- Identity Context: [`../contexts/identity.md`](../contexts/identity.md)
- Chat Context: [`../contexts/chat.md`](../contexts/chat.md)
