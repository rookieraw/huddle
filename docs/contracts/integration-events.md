# Integration Event Contracts

Status: Phase 3 Call catalog accepted; Meeting catalog reserved for Phase 5  
Last reviewed: 2026-08-08

## Purpose

This document defines Huddle's public cross-context Integration Event contracts.

It owns:

- event envelope;
- event names;
- schema versions;
- public payloads;
- producer ownership;
- intended consumers;
- ordering keys;
- idempotency expectations;
- compatibility rules.

It does not define:

- internal Domain Event classes;
- Outbox table schemas;
- queue-library job payloads;
- Socket.IO events;
- Stripe webhook payloads;
- Notification types not yet accepted by the Notification event catalog.

---

## Core Rule

A Domain Event is not automatically an Integration Event.

An Integration Event exists only when:

1. a committed provider fact has a real asynchronous consumer;
2. the provider intentionally defines a public contract;
3. delivery loss would violate an accepted consistency requirement;
4. the provider writes an Outbox record with its state change;
5. the consumer processes delivery idempotently.

Returning a Domain Event from a use case does not establish reliable cross-context delivery.

---

## Current Event Catalog

| Event type                                    | Version | Producer     | Consumer | Delivery phase |
| --------------------------------------------- | ------: | ------------ | -------- | -------------- |
| `conferencing.call.lifecycle-changed`         |       1 | Conferencing | Chat     | Phase 3        |
| `conferencing.meeting.created`                |       1 | Conferencing | Chat     | Phase 5        |
| `conferencing.meeting.lifecycle-changed`      |       1 | Conferencing | Chat     | Phase 5        |
| `conferencing.meeting.participant-eligible`   |       1 | Conferencing | Chat     | Phase 5        |
| `conferencing.meeting.participant-ineligible` |       1 | Conferencing | Chat     | Phase 5        |

Only `conferencing.call.lifecycle-changed` becomes active during Phase 3.

Meeting event definitions are implementation authority only when Phase 5 is active.

No Notification consumer event is active until Phase 6 accepts its deliberately small event catalog.

---

# Standard Envelope

Every Integration Event uses a plain serializable envelope.

```typescript
type IntegrationEventEnvelope<TPayload> = {
  eventId: string;
  eventType: string;
  schemaVersion: number;
  producerContext: string;
  subject: {
    type: string;
    id: string;
    version: number;
  };
  occurredAt: string;
  correlationId: string;
  causationId?: string;
  payload: TPayload;
};
```

## Field Meaning

| Field             | Meaning                                                       |
| ----------------- | ------------------------------------------------------------- |
| `eventId`         | Globally unique identity for this committed Integration Event |
| `eventType`       | Stable semantic event name                                    |
| `schemaVersion`   | Version of the public payload contract                        |
| `producerContext` | Context that owns the event meaning                           |
| `subject.type`    | Type of versioned provider subject                            |
| `subject.id`      | Stable provider-owned subject identifier                      |
| `subject.version` | Monotonic version for the ordering scope                      |
| `occurredAt`      | Provider-authoritative time of the committed fact             |
| `correlationId`   | Identifier connecting one logical operation across boundaries |
| `causationId`     | Optional preceding command or event identity                  |
| `payload`         | Minimum committed data required by accepted consumers         |

`occurredAt` represents the business fact, not queue-dispatch time.

Queue retry timestamps, attempt counts, and worker identifiers do not belong in the public envelope.

---

## Serialization

Integration Events must be serializable without:

- class prototypes;
- methods;
- ORM entities;
- NestJS providers;
- database connections;
- provider SDK objects;
- process-memory references.

Dates use ISO 8601 UTC strings.

Enums use stable string values.

Identifiers are opaque strings.

An Integration Event must not publish an internal Domain Event instance directly.

---

# Delivery Guarantees

Huddle Integration Event delivery is:

```text
At least once
```

The system does not claim:

- exactly-once delivery;
- global ordering;
- simultaneous provider and consumer commit;
- zero-delay projection;
- automatic distributed rollback.

Required behavior:

```text
Provider state change
+ provider Outbox record
commit atomically

→ dispatch
→ consumer deduplication
→ consumer-owned local update
```

A consumer failure does not roll back the provider's committed state.

---

# Producer Requirements

The producer owns:

- event meaning;
- event name;
- schema version;
- event identity;
- subject identity and version;
- occurrence time;
- minimal payload;
- Transactional Outbox;
- dispatch and retry state;
- operational recovery.

The Outbox record and provider state change must commit in the same provider-owned transaction.

The producer must not publish an event for a transaction that later rolls back.

The producer must not consider in-memory event creation equivalent to durable publication.

---

# Consumer Requirements

A consumer owns:

- supported-version validation;
- durable event deduplication;
- local projection;
- consumer-side transaction boundary;
- stale-event protection;
- retry-safe processing;
- consumer-specific failure state;
- operational replay behavior.

Every consumer must tolerate:

- duplicate delivery;
- process restart;
- failure after local commit but before acknowledgement;
- newer event arriving before an older event;
- delayed delivery;
- unsupported schema version.

An in-memory set of processed event IDs is not sufficient.

---

# Ordering

Huddle does not require global event ordering.

Ordering is scoped by:

```text
subject.type
+ subject.id
+ subject.version
```

Consumers compare versions only inside the relevant subject scope.

An event for one Meeting participant must not cause an unrelated participant's older but valid event to be discarded.

An older event must not overwrite a newer terminal or ineligible state.

Event timestamp alone is not the primary stale-event guard when a subject version exists.

---

# Schema Compatibility

## Compatible Changes

Within an existing schema version, a producer may add an optional field only when:

- existing consumers ignore unknown fields;
- the field does not change existing meaning;
- absence retains the previous interpretation;
- contract tests verify compatibility.

## Breaking Changes

A new schema version is required when changing:

- required field;
- field type;
- enum meaning;
- event meaning;
- subject ordering scope;
- authorization-sensitive interpretation;
- removal or renaming of a field.

A producer must not begin emitting a new version until active consumers support it or a compatible migration plan exists.

## Unsupported Versions

A consumer receiving an unsupported schema version must:

- reject or defer processing safely;
- preserve visible failure state;
- avoid acknowledging successful application;
- avoid silently discarding the event;
- allow operational recovery after consumer support is deployed.

---

# Phase 3 Call Event

## `conferencing.call.lifecycle-changed`

Version: 1  
Producer: Conferencing  
Consumer: Chat  
Delivery: Active in Phase 3

This event represents the latest committed durable lifecycle state of one `CallSession`.

It is emitted for applicable transitions including:

- Call initiated;
- Call activated;
- Call rejected;
- Call unanswered;
- Call canceled;
- all participants left;
- maximum duration reached;
- infrastructure failure.

The event is not a Socket.IO notification.

The realtime equivalent belongs to:

```text
contracts/conferencing-realtime.md
```

---

## Subject

```typescript
type CallLifecycleSubject = {
  type: 'CALL_SESSION';
  id: string;
  version: number;
};
```

`id` is the durable `callSessionId`.

`version` is the Call lifecycle version.

---

## Payload

```typescript
type CallLifecycleChangedV1 = {
  callSessionId: string;
  conversationId: string;
  conversationScope: 'DIRECT' | 'GROUP';
  mediaType: 'VOICE' | 'VIDEO';
  initiatorId: string;
  status: 'RINGING' | 'ACTIVE' | 'ENDED';
  initiatedAt: string;
  activatedAt: string | null;
  endedAt: string | null;
  endReason:
    | 'REJECTED'
    | 'UNANSWERED'
    | 'CANCELED'
    | 'ALL_LEFT'
    | 'MAX_DURATION'
    | 'INFRASTRUCTURE_FAILURE'
    | null;
};
```

Example:

```json
{
  "eventId": "event-id",
  "eventType": "conferencing.call.lifecycle-changed",
  "schemaVersion": 1,
  "producerContext": "conferencing",
  "subject": {
    "type": "CALL_SESSION",
    "id": "call-session-id",
    "version": 3
  },
  "occurredAt": "2026-08-08T10:00:00.000Z",
  "correlationId": "correlation-id",
  "payload": {
    "callSessionId": "call-session-id",
    "conversationId": "conversation-id",
    "conversationScope": "DIRECT",
    "mediaType": "VIDEO",
    "initiatorId": "user-id",
    "status": "ENDED",
    "initiatedAt": "2026-08-08T09:30:00.000Z",
    "activatedAt": "2026-08-08T09:31:00.000Z",
    "endedAt": "2026-08-08T10:00:00.000Z",
    "endReason": "ALL_LEFT"
  }
}
```

---

## Chat Consumption

Chat owns the conversation-visible timeline document.

Its stable logical identity is:

```text
call:<callSessionId>
```

Chat consumption must:

1. validate event type and schema version;
2. deduplicate `eventId`;
3. verify the referenced Conversation projection exists or defer safely;
4. compare the Call lifecycle version;
5. ignore a stale lifecycle version;
6. insert or update the single Call timeline entry;
7. preserve a terminal state from older overwrite;
8. record successful consumption durably.

A duplicate event must not:

- create another timeline entry;
- emit another accepted Chat update;
- regress the lifecycle state.

The Integration Event does not grant Conversation membership.

Chat applies its own Conversation access rules when users later read the projected entry.

---

## Data Excluded from Call Event

The event must not include:

- participant access tokens;
- SDP;
- ICE candidates;
- TURN credentials;
- mediasoup transports;
- Producers or Consumers;
- effective tier;
- Stripe data;
- private Message content;
- Identity email;
- display name;
- Call aggregate or ORM entity.

The numeric participant capacity is not required by the current Chat consumer and is therefore excluded.

---

# Phase 5 Meeting Events

Meeting event definitions become active only during Phase 5.

They exist to let Chat create and maintain the Meeting Conversation, membership eligibility, history boundary, and writable state.

---

## `conferencing.meeting.created`

Version: 1  
Producer: Conferencing  
Consumer: Chat  
Delivery: Phase 5

Represents creation of a committed standalone Meeting.

### Subject

```typescript
type MeetingSubject = {
  type: 'MEETING';
  id: string;
  version: number;
};
```

### Payload

```typescript
type MeetingCreatedV1 = {
  meetingId: string;
  organizerId: string;
  title: string;
  meetingType: 'INSTANT' | 'SCHEDULED';
  scheduledStartsAt: string | null;
  createdAt: string;
};
```

### Chat Consumption

Chat creates or converges on:

- one `MEETING` Conversation for the Meeting;
- organizer eligibility;
- organizer access to all Meeting history;
- initial writable state.

Stable logical identity:

```text
meeting:<meetingId>
```

The Meeting Conversation:

- does not become a Group Conversation;
- does not consume Group quotas;
- does not create a Contact relationship.

Duplicate creation delivery must converge on the same Meeting Conversation.

---

## `conferencing.meeting.lifecycle-changed`

Version: 1  
Producer: Conferencing  
Consumer: Chat  
Delivery: Phase 5

Represents a committed Meeting lifecycle transition.

### Subject

```typescript
type MeetingLifecycleSubject = {
  type: 'MEETING';
  id: string;
  version: number;
};
```

### Payload

```typescript
type MeetingLifecycleChangedV1 = {
  meetingId: string;
  status: 'AVAILABLE' | 'ACTIVE' | 'COMPLETED' | 'CANCELED' | 'ARCHIVED';
  startedAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  archivedAt: string | null;
};
```

### Chat Projection

| Meeting status | Existing eligible Chat user |
| -------------- | --------------------------- |
| `AVAILABLE`    | Read and write              |
| `ACTIVE`       | Read and write              |
| `COMPLETED`    | Read and write              |
| `CANCELED`     | Read only                   |
| `ARCHIVED`     | Read only                   |

After `COMPLETED`:

- existing eligibility remains;
- no new participant is added;
- Chat remains writable for existing eligible users.

After `CANCELED` or `ARCHIVED`:

- existing history remains;
- the Meeting Conversation becomes read-only.

Older lifecycle events must not reopen a canceled or archived Meeting Conversation.

---

## `conferencing.meeting.participant-eligible`

Version: 1  
Producer: Conferencing  
Consumer: Chat  
Delivery: Phase 5

Represents durable Meeting and Meeting-chat eligibility for one registered user.

It is produced for:

- formal Meeting invitation;
- durable lobby admission.

RSVP acceptance or decline does not create or remove eligibility and therefore does not require this event.

### Subject

The ordering scope is one participant's eligibility for one Meeting.

```typescript
type MeetingParticipantEligibilitySubject = {
  type: 'MEETING_PARTICIPANT_ELIGIBILITY';
  id: string;
  version: number;
};
```

The subject identifier is a stable provider-owned eligibility identifier. It must remain stable across changes for the same Meeting and user.

### Payload

```typescript
type MeetingParticipantEligibleV1 = {
  meetingId: string;
  userId: string;
  source: 'FORMAL_INVITATION' | 'LOBBY_ADMISSION';
  eligibleAt: string;
  historyVisibleFrom: string | null;
};
```

Rules:

| Source              | `historyVisibleFrom`                              |
| ------------------- | ------------------------------------------------- |
| `FORMAL_INVITATION` | `null`, meaning full Meeting Conversation history |
| `LOBBY_ADMISSION`   | Admission timestamp                               |

Chat must enforce the history boundary on the backend.

Lobby admission does not reserve live-media capacity.

### Chat Consumption

Chat converges on one Meeting membership for:

```text
meetingId
+ userId
```

A duplicate event must not create duplicate membership.

A newer eligibility version may update the visibility boundary only according to the accepted provider meaning.

The frontend must not override `historyVisibleFrom`.

---

## `conferencing.meeting.participant-ineligible`

Version: 1  
Producer: Conferencing  
Consumer: Chat  
Delivery: Phase 5

Represents removal of future Meeting access for a previously formally invited user.

Initial reason:

```text
INVITATION_REVOKED
```

### Subject

Uses the same stable participant-eligibility subject as the corresponding eligible event.

```typescript
type MeetingParticipantEligibilitySubject = {
  type: 'MEETING_PARTICIPANT_ELIGIBILITY';
  id: string;
  version: number;
};
```

### Payload

```typescript
type MeetingParticipantIneligibleV1 = {
  meetingId: string;
  userId: string;
  reason: 'INVITATION_REVOKED';
  ineligibleAt: string;
};
```

### Chat Consumption

Chat must:

- remove future Meeting Conversation access;
- preserve already stored Messages;
- preserve other participant eligibility;
- reject new reads and sends by the ineligible user;
- prevent an older eligible event from restoring access.

This event does not delete historical Message documents.

It does not ban a later invitation or lobby admission. A later accepted eligibility transition uses a newer subject version.

---

# Meeting Detail Changes

Meeting title or other metadata changes may require a future event if Chat presents copied Meeting metadata.

No `meeting.details-changed` event is currently accepted.

Before copying mutable Meeting metadata into Chat:

1. confirm the actual presentation requirement;
2. define the owning Integration Event;
3. define stale-update behavior;
4. update this catalog;
5. implement the Outbox and consumer together.

Do not emit `meeting.lifecycle-changed` merely to disguise an unrelated title update.

---

# Notification Event-Catalog Gate

Phase 6 introduces Notification only after a deliberately small event catalog is accepted.

For each selected Notification type, define:

- provider event;
- recipient source;
- safe presentation summary;
- whether in-app Notification is created;
- whether Slack delivery is supported;
- deduplication identity;
- ordering requirement;
- prohibited fields.

Candidate business facts include:

- Contact invitation;
- Group invitation;
- unanswered Call;
- Meeting invitation;
- selected Meeting lifecycle transition;
- selected Billing lifecycle transition.

This candidate list is not an active event catalog.

Notification must not subscribe to every existing Integration Event automatically.

Existing events may be reused only when their payload safely satisfies the selected Notification requirement.

If Notification needs data that an existing event intentionally omits, update the contract deliberately or query through a provider Public API. Do not expose an aggregate.

---

# Identity Event Boundary

Identity currently has internal Domain Events equivalent to:

- User created;
- User verified.

They are not active Integration Events.

Phase 2 does not introduce:

- Identity Outbox;
- profile Integration Events;
- Chat user-profile projection;
- event bus.

If Phase 6 selects an Identity fact for Notification, Identity must define a new versioned public Integration Event rather than publishing the internal Domain Event object.

Identity email and credentials must not be exposed merely because Notification becomes a consumer.

---

# Billing Event Boundary

Billing uses a durable Inbox for external Stripe events.

A Stripe webhook is not a Huddle Integration Event.

The following remain separate:

```text
Stripe event
→ Billing Webhook Inbox
→ Billing reconciliation
→ committed Billing state
→ optional Huddle Integration Event when a real consumer exists
```

No generic `TierChangedEvent` is currently an active public Integration Event.

Chat and Conferencing obtain current entitlements synchronously through their consumer-owned ports.

A future Billing Integration Event requires:

- real asynchronous consumer;
- minimal safe payload;
- explicit lifecycle-ordering behavior;
- provider-owned Outbox;
- new catalog entry.

---

# Chat Event Boundary

Chat's internal Message or membership Domain Events are not automatically public Integration Events.

Phase 2 does not create a Chat Outbox merely because internal events exist.

Phase 6 may add a Chat Integration Event for a selected Contact or Group invitation Notification.

The event must not include:

- complete private Message content;
- Identity email;
- Chat aggregate;
- membership repository data;
- unrelated participant lists.

---

# Outbox Dispatch

The initial Phase 3 dispatcher runs in process.

The contract remains transport-neutral.

The dispatcher must:

1. select pending provider Outbox records;
2. publish the stored immutable envelope;
3. mark or advance dispatch state safely;
4. retry transient failure with a bounded policy;
5. preserve exhausted failure for operations;
6. tolerate process interruption;
7. avoid rebuilding a different payload during every retry.

Kafka, RabbitMQ, and another external broker are not introduced in Phase 3.

A future transport change must preserve the Integration Event contract unless a versioned contract migration is intentionally performed.

---

# Consumer Deduplication

The primary deduplication identity is:

```text
eventId
```

Logical projection uniqueness also protects the consumer:

| Projection                      | Logical identity                           |
| ------------------------------- | ------------------------------------------ |
| Call timeline                   | `call:<callSessionId>`                     |
| Meeting Conversation            | `meeting:<meetingId>`                      |
| Meeting participant eligibility | `meetingId + userId`                       |
| Future Notification             | `eventId + notificationType + recipientId` |

Event-ID deduplication and logical uniqueness solve different failure cases. Both may be required.

A consumer must not rely only on BullMQ job identity or an in-memory cache.

---

# Cross-Database Consumer Work

A consumer may own data in more than one datastore.

Huddle does not introduce a distributed transaction between PostgreSQL and MongoDB.

When one logical event requires multiple consumer-side effects:

- split effects into retry-safe local steps;
- persist enough progress to resume;
- use stable event and projection identities;
- never apply duplicate business meaning;
- expose incomplete processing operationally.

The provider transaction remains committed regardless of consumer progress.

---

# Error and Recovery Behavior

A failed event must remain:

- pending;
- failed with safe diagnostics;
- or otherwise durably discoverable.

Silent loss is prohibited.

Infinite retry is prohibited.

Operational evidence should include safe fields such as:

- `eventId`;
- `eventType`;
- `schemaVersion`;
- producer Context;
- subject identifier;
- subject version;
- attempt count;
- safe last-error category.

Logs must not contain secrets or complete private payloads unnecessarily.

Recovery procedures belong in:

```text
operations/runbook.md
```

---

# Contract Tests

## Provider Contract Tests

Verify:

- correct event type;
- correct schema version;
- valid envelope;
- minimum payload only;
- state change and Outbox atomicity;
- rollback produces no deliverable event;
- subject version increases correctly;
- serialization produces plain data.

## Consumer Contract Tests

Verify:

- supported version accepted;
- unsupported version retained as failure;
- duplicate `eventId`;
- duplicate logical projection;
- stale subject version;
- newer event before older event;
- retry after local commit;
- retry after process restart;
- unknown optional field compatibility.

## Call Projection Tests

Verify:

- one timeline entry per Call;
- `RINGING` creation;
- `ACTIVE` update;
- terminal update;
- duplicate event safety;
- old active event cannot replace ended state;
- infrastructure failure remains terminal.

## Meeting Projection Tests

Verify:

- Meeting Conversation created once;
- organizer eligibility;
- invited participant full history;
- lobby-admitted participant bounded history;
- invitation revocation removes future access;
- old eligible event cannot restore access;
- completed Meeting remains writable;
- canceled Meeting becomes read-only;
- archived Meeting remains read-only.

---

# Legacy Mapping Note

Legacy documents referred directly to internal events such as:

```text
UserCreatedEvent
UserVerifiedEvent
MessageCreatedEvent
SessionStartedEvent
SessionEndedEvent
TierChangedEvent
```

Those names are not automatically retained as public Integration Events.

The new architecture requires:

```text
Internal Domain Event or committed state
→ explicit public Integration Event translation
→ provider Outbox
→ idempotent consumer
```

Only the event catalog in this document defines active cross-context event contracts.

---

# Source-of-Truth Boundaries

This document is the source of truth for:

- Integration Event envelope;
- public event names;
- schema versions;
- event payloads;
- producer and consumer mapping;
- event ordering scope;
- compatibility rules;
- consumer idempotency requirements.

This document is not the source of truth for:

- Domain Event classes;
- Outbox database schema;
- queue job schema;
- Socket.IO events;
- Stripe webhook schema;
- Notification catalog not yet accepted;
- current implementation status.

Those concerns belong to Context documents, executable persistence, realtime contracts, Billing Inbox behavior, Notification catalog, tests, and `delivery/status.md`.
