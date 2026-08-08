# ADR 0005 — Separate BillingAccount, Paid Subscription, and Effective Entitlements

Status: Accepted  
Recorded: 2026-08-07  
Supersedes: None  
Superseded by: None

## Context

Huddle needs Free and Pro behavior across several bounded contexts.

Examples include:

- Chat resource limits;
- Conferencing participant capacity;
- standalone Meeting creation and start;
- Notification integrations.

Billing owns payment and subscription state, while consuming contexts own their resource and authorization rules.

The design must answer:

- whether every registered user requires Billing data;
- whether Free is stored or derived;
- whether Stripe customers are created at registration or checkout;
- how paid Subscription history is retained;
- how consumers obtain entitlements;
- how downgrades affect existing resources;
- whether active-session limits change after a tier transition;
- whether entitlement caching is currently justified;
- whether Enterprise can be modeled before Workspace ownership exists.

## Decision

Huddle separates:

- `BillingAccount`;
- paid `Subscription`;
- effective entitlements.

These concepts have different meanings and lifecycles.

### BillingAccount

A BillingAccount represents the relationship between one Huddle user and Stripe.

It is created when the user first begins a paid checkout flow.

Registration does not create:

- a BillingAccount;
- a Stripe customer;
- a Subscription.

BillingAccount existence alone does not grant Pro access.

### Subscription

A Subscription represents a real Stripe paid-subscription relationship.

Huddle does not create a synthetic Subscription to represent Free access.

Paid Subscription history is retained after cancellation rather than deleted.

A BillingAccount may therefore exist without a currently entitlement-bearing Subscription.

### Effective Entitlements

Free is the default effective tier when no paid Subscription state grants Pro.

Billing derives current entitlements from:

- confirmed Subscription state;
- the authoritative product-tier policy;
- the time at which entitlement is evaluated.

Consumers receive a minimal entitlement DTO, not BillingAccount, Subscription, or Stripe objects.

The consuming context remains responsible for enforcement.

## Supporting Decisions

### Absence Is Not Failure

Confirmed absence of a paid Subscription produces Free entitlements.

Persistence failure, timeout, or invalid stored state does not mean Free.

Infrastructure failures must not be converted into a resolved `null` result.

Entitlement-protected operations fail closed when Billing cannot determine the current result.

### No Payment-Failure Grace Period

A `past_due` Subscription produces effective Free immediately after the corresponding Billing state is committed.

Cancel-at-period-end retains Pro only until the already-paid period ends.

This is not treated as a grace period.

### Dynamic Checks and Numeric Snapshots

Protected operations resolve the latest committed entitlement when they begin.

Consumers do not copy the user's tier onto every resource.

A live Call or Meeting session intentionally snapshots its numeric participant capacity when the session is created.

This snapshot is a live-session invariant, not a general copy of the user's tier.

### Non-Destructive Downgrade

Downgrades preserve existing data and resources.

Consumers block further protected growth while current usage is at or above the effective limit.

A downgrade does not automatically:

- delete Conversations or messages;
- remove Group members;
- delete scheduled Meetings;
- terminate an active media session;
- delete external-integration configuration.

### No Entitlement Cache Initially

Entitlements are not initially cached in Redis.

The protected operations are sufficiently infrequent that cache invalidation, freshness, and failure complexity are not justified.

Caching requires measured need and a separate consistency decision.

### Enterprise Deferred

Only Free and Pro are modeled.

Enterprise is deferred until Workspace or organization ownership can correctly represent subscription ownership, seats, and administration.

### Transitional Static Adapter

Before real Billing is delivered, consumers use an explicit static Free adapter at the application composition root.

The adapter:

- is not inline controller logic;
- cannot be selected by the client;
- is not a fallback for Billing failure.

Phase 4 replaces the runtime binding with a Billing-backed adapter without changing consumer-owned ports.

## Rationale

This design provides:

- no eager Stripe resources for users who never enter a paid flow;
- no Billing backfill requirement for existing Free users;
- a clear distinction between product default and paid history;
- retained subscription history;
- deterministic effective-tier calculation;
- minimal cross-context contracts;
- consumer-owned enforcement;
- stable active-session capacity;
- explicit downgrade behavior;
- no premature cache or Enterprise ownership model.

It also prevents Billing lifecycle fields from leaking into Identity or consumer aggregates.

## Consequences

### Positive

- Free users do not require synthetic Subscriptions.
- Existing users can remain Free without migration.
- Billing history remains available after cancellation.
- Stripe models stay inside Billing.
- Consumers receive only required entitlement facts.
- Tier transitions affect future protected operations consistently.
- Active live sessions remain stable.
- Consumer adapters can change without rewriting domain rules.

### Negative

- Free may result from several distinct persisted states.
- Some Free users have BillingAccount history while others do not.
- Protected mutations synchronously depend on Billing availability.
- Billing outages block protected growth.
- Historical and current Subscriptions must be distinguished.
- Reliable Stripe webhook processing and reconciliation are required.

## Alternatives Considered

### Create Billing Data at Registration

Rejected because most registered users may never pay, Stripe resources would be created unnecessarily, and existing users would require backfill.

### Store Tier on the Identity User

Rejected because payment and Subscription state belong to Billing.

It would also couple Identity persistence and authentication concerns to Billing lifecycle changes.

### Store a Subscription for Every Free User

Rejected because Free is a product default, not a paid Stripe relationship.

### Delete Subscription on Cancellation

Rejected because it destroys billing history and complicates Stripe reconciliation.

### Return Billing Entities to Consumers

Rejected because it leaks Billing and Stripe concepts across bounded-context boundaries.

Consumers require only minimal entitlement facts.

### Store Entitlements on Every Resource

Rejected because copied tier state becomes stale.

Numeric live-session capacity remains an intentional, narrowly scoped exception.

### Cache Entitlements in Redis

Deferred because expected request frequency does not justify cache invalidation and stale-entitlement risk.

### Add a Past-Due Grace Period

Rejected for the current scope because it adds policy state, scheduling, and lifecycle complexity without a current product requirement.

### Add Enterprise Before Workspace

Rejected because user-owned BillingAccount cannot correctly represent organization ownership, seats, or Enterprise administration.

## Analytics Consequence

The following may all produce effective Free but remain historically different:

- no BillingAccount;
- BillingAccount without paid Subscription;
- previously subscribed and canceled;
- currently `past_due`;
- paid period ended.

Analytics must not infer payment history solely from effective tier.

## Future Workspace Evolution

When Workspace ownership is introduced:

- Subscription ownership may move from user to Workspace;
- seat and organization roles may be added;
- Enterprise may become a valid tier;
- existing user-owned Billing history may require migration;
- entitlement queries may become Workspace-scoped.

That change requires a new ADR.

## Sources of Truth

This ADR records why the model was selected.

Current behavior belongs to:

- Billing domain and Stripe lifecycle: [`../contexts/billing.md`](../contexts/billing.md)
- Product tiers, limits, and price: [`../product/tiers.md`](../product/tiers.md)
- Cross-context integration: [`0004-cross-context-integration.md`](0004-cross-context-integration.md)
- Persistence and consistency: [`../architecture/data-and-consistency.md`](../architecture/data-and-consistency.md)
- Phase 4 implementation scope: [`../delivery/phases/04-billing-and-portfolio-release.md`](../delivery/phases/04-billing-and-portfolio-release.md)

## Revisit When

Reconsider this decision when:

- Workspace ownership is introduced;
- Subscription ownership moves from user to organization;
- multiple paid plans are required;
- annual or usage-based billing is required;
- entitlement reads become a measured bottleneck;
- a grace period becomes a real product requirement;
- multiple current paid Subscriptions become valid;
- Stripe lifecycle complexity exceeds the current model.
