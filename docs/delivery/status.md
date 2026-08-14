# Project Status

Last updated: 2026-08-13  
Current implementation phase: Phase 2 — Contacts and Chat  
Current activity: Identity `displayName` implemented; Contacts and Chat implementation not yet started
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

| Area                        | Status                                                                  |
| --------------------------- | ----------------------------------------------------------------------- |
| Phase 1 Identity            | Completed                                                               |
| Phase 2 Identity additions  | `displayName` implemented; directory and profile-query APIs not started |
| Contacts                    | Not started                                                             |
| Direct and Group Chat       | Not started                                                             |
| MongoDB Message persistence | Not started                                                             |
| Realtime Chat               | Not started                                                             |
| Deployment foundation       | Planned                                                                 |
| Voice and Video Calling     | Planned                                                                 |
| Billing                     | Planned                                                                 |
| First Portfolio Release     | Planned                                                                 |
| Meetings                    | Later                                                                   |
| Notification                | Later                                                                   |
| Hardening                   | Later                                                                   |

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

Phase 2's remaining Identity work — the Authentication, Directory, and Profile Query Public APIs required by Chat — has not started.

## Current Activity

Phase 2 implementation has begun. Identity's `displayName` capability — the first required Phase 2 Identity addition — is implemented and verified.

Remaining Phase 2 work has not started:

- the Authentication, Directory, and Profile Query Public APIs required by Chat;
- Contacts;
- Direct and Group Conversations;
- MongoDB Message persistence;
- authenticated realtime Chat;
- concurrency-safe quota enforcement.

Accepted target documentation is not evidence of implementation for the remaining items above.

## Next Implementation Work

The next Phase 2 Identity work is the Authentication, Directory, and Profile Query Public APIs required by Chat, followed by:

[`phases/02-chat.md`](phases/02-chat.md)

Its remaining high-level outcome is:

- Contacts;
- Direct Conversations;
- Group Conversations;
- PostgreSQL Chat metadata;
- MongoDB Messages;
- authenticated realtime Chat;
- concurrency-safe quota enforcement;
- the transitional static Free entitlement adapter.

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

- cross-context Identity Public APIs;
- Contact management;
- Direct or Group Chat;
- MongoDB Message persistence;
- Chat Socket.IO events;
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
