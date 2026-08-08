# Conferencing SFU Signaling Contract

Status: Phase 3 Group Call contract accepted; Phase 5 Meeting extension planned  
Last reviewed: 2026-08-08

## Purpose

This document defines mediasoup SFU signaling for Group Calls and Meetings:

- Router capability access
- Transport creation and connection
- Producer creation and closure
- Consumer creation and resumption
- Media-resource ownership

Shared connection, participant admission, acknowledgement, expiration, and recovery behavior belongs to [`conferencing-realtime.md`](conferencing-realtime.md).

This contract does not define durable lifecycle, Meeting lobby behavior, product limits, or mediasoup deployment configuration.

## Delivery Boundary

Phase 3 authorizes SFU signaling for Group voice and video Calls.

Phase 5 reuses the contract for Meetings and adds organizer or co-organizer screen sharing.

Phase 3 must not implement Meetings or screen sharing merely because their accepted transport values appear here.

Conversation Calls do not gain screen sharing through this contract.

## Admission Boundary

SFU signaling is permitted only when:

- The ConferenceSession uses `SFU` topology.
- The durable parent permits live participation.
- The authenticated user remains eligible.
- The participant has joined the active ConferenceSession.
- Referenced media resources belong to the expected session and participant.

Capacity is enforced by `conference:join` before media resources are created.

Billing is not queried during SFU operations.

## Mediasoup Type Boundary

Conceptual public types include:

```typescript
type RtpCapabilities = unknown;
type DtlsParameters = unknown;
type RtpParameters = unknown;
type MediaKind = 'audio' | 'video';
```

Implementation uses the installed `mediasoup` and `mediasoup-client` type definitions rather than unvalidated `any`.

Mediasoup domain objects, Worker identifiers, Router objects, and process-memory references must not appear in public payloads.

Client `appData` is not authorization.

## Applicable Errors

Commands use the acknowledgement envelope from [`conferencing-realtime.md`](conferencing-realtime.md).

Applicable errors include:

- `INVALID_PAYLOAD`
- `AUTHENTICATION_EXPIRED`
- `SESSION_UNAVAILABLE`
- `ACCESS_DENIED`
- `INVALID_SESSION_STATE`
- `MEDIA_UNAVAILABLE`
- `TRANSPORT_NOT_FOUND`
- `TRANSPORT_OWNERSHIP_VIOLATION`
- `PRODUCER_NOT_FOUND`
- `PRODUCER_OWNERSHIP_VIOLATION`
- `CONSUMER_NOT_FOUND`
- `INTERNAL_ERROR`

## Get Router RTP Capabilities

Client event:

```text
sfu:get-router-capabilities
```

Payload:

```typescript
type GetRouterCapabilitiesCommand = {
  conferenceSessionId: string;
};
```

Success:

```typescript
type GetRouterCapabilitiesResult = {
  rtpCapabilities: RtpCapabilities;
};
```

Capabilities are returned only for an eligible participant of the selected active SFU session.

## Create Transport

Client event:

```text
sfu:create-transport
```

Payload:

```typescript
type CreateTransportCommand = {
  conferenceSessionId: string;
  direction: 'SEND' | 'RECEIVE';
};
```

Success:

```typescript
type CreateTransportResult = {
  transportId: string;
  iceParameters: unknown;
  iceCandidates: unknown[];
  dtlsParameters: DtlsParameters;
  sctpParameters?: unknown;
};
```

The server associates the transport with:

```text
conferenceSessionId
+ authenticated participantId
+ direction
```

A client cannot select another transport owner.

## Connect Transport

Client event:

```text
sfu:connect-transport
```

Payload:

```typescript
type ConnectTransportCommand = {
  conferenceSessionId: string;
  transportId: string;
  dtlsParameters: DtlsParameters;
};
```

Success:

```typescript
type ConnectTransportResult = {
  connected: true;
};
```

The server verifies ConferenceSession state and transport ownership before connection.

## Produce Media

Client event:

```text
sfu:produce
```

Payload:

```typescript
type ProduceMediaCommand = {
  conferenceSessionId: string;
  transportId: string;
  kind: MediaKind;
  source: 'MICROPHONE' | 'CAMERA' | 'SCREEN';
  rtpParameters: RtpParameters;
};
```

Success:

```typescript
type ProduceMediaResult = {
  producerId: string;
};
```

Authorization:

| Source       | Earliest Phase | Authorized participant                            |
| ------------ | -------------- | ------------------------------------------------- |
| `MICROPHONE` | Phase 3        | Eligible joined Group Call or Meeting participant |
| `CAMERA`     | Phase 3        | Eligible joined Group Call or Meeting participant |
| `SCREEN`     | Phase 5        | Joined Meeting organizer or co-organizer          |

Meeting microphone and camera behavior still belongs to Phase 5.

A client-provided `source` does not grant permission to produce it.

## Producer Available

Server event:

```text
sfu:producer-available
```

Payload:

```typescript
type ProducerAvailableEvent = {
  conferenceSessionId: string;
  producerId: string;
  participantId: string;
  kind: MediaKind;
  source: 'MICROPHONE' | 'CAMERA' | 'SCREEN';
};
```

The event indicates that a Producer may be consumed. It does not authorize consumption by itself.

## Consume Media

Client event:

```text
sfu:consume
```

Payload:

```typescript
type ConsumeMediaCommand = {
  conferenceSessionId: string;
  transportId: string;
  producerId: string;
  rtpCapabilities: RtpCapabilities;
};
```

Success:

```typescript
type ConsumeMediaResult = {
  consumerId: string;
  producerId: string;
  participantId: string;
  kind: MediaKind;
  source: 'MICROPHONE' | 'CAMERA' | 'SCREEN';
  rtpParameters: RtpParameters;
  paused: boolean;
};
```

The server verifies:

- Receive transport ownership
- Current ConferenceSession participation
- Producer belongs to the same ConferenceSession
- Producer remains available
- Router compatibility
- Media source remains authorized

## Resume Consumer

Client event:

```text
sfu:resume-consumer
```

Payload:

```typescript
type ResumeConsumerCommand = {
  conferenceSessionId: string;
  consumerId: string;
};
```

Success:

```typescript
type ResumeConsumerResult = {
  resumed: true;
};
```

The server verifies Consumer ownership and current Producer availability.

## Close Producer

Client event:

```text
sfu:close-producer
```

Payload:

```typescript
type CloseProducerCommand = {
  conferenceSessionId: string;
  producerId: string;
};
```

Success:

```typescript
type CloseProducerResult = {
  closed: true;
};
```

A participant may close only their own Producer.

Stopping screen sharing closes the screen Producer. It does not end the Meeting.

Repeated closure must converge safely.

## Producer Closed

Server event:

```text
sfu:producer-closed
```

Payload:

```typescript
type ProducerClosedEvent = {
  conferenceSessionId: string;
  producerId: string;
  participantId: string;
  reason:
    | 'OWNER_CLOSED'
    | 'OWNER_LEFT'
    | 'TRANSPORT_CLOSED'
    | 'SESSION_ENDED'
    | 'MEDIA_FAILURE';
};
```

Receiving clients close dependent Consumers idempotently.

This event represents live-resource cleanup, not a durable lifecycle transition.

## Resource Ownership

The server maintains ownership equivalent to:

```text
ConferenceSession
└── Participant
    ├── SEND Transport
    │   └── Producers
    └── RECEIVE Transport
        └── Consumers
```

Possession of a `transportId`, `producerId`, or `consumerId` is not authorization.

Every operation verifies the full ownership chain. Resources cannot cross ConferenceSession boundaries.

When participation ends, participant-owned transports, Producers, and Consumers close idempotently.

## Reconnection

After reconnect and successful `conference:join`, the participant:

1. Fetches Router capabilities.
2. Creates new transports.
3. Connects the transports.
4. Recreates authorized Producers.
5. Consumes currently available Producers.

Previous transport, Producer, and Consumer identifiers are not reusable.

Shared reconnect and failure behavior belongs to [`conferencing-realtime.md`](conferencing-realtime.md).

## Required Tests

Test:

- Authorized Router capability access
- Send and receive transport creation
- Transport ownership and cross-session rejection
- Transport connection
- Microphone and camera Producer creation
- Producer ownership
- Unsupported media source
- Screen source rejected before Phase 5
- Screen source rejected for Conversation Calls
- Consumer ownership
- Cross-session Producer rejection
- Incompatible RTP capabilities
- Consumer resume
- Participant and Producer cleanup
- Session-end cleanup
- Worker-failure reconciliation
- Reconnect with new media resources

Phase 5 additionally tests:

- Meeting microphone and camera
- Organizer screen sharing
- Co-organizer screen sharing
- Attendee screen sharing rejection
- Screen Producer cleanup

## Explicitly Deferred

This contract does not authorize:

- Attendee screen sharing
- Conversation Call screen sharing
- Recording
- Transcription
- Breakout rooms
- Remote participant mute
- Multiple mediasoup Workers
- Cross-node Router piping
- Seamless media recovery
- Server-side media composition

## Source-of-Truth Boundaries

This document is the source of truth for:

- `sfu:get-router-capabilities`
- `sfu:create-transport`
- `sfu:connect-transport`
- `sfu:produce`
- `sfu:producer-available`
- `sfu:consume`
- `sfu:resume-consumer`
- `sfu:close-producer`
- `sfu:producer-closed`
- SFU media-resource ownership

Shared participant behavior belongs to [`conferencing-realtime.md`](conferencing-realtime.md). Meeting lobby behavior belongs to [`meeting-realtime.md`](meeting-realtime.md).

## Related Documentation

- [Shared Conferencing Realtime Contract](conferencing-realtime.md)
- [Meeting Realtime Contract](meeting-realtime.md)
- [Conferencing Context](../contexts/conferencing/README.md)
- [Calls](../contexts/conferencing/calls.md)
- [Meetings](../contexts/conferencing/meetings.md)
- [Calling Phase](../delivery/phases/03-calling.md)
- [Meeting Phase](../delivery/phases/05-meetings.md)
