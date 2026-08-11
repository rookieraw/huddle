# Billing Context

## Purpose

The Billing context owns paid subscription state, Stripe integration, and the calculation of a user's effective product tier.

It answers:

- whether a user currently has Free or Pro access;
- which entitlements follow from that effective tier;
- how Stripe lifecycle changes affect access;
- how Stripe webhook events are received and processed safely.

The authoritative Free and Pro feature comparison is defined in [`../product/tiers.md`](../product/tiers.md).

Billing must not redefine tier limits or product features independently.

---

## Delivery Status

Billing is scheduled for Phase 4.

Before Phase 4, consumers that require entitlement information use a static Free implementation located at the application composition root.

The transitional adapter must not be implemented inside Identity, Chat, or Conferencing.

Phase 4 replaces that adapter with the real Billing-backed implementation without changing consumer-owned ports.

See:

- [`../delivery/phases/04-billing-and-portfolio-release.md`](../delivery/phases/04-billing-and-portfolio-release.md)
- [`../decisions/0005-billing-entitlement-model.md`](../decisions/0005-billing-entitlement-model.md)

---

## Responsibilities

Billing owns:

- Billing accounts;
- Stripe customer identifiers;
- paid subscription lifecycle state;
- effective-tier calculation;
- entitlement queries;
- Stripe Checkout session creation;
- Stripe webhook receipt and validation;
- durable webhook deduplication;
- asynchronous webhook processing;
- reconciliation with Stripe;
- billing-related audit metadata.

Billing does not own:

- user authentication;
- user profiles;
- room membership or ownership;
- call or meeting participation;
- authorization rules inside other contexts;
- product presentation decisions in the frontend;
- feature limits independently from `product/tiers.md`.

Storing a `userId` does not create a runtime dependency on Identity.

`userId` is a cross-context identifier, not an Identity aggregate reference.

---

## Domain Model

### BillingAccount

A `BillingAccount` represents the billing identity associated with one Huddle user.

Suggested properties include:

- `id`;
- `userId`;
- `stripeCustomerId`;
- `createdAt`;
- `updatedAt`.

Invariants:

- one Huddle user has at most one Billing account;
- one Stripe customer belongs to at most one Billing account;
- a Billing account is created when the user first begins a paid checkout flow;
- registration alone does not create a Billing account;
- registration does not create a Stripe customer.

A Billing account may exist without a current paid subscription, for example when checkout was started but not completed.

### Subscription

A `Subscription` represents a real Stripe subscription relationship.

Suggested properties include:

- `id`;
- `billingAccountId`;
- `stripeSubscriptionId`;
- `stripePriceId`;
- `tier`;
- `status`;
- `cancelAtPeriodEnd`;
- `currentPeriodStartsAt`;
- `currentPeriodEndsAt`;
- `createdAt`;
- `updatedAt`.

A Subscription row is created only when a real Stripe subscription exists.

A synthesized Free user must not be represented by a fake Stripe subscription.

Subscription history is retained after cancellation. Cancellation must not delete the Subscription record merely to represent Free access.

At most one Subscription may provide current paid entitlements for a Billing account.

Historical or non-entitlement-bearing records may remain for audit and reconciliation.

### WebhookInbox

`WebhookInbox` durably records received Stripe events.

Suggested properties include:

- `id`;
- `stripeEventId`;
- `eventType`;
- `payload`;
- `processingStatus`;
- `receivedAt`;
- `processedAt`;
- `lastError`;
- `attemptCount`.

`stripeEventId` must be unique.

PostgreSQL is the durable source for webhook receipt and processing state. Redis and BullMQ are delivery mechanisms, not the sole record that an event was received.

---

## Effective Tier

The supported effective tiers are:

- `FREE`;
- `PRO`.

Enterprise is not part of the current domain model.

The Subscription domain model should expose a pure calculation such as:

```typescript
effectiveTierAt(now: Date): Tier
```

Passing `now` explicitly keeps the calculation deterministic and directly testable.

### Effective-Tier Rules

| Billing state                                                                       | Effective tier   |
| ----------------------------------------------------------------------------------- | ---------------- |
| No Billing account                                                                  | Free             |
| Billing account without a Subscription                                              | Free             |
| Active Pro Subscription                                                             | Pro              |
| Active Subscription scheduled to cancel at period end, before `currentPeriodEndsAt` | Pro              |
| Subscription period has ended                                                       | Free             |
| `past_due` Subscription                                                             | Free immediately |
| Canceled Subscription                                                               | Free             |
| Unpaid or otherwise non-entitlement-bearing Subscription                            | Free             |

Huddle does not provide a payment-failure grace period.

A `past_due` transition therefore removes Pro entitlements immediately after the committed Billing update becomes visible.

Cancel-at-period-end is not a grace period. It preserves already-paid Pro access only until the paid period ends.

---

## Missing Data and Failures

The following outcomes are different and must never be treated as interchangeable:

1. the repository resolves with `null`;
2. the repository rejects because persistence is unavailable.

A repository contract may use a shape such as:

```typescript
findCurrentSubscription(
  userId: string,
): Promise<Subscription | null>;
```

Its meanings are:

- resolved Subscription: calculate the effective tier from that Subscription;
- resolved `null`: the user has no paid subscription record and receives synthesized Free entitlements;
- rejected Promise: Billing could not determine the entitlement state.

Infrastructure failures must not be caught and converted into `null`.

A database outage must not silently grant Free access as though the user had never subscribed.

For an operation protected by an entitlement, an unavailable entitlement result fails closed and returns a service-unavailable outcome.

Unrelated operations should remain available when they do not require Billing. For example, a Billing outage should not prevent login or ordinary message reads solely because those operations exist in the same application.

---

## Entitlements

Billing translates the effective tier into a minimal entitlement response.

The public response may contain values such as:

```typescript
interface TierEntitlements {
  tier: 'FREE' | 'PRO';
  ownedGroupRoomLimit: number;
  groupMemberLimit: number;
  groupCallParticipantLimit: number;
  groupVideoEnabled: boolean;
  standaloneMeetingCreationEnabled: boolean;
  meetingParticipantLimit: number;
  slackIntegrationEnabled: boolean;
}
```

The exact fields should be added only when an implemented consumer requires them.

The entitlement values and feature availability must come from [`../product/tiers.md`](../product/tiers.md). They must not be redefined in this document or scattered across consuming contexts.

Entitlements are evaluated dynamically when a protected action begins.

Examples include:

- creating a group room;
- inviting another member;
- creating or starting a standalone meeting;
- starting a group video session;
- enabling a Pro-only integration.

Numeric live-session capacity is snapshotted when the session is created. A later tier change does not alter the capacity of an already-active session.

Billing does not use Redis to cache entitlements in the current design. The protected operations are not frequent enough to justify cache invalidation complexity.

---

## Public API

Billing exposes capabilities through narrow public APIs.

It must not expose:

- Subscription aggregates;
- repositories;
- Stripe SDK objects;
- database entities;
- internal webhook models.

A public entitlement capability may resemble:

```typescript
interface BillingEntitlementsApi {
  getEntitlements(userId: string): Promise<TierEntitlements>;
}
```

A current-subscription capability used for application composition may resemble:

```typescript
interface BillingCurrentSubscriptionApi {
  getCurrentSubscription(userId: string): Promise<CurrentSubscriptionView>;
}
```

DTO names are illustrative. Implementation should expose only fields required by real consumers.

Consuming contexts define their own ports and depend on those ports.

Adapters at the application composition layer call Billing's public API.

---

## `/users/me` Composition

The authenticated current-user response may combine:

- profile data from Identity;
- subscription or entitlement data from Billing.

This composition belongs outside both context libraries, at the application composition root such as `apps/api-gateway`.

Identity must not import Billing merely to build `/users/me`.

Billing must not import Identity to resolve the authenticated user's profile.

The authenticated `sub` already identifies the requester. An Identity existence check is unnecessary for this endpoint.

Before Phase 4, the gateway uses a dedicated static Free subscription adapter file.

During Phase 4, that adapter is replaced with a Billing-backed adapter.

The transitional Free result must not be written inline inside the controller.

If the composite endpoint cannot obtain required Billing data, it returns a service-unavailable response. This couples the availability of that endpoint to both data sources, but it does not create a domain dependency between Identity and Billing.

Pure Identity endpoints, including authentication, remain independent.

---

## Stripe Checkout

Checkout creation requires an authenticated user.

The server controls:

- allowed Stripe price identifiers;
- the mapping from a price to a supported tier;
- checkout mode;
- success and cancellation URLs;
- Stripe customer association;
- idempotency identifiers.

The client must not submit an arbitrary trusted price or tier.

The public product price is defined in [`../product/tiers.md`](../product/tiers.md). Stripe price identifiers belong to deployment configuration, not public product documentation.

Repeated checkout requests must not unintentionally create multiple equivalent Billing accounts, Stripe customers, or active subscriptions.

The browser's return from Stripe Checkout is not authoritative proof of payment.

Paid access changes only after Billing has processed trusted Stripe state through webhook handling or explicit reconciliation.

---

## Stripe Webhook Receipt

The webhook endpoint must:

1. read the raw request body;
2. verify the Stripe signature;
3. reject invalid signatures;
4. persist a new `WebhookInbox` record;
5. acknowledge duplicate Stripe event IDs without applying the event twice;
6. enqueue asynchronous processing;
7. return an HTTP response based on durable receipt.

Expected responses:

| Situation                                                           | Response |
| ------------------------------------------------------------------- | -------- |
| Invalid payload or signature                                        | `400`    |
| New event durably accepted                                          | `200`    |
| Duplicate event already accepted                                    | `200`    |
| Durable inbox persistence fails                                     | `503`    |
| Required enqueueing fails and no recovery path has been established | `503`    |

If enqueueing is separated from the receipt transaction, a recovery worker must discover pending inbox records and enqueue them later.

The system must not acknowledge an event that can be permanently lost.

---

## Asynchronous Processing

BullMQ may process accepted Stripe events asynchronously.

Redis provides queue coordination, but PostgreSQL remains the durable record of pending and processed events.

Processing requirements:

- processing is idempotent;
- duplicate delivery does not apply the same transition twice;
- transient failures are retried with a bounded policy;
- exhausted retries remain visible for operational recovery;
- successfully applied events are marked processed;
- application logs include the Stripe event ID and internal correlation identifiers.

Applying a Subscription state change and marking its inbox event processed should occur in the same PostgreSQL transaction.

This prevents:

- marking an event processed without applying the domain change;
- applying the domain change while leaving the event eligible for accidental reprocessing.

---

## Event Ordering and Reconciliation

Stripe events may be duplicated, delayed, or delivered out of order.

Billing must not assume webhook delivery order is the source of truth.

When an event cannot safely be applied from its payload alone, the processor retrieves the current authoritative Stripe object and reconciles the local state with it.

The local result should represent the latest confirmed Stripe state rather than whichever event arrived last.

Relevant Stripe object identifiers and timestamps should be retained to support reconciliation and diagnosis.

---

## Cross-Context Consistency

Entitlement consumers use the latest committed Billing state observable when the protected operation begins.

If a tier changes concurrently with an operation:

- an operation already accepted under the previously observed committed tier is not retroactively invalidated;
- later operations observe the newly committed effective tier;
- an active live session keeps its snapshotted participant capacity;
- existing over-limit resources are preserved;
- further growth is blocked while current usage is at or above the effective limit.

Billing supplies entitlements but does not enforce resource ownership or count resource usage.

For example:

- Billing returns a group-room limit;
- Chat counts owned rooms and decides whether room creation is allowed.

---

## Security Requirements

Billing implementations must ensure:

- Stripe secrets are never exposed to the client;
- webhook signing secrets are stored outside source control;
- raw webhook payloads are handled safely;
- Stripe metadata is treated as external input and validated;
- authenticated `userId` values come from the trusted principal;
- users cannot query another user's subscription;
- allowed price identifiers are server-controlled;
- sensitive Stripe payload fields are not written indiscriminately to logs;
- administrative replay or recovery actions are authorized and audited.

---

## Testing Priorities

### Domain Tests

Test effective-tier calculation for:

- active Pro;
- cancel-at-period-end before expiry;
- period expiry;
- `past_due`;
- canceled;
- no paid Subscription;
- boundary timestamps at `currentPeriodEndsAt`.

### Application Tests

Test:

- no Subscription produces synthesized Free entitlements;
- a repository failure produces an unavailable result rather than Free;
- entitlement mapping follows the authoritative tier policy;
- unsupported checkout prices are rejected;
- repeated checkout requests remain idempotent.

### Integration Tests

Test:

- Stripe signature validation with the raw body;
- WebhookInbox uniqueness by Stripe event ID;
- duplicate webhook acknowledgement;
- transactional Subscription update and inbox completion;
- retry of transient worker failures;
- recovery of pending inbox records;
- reconciliation after out-of-order events;
- `/users/me` composition success and partial failure.

### Contract Tests

Test that consumer adapters depend only on Billing public DTOs and do not import:

- Billing repositories;
- Subscription aggregates;
- persistence entities;
- Stripe SDK types.

---

## Deferred Work

The following are intentionally deferred until a real product requirement justifies them:

- Enterprise tier;
- Workspace or organization billing;
- annual plans;
- multiple paid plans;
- quantity-based or seat-based billing;
- coupons and promotion codes;
- trials;
- payment-failure grace periods;
- prorated plan switching beyond Stripe's required behavior;
- invoices and billing-history UI;
- refunds managed from Huddle;
- entitlement caching;
- usage-based billing;
- multiple active subscriptions per Billing account.

Deferred features must not appear as active entitlements or partially implemented domain states.

---

## Authoritative References

- Product tier features and limits: [`../product/tiers.md`](../product/tiers.md)
- Current delivery timing: [`../delivery/roadmap.md`](../delivery/roadmap.md)
- Phase 4 implementation scope: [`../delivery/phases/04-billing-and-portfolio-release.md`](../delivery/phases/04-billing-and-portfolio-release.md)
- Billing entitlement decision: [`../decisions/0005-billing-entitlement-model.md`](../decisions/0005-billing-entitlement-model.md)
- Cross-context integration rules: [`../decisions/0004-cross-context-integration.md`](../decisions/0004-cross-context-integration.md)
- Persistence and consistency model: [`../architecture/data-and-consistency.md`](../architecture/data-and-consistency.md)
- Security model: [`../architecture/security.md`](../architecture/security.md)
