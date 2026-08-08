# Conferencing Context

Status: Accepted target; Calling in Phase 3, Meetings in Phase 5  
Last reviewed: 2026-08-07

## Responsibility

Conferencing owns the control plane for Huddle voice, video, and screen-sharing sessions.

It owns:

- CallSession
- Meeting
- ConferenceSession
- Participant media lifecycle
- Signaling authorization
- Numeric participant capacity
- mediasoup resource coordination
- TURN credential issuance
- Media-process failure handling

Calls and Meetings are capabilities within the Conferencing bounded context. They are not independent bounded contexts.

Their detailed product lifecycles are defined in:

- [Calls](calls.md)
- [Meetings](meetings.md)

This document defines their shared live-media architecture.

## Delivery State

| Capability              | Delivery phase |
| ----------------------- | -------------- |
| Direct voice and video  | Phase 3        |
| Group voice and video   | Phase 3        |
| mediasoup SFU           | Phase 3        |
| coturn fallback         | Phase 3        |
| Standalone Meetings     | Phase 5        |
| Lobby and Meeting roles | Phase 5        |
| Screen sharing          | Phase 5        |

## Core Concepts

### CallSession

Durable conversation-call lifecycle.

Source of truth:

```text
contexts/conferencing/calls.md
```

### Meeting

Durable standalone-Meeting lifecycle, eligibility, and roles.

Source of truth:

```text
contexts/conferencing/meetings.md
```

### ConferenceSession

Represents one active or preparing live-media session.

A ConferenceSession belongs to exactly one:

- CallSession, or
- Meeting

It contains concepts equivalent to:

- ConferenceSession identifier
- Parent type and identifier
- Media topology
- Status
- Numeric maximum participants
- Creation timestamp
- Activation timestamp
- End timestamp
- Failure outcome when applicable

It does not own Chat messages or subscription state.

## Media Topologies

Huddle supports two media paths.

| Experience           | Media topology                                 |
| -------------------- | ---------------------------------------------- |
| Direct call          | Peer-to-peer WebRTC where possible             |
| Direct-call fallback | Peer-to-peer connection relayed through coturn |
| Group call           | mediasoup SFU                                  |
| Standalone Meeting   | mediasoup SFU                                  |

The signaling server participates in authorization and negotiation but does not normally carry peer-to-peer media.

## Direct Peer-to-peer Calls

For Direct Calls:

1. Conferencing authenticates and authorizes both participants.
2. Clients exchange signaling through the authenticated realtime channel.
3. Clients attempt direct WebRTC connectivity.
4. STUN assists connectivity discovery.
5. coturn relays media when direct connectivity fails.

CallSession remains durable even though media flows peer to peer.

The backend remains authoritative for:

- Call lifecycle
- Participant eligibility
- Accept or reject state
- Rejoin eligibility
- Timeouts
- Maximum duration

Browser peer-connection state is not authoritative CallSession state.

## Group Calls and Meetings

Group Calls and Meetings use mediasoup as a Selective Forwarding Unit.

Each sending participant publishes media to mediasoup.

mediasoup forwards selected media streams to receiving participants without mixing or transcoding them into one composed stream.

The initial architecture does not include:

- Recording
- Server-side media composition
- Transcoding pipeline
- Multiple media nodes
- Cross-node Router piping

## ConferenceSession Capacity

Capacity is numeric and immutable after ConferenceSession creation.

Accepted sequence:

```text
Resolve entitlement when required
→ validate capability
→ obtain numeric participant limit
→ create ConferenceSession(maxParticipants)
```

Participant join:

- Reads the stored numeric capacity.
- Does not query Billing.
- Includes the initiating user or organizer.
- Must be concurrency-safe.
- Rejects when the active joined count reaches capacity.

Invitation or eligibility does not reserve a media slot.

Leaving releases the active slot while preserving rejoin eligibility according to the parent lifecycle.

## Participant Media State

Live participant state distinguishes concepts equivalent to:

- Eligible
- Connected
- Joined
- Left
- Disconnected

Eligibility belongs to the parent CallSession or Meeting rules.

Live presence may be recoverable Redis state.

Durable ConferenceSession metadata remains in PostgreSQL.

A stale socket connection must not permanently consume capacity.

Participant cleanup must account for:

- Explicit leave
- Socket disconnect
- WebRTC transport close
- mediasoup producer close
- Worker failure
- Session termination

## Signaling

Signaling uses authenticated realtime connections.

Required rules:

- Access token is supplied through `handshake.auth.accessToken`.
- Verified principal is stored in trusted socket state.
- Payload does not supply authoritative actor identity.
- Every message is scoped to an authorized parent session.
- Conversation or Meeting eligibility is rechecked where required.
- Unsupported or oversized signaling payloads are rejected.
- Ended sessions reject new signaling.
- Token expiration disconnects the socket.
- Refresh occurs through HTTP and reconnect.

Exact shared connection, session, participant, and lifecycle events belong to:

```text
contracts/conferencing-realtime.md
```

Capability-specific event names and payloads belong to:

- Direct Call P2P signaling: `contracts/conferencing-p2p.md`
- Group Call and Meeting SFU signaling: `contracts/conferencing-sfu.md`
- Meeting lobby and Meeting state: `contracts/meeting-realtime.md`

A Context rule does not redefine a transport payload.

## Direct-call Signaling

Direct-call signaling relays negotiation facts only between the two authorized participants.

The server must prevent:

- Signaling to an arbitrary user
- Signaling across CallSessions
- Sender spoofing
- Late signaling after terminal state
- Unauthorized ICE or session-description forwarding

Signaling delivery does not replace durable CallSession transitions.

## mediasoup Architecture

The initial deployment uses:

- One mediasoup Worker
- One Router per active Group Call or Meeting ConferenceSession
- One WebRtcServer where appropriate
- Explicit listen information
- Explicit announced public address
- Restricted transport port configuration

A mediasoup Worker is a native subprocess and is treated as CPU-sensitive infrastructure.

One configured Worker does not prove the capacity of every accepted product scenario.

## Router Ownership

A Router belongs to one active SFU-backed ConferenceSession.

When the ConferenceSession ends:

- Its transports close.
- Producers close.
- Consumers close.
- Router resources close.
- Participant live state is removed.
- Durable parent state remains.

A Router is not shared across unrelated Calls or Meetings in the initial design.

## WebRTC Transports

Transport creation requires:

- Authenticated participant
- Active ConferenceSession
- Current eligibility
- Valid mediasoup capabilities
- Supported direction or operation
- Resource ownership by the requesting participant

Transport identifiers are scoped to:

- ConferenceSession
- Participant

A participant cannot connect, close, or control another participant’s transport without explicit system authority.

## Producers and Consumers

A Producer represents media sent by one participant.

A Consumer represents one participant receiving another allowed Producer.

Required behavior:

- Producer identity is server-associated with the authenticated participant.
- Consumer creation checks ConferenceSession membership.
- Closed Producers cause dependent Consumer cleanup.
- Participant leave closes owned media resources.
- Session termination closes all related resources.
- Client identifiers are never sufficient authorization by themselves.

## Voice and Video

Supported media categories include:

- Microphone audio
- Camera video

The frontend controls presentation layout.

The backend controls:

- Authorization
- Resource ownership
- Session capacity
- Media-session lifecycle

Codec selection and detailed RTP capabilities belong to implementation and tested deployment configuration.

## Screen Sharing

Screen sharing is introduced with Meetings.

It is represented as a distinct video Producer.

Authorization belongs to Meeting role policy:

```text
contexts/conferencing/meetings.md
```

Required media behavior:

- Only an authorized joined participant may produce.
- Disconnect closes the screen Producer.
- Stopping screen share does not end the Meeting.
- Screen media is not persisted.
- Recording is not implied.

## coturn

coturn provides connectivity fallback.

It runs as a separate process or container.

Required behavior:

- Publicly reachable listener
- Explicit relay range
- Time-limited credentials
- Server-side credential generation
- Protected shared secret
- No permanent frontend credential
- UDP relay validation
- TCP or TLS relay validation where configured
- Credential expiration

TURN credentials are returned only to authenticated users eligible for the requested session.

Exact networking belongs to:

```text
operations/deployment.md
```

## TURN Credential Model

Credentials use a time-limited mechanism equivalent to:

```text
username = expiration and user-scoped value
credential = HMAC(shared secret, username)
```

The exact coturn-compatible format belongs to implementation.

Required rules:

- Shared secret remains server-side.
- Credential lifetime is bounded.
- Logs do not contain the shared secret.
- Expired credentials are rejected.
- TURN issuance is rate-limited where appropriate.

## Public Address Configuration

mediasoup and coturn require the externally reachable address to be configured correctly.

Deployment must distinguish:

- Container or host listen address
- Private host address
- Public announced address

Advertising a private container address to browser clients is invalid.

The exact address and port configuration belongs to operations documentation and deployment environment.

## Persistence

### PostgreSQL

Stores durable control state:

- CallSession
- Meeting
- ConferenceSession metadata
- Capacity snapshot
- Lifecycle timestamps
- Failure outcome
- Transactional Outbox

### Redis

May store recoverable live state:

- Connected participants
- Socket mapping
- Lobby presence
- Short-lived coordination
- Scheduler or queue state where justified

### Process Memory

Stores mediasoup runtime resources:

- Worker
- Router
- WebRtcServer
- Transport
- Producer
- Consumer

No process-memory object is a substitute for durable parent lifecycle state.

## Process Failure

If the NestJS media process or mediasoup Worker fails:

- Active media stops.
- mediasoup resources cannot be reconstructed transparently.
- Affected ConferenceSessions become terminal.
- Parent CallSession or Meeting state is reconciled.
- Required Integration Events are produced.
- Chat history remains.
- Users may create a later eligible session.

Huddle does not claim seamless live-media recovery.

## Application Restart

On startup, Conferencing must identify durable sessions that were active but have no valid live media runtime.

It must reconcile them to the accepted infrastructure-failure outcome.

It must not recreate an active media session merely because PostgreSQL still contains a previously active status.

## Cross-context Dependencies

### Identity

Provides:

- Token verification
- Minimal participant profile data where required

### Chat

Provides:

- Conversation existence
- Conversation type
- Current membership
- Conversation-call eligibility

### Billing

Provides:

- Group-call entitlement at creation
- Meeting creation and start entitlement
- Numeric participant limits

### Chat as Event Consumer

Consumes:

- Call lifecycle facts
- Meeting lifecycle and eligibility facts

Conferencing does not write Chat persistence directly.

## Integration Events

Conferencing owns versioned lifecycle events for:

- Calls
- Meetings
- Participant eligibility facts required by Chat

Event persistence uses the Conferencing Transactional Outbox.

Delivery is:

- At least once
- Recoverable
- Idempotently consumed
- Lifecycle-version aware

Exact payloads belong to:

```text
contracts/integration-events.md
```

## Deployment Validation

The target OCI ARM64 environment must verify:

- mediasoup installation or compilation
- Worker startup
- WebRtcServer binding
- Public announced address
- UDP media
- coturn relay
- Direct peer-to-peer media
- TURN fallback
- Group SFU media
- Product participant scenarios
- CPU
- Memory
- Network
- Worker failure

Capacity claims require recorded evidence.

## Required Tests

Critical tests include:

- Authenticated signaling
- Unauthorized signaling
- Cross-session signaling rejection
- Sender spoofing rejection
- Capacity snapshot
- Concurrent final-capacity join
- Stale presence cleanup
- Transport ownership
- Producer and Consumer cleanup
- Direct peer-to-peer call
- TURN fallback
- SFU Group Call
- SFU Meeting
- Screen-share authorization
- Worker failure reconciliation
- Application restart reconciliation
- Duplicate lifecycle event safety

## Deferred

Conferencing does not include:

- Recording
- Transcription
- Media mixing
- Server-side composition
- Breakout rooms
- Multiple mediasoup Workers
- Multiple media nodes
- Router piping
- Seamless session recovery
- Kubernetes
- Multi-region media

These require measured need and explicit decisions.

## Source-of-truth Boundaries

This document is the source of truth for:

- ConferenceSession responsibility
- Shared media topology
- mediasoup resource ownership
- coturn credential principles
- Signaling security
- Live versus durable state
- Media-process failure behavior

This document is not the source of truth for:

- Call product lifecycle
- Meeting product lifecycle
- Tier values
- Realtime payloads
- Exact media ports
- Exact codec configuration
- Current implementation status

Those concerns belong to Calls, Meetings, Product, Contracts, Operations, code, tests, and Delivery documentation.
