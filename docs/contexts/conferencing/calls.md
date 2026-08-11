# Calls

Status: Accepted target; Phase 3 implementation  
Parent bounded context: Conferencing  
Last reviewed: 2026-08-07

## Responsibility

Calls defines the lifecycle of voice and video communication started from an existing Chat conversation.

It owns:

- CallSession
- Call type and conversation scope
- Initiation and response
- Participant join, leave, and rejoin
- Capacity snapshot
- Unanswered timeout
- Maximum duration
- Terminal outcome
- Call lifecycle Integration Events

It does not own:

- Conversation membership
- Chat timeline persistence
- User authentication
- Effective subscription state
- Standalone Meeting lifecycle
- mediasoup implementation details

## Call Types

A CallSession has:

### Media Type

- `VOICE`
- `VIDEO`

### Conversation Scope

- `DIRECT`
- `GROUP`

A CallSession always references one eligible Chat Conversation.

Standalone Meetings do not use CallSession.

## CallSession Model

A CallSession contains concepts equivalent to:

- Session identifier
- Conversation identifier
- Conversation scope
- Media type
- Initiator identifier
- Status
- Numeric maximum participants
- Initiated timestamp
- Activated timestamp
- Ended timestamp
- End reason
- Lifecycle version

Exact persistence fields belong to the implementation.

## Lifecycle

The lifecycle is equivalent to:

```text
RINGING
→ ACTIVE
→ ENDED
```

`ENDED` is terminal.

An ended CallSession:

- Cannot be reopened.
- Cannot accept new signaling.
- Cannot accept participant rejoin.
- Retains its durable history.
- Remains represented by its Chat timeline entry.

A later call creates a new CallSession.

## End Reasons

A terminal CallSession records one reason equivalent to:

| Reason                   | Meaning                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `REJECTED`               | Direct-call recipient rejected                             |
| `UNANSWERED`             | Required participant response did not occur before timeout |
| `CANCELED`               | Initiator canceled before activation                       |
| `ALL_LEFT`               | No participant remains                                     |
| `MAX_DURATION`           | Authoritative duration limit reached                       |
| `INFRASTRUCTURE_FAILURE` | Live media could not continue                              |

Exact enum names may follow repository conventions but must preserve these meanings.

## One Non-ended Call per Conversation

A Conversation may have at most one non-ended CallSession.

When an eligible member attempts to start another call:

- No second CallSession is created.
- The existing non-ended CallSession is returned.
- The client presents the existing call entry.
- The user may join or respond when authorized.
- Concurrent creation attempts converge on the same session.
- Chat does not create a duplicate call-started timeline entry.

Persistence must enforce this invariant under concurrency.

## Direct Calls

A member of a Direct Conversation may initiate a voice or video call.

A Direct CallSession has:

```text
maxParticipants = 2
```

It does not require a Billing entitlement lookup.

### Accept

When the recipient accepts before the deadline:

- The session becomes `ACTIVE`.
- Both eligible participants may join media.
- The unanswered deadline no longer applies.
- The maximum-duration deadline begins from authoritative activation.

### Reject

When the recipient rejects:

- The CallSession immediately becomes `ENDED`.
- End reason is `REJECTED`.
- Media negotiation is closed.
- The caller receives a rejected result.
- The recipient receives a declined result.
- Chat updates the existing timeline entry.

### Ignore

If the recipient neither accepts nor rejects within:

```text
2 minutes from initiatedAt
```

the CallSession ends as `UNANSWERED`.

A late acceptance is rejected.

### Initiator Cancellation

If the initiator cancels before activation:

- The session ends as `CANCELED`.
- A later recipient response is rejected.
- The existing timeline entry becomes terminal.

## Group Calls

Any active Group Conversation member may initiate a voice or video call.

The initiator’s effective entitlement determines the numeric participant capacity at creation.

The capacity includes the initiator.

### Activation

A Group CallSession begins in `RINGING`.

When the first eligible participant beyond the initiator joins:

- The session becomes `ACTIVE`.
- The unanswered deadline no longer applies.
- The maximum-duration deadline begins.

### Individual Decline

A Group member may decline for themselves.

Their decline:

- Does not end the CallSession.
- Does not prevent other eligible members from joining.
- Does not create a separate CallSession.

A member who declined may join later while the session remains active, authorization remains valid, and capacity is available.

### Unanswered Group Call

If no eligible participant beyond the initiator joins within:

```text
2 minutes from initiatedAt
```

the session ends as `UNANSWERED`.

### Initiator Leaves Before Activation

If the initiator explicitly cancels before another participant joins, the session ends as `CANCELED`.

If no participant remains for any reason, the session ends immediately and does not wait for the unanswered timeout.

## Leave and Rejoin

Leaving media does not automatically end an active CallSession while another participant remains.

Required behavior:

- A participant may leave.
- Remaining participants continue.
- A former participant may rejoin.
- Rejoin uses the existing timeline entry.
- Rejoin requires current Conversation authorization.
- Rejoin requires available session capacity.
- Rejoin does not extend any deadline.
- An ended session cannot be rejoined.

When all joined participants have left:

- The CallSession ends immediately as `ALL_LEFT`.
- Live media resources are released.
- Chat receives the terminal lifecycle fact.

## Capacity Snapshot

### Direct Call

Direct capacity is fixed at two.

### Group Call

Group-call creation follows:

```text
Resolve initiator entitlement
→ obtain group-call participant limit
→ create CallSession(maxParticipants)
```

The session stores the numeric limit.

It does not store a tier as capacity authority.

Consequences:

- Upgrade does not expand the active session.
- Downgrade does not shrink the active session.
- Participant join does not query Billing.
- A later CallSession uses the latest entitlement.

Authoritative values belong only to:

```text
product/tiers.md
```

## Concurrent Join

Participant admission must be safe when several users attempt to consume the final capacity slot.

The system must not allow active participant count to exceed:

```text
CallSession.maxParticipants
```

The exact concurrency mechanism belongs to Conferencing persistence design and must be verified through integration tests.

## Time Policy

Backend time is authoritative.

### Unanswered Deadline

```text
Direct Call: 2 minutes from initiation
Group Call: 2 minutes from initiation
```

### Maximum Active Duration

```text
4 hours from activation
```

### Warning

Connected participants receive a warning:

```text
5 minutes before maximum-duration termination
```

During the warning period:

- Eligible participants may remain.
- Eligible participants may rejoin.
- Rejoin does not move the deadline.
- The client cannot extend the session by changing its clock.

At the deadline:

- The CallSession ends as `MAX_DURATION`.
- Media resources close.
- Chat receives the terminal lifecycle fact.

Timer recovery must not depend only on an in-memory timeout.

Tests use an injected clock.

## Authorization

Call authorization depends on current Chat facts.

Conferencing uses a consumer-owned port backed by Chat’s public Conversation access capability.

Required checks include:

- Conversation exists.
- Conversation type supports the requested call.
- Initiator is an active member.
- Responder or joiner is an active member.
- CallSession belongs to the Conversation.
- Session is in a valid lifecycle state.
- Capacity is available.

Identity existence alone does not grant Call access.

The verified principal supplies the authoritative actor identifier.

## Signaling

Signaling uses authenticated realtime connections.

Required rules:

- Access token comes from `handshake.auth.accessToken`.
- Verified principal is stored in trusted socket state.
- Payload does not provide authoritative sender identity.
- Signaling is scoped to one authorized CallSession.
- SDP and ICE candidates are routed only to eligible participants.
- Expired token disconnects the socket.
- Refresh occurs through HTTP followed by reconnect.
- Signaling messages are not durable lifecycle authority.

Exact shared ConferenceSession, participant, and Call lifecycle events belong to:

```text
contracts/conferencing-realtime.md
```

Exact Direct Call offer, answer, and ICE events belong to:

```text
contracts/conferencing-p2p.md
```

Exact Group Call mediasoup events belong to:

```text
contracts/conferencing-sfu.md
```

The Calls Context owns signaling authorization rules but does not redefine transport payloads.

## Persistence

PostgreSQL stores durable Call state:

- CallSession
- Lifecycle timestamps
- End reason
- Numeric capacity
- Lifecycle version
- Transactional Outbox record

Redis may store recoverable live state:

- Participant presence
- Socket mapping
- Short-lived signaling coordination

Live media objects remain in process memory.

Redis and process memory are not authoritative for whether the CallSession exists or has ended.

## Chat Timeline Integration

Call lifecycle changes use a provider-owned Transactional Outbox.

Accepted flow:

```text
Commit CallSession change
+ commit Conferencing Outbox record

→ dispatch versioned Integration Event
→ Chat application command
→ idempotent MongoDB timeline update
```

Required lifecycle facts include equivalents of:

- Call started
- Call activated when required by presentation
- Call ended

Conferencing owns lifecycle meaning.

Chat owns the timeline document.

Chat deduplicates through the stable call identity and lifecycle version defined in:

```text
contexts/chat.md
```

Delivery is at least once and eventually consistent.

## Infrastructure Failure

If the media process fails:

- Active media cannot be reconstructed transparently.
- Affected CallSessions end as `INFRASTRUCTURE_FAILURE`.
- Durable state is reconciled.
- Terminal lifecycle events are produced.
- Chat history remains.
- Users may start a later CallSession.

Huddle does not claim seamless active-call recovery.

## Error Categories

Calls distinguishes:

- Authentication failure
- Conversation authorization failure
- Invalid lifecycle transition
- Existing non-ended call
- Entitlements unavailable
- Capacity reached
- Session ended
- Signaling payload invalid
- Media infrastructure unavailable
- Timer-processing failure

Transport-specific mappings belong to contract documents.

## Required Tests

Critical tests include:

- One CallSession per Conversation
- Concurrent call creation
- Direct accept
- Direct reject
- Direct unanswered at two minutes
- Late response rejection
- Initiator cancellation
- Group individual decline
- Group unanswered at two minutes
- Group activation
- Leave while another remains
- Rejoin
- All-left termination
- Four-hour maximum duration
- Five-minute warning
- Rejoin without deadline extension
- Direct fixed capacity
- Group capacity snapshot
- Concurrent final-capacity join
- Entitlement failure before mutation
- Duplicate and out-of-order timeline events
- Media-process failure reconciliation
- Unauthorized signaling
- Sender spoofing attempt

## Deferred

Calls does not include:

- Scheduling
- Meeting links
- Lobby
- Meeting roles
- Recording
- Transcription
- Anonymous participants
- Breakout rooms
- Multiple media nodes
- Seamless media recovery

These belong to later or deferred scope.

## Source-of-truth Boundaries

This document is the source of truth for:

- CallSession lifecycle
- Direct and Group response behavior
- Leave and rejoin behavior
- Call timing values
- Capacity snapshot behavior
- Call authorization responsibility
- Call timeline integration meaning

This document is not the source of truth for:

- Tier values
- Realtime payloads
- mediasoup configuration
- coturn configuration
- Exact database schema
- Current implementation status

Those concerns belong to Product, Contracts, Conferencing, Operations, code, tests, and Delivery documentation.
