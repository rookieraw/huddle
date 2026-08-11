# Notification Context

## Purpose

The Notification context delivers user-facing notifications produced by meaningful events in other bounded contexts.

It separates:

- a business event occurring;
- deciding who should be notified;
- selecting a delivery channel;
- attempting delivery;
- recording the delivery result.

Notification is an asynchronous consumer. It must not become the owner of Chat, Conferencing, Identity, or Billing business rules.

---

## Delivery Status

Notification is scheduled for Phase 6.

Before Phase 6:

- other contexts must not import Notification internals;
- Notification-specific projections or delivery records are not required;
- integration events should be introduced only when a real consumer or durable workflow requires them;
- Slack integration remains unavailable.

The current implementation authorization is defined in:

- [`../delivery/roadmap.md`](../delivery/roadmap.md)
- [`../delivery/phases/06-notification.md`](../delivery/phases/06-notification.md)

This context document describes the target boundary. It does not authorize implementing every capability listed here during an earlier phase.

---

## Responsibilities

Notification owns:

- notification records;
- recipient targeting after consuming an integration event;
- delivery-channel selection;
- delivery status;
- delivery attempts and retry metadata;
- notification templates or message construction;
- Slack delivery configuration;
- Slack message delivery;
- Notification-specific idempotency;
- Notification-specific operational history.

Notification does not own:

- user authentication;
- user profile truth;
- room membership;
- call or meeting lifecycle;
- subscription lifecycle;
- the definition of Free and Pro;
- whether a Chat, Call, Meeting, or Billing event occurred;
- business transactions inside provider contexts.

---

## Initial Scope

Phase 6 should implement a deliberately small vertical slice.

The initial portfolio scope is:

- consume selected integration events asynchronously;
- create durable Notification records;
- deliver an initial notification through an implemented channel;
- demonstrate retry and idempotency behavior;
- support Pro-only Slack integration;
- preserve delivery failure information for diagnosis.

Before Phase 6 implementation begins, the accepted initial event catalog must be added to this document.

The candidate event families in the Phase 6 document are planning inputs, not implementation authority.

This context must not be interpreted as requiring Notifications for every Domain Event in the system.

---

## Domain Model

### Notification

A `Notification` represents the intent to inform one recipient about one meaningful occurrence.

Suggested properties include:

- `id`;
- `recipientUserId`;
- `type`;
- `sourceContext`;
- `sourceEventId`;
- `subjectId`;
- `payload`;
- `createdAt`;
- `readAt`.

Invariants:

- a Notification belongs to one recipient;
- `sourceEventId`, notification type, and recipient identify the logical notification;
- replaying the same integration event must not create duplicate logical notifications;
- Notification stores only the data required to render or deliver the notification;
- private aggregates from provider contexts are never persisted directly.

`payload` is a Notification-owned snapshot, not a live reference to another context's aggregate.

### DeliveryAttempt

A `DeliveryAttempt` records an attempt to deliver a Notification through one channel.

Suggested properties include:

- `id`;
- `notificationId`;
- `channel`;
- `status`;
- `attemptNumber`;
- `providerMessageId`;
- `attemptedAt`;
- `completedAt`;
- `nextRetryAt`;
- `failureCode`;
- `failureMessage`.

Possible statuses include:

- `PENDING`;
- `PROCESSING`;
- `DELIVERED`;
- `RETRYABLE_FAILURE`;
- `PERMANENT_FAILURE`.

Invariants:

- attempt numbers increase monotonically per Notification and channel;
- a successful delivery must not be repeated merely because a queue job is redelivered;
- retryable and permanent failures are distinguished;
- provider responses are sanitized before persistence or logging.

### SlackConnection

A `SlackConnection` represents the delivery configuration authorized by a user for Slack notifications.

Suggested properties include:

- `id`;
- `userId`;
- `workspaceId`;
- `channelId`;
- `encryptedAccessToken`;
- `status`;
- `connectedAt`;
- `revokedAt`.

Possible statuses include:

- `ACTIVE`;
- `REVOKED`;
- `INVALID`.

Invariants:

- one Huddle user has at most one active Slack connection;
- one Slack connection has exactly one supported delivery destination;
- Slack access tokens are encrypted at rest;
- plaintext access tokens are never returned through the public API;
- a revoked or invalid connection cannot be used for delivery;
- reconnecting replaces or updates the supported active configuration without creating conflicting connections;
- changing subscription tier does not delete the stored connection.

---

## Domain Events and Integration Events

Provider contexts may produce Domain Events for their internal workflows.

Notification consumes stable Integration Events.

A Domain Event is not automatically a public cross-context contract.

Before an event is consumed by Notification, the provider context must explicitly translate the relevant Domain Event or committed state change into a versioned Integration Event.

Integration Events must contain:

- a globally unique event ID;
- event type;
- schema version;
- occurrence timestamp;
- provider context;
- minimal business identifiers;
- only the snapshot data required by consumers.

They must not expose:

- provider aggregates;
- ORM entities;
- repositories;
- private value objects;
- secrets;
- unnecessary personal data.

---

## Event Publication

When an integration event represents a committed business state change, the provider context uses a Transactional Outbox.

The provider's domain change and outbox record are committed in the same local database transaction.

An asynchronous publisher later delivers the outbox event to consumers.

This prevents the system from:

- committing the business change but losing the notification event;
- publishing an event for a business transaction that later rolls back.

Redis and BullMQ may transport jobs, but they are not the only durable evidence that an integration event must be published or processed.

Notification must tolerate:

- duplicate delivery;
- delayed delivery;
- retry;
- temporary reordering.

See [`../architecture/data-and-consistency.md`](../architecture/data-and-consistency.md).

---

## Event Consumption

Notification processes each integration event idempotently.

A durable consumer record or equivalent unique constraint must identify already-consumed event IDs.

Processing follows this sequence:

1. receive the integration event;
2. validate its type and schema version;
3. check whether it has already been consumed;
4. determine the intended recipients;
5. create the Notification records;
6. create or enqueue the required Delivery Attempts;
7. mark the event as consumed.

Creating Notification records and marking an event consumed should occur in the same PostgreSQL transaction.

An acknowledged queue job must not leave the event permanently unrecorded.

---

## Recipient Resolution

The provider context should include authoritative recipient identifiers when recipient selection is part of its business rule.

Notification must not reconstruct another context's authorization model.

For example:

- Chat owns room membership;
- Conferencing owns meeting invitations and call participants;
- Billing owns subscription state.

Notification may enrich delivery content through narrow public query APIs when required, but it must not query provider repositories directly.

If recipient resolution requires current membership or permission checks, the owning context provides that capability.

---

## Display Data

The frontend decides how Notification data is visually presented.

Notification may store minimal display snapshots required for delivery, such as:

- actor display label;
- room or meeting title;
- notification text parameters;
- destination identifiers.

It must not define frontend layout, avatar placement, colors, or component behavior.

When current display information is required, Notification uses an appropriate narrow Identity profile-query capability.

It does not receive the Identity User aggregate.

A later event-driven profile projection may replace synchronous profile lookup without changing Notification's application-facing port.

---

## Delivery Channels

A delivery channel is an implementation of a Notification-owned port.

The committed Phase 6 channels are:

- durable in-application Notification;
- Pro-only Slack delivery.

Deferred channel candidates include:

- product-event Email;
- mobile push;
- SMS;
- arbitrary outgoing webhooks.

Adding a channel must not require provider contexts to understand provider-specific delivery details.

For example, Conferencing publishes that a Meeting-related event occurred. It does not call the Slack SDK.

### Initial Channel Control

The initial implementation does not introduce a generic Notification preference matrix.

The accepted event catalog determines whether a Notification type supports:

- in-application delivery;
- Slack delivery.

In-application Notification remains the durable default for every selected Phase 6 Notification type.

Slack delivery additionally requires:

- the event catalog to permit Slack;
- an active Slack connection;
- the configured single destination;
- confirmed current Pro entitlement.

Disconnecting Slack disables future Slack delivery.

A future per-event or per-channel preference model requires explicit product and delivery authorization.

---

## In-Application Notifications

The Phase 6 in-application Notification is represented by the durable `Notification` record.

A user may query only their own Notifications.

The initial operations include:

- list Notifications with bounded cursor pagination;
- mark one Notification as read;
- mark an explicitly bounded set of Notifications as read when the bulk operation is included by the HTTP contract.

Unread count is derived from Notification-owned data.

Real-time UI delivery may use an application socket connection, but the durable Notification record remains the source of truth.

A missed socket delivery must not cause permanent notification loss.

---

## Slack Integration

Slack integration is a Pro-only feature.

The authoritative entitlement is defined in [`../product/tiers.md`](../product/tiers.md).

Notification owns the Slack connection and delivery implementation. Billing owns the effective entitlement decision.

### Connection

When a user attempts to connect Slack:

1. authenticate the user;
2. query the current Slack-integration entitlement;
3. fail closed if entitlement information is unavailable;
4. reject the operation if Slack integration is not enabled;
5. complete the Slack authorization flow;
6. persist the encrypted connection information.

The server validates OAuth state and redirect parameters.

Slack credentials and access tokens must never be trusted from arbitrary client input.

### Delivery

Before sending a new Slack Notification, Notification checks that:

- the accepted event catalog permits Slack delivery for the Notification type;
- the Slack connection is active;
- the configured single destination exists;
- the current effective entitlement permits Slack delivery.

Entitlement checks are dynamic for new deliveries.

A downgrade does not delete the stored Slack connection immediately, but further Slack deliveries are disabled while the effective tier does not permit them.

This preserves configuration if the user later upgrades again without granting a Free user ongoing Pro delivery.

### Failure Behavior

Slack failure must not roll back the business action that caused the notification.

For example, a meeting remains created even if its Slack notification fails.

Delivery failures are recorded and classified as:

- retryable, such as a temporary provider outage or rate limit;
- permanent, such as revoked authorization or an invalid destination.

Repeated permanent failures may mark the Slack connection invalid.

---

## Entitlement Availability

Notification must distinguish:

- Free entitlement result;
- Pro entitlement result;
- entitlement service failure.

An entitlement failure must not be interpreted as Free.

For a Pro-only external delivery action, entitlement failure causes that delivery to remain pending or fail safely according to the retry policy.

It must not silently deliver a Pro-only notification without confirming entitlement.

Internal durable Notification creation may still succeed when the external Slack entitlement check is temporarily unavailable.

This prevents a Billing outage from erasing the notification intent while still failing closed for the protected external action.

---

## Retry Policy

Retries must be bounded.

The implementation should define:

- maximum attempts;
- exponential backoff;
- jitter;
- retryable provider errors;
- permanent provider errors;
- the state after retries are exhausted.

Queue redelivery and application-level retries must remain idempotent.

Exhausted retries remain visible for operational diagnosis and possible authorized replay.

The initial values belong to implementation or operational configuration, not the domain model.

---

## Ordering and Staleness

Notification does not guarantee that users observe notifications in the exact order in which all distributed actions occurred.

Within the modular monolith, timestamps and provider sequence information should be retained where useful, but consumers must tolerate delayed delivery.

A later event must not incorrectly reactivate a terminal delivery or integration state solely because events arrived out of order.

Where current external state is authoritative, such as a Slack connection being revoked, Notification reconciles with that current state before retrying delivery.

---

## Public API

Notification may expose narrow capabilities such as:

```typescript
interface NotificationQueryApi {
  listForUser(
    userId: string,
    query: NotificationListQuery,
  ): Promise<NotificationPage>;
}

interface NotificationCommandApi {
  markAsRead(userId: string, notificationId: string): Promise<void>;
}
```

Slack connection management may be exposed through a separate capability.

Public APIs must not expose:

- Notification aggregates;
- repositories;
- queue jobs;
- Slack SDK objects;
- encrypted credential fields;
- persistence entities.

Provider contexts generally integrate with Notification through Integration Events rather than synchronous delivery calls.

---

## Failure Isolation

Notification delivery is secondary to the business transaction that produced it.

Therefore:

- a Slack outage must not fail room creation;
- a temporary queue outage must not roll back an already-committed meeting;
- Notification processing failures must remain recoverable;
- login and ordinary message operations must not depend on Notification availability.

This isolation depends on durable outbox publication and asynchronous consumption.

A synchronous cross-context call to "send a notification now" should not be introduced as the default integration pattern.

---

## Security and Privacy

Notification implementations must ensure:

- users can read only their own notifications;
- Slack OAuth state is validated;
- Slack access tokens are encrypted at rest;
- secrets are excluded from logs;
- external provider payloads are treated as untrusted input;
- stored payloads contain only necessary data;
- notification text does not expose inaccessible room or meeting content;
- replay and recovery operations are authorized;
- personal data retention follows the project's eventual privacy policy.

A notification does not grant access to its referenced resource.

The destination context must independently authorize access when the user follows a notification.

---

## Testing Priorities

### Domain Tests

Test:

- logical notification deduplication;
- delivery status transitions;
- retryable versus permanent failure classification;
- prevention of delivery after success;
- Slack connection status transitions.

### Application Tests

Test:

- one integration event creates the expected recipient notifications;
- replaying an event does not duplicate notifications;
- Notification does not reconstruct Chat or Conferencing authorization;
- Free users cannot connect or use Slack delivery;
- Pro users can use Slack delivery;
- entitlement failure does not grant Slack delivery;
- downgrade disables new Slack deliveries without deleting the connection;
- internal Notification creation survives temporary Slack or Billing failure.

### Integration Tests

Test:

- outbox event consumption;
- BullMQ retry behavior;
- recovery after worker interruption;
- duplicate queue delivery;
- PostgreSQL consumer idempotency;
- encrypted Slack credential persistence;
- Slack OAuth state validation;
- provider rate-limit handling;
- invalid or revoked Slack credentials;
- notification ownership enforcement.

### Contract Tests

Test that Notification consumes only documented Integration Event schemas and public APIs.

It must not import:

- another context's repositories;
- provider aggregates;
- provider persistence entities;
- private Domain Events as though they were stable public contracts.

---

## Deferred Work

The following are deferred unless explicitly added to a later phase:

- comprehensive Notification preference management;
- per-event and per-channel preference matrices;
- product-event Email delivery;
- mobile push Notifications;
- SMS;
- arbitrary outgoing webhooks;
- Notification digests;
- scheduled quiet hours;
- localization of all delivery templates;
- delivery analytics dashboards;
- multiple Slack Workspaces per user;
- multiple Slack destinations per user;
- arbitrary Slack channel routing;
- Huddle and Slack Message synchronization;
- organization-wide Slack administration;
- Enterprise integrations;
- guaranteed global event ordering.

Deferred channels must not appear as implemented product features.

---

## Authoritative References

- Product tier entitlements: [`../product/tiers.md`](../product/tiers.md)
- Current delivery timing: [`../delivery/roadmap.md`](../delivery/roadmap.md)
- Phase 6 implementation scope: [`../delivery/phases/06-notification.md`](../delivery/phases/06-notification.md)
- Cross-context integration rules: [`../decisions/0004-cross-context-integration.md`](../decisions/0004-cross-context-integration.md)
- Persistence and event consistency: [`../architecture/data-and-consistency.md`](../architecture/data-and-consistency.md)
- Security model: [`../architecture/security.md`](../architecture/security.md)
