# Phase 5 — Meetings

Status: Later  
Depends on: Phase 4 — Billing and Portfolio Release  
Next phase: Phase 6 — Notification

## Objective

Deliver standalone Meetings with:

- instant and scheduled creation;
- invitations and RSVP;
- registered-user Meeting links;
- lobby admission;
- Meeting roles;
- live voice and video;
- screen sharing;
- persistent Meeting chat.

Meetings remain separate from ordinary Group Conversations and conversation-based Calls.

## Implementation Authority

Phase 5 may implement the Meeting capability defined in:

- [`../../contexts/conferencing/meetings.md`](../../contexts/conferencing/meetings.md)
- [`../../contexts/conferencing/README.md`](../../contexts/conferencing/README.md)

The Context documents define the target behavior.

This phase defines which parts of that target are authorized for current implementation.

Phase 5 must not expand into anonymous conferencing, recording, webinars, calendar integration, or Enterprise Workspace features.

## Entry Criteria

Phase 5 begins only after Phase 4 has provided:

- deployed Identity and Chat capabilities;
- deployed conversation-based Calling;
- real Billing-backed entitlements;
- Free and Pro effective-tier calculation;
- authenticated `/users/me` composition;
- production-like PostgreSQL, MongoDB, and Redis operation;
- working Transactional Outbox infrastructure;
- validated mediasoup and coturn deployment;
- documented deployment and recovery procedures.

Chat must already provide:

- persistent message storage;
- realtime message delivery;
- idempotent Integration Event consumption;
- backend-enforced conversation access;
- support for a Meeting Conversation projection.

## Required Documents by Task

| Task                | Read these documents                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Meeting lifecycle   | This phase file, `contexts/conferencing/meetings.md`, and the applicable Meeting HTTP contract                                  |
| Shared live session | This phase file, `contexts/conferencing/README.md`, and `contracts/conferencing-realtime.md`                                    |
| Live media          | This phase file, `contexts/conferencing/README.md`, `contracts/conferencing-realtime.md`, and `contracts/conferencing-sfu.md`   |
| Roles and lobby     | This phase file, `contexts/conferencing/meetings.md`, `contracts/meeting-realtime.md`, and the applicable Meeting HTTP contract |
| Meeting chat        | This phase file, `contexts/conferencing/meetings.md`, `contexts/chat.md`, and `contracts/integration-events.md`                 |
| Entitlements        | This phase file, `product/tiers.md`, and `contexts/billing.md`                                                                  |
| Deployment          | This phase file, `operations/deployment.md`, and `operations/runbook.md`                                                        |
| Tests               | Relevant task documents and `engineering/testing.md`                                                                            |

Do not load ordinary Group Conversation administration rules as Meeting-role rules.

ADR 0006 explains why CallSession, Meeting, and ConferenceSession are separate concepts. It is not required for routine Meeting implementation after that boundary is understood.

## Included Scope

### Meeting Capability

Implement:

- Instant Meetings;
- Scheduled Meetings;
- durable Meeting lifecycle;
- registered Huddle users as participants;
- organizer, co-organizer, and attendee roles;
- invitations;
- RSVP;
- invitation revocation;
- unguessable Meeting links;
- lobby admission and denial;
- participant eligibility;
- one active ConferenceSession per Meeting;
- Meeting completion, cancellation, and archive;
- media-process failure reconciliation.

All lifecycle, eligibility, role, invitation, and lobby rules come from:

`contexts/conferencing/meetings.md`

### Entitlement Enforcement

Use the real Billing capability introduced in Phase 4.

Implement entitlement checks for:

- Meeting creation;
- Meeting start;
- protected Meeting capabilities;
- live ConferenceSession capacity.

Required behavior includes:

- fail closed when required entitlement information is unavailable;
- use current committed entitlement when a protected operation begins;
- snapshot numeric participant capacity at ConferenceSession creation;
- preserve an already-active ConferenceSession across a later tier change.

The authoritative Free and Pro rules come only from:

`product/tiers.md`

### Live Media

Extend the existing Conferencing media infrastructure for standalone Meetings.

Implement:

- SFU-backed Meeting voice and video;
- Meeting ConferenceSession creation;
- authenticated media join;
- concurrency-safe participant admission;
- participant cleanup;
- Meeting termination cleanup;
- media-worker failure handling;
- organizer and co-organizer screen sharing.

Shared WebRTC, mediasoup, signaling, and capacity behavior comes from:

`contexts/conferencing/README.md`

Meeting-specific authorization comes from:

`contexts/conferencing/meetings.md`

### Meeting Chat

Extend Chat with the `MEETING` Conversation type.

Implement:

- one Meeting Conversation per Meeting;
- Meeting-specific eligibility projection;
- invited-user access;
- lobby-admitted-user history boundaries;
- Meeting lifecycle effects on conversation writability;
- backend-enforced history filtering;
- preservation of Meeting messages after live media ends;
- exclusion from ordinary Group Conversation quotas.

Chat remains the owner of:

- Meeting messages;
- message queries;
- realtime message delivery;
- Meeting Conversation persistence;
- read and write enforcement.

Conferencing remains the owner of:

- Meeting lifecycle;
- invitations;
- roles;
- admission;
- participant eligibility facts.

Detailed behavior comes from:

- `contexts/conferencing/meetings.md`
- `contexts/chat.md`

### Cross-Context Integration

Extend the Conferencing Transactional Outbox for Meeting lifecycle and eligibility facts required by Chat.

Implement:

- provider-owned versioned Integration Events;
- atomic Meeting state and Outbox persistence;
- idempotent Chat consumption;
- stale lifecycle-event protection;
- safe Meeting Conversation creation under redelivery;
- safe participant projection updates;
- honest handling of temporary Chat projection delay.

Do not introduce an external broker solely for this flow without measured operational need and a separate decision.

### Realtime Contracts

Create or update contracts for:

- Meeting lifecycle commands;
- invitations and RSVP;
- Meeting role management;
- lobby entry, admission, and denial;
- ConferenceSession join and leave;
- Meeting voice and video signaling;
- screen-sharing signaling;
- Meeting-chat realtime behavior.

Exact event names and payloads belong in `contracts/`.

Clients must not supply authoritative:

- actor identity;
- Meeting role;
- admission authority;
- entitlement;
- participant capacity.

### Operations

Update operational documentation for:

- Meeting media sessions;
- Meeting Router and transport cleanup;
- screen-share resource cleanup;
- lobby-state recovery;
- media-process failure reconciliation;
- pending Integration Event recovery;
- target-environment Meeting validation.

Exact operational procedures belong in `operations/`.

## Persistence Introduced

### PostgreSQL

Extend Conferencing-owned persistence for:

- Meeting;
- invitations and RSVP;
- roles;
- participant eligibility;
- durable admission;
- Meeting ConferenceSession metadata;
- capacity snapshot;
- lifecycle version;
- Transactional Outbox.

### MongoDB

Extend Chat-owned persistence for:

- Meeting Conversation;
- Meeting messages;
- participant access projection;
- history-visibility boundary;
- writable or read-only projection state.

### Redis

Redis may hold recoverable live state such as:

- lobby presence;
- connected Meeting participants;
- socket mappings;
- short-lived coordination.

### Process Memory

mediasoup runtime resources remain process-bound.

Losing those resources ends the affected live ConferenceSession but must not delete durable Meeting or Chat state.

## Required Verification

### Domain

Verify the Meeting rules defined by `contexts/conferencing/meetings.md`, including:

- lifecycle transitions;
- organizer invariants;
- role permissions;
- invitation and RSVP behavior;
- invitation revocation;
- participant eligibility;
- one active ConferenceSession;
- capacity snapshot behavior;
- completion, cancellation, and archive.

Use an injected clock for scheduled behavior.

### Application and Persistence

Verify:

- real Free and Pro entitlement enforcement;
- entitlement failure before protected mutation;
- Identity validation of client-supplied invitee IDs;
- invitation idempotency;
- lobby admission and denial;
- concurrent admission at the final capacity slot;
- duplicate ConferenceSession start prevention;
- Meeting and Outbox atomicity;
- duplicate Integration Event delivery;
- out-of-order lifecycle delivery;
- Meeting Conversation creation;
- participant projection;
- recovery after worker interruption;
- no ordinary Group quota consumption.

### Chat Authorization

Verify the access and history rules defined by `contexts/conferencing/meetings.md`, including:

- formally invited participant access;
- RSVP decline behavior;
- invitation revocation;
- admitted-participant history boundary;
- backend rejection of inaccessible history;
- lifecycle-driven writable and read-only state;
- rejection of new participants after completion;
- preservation of Meeting Conversation type.

### Realtime and Media

Verify:

- authenticated lobby entry;
- unauthorized admission rejection;
- role-authorized Meeting operations;
- admitted media join;
- concurrent capacity enforcement;
- Meeting voice and video;
- screen-share authorization;
- screen-share cleanup;
- ConferenceSession completion;
- participant disconnect cleanup;
- media-process failure with durable Meeting and Chat state preserved.

### Target Deployment

Validate on the deployed OCI ARM64 environment:

- SFU-backed Meeting media;
- documented Meeting participant scenario;
- screen sharing;
- lobby and admission realtime behavior;
- Router and transport cleanup;
- CPU usage;
- memory usage;
- network usage;
- media-worker failure handling.

Record the result and do not claim capacity beyond collected evidence.

## Definition of Done

Phase 5 is complete only when:

- Instant and Scheduled Meetings work;
- real Billing entitlements protect Meeting creation and start;
- eligible registered users can participate according to the documented rules;
- Meeting roles and lobby authorization work;
- numeric live-session capacity is concurrency-safe;
- Meeting voice and video work on the target deployment;
- authorized screen sharing works;
- Meeting chat is created through the Integration Event path;
- Meeting history boundaries are enforced by the backend;
- Meeting lifecycle changes correctly affect Chat access;
- Meeting Conversations do not consume ordinary Group quotas;
- duplicate and out-of-order events are safe;
- media-process failure preserves durable Meeting and Chat state;
- required HTTP, realtime, and Integration Event contracts are documented;
- operations documentation is updated;
- test evidence is recorded;
- [`../status.md`](../status.md) is updated.

## Explicitly Deferred

Do not implement during Phase 5:

- anonymous guests;
- recurring Meetings;
- calendar integration;
- recording;
- transcription;
- Presenter role;
- attendee screen sharing;
- webinars;
- breakout rooms;
- organizer transfer;
- participant banning;
- Enterprise Meeting policy;
- Workspace ownership;
- multiple active ConferenceSessions per Meeting;
- multiple media nodes;
- Kubernetes;
- multi-region conferencing.
