# Conferencing Realtime Contract

Status: Phase 3 shared contract accepted; Phase 5 Meeting use planned  
Last reviewed: 2026-08-08

## Purpose

This document defines shared Socket.IO behavior for Huddle Conferencing:

- Namespace and authentication
- Acknowledgement envelope
- Shared error codes
- Call and ConferenceSession views
- Lifecycle notifications
- Participant join and leave
- Token expiration
- Shared reconnection and failure behavior

Capability-specific contracts are:

- Direct Call P2P signaling: [`conferencing-p2p.md`](conferencing-p2p.md)
- Group Call and Meeting SFU signaling: [`conferencing-sfu.md`](conferencing-sfu.md)
- Meeting lobby and Meeting state: [`meeting-realtime.md`](meeting-realtime.md)

This document does not define durable domain rules, HTTP commands, Integration Events, product limits, or deployment configuration.

## Identifier Boundary

| Identifier            | Meaning                                                    |
| --------------------- | ---------------------------------------------------------- |
| `callSessionId`       | Durable Call lifecycle associated with a Chat Conversation |
| `meetingId`           | Durable standalone Meeting lifecycle                       |
| `conferenceSessionId` | One temporary live-media execution                         |
| `transportId`         | One participant-owned mediasoup transport                  |
| `producerId`          | One participant-owned outgoing media source                |
| `consumerId`          | One participant-owned received media stream                |

A `ConferenceSession` belongs to exactly one `CallSession` or `Meeting`.

Loss of live-media resources does not delete the durable parent.

## Delivery Boundary

Phase 3 implements this shared contract for Direct and Group Calls.

Phase 5 reuses it for Meeting ConferenceSessions and adds [`meeting-realtime.md`](meeting-realtime.md).

The presence of `parentType: 'MEETING'` does not authorize Meeting implementation before Phase 5.

## Namespace

Conferencing uses:

```text
/conferencing
```

Example:

```typescript
const socket = io(`${apiOrigin}/conferencing`, {
  auth: {
    accessToken,
  },
});
```

Access tokens must not be sent through query parameters, signaling payloads, SDP, ICE candidates, mediasoup `appData`, or Meeting links.

## Authentication

Handshake:

```typescript
type ConferencingHandshakeAuth = {
  accessToken: string;
};
```

Accepted flow:

```text
Read handshake.auth.accessToken
→ verify the token
→ create a trusted principal
→ attach it to socket state
→ accept the connection
```

Trusted socket state:

```typescript
type ConferencingSocketPrincipal = {
  userId: string;
  expiresAt: string;
};
```

Event payloads must not provide an authoritative actor identifier.

Authentication identifies the actor. The owning Context still authorizes every Call, Meeting, and ConferenceSession operation.

### Connection Failure

Invalid authentication rejects the connection through Socket.IO `connect_error`.

```typescript
type ConferencingConnectionError = {
  code: 'AUTHENTICATION_FAILED';
  message: string;
};
```

The public message must not expose token-verification details.

## Acknowledgement Envelope

Client commands use Socket.IO acknowledgements.

Success:

```typescript
type ConferencingSuccess<T> = {
  ok: true;
  data: T;
};
```

Failure:

```typescript
type ConferencingFailure = {
  ok: false;
  error: {
    code: ConferencingRealtimeErrorCode;
    message: string;
    retryable: boolean;
  };
};
```

Shared error codes:

```typescript
type ConferencingRealtimeErrorCode =
  | 'INVALID_PAYLOAD'
  | 'AUTHENTICATION_EXPIRED'
  | 'SESSION_UNAVAILABLE'
  | 'ACCESS_DENIED'
  | 'INVALID_SESSION_STATE'
  | 'CAPACITY_REACHED'
  | 'LOBBY_REQUIRED'
  | 'LOBBY_ACCESS_DENIED'
  | 'MEDIA_UNAVAILABLE'
  | 'TRANSPORT_NOT_FOUND'
  | 'TRANSPORT_OWNERSHIP_VIOLATION'
  | 'PRODUCER_NOT_FOUND'
  | 'PRODUCER_OWNERSHIP_VIOLATION'
  | 'CONSUMER_NOT_FOUND'
  | 'INTERNAL_ERROR';
```

Capability contracts identify the applicable codes for each command.

Infrastructure errors, stack traces, private addresses, internal media objects, and provider secrets must not appear in public failures.

## Shared Views

### Call Realtime View

```typescript
type CallRealtimeView = {
  callSessionId: string;
  conferenceSessionId: string | null;
  conversationId: string;
  conversationScope: 'DIRECT' | 'GROUP';
  mediaType: 'VOICE' | 'VIDEO';
  status: 'RINGING' | 'ACTIVE' | 'ENDED';
  initiatorId: string;
  maxParticipants: number;
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
  lifecycleVersion: number;
};
```

The view exposes the numeric capacity snapshot, not a subscription tier.

### ConferenceSession View

```typescript
type ConferenceSessionView = {
  conferenceSessionId: string;
  parentType: 'CALL' | 'MEETING';
  parentId: string;
  topology: 'P2P' | 'SFU';
  status: 'PREPARING' | 'ACTIVE' | 'ENDED';
  maxParticipants: number;
};
```

Process-memory media objects must not appear in this view.

## Durable Lifecycle Boundary

Durable lifecycle commands use the applicable HTTP contract.

Examples include:

- Initiate Call
- Accept or reject Direct Call
- Decline Group Call
- Cancel Call
- Start, end, or cancel Meeting

Realtime events notify clients only after the durable transition commits.

A realtime notification is not the durable source of lifecycle truth. Clients recover authoritative state through HTTP.

## Call State Changed

Server event:

```text
call:state-changed
```

Payload:

```typescript
type CallStateChangedEvent = CallRealtimeView;
```

It is emitted to eligible connected Conversation participants after a committed Call transition.

Applicable transitions include:

- Call created
- Direct Call accepted or rejected
- Group Call activated
- Call canceled or unanswered
- All participants left
- Maximum duration reached
- Infrastructure failure

Clients compare `lifecycleVersion`. An older event must not replace newer local state.

Chat timeline updates use Integration Events rather than this Socket.IO event.

## Call Ending Soon

Server event:

```text
call:ending-soon
```

Payload:

```typescript
type CallEndingSoonEvent = {
  callSessionId: string;
  conferenceSessionId: string;
  endsAt: string;
  remainingSeconds: number;
};
```

The server clock is authoritative.

Receiving or missing the warning does not change the deadline. Rejoin does not extend `endsAt`.

## Conference Ended

Server event:

```text
conference:ended
```

Payload:

```typescript
type ConferenceEndedEvent = {
  conferenceSessionId: string;
  parentType: 'CALL' | 'MEETING';
  parentId: string;
  reason: 'PARENT_ENDED' | 'MAX_DURATION' | 'INFRASTRUCTURE_FAILURE';
};
```

After this event:

- New signaling is rejected.
- Participant live state is removed.
- Temporary media resources close.

An ended `CallSession` cannot be reopened.

Meeting Chat history may remain after its live ConferenceSession ends.

## Join ConferenceSession

Client event:

```text
conference:join
```

Payload:

```typescript
type JoinConferenceCommand = {
  conferenceSessionId: string;
};
```

Success:

```typescript
type JoinConferenceResult = {
  conference: ConferenceSessionView;
  participantId: string;
};
```

Before admission, the server verifies:

1. Authenticated principal
2. Parent exists and permits joining
3. Current Conversation or Meeting eligibility
4. Lobby admission where required
5. Numeric capacity snapshot
6. Concurrency-safe final-slot admission

Participant join does not query Billing.

Invitation, eligibility, or lobby admission does not reserve capacity.

### Join Errors

| Situation                        | Code                     | Retryable                       |
| -------------------------------- | ------------------------ | ------------------------------- |
| Invalid payload                  | `INVALID_PAYLOAD`        | No                              |
| Token expired                    | `AUTHENTICATION_EXPIRED` | After HTTP refresh              |
| Session unavailable or ended     | `SESSION_UNAVAILABLE`    | No                              |
| Current eligibility denied       | `ACCESS_DENIED`          | No                              |
| Invalid parent lifecycle         | `INVALID_SESSION_STATE`  | No                              |
| Meeting lobby admission required | `LOBBY_REQUIRED`         | After admission                 |
| Numeric capacity reached         | `CAPACITY_REACHED`       | When capacity becomes available |
| Media process unavailable        | `MEDIA_UNAVAILABLE`      | Later                           |
| Unknown infrastructure failure   | `INTERNAL_ERROR`         | Depends on reconciliation       |

## Leave ConferenceSession

Client event:

```text
conference:leave
```

Payload:

```typescript
type LeaveConferenceCommand = {
  conferenceSessionId: string;
};
```

Success:

```typescript
type LeaveConferenceResult = {
  conferenceSessionId: string;
};
```

Leave processing:

- Removes current live participation.
- Closes participant-owned media resources.
- Releases the capacity slot.
- Preserves durable Conversation or Meeting eligibility.
- Does not extend a deadline.

Repeated leave must converge safely.

For Calls, the durable lifecycle ends according to the Call rules when no joined participant remains.

## Participant Joined

Server event:

```text
conference:participant-joined
```

Payload:

```typescript
type ConferenceParticipantJoinedEvent = {
  conferenceSessionId: string;
  participantId: string;
};
```

Emit only after capacity admission succeeds.

## Participant Left

Server event:

```text
conference:participant-left
```

Payload:

```typescript
type ConferenceParticipantLeftEvent = {
  conferenceSessionId: string;
  participantId: string;
  reason:
    | 'LEFT'
    | 'DISCONNECTED'
    | 'ACCESS_REVOKED'
    | 'TRANSPORT_CLOSED'
    | 'SESSION_ENDED';
};
```

A stale socket must not permanently retain a capacity slot.

Disconnect and transport cleanup must be idempotent.

## Token Expiration

Server event:

```text
auth:expired
```

Payload:

```typescript
type ConferencingAuthenticationExpiredEvent = {
  code: 'AUTHENTICATION_EXPIRED';
};
```

When the access token expires:

1. Emit `auth:expired` where possible.
2. Disconnect the socket.
3. Clean up stale live participation.
4. Preserve durable parent state.
5. Close or reconcile participant-owned media resources.

The client refreshes through HTTP and reconnects.

## Reconnection

After reconnect:

1. Reauthenticate.
2. Recover authoritative parent state.
3. Verify current eligibility.
4. Rejoin the existing ConferenceSession if active and capacity permits.
5. Recreate temporary media resources through the applicable capability contract.

Capability-specific recovery belongs to:

- [`conferencing-p2p.md`](conferencing-p2p.md)
- [`conferencing-sfu.md`](conferencing-sfu.md)
- [`meeting-realtime.md`](meeting-realtime.md)

Rejoin does not recreate an ended session, extend a deadline, preserve a previous capacity slot, or restore process-bound media identifiers.

## Failure Behavior

### Media Failure

If required live-media infrastructure fails:

- Active media may stop.
- Affected ConferenceSessions are reconciled.
- `conference:ended` is emitted where possible.
- Durable parent state is reconciled.
- Chat history remains.

Huddle does not claim seamless active-session recovery.

### Redis Failure

Redis is reconstructable coordination state, not durable Call or Meeting authority.

After Redis recovers, durable PostgreSQL state and remaining process state are reconciled before admitting participants.

### Unknown Command Outcome

If a client disconnects before acknowledgement:

- Do not assume a durable operation failed.
- Recover authoritative state through HTTP.
- Repeat only operations with defined idempotency.
- Recreate temporary media resources when ownership is uncertain.

## Security Rules

Every operation verifies the applicable:

- Authenticated principal
- Parent authorization
- Session lifecycle
- Participant eligibility
- Capacity
- Target participant
- Media-resource ownership

The client must not provide authoritative actor identity, Meeting role, admission authority, subscription tier, participant limit, lifecycle version, or media ownership.

Signaling and media parameters remain untrusted input.

Capability-specific authorization belongs to the applicable contract.

## Required Tests

Test the shared contract for:

- Valid, missing, invalid, and expired tokens
- Query-string token rejection
- Token-expiration cleanup
- Eligible and unauthorized join
- Ended-session rejection
- Concurrent final-capacity admission
- Leave and stale-disconnect cleanup
- Rejoin without deadline extension
- Lifecycle-version ordering
- Ending-soon notification
- Terminal-session signaling rejection
- Redis and media failure reconciliation
- Unknown acknowledgement outcome

P2P-, SFU-, and Meeting-specific tests belong to their capability contracts.

## Explicitly Deferred

This shared contract does not authorize:

- Anonymous Meeting guests
- Recording
- Transcription
- Breakout rooms
- Multiple mediasoup Workers
- Cross-node Router piping
- Seamless active-media recovery
- Server-side media composition

## Source-of-Truth Boundaries

This document is the source of truth for:

- `/conferencing`
- Conferencing handshake
- Shared acknowledgement and error codes
- Shared session views
- `call:state-changed`
- `call:ending-soon`
- `conference:ended`
- `conference:join`
- `conference:leave`
- `conference:participant-joined`
- `conference:participant-left`
- `auth:expired`
- Shared reconnect and failure behavior

It is not the source of truth for P2P events, SFU events, Meeting lobby events, durable lifecycle rules, product limits, HTTP commands, Integration Events, or deployment configuration.

## Related Documentation

- [P2P Signaling Contract](conferencing-p2p.md)
- [SFU Signaling Contract](conferencing-sfu.md)
- [Meeting Realtime Contract](meeting-realtime.md)
- [Conferencing Context](../contexts/conferencing/README.md)
- [Calls](../contexts/conferencing/calls.md)
- [Meetings](../contexts/conferencing/meetings.md)
- [Calling Phase](../delivery/phases/03-calling.md)
- [Meeting Phase](../delivery/phases/05-meetings.md)
- [Integration Events](integration-events.md)
- [Security Architecture](../architecture/security.md)
