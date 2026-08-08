# Portfolio Demonstration

Status: Planned; exact routes and preparation commands are added with the implementing phase

## Purpose

This document defines a repeatable Huddle portfolio demonstration that can be operated by one person.

The demonstration is designed to show:

- implemented product behavior;
- backend boundaries;
- persistence and consistency;
- realtime communication;
- WebRTC;
- Stripe-backed Free and Pro entitlements;
- failure-aware engineering decisions.

It must not require manually controlling five or ten active user accounts.

This document owns the demonstration sequence. It does not redefine product scope, tier values, or deployment architecture.

---

## Demonstration Principles

The demonstration should be:

- executable by one operator;
- short enough for a focused presentation;
- based on the deployed application;
- supported by automated evidence for scenarios that are awkward to perform manually;
- explicit about implemented and deferred capabilities;
- repeatable without unsafe production shortcuts.

The demonstration must not rely on:

- real Stripe charges;
- a public “become Pro” endpoint;
- a client-controlled tier;
- direct database editing during the presentation;
- an unauthenticated reset endpoint;
- manually operating ten browser sessions;
- fake claims of production scale;
- functionality scheduled for a later phase.

---

## Demonstration Structure

The recommended presentation has three layers.

### Layer 1 — Live Product Flow

Show the visible behavior through the application:

- authentication;
- Contacts and Chat;
- realtime Message delivery;
- Direct or Group Call;
- Free quota rejection;
- Stripe test-mode upgrade;
- Pro quota success.

### Layer 2 — Backend Evidence

Briefly show selected implementation or operational evidence:

- Bounded Context separation;
- context-owned persistence;
- Stripe durable Inbox;
- Transactional Outbox;
- idempotency;
- concurrency test;
- deployment health.

### Layer 3 — Automated Capacity Evidence

Use automated test or recorded measurement output for scenarios that are impractical for one operator:

- five-participant Free group call;
- ten-participant Pro group call;
- concurrent quota attempts;
- duplicate Stripe webhook;
- out-of-order Stripe events;
- media participant churn.

Automated evidence complements the live demonstration. It must not be presented as a live manual test.

---

## Recommended Duration

| Section                                     | Target duration |
| ------------------------------------------- | --------------: |
| Project and architecture introduction       |     1–2 minutes |
| Identity and Chat                           |     2–3 minutes |
| WebRTC Call                                 |     2–3 minutes |
| Free-to-Pro Billing flow                    |     3–5 minutes |
| Backend evidence and trade-offs             |     2–3 minutes |
| Questions or optional failure demonstration |       As needed |

The main path should remain understandable even when the available presentation time is reduced.

---

## Demonstration Accounts

Use two prepared accounts at most.

### Primary Account

The primary account demonstrates:

- authenticated current-user response;
- Free entitlements;
- group-ownership quota;
- Stripe Checkout;
- webhook-driven Pro activation;
- newly permitted Pro operation.

The same account remains in use throughout the Free-to-Pro transition.

### Secondary Account

The secondary account exists only when needed to demonstrate:

- Contacts;
- realtime Message delivery;
- Direct Call;
- two-party WebRTC.

Keep it signed in before the demonstration in a separate browser profile, private window, browser, or device.

The operator should not need to log in and out repeatedly during the presentation.

### Capacity Scenarios

Do not prepare ten manually controlled accounts merely to demonstrate participant limits.

Use automated evidence for participant-capacity enforcement and media-load validation.

---

## Prepared State

Before the demonstration, prepare the primary account with:

- confirmed Free effective tier;
- no paid Subscription;
- one owned Group Conversation;
- the Free owned-group limit therefore already reached;
- one existing Contact with the secondary account;
- one existing Direct Conversation;
- valid authentication;
- no incomplete Stripe Checkout that could confuse the flow.

Prepare the secondary account with:

- an accepted Contact relationship with the primary account;
- access to the Direct Conversation;
- an active authenticated browser session;
- microphone and camera permissions where required.

Prepared state must be created through:

- supported application behavior;
- a controlled local or Portfolio fixture mechanism;
- an authenticated administrative preparation process that is not publicly exposed.

Do not prepare the demonstration by editing production database rows during the presentation.

---

## Pre-Demonstration Checklist

### Deployment

Confirm:

- public application is reachable;
- HTTPS is valid;
- API health succeeds;
- WebSocket upgrade succeeds;
- PostgreSQL is healthy;
- MongoDB is healthy;
- Redis and required workers are healthy;
- sufficient disk and memory remain;
- the deployed revision is known.

### Identity

Confirm:

- both prepared accounts can authenticate;
- primary and secondary browser sessions are valid;
- OAuth callback configuration is correct if OAuth is shown;
- expired sessions have been refreshed before the presentation.

### Chat

Confirm:

- Contact and Direct Conversation already exist;
- Message history loads;
- realtime Message delivery works;
- the primary account owns exactly one Group Conversation;
- creating another Group Conversation is blocked while Free.

### Conferencing

Confirm:

- browser permissions are granted;
- required test devices are selected;
- coturn is reachable;
- mediasoup is healthy;
- the selected live Call path was rehearsed;
- feedback or echo is prevented by headphones or muted devices.

### Billing

Confirm:

- Stripe is in test mode;
- the configured Price ID maps to Pro;
- the webhook endpoint is reachable;
- the webhook signing secret matches the deployed environment;
- Billing worker processing is healthy;
- the primary account has no active paid Subscription;
- `/users/me` or its implemented equivalent reports confirmed Free.

### Evidence

Prepare links or commands for:

- CI result;
- concurrency test;
- duplicate webhook test;
- capacity-test result;
- architecture diagram;
- deployed revision.

Do not search for these materials during the live presentation.

---

## Main Demonstration Script

## 1. Introduce the Project

Explain briefly:

> Huddle is a backend-focused portfolio project built with NestJS, Next.js, DDD, and a modular monolith. It separates Identity, Chat, Conferencing, Billing, and Notification into Bounded Contexts while keeping the first deployment operationally appropriate for one developer.

Clarify:

- the system is a modular monolith;
- Context boundaries are designed for later extraction;
- the Portfolio deployment is a low-traffic single-host environment;
- the project does not claim to be a production-scale Microsoft Teams replacement.

Do not begin by listing every planned feature.

---

## 2. Show Identity

Using the primary account:

1. show an authenticated session;
2. show the current-user response or account page;
3. identify the stable user identity;
4. show that the effective tier is Free.

Optional implementation point:

> Identity owns authentication, but the current-user response is composed outside Identity because subscription data belongs to Billing.

Do not describe Google or GitHub OAuth as SAML or Enterprise SSO.

---

## 3. Show Contacts and Direct Chat

Use the prepared primary and secondary browser sessions.

1. open the Contact list;
2. select the secondary account;
3. enter the existing Direct Conversation;
4. send a Message from the primary account;
5. show realtime delivery to the secondary account;
6. refresh or reload history if useful to demonstrate persistence.

Explain:

> The Contact list and Conversation list are separate. Selecting a Contact resolves or opens the corresponding Direct Conversation.

Backend point:

> Chat persists the Message before acknowledging and broadcasting it. If broadcast fails after persistence, history remains the recovery path.

Keep private Message content simple and presentation-safe.

---

## 4. Show a WebRTC Call

From the Direct Conversation:

1. start a voice or video Call;
2. show the Call timeline entry in Chat;
3. accept from the prepared secondary session;
4. demonstrate two-party media;
5. leave from one participant;
6. demonstrate re-entry while the other participant remains;
7. end the final active participation;
8. show the Chat timeline entry transition to ended.

Explain:

- Chat owns the Conversation timeline;
- Conferencing owns Call lifecycle, signaling, participation, and media;
- the CallSession is durable;
- live media resources are process-bound;
- lifecycle facts reach Chat through a reliable Integration Event path.

If the live media path becomes unstable, move to the prepared evidence rather than repeatedly debugging during the demonstration.

---

## 5. Demonstrate the Free Restriction

Return to the primary account.

Prepared state:

```text
Effective tier: Free
Owned Group Conversations: 1
Free limit: 1
```

Attempt to create a second Group Conversation.

Expected result:

- the operation is rejected;
- no second Group Conversation is persisted;
- the response identifies a quota outcome without leaking internal Billing or database details;
- the UI may offer an upgrade path.

Explain:

> Chat owns the resource count and enforcement. Billing supplies the confirmed entitlement. The frontend does not decide whether creation is allowed.

This scenario demonstrates a real protected mutation without requiring multiple participants.

---

## 6. Start Stripe Checkout

From the same primary account:

1. select the Pro upgrade;
2. request a Checkout Session;
3. enter Stripe-hosted test Checkout;
4. complete payment with a documented Stripe test payment method;
5. return to Huddle.

Explain:

- the server controls the allowed Stripe Price ID;
- the client cannot submit an authoritative tier;
- Checkout creation is idempotent;
- the browser redirect is not proof of Pro access.

Immediately after returning, the UI may show a pending state until webhook processing completes.

Do not manually change the account tier if processing is delayed.

---

## 7. Show Webhook-Driven Pro Activation

After Checkout:

1. wait for the verified webhook to be durably accepted;
2. allow the Billing worker to process or reconcile it;
3. refresh the current-user response;
4. show the confirmed Pro effective tier;
5. show the resulting entitlements.

Expected backend sequence:

```text
Stripe webhook
→ raw-body signature verification
→ durable Webhook Inbox
→ asynchronous processing
→ Subscription reconciliation
→ committed Billing state
→ effective Pro entitlements
```

Explain:

> PostgreSQL records the accepted webhook before asynchronous processing. Redis and BullMQ coordinate delivery but are not the only evidence that the event exists.

If Pro does not activate, follow [`runbook.md`](./runbook.md). Do not bypass the webhook-authoritative design during the presentation.

---

## 8. Demonstrate the Newly Permitted Pro Operation

Using the same primary account, retry creation of the second Group Conversation.

Prepared state after upgrade:

```text
Effective tier: Pro
Owned Group Conversations: 1
Pro limit: 20
```

Expected result:

- the second Group Conversation is created;
- the owner is the authenticated primary user;
- the protected mutation observes the newly committed Pro entitlement;
- no Chat domain rule was rewritten during the upgrade.

Explain:

> The consumer-owned entitlement port stayed stable. Phase 4 replaced the static Free adapter with a Billing-backed adapter at the composition boundary.

This completes the primary Free-to-Pro demonstration.

---

## Optional Downgrade Demonstration

Do not include downgrade in the default live path unless it has been rehearsed and remains short.

A controlled downgrade demonstration may show:

- cancel-at-period-end remains Pro until the paid period ends;
- `past_due` becomes effective Free immediately after the Billing update commits;
- no payment-failure grace period exists;
- existing Group Conversations remain preserved;
- new protected growth is blocked at or above the Free limit;
- active Call capacity remains snapshotted.

Prefer automated tests or prepared evidence for time-bound lifecycle transitions.

Do not simulate downgrade through a public tier-switch endpoint.

---

## Automated Evidence Set

## Quota Concurrency

Show a test where concurrent requests attempt to cross an owned-group or member quota.

Evidence should demonstrate:

- the invariant is protected under concurrent execution;
- serialization conflicts use bounded retries;
- exhausted contention differs from confirmed quota failure;
- no over-quota resource is committed.

## Stripe Idempotency

Show tests for:

- duplicate Stripe event ID;
- repeated Checkout request;
- worker interruption and redelivery;
- state update and Inbox completion atomicity;
- out-of-order event reconciliation.

## Billing Failure

Show that:

- confirmed absence produces Free;
- repository failure does not produce Free;
- entitlement-protected mutation fails closed;
- Billing-independent login or Message history remains available where designed.

## Participant Capacity

Show automated or recorded evidence for:

- Free group Call capacity of five, including initiator;
- Pro group Call capacity of ten, including initiator;
- rejection of the next participant;
- concurrent final-slot joins;
- participant leave and rejoin;
- capacity snapshot across a tier change.

Keep product entitlement and measured deployment capacity clearly separated.

## Persistence and Recovery

Show selected evidence for:

- Message persistence before broadcast;
- duplicate Integration Event consumption;
- Outbox replay;
- Redis recovery from durable sources;
- PostgreSQL backup and restore;
- MongoDB backup and restore.

---

## Optional Later-Phase Extensions

These must not appear in the Phase 4 demonstration before implementation.

### Phase 5 — Meetings

Add:

- Pro Meeting creation;
- eligible Free participant joining;
- organizer admission;
- live Meeting session;
- writable pre-meeting and in-meeting chat;
- read-only Meeting Conversation after completion.

### Phase 6 — Notification

Add:

- durable in-app Notification;
- selected provider Integration Event;
- Pro-only Slack connection;
- one configured Slack destination;
- Slack failure without loss of the in-app Notification.

Product-event Email Notification remains deferred.

### Phase 7 — Hardening

Add measured evidence for:

- performance;
- capacity;
- failure injection;
- security boundaries;
- recovery exercises;
- final documentation consistency.

---

## Failure Contingencies

### Public OCI environment is unavailable

Use a rehearsed local or temporary compatible deployment.

State clearly which environment is being shown.

Do not claim that the fallback is the accepted permanent topology.

### Stripe webhook is delayed

Show the pending state and trace the durable Inbox through the Runbook.

If time is limited, continue with previously captured automated evidence.

Do not manually grant Pro.

### WebRTC media fails

Confirm whether the failure is:

- browser permission;
- signaling;
- coturn;
- mediasoup;
- host capacity.

Move to prepared evidence after one controlled retry.

Do not spend demonstration time repeatedly refreshing or changing firewall settings.

### Secondary browser session expires

Reauthenticate the prepared secondary account without changing the primary Billing flow.

### External provider is unavailable

Explain the dependency boundary and show controlled adapter or test evidence.

Do not substitute a different unverified provider during the presentation.

---

## What to Explain During Questions

### Why a modular monolith?

> The project needs clear domain ownership without the operational cost of prematurely deploying several services. Consumer-owned ports and provider Public APIs preserve an extraction seam.

### Why PostgreSQL and MongoDB?

> Relational aggregates and durable processing records require relational constraints and transactions. Chat entries form an append-oriented document workload whose MongoDB use is bounded and independently testable.

### Why Redis is not authoritative?

> Redis is useful for queues, live state, and coordination, but accepted business work must survive Redis loss through PostgreSQL Inbox or Outbox records and durable persistence.

### Why does Billing not create a row for every Free user?

> Free is synthesized from confirmed absence of paid subscription data. Registration should not create unnecessary Stripe customers or fake Subscription records.

### Why is there no payment-failure grace period?

> The portfolio model chooses immediate effective Free for `past_due` to keep entitlement behavior explicit. Cancel-at-period-end still preserves already-paid access until the period ends.

### Why not demonstrate ten users manually?

> Capacity and concurrency are better demonstrated with repeatable automated evidence. The live presentation focuses on product behavior and system integration without adding operator error.

### How would contexts become microservices?

> Keep the consuming port and replace its in-process adapter with a network adapter. Then add explicit transport, timeout, authentication, deployment, and data-migration decisions without moving domain ownership.

---

## Demonstration Safety

Before screen sharing:

- close terminals containing secrets;
- clear sensitive shell history where necessary;
- hide `.env`;
- use Stripe test mode;
- use presentation-safe account data;
- disable unrelated notifications;
- avoid displaying full private Message histories;
- prepare only the browser tabs and evidence required;
- confirm the recording does not expose credentials.

Do not show:

- JWTs;
- refresh tokens;
- OAuth secrets;
- Stripe secret keys;
- Stripe webhook secret;
- Slack tokens;
- TURN shared secret;
- database passwords;
- private deployment credentials.

---

## Completion Criteria

The Portfolio demonstration is ready when:

- one operator can complete the main path without improvisation;
- the same primary account moves from confirmed Free to confirmed Pro;
- the Free quota rejection is visible;
- Stripe test-mode Checkout succeeds;
- Pro activation is webhook-authoritative;
- the newly permitted Pro operation succeeds;
- Direct Chat and WebRTC behavior are demonstrated or backed by prepared evidence;
- multi-participant limits use automated evidence;
- failure contingencies are rehearsed;
- no unsafe tier-switch or reset endpoint exists;
- all claims match [`../delivery/status.md`](../delivery/status.md).

Rehearse the complete sequence before recording or presenting it.

---

## Source-of-Truth Boundaries

| Information                            | Authoritative source                                       |
| -------------------------------------- | ---------------------------------------------------------- |
| Demonstration sequence and preparation | This document                                              |
| Implemented capability status          | `docs/delivery/status.md`                                  |
| Free and Pro values                    | `docs/product/tiers.md`                                    |
| Portfolio Release authorization        | `docs/delivery/phases/04-billing-and-portfolio-release.md` |
| Final hardening requirements           | `docs/delivery/phases/07-hardening.md`                     |
| Deployment procedure                   | `docs/operations/deployment.md`                            |
| Failure recovery                       | `docs/operations/runbook.md`                               |
| Context behavior                       | Owning file under `docs/contexts/`                         |
| Exact endpoint and event contracts     | `docs/contracts/`                                          |
| Automated verification                 | Tests and CI configuration                                 |

When routes, fixture commands, service names, or evidence locations become executable, update this document in the same implementation change.
