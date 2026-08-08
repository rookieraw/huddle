# Phase 3 — Voice and Video Calling

Status: Planned  
Depends on: Phase 2.5 — CI/CD and Deployment Foundation  
Next gate: Phase 4 — Billing and Portfolio Release

## Objective

Deliver authenticated Direct and Group voice/video Calls from existing Chat Conversations.

Phase 3 introduces:

- the first Conferencing capability;
- WebRTC signaling;
- direct peer-to-peer media with TURN fallback;
- group media through mediasoup;
- durable CallSession state;
- conversation timeline integration through a Transactional Outbox.

Standalone Meetings are not part of this phase.

## Implementation Authority

Phase 3 may implement only conversation-based Calls described in:

- [`../../contexts/conferencing/calls.md`](../../contexts/conferencing/calls.md)
- [`../../contexts/conferencing/README.md`](../../contexts/conferencing/README.md)

The Context documents define the target behavior.

This phase defines which parts of that target are authorized for current implementation.

Phase 3 must not expand into Meeting functionality.

## Entry Criteria

Phase 3 begins only after Phase 2.5 has established:

- a working deployment baseline;
- CI verification;
- environment configuration;
- PostgreSQL availability;
- MongoDB availability;
- Redis availability;
- target OCI ARM64 deployment access;
- a documented deployment and recovery procedure.

Phase 2 Chat must already provide:

- Direct Conversations;
- Group Conversations;
- conversation membership;
- current-member authorization;
- message and timeline persistence;
- a public capability for Conferencing to validate conversation access.

## Required Documents by Task

| Task                  | Read these documents                                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Call lifecycle        | This phase file and `contexts/conferencing/calls.md`                                                                                                      |
| Shared live session   | This phase file, `contexts/conferencing/README.md`, `contracts/conferencing-realtime.md`, and `architecture/security.md`                                  |
| Direct-call signaling | This phase file, `contexts/conferencing/calls.md`, `contracts/conferencing-realtime.md`, `contracts/conferencing-p2p.md`, and `architecture/security.md`  |
| Group media           | This phase file, `contexts/conferencing/README.md`, `contracts/conferencing-realtime.md`, `contracts/conferencing-sfu.md`, and `operations/deployment.md` |
| Call timeline         | This phase file, `contexts/conferencing/calls.md`, `contexts/chat.md`, `contracts/integration-events.md`, and ADR 0004                                    |
| Capacity entitlement  | This phase file, `product/tiers.md`, `contexts/billing.md`, and `contexts/conferencing/calls.md`                                                          |
| TURN                  | This phase file, `contexts/conferencing/README.md`, `operations/deployment.md`, and `operations/runbook.md`                                               |
| Tests                 | Relevant task documents and `engineering/testing.md`                                                                                                      |

Do not load Meeting documentation for an ordinary Call task.

ADR 0006 explains why Calls, Meetings, and ConferenceSessions use separate domain concepts. It is not required for routine Call implementation after that boundary is understood.

## Included Scope

### Call Capability

Implement:

- Direct voice Calls;
- Direct video Calls;
- Group voice Calls;
- Group video Calls;
- durable CallSession lifecycle;
- one non-ended CallSession per Conversation;
- Call initiation and response;
- participant leave and rejoin;
- backend-authoritative Call deadlines;
- numeric capacity snapshots;
- concurrency-safe Call creation and participant admission;
- terminal Call outcomes;
- media-process failure reconciliation.

All lifecycle rules and time values come from:

`contexts/conferencing/calls.md`

### Direct Media

Implement:

- authenticated WebRTC signaling;
- peer-to-peer media where connectivity permits;
- STUN-assisted connectivity;
- coturn relay fallback;
- server-issued time-limited TURN credentials;
- authorization of every signaling operation.

Detailed shared media rules come from:

`contexts/conferencing/README.md`

### Group Media

Implement:

- mediasoup SFU media;
- the initial single-worker topology;
- one Router per active SFU-backed Call;
- transport, Producer, and Consumer ownership;
- participant cleanup;
- Call termination cleanup;
- media-worker failure handling.

The implementation must be validated on the target OCI ARM64 environment.

Configuration alone is not evidence that the deployment can sustain the documented product scenarios.

### Chat Timeline Integration

Implement the first producer-owned Transactional Outbox with a real cross-context consumer.

The required boundary is:

- Conferencing commits CallSession state and its Outbox record atomically;
- Conferencing dispatches versioned Integration Events;
- Chat consumes the events idempotently;
- Chat updates its MongoDB timeline projection;
- duplicate and out-of-order lifecycle events remain safe.

Phase 3 uses an in-process dispatcher.

Do not introduce Kafka, RabbitMQ, or another external message broker.

### Entitlement Transition

Billing is not implemented until Phase 4.

During Phase 3:

- runtime users receive the static Free entitlement;
- Pro capacity is verified through injected test fixtures;
- no client-controlled tier override is exposed;
- consumers use their Billing entitlement port;
- the real Billing adapter is not implemented early.

The authoritative capability and participant limits come only from:

`product/tiers.md`

### Contracts

Create or update the contracts required for:

- Call-related HTTP operations;
- authenticated Conferencing realtime events;
- signaling payloads;
- Call lifecycle Integration Events;
- transport-level error responses.

Exact payloads belong in `contracts/`, not in this phase file.

### Operations

Create or update operational instructions for:

- mediasoup startup;
- coturn startup;
- required public addresses and ports;
- TURN credential configuration;
- media-process health checks;
- active-session failure behavior;
- target-environment validation;
- relevant recovery procedures.

Exact deployment configuration belongs in `operations/`.

## Persistence Introduced

Phase 3 adds Conferencing-owned PostgreSQL persistence for:

- CallSession;
- ConferenceSession metadata;
- numeric capacity snapshots;
- lifecycle timestamps and terminal outcome;
- lifecycle version;
- Transactional Outbox.

Redis may hold recoverable live presence and coordination state.

mediasoup runtime objects remain in process memory.

The authoritative persistence boundaries are defined in:

- `contexts/conferencing/README.md`
- `architecture/data-and-consistency.md`
- ADR 0002
- ADR 0004

## Required Verification

### Domain

Verify:

- allowed and rejected Call lifecycle transitions;
- one non-ended Call per Conversation;
- Direct and Group response behavior;
- leave and rejoin behavior;
- authoritative timeout and duration behavior;
- numeric capacity snapshots;
- terminal outcomes.

Tests use an injected clock and must not wait for real multi-minute or multi-hour durations.

### Application and Persistence

Verify:

- current Conversation authorization;
- concurrent Call initiation;
- concurrent admission at the final capacity slot;
- entitlement failure before protected mutation;
- static Free runtime behavior;
- Pro entitlement fixtures;
- durable CallSession persistence;
- Outbox atomicity;
- recoverable Outbox dispatch;
- duplicate Integration Event delivery;
- out-of-order lifecycle delivery;
- Chat timeline idempotency;
- application and media-process failure reconciliation.

### Realtime and Media

Verify:

- authenticated socket connection;
- unauthorized signaling rejection;
- sender-spoofing rejection;
- cross-session signaling rejection;
- SDP and ICE routing;
- reconnection;
- access-token expiry;
- participant cleanup;
- transport ownership;
- Producer and Consumer cleanup;
- direct peer-to-peer media;
- TURN-relayed media;
- group SFU media.

### Target Deployment

Validate on the OCI ARM64 environment:

- mediasoup installation or compilation;
- mediasoup Worker startup;
- public announced-address behavior;
- UDP media;
- supported TCP fallback;
- coturn UDP relay;
- coturn TCP or TLS relay where configured;
- Direct Call scenarios;
- Free and Pro Group Call participant scenarios;
- CPU usage;
- memory usage;
- network usage;
- worker-failure behavior.

Record the validation result.

Do not claim capacity beyond collected evidence.

## Definition of Done

Phase 3 is complete only when:

- Direct voice and video Calls work;
- Group voice and video Calls work;
- behavior matches `contexts/conferencing/calls.md`;
- authenticated signaling is enforced;
- unauthorized signaling and sender spoofing are rejected;
- peer-to-peer media works where available;
- coturn fallback is validated outside the local network;
- mediasoup group media works on the target OCI ARM64 environment;
- CallSession state is durable;
- numeric session capacity is enforced safely under concurrency;
- Call timeline entries use the Transactional Outbox path;
- duplicate and out-of-order events are safe;
- infrastructure-failure reconciliation is verified;
- Free runtime entitlement and Pro test fixtures are verified;
- required HTTP, realtime, and Integration Event contracts are documented;
- relevant operations documentation is updated;
- test evidence is recorded;
- [`../status.md`](../status.md) is updated.

## Explicitly Deferred

Do not implement during Phase 3:

- standalone Meetings;
- Meeting scheduling;
- Meeting links;
- Meeting lobby;
- Meeting roles;
- Meeting chat;
- recording;
- transcription;
- anonymous guests;
- breakout rooms;
- Stripe integration;
- Slack integration;
- general Notification delivery;
- Kafka;
- RabbitMQ;
- multiple media nodes;
- Kubernetes;
- seamless active-media recovery;
- production availability claims.

Screen sharing remains part of the later Meeting scope unless a separate decision explicitly authorizes it for conversation Calls.
