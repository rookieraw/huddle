# Phase 4 — Billing and Portfolio Release

Status: Planned  
Depends on: Phase 3 — Voice and Video Calling  
Portfolio milestone: First public Portfolio Release  
Next phase: Phase 5 — Meetings

## Objective

Implement real Free and Pro subscription entitlements through Stripe and publish the first reproducible Huddle portfolio demonstration.

Phase 4 replaces transitional static entitlement adapters with the real Billing capability.

The first Portfolio Release demonstrates the completed backend progression through:

- Identity;
- Chat;
- voice and video Calling;
- Billing;
- deployment and operational recovery.

Standalone Meetings and Notification remain later work.

## Implementation Authority

Phase 4 may implement:

- Billing domain behavior;
- Stripe Checkout;
- durable Stripe webhook processing;
- real entitlement APIs and adapters;
- current-user response composition;
- portfolio deployment;
- portfolio demonstration support;
- release and operations documentation.

Billing behavior must follow:

- [`../../contexts/billing.md`](../../contexts/billing.md)
- [`../../product/tiers.md`](../../product/tiers.md)

ADR 0005 explains why BillingAccount, paid Subscription, and effective entitlements are separate concepts. It is not the source of current lifecycle rules.

This phase must not expand into Meetings, Notification, Enterprise, Workspace billing, or recording.

## Entry Criteria

Phase 4 begins only after Phase 3 has delivered:

- deployed Identity and Chat capabilities;
- Direct voice and video Calls;
- Group voice and video Calls;
- durable CallSession state;
- working WebRTC signaling;
- coturn fallback;
- mediasoup group media;
- the Conferencing Transactional Outbox;
- idempotent Chat timeline projection;
- target OCI ARM64 validation;
- documented deployment and recovery procedures.

The transitional entitlement boundary must already exist:

```text
Consumer-owned EntitlementsPort
→ StaticFreeEntitlementsAdapter
```

Consumer domain rules must not depend directly on that static implementation.

## Required Documents by Task

| Task                    | Read these documents                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| Billing domain          | This phase file and `contexts/billing.md`                                                                   |
| Product tier mapping    | This phase file and `product/tiers.md`                                                                      |
| Stripe Checkout         | This phase file, `contexts/billing.md`, `contracts/http.md`, and `architecture/security.md`                 |
| Stripe webhook          | This phase file, `contexts/billing.md`, `architecture/data-and-consistency.md`, and `operations/runbook.md` |
| Consumer adapter        | This phase file, `product/tiers.md`, the consuming Context document, and ADR 0004                           |
| `/users/me` composition | This phase file, `contexts/identity.md`, `contexts/billing.md`, and ADR 0004                                |
| Deployment              | This phase file, `operations/deployment.md`, and ADR 0007                                                   |
| Portfolio demonstration | This phase file and `operations/portfolio-demo.md`                                                          |
| Tests                   | Relevant task documents and `engineering/testing.md`                                                        |

Do not load Stripe implementation details for an ordinary consumer entitlement-enforcement task.

## Included Scope

### Billing Domain

Implement:

- BillingAccount;
- paid Subscription;
- effective-tier calculation;
- synthesized Free entitlements when no paid Subscription exists;
- retained paid-subscription history;
- cancel-at-period-end behavior;
- immediate effective Free for `past_due`;
- cancellation and paid-period expiry;
- resubscription;
- minimal Billing public APIs.

The current domain model and lifecycle rules come only from:

`contexts/billing.md`

Free and Pro features, limits, and public price come only from:

`product/tiers.md`

### Stripe Checkout

Implement authenticated Stripe Checkout for the supported Pro plan.

Required delivery includes:

- server-controlled Stripe Price ID mapping;
- find-or-create BillingAccount behavior;
- Stripe customer association;
- outgoing Stripe-request idempotency;
- trusted user ownership;
- client-safe Checkout response;
- correlation data required for reconciliation;
- pending or confirmation behavior after browser return.

The browser redirect is not authoritative subscription state.

Detailed Checkout authority and security rules come from:

- `contexts/billing.md`
- `architecture/security.md`
- `contracts/http.md`

### Stripe Webhook Processing

Implement:

- raw-body Stripe signature verification;
- durable PostgreSQL Webhook Inbox;
- unique Stripe event deduplication;
- BullMQ asynchronous processing;
- pending-inbox recovery;
- bounded retries;
- Subscription reconciliation;
- out-of-order event safety;
- atomic Billing-state update and Inbox completion;
- operational visibility for failed processing.

PostgreSQL remains the durable source of webhook receipt and processing state.

Redis and BullMQ must not be the only evidence that accepted Billing work exists.

Detailed receipt, response, processing, and reconciliation rules come from:

- `contexts/billing.md`
- `architecture/data-and-consistency.md`
- `operations/runbook.md`

### Real Entitlement Integration

Replace the Portfolio runtime binding:

```text
Consumer EntitlementsPort
→ StaticFreeEntitlementsAdapter
```

with:

```text
Consumer EntitlementsPort
→ BillingEntitlementsAdapter
→ Billing public API
```

Apply the real Billing adapter to protected operations already implemented in:

- Chat;
- Conferencing Calls.

Consumer domain and application rules must not be rewritten merely because the adapter changes.

The static adapter may remain available for isolated tests but must not remain the deployed Portfolio runtime binding.

### Current-User Composition

Implement a composed authenticated current-user endpoint outside both Identity and Billing context libraries.

The composition uses:

```text
Application composition root
├─ Identity profile-query capability
└─ Billing current-subscription or entitlement capability
```

Required boundary:

- Identity does not import Billing;
- Billing does not import Identity for profile data;
- the authenticated principal supplies the current `userId`;
- the composite endpoint applies the documented partial-failure policy;
- pure Identity authentication endpoints remain independent.

Before Billing is available, the composition root owns the static Free adapter.

Phase 4 replaces it with a real Billing-backed adapter file rather than adding Billing literals to the controller.

### Existing Resource Downgrade Behavior

Verify that Chat and Conferencing apply the non-destructive downgrade policy defined by Billing and their own Context rules.

Phase 4 must demonstrate that:

- existing data remains preserved;
- new protected growth observes the current effective entitlement;
- active live sessions retain their numeric capacity snapshot;
- Billing failure does not silently grant or synthesize an entitlement result;
- unrelated Billing-independent reads remain available where designed.

The consuming Context remains the owner of resource enforcement.

### Portfolio Demonstration

Deliver a repeatable one-operator demonstration.

The demonstration must support this high-level progression:

1. begin with a confirmed Free account;
2. display the current effective tier and entitlements;
3. demonstrate a Free restriction;
4. begin Stripe Checkout in test mode;
5. complete the test payment;
6. process the verified webhook;
7. refresh the same account;
8. display confirmed Pro entitlements;
9. demonstrate a newly permitted Pro operation;
10. optionally demonstrate a cancellation or downgrade transition.

The detailed setup, prepared data, commands, recovery steps, and expected results belong only in:

`operations/portfolio-demo.md`

The demonstration must not expose:

- a public “become Pro” endpoint;
- a client-controlled tier;
- an unauthenticated reset endpoint;
- a production runtime switch that grants arbitrary Pro access;
- real Stripe charges.

Participant-capacity behavior may be supported by automated test evidence when manually controlling many accounts would weaken the demonstration.

### Portfolio Deployment

Release the documented Huddle deployment on the OCI Always Free baseline.

Validate the integrated system for:

- HTTPS;
- HTTP API;
- WebSocket;
- production OAuth callbacks;
- PostgreSQL;
- MongoDB;
- Redis and BullMQ recovery;
- Stripe webhook delivery;
- Direct WebRTC;
- TURN fallback;
- mediasoup Group Calls;
- backup and restore;
- deployment rollback.

The deployment must be described as a low-traffic portfolio environment without a production SLA.

Exact topology and procedures belong in:

- `operations/deployment.md`
- `operations/runbook.md`
- ADR 0007

Render is not part of the baseline deployment.

## Contracts and Operations

Create or update:

- Billing HTTP contracts;
- Stripe webhook contract behavior;
- entitlement DTO contracts;
- composed current-user response;
- relevant consumer error mappings;
- deployment procedure;
- operations runbook;
- backup and restore procedure;
- portfolio demonstration guide.

Implementation secrets, Stripe identifiers, callback URLs, and deployment-specific values must remain outside public source-controlled documentation unless represented as safe placeholders.

## Required Verification

### Domain

Verify the Billing model defined by `contexts/billing.md`, including:

- effective-tier calculation;
- time-bound subscription behavior;
- absence versus failure;
- retained subscription history;
- no payment-failure grace period;
- entitlement projection.

Use an injected clock for time boundaries.

### Application

Verify:

- authenticated Checkout ownership;
- server-controlled price selection;
- BillingAccount idempotency;
- Stripe customer uniqueness;
- outgoing Stripe idempotency;
- static-to-real adapter replacement;
- Billing-unavailable behavior;
- current-user composition;
- existing Chat and Calling enforcement through real entitlements.

### Webhook Integration

Verify:

- raw-body signature validation;
- invalid-signature rejection;
- durable Inbox persistence;
- duplicate event safety;
- persistence and enqueue failure behavior;
- BullMQ retry;
- recovery after Redis or worker interruption;
- out-of-order delivery;
- current-state reconciliation;
- atomic Billing update and Inbox completion;
- safe job redelivery after process interruption.

### End to End

Verify:

- confirmed Free current-user response;
- Stripe test-mode Checkout;
- webhook-driven Pro activation;
- a Pro-protected operation;
- cancel-at-period-end;
- immediate effective Free for `past_due`;
- non-destructive downgrade;
- growth restriction after downgrade;
- fail-closed protected mutation during Billing outage;
- continued Billing-independent access where documented.

### Release Validation

Verify:

- deployed OCI application behavior;
- OAuth callback configuration;
- Stripe webhook reachability;
- WebSocket connectivity;
- WebRTC and TURN behavior;
- mediasoup Group Call behavior;
- database persistence;
- BullMQ recovery;
- backup;
- restore;
- rollback;
- reproducible portfolio demonstration.

Record the validation evidence and known environmental limitations.

## Public Release Documentation

Before the Portfolio Release, update:

- root `README.md`;
- public docs navigation;
- product scope and tiers;
- implemented architecture;
- Context delivery status;
- HTTP and realtime contracts;
- ADR index;
- engineering setup;
- testing guidance;
- deployment guide;
- operations runbook;
- portfolio demonstration guide;
- delivery status.

Public documentation must clearly distinguish:

- implemented behavior;
- accepted target design;
- deferred scope;
- deployment limitations;
- measured capacity evidence.

## Definition of Done

Phase 4 is complete only when:

- BillingAccount and paid Subscription behavior match `contexts/billing.md`;
- Free remains the default without eager Billing records;
- Stripe Checkout uses server-controlled configuration;
- Pro activation is webhook-authoritative;
- Webhook processing is durable, idempotent, recoverable, and ordering-safe;
- no payment-failure grace period exists;
- real Billing adapters replace static runtime bindings;
- Chat and Calling enforce real Free and Pro entitlements;
- `/users/me` is composed outside Identity and Billing;
- the one-operator Stripe test-mode demonstration works;
- the integrated system is released on the OCI baseline;
- backup, restore, and rollback are exercised;
- public documentation matches implemented behavior;
- known limitations and capacity evidence are published;
- the release can be reproduced from documented instructions;
- [`../status.md`](../status.md) is updated.

## Explicitly Deferred

Do not implement during Phase 4:

- standalone Meetings;
- Meeting links or lobby;
- Notification delivery;
- Slack integration;
- recording;
- annual plans;
- multiple paid plans;
- coupons;
- payment-failure grace period;
- Enterprise;
- Workspace billing;
- SAML;
- anonymous guests;
- multiple media nodes;
- Kubernetes;
- multi-region deployment;
- production SLA claims.
