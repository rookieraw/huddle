# Conferencing P2P Signaling Contract

Status: Phase 3 contract accepted  
Last reviewed: 2026-08-08

## Purpose

This document defines peer-to-peer WebRTC signaling for Direct Calls:

- SDP offer relay
- SDP answer relay
- ICE candidate relay
- P2P authorization
- Payload bounds

Shared connection, acknowledgement, participant, expiration, and recovery behavior belongs to [`conferencing-realtime.md`](conferencing-realtime.md).

This contract does not define durable Call lifecycle, ConferenceSession admission, Group Call media, Meeting behavior, or TURN deployment.

## Delivery Boundary

This contract is authorized for Phase 3 Direct Calls only.

It must not be used for:

- Group Calls
- Meetings
- Screen sharing
- Server-side media routing

Direct Calls use peer-to-peer WebRTC where possible and coturn relay when required.

## Signaling Authorization

P2P signaling is permitted only when:

- The ConferenceSession belongs to a Direct Call.
- The Call and ConferenceSession permit signaling.
- Both users remain eligible participants.
- The sender has joined the ConferenceSession.
- The target is the other Direct Call participant.

Every command uses `conferenceSessionId`.

The server derives the sender from trusted socket state. A client cannot provide an authoritative sender identity or select a participant outside the Direct Call.

Signaling data is temporary negotiation data, not durable Call state.

## Command Result

Successful relay uses the shared acknowledgement envelope with:

```typescript
type SignalingRelayResult = {
  accepted: true;
};
```

Success means the server accepted the relay. It does not prove the remote browser completed WebRTC negotiation.

Applicable shared failures include:

- `INVALID_PAYLOAD`
- `AUTHENTICATION_EXPIRED`
- `SESSION_UNAVAILABLE`
- `ACCESS_DENIED`
- `INVALID_SESSION_STATE`
- `INTERNAL_ERROR`

## Send Offer

Client event:

```text
p2p:offer
```

Payload:

```typescript
type SendP2POfferCommand = {
  conferenceSessionId: string;
  targetUserId: string;
  description: {
    type: 'offer';
    sdp: string;
  };
};
```

Server event:

```text
p2p:offer-received
```

Payload:

```typescript
type P2POfferReceivedEvent = {
  conferenceSessionId: string;
  fromUserId: string;
  description: {
    type: 'offer';
    sdp: string;
  };
};
```

## Send Answer

Client event:

```text
p2p:answer
```

Payload:

```typescript
type SendP2PAnswerCommand = {
  conferenceSessionId: string;
  targetUserId: string;
  description: {
    type: 'answer';
    sdp: string;
  };
};
```

Server event:

```text
p2p:answer-received
```

Payload:

```typescript
type P2PAnswerReceivedEvent = {
  conferenceSessionId: string;
  fromUserId: string;
  description: {
    type: 'answer';
    sdp: string;
  };
};
```

## Send ICE Candidate

Client event:

```text
p2p:ice-candidate
```

Payload:

```typescript
type SendP2PIceCandidateCommand = {
  conferenceSessionId: string;
  targetUserId: string;
  candidate: {
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number | null;
    usernameFragment?: string | null;
  };
};
```

Server event:

```text
p2p:ice-candidate-received
```

Payload:

```typescript
type P2PIceCandidateReceivedEvent = {
  conferenceSessionId: string;
  fromUserId: string;
  candidate: {
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number | null;
    usernameFragment?: string | null;
  };
};
```

## Payload Bounds

The implementation rejects:

- Malformed session descriptions
- Unsupported description types
- Oversized SDP
- Oversized ICE candidate strings
- Cross-session targets
- Signaling after terminal state

Initial public bounds:

| Payload              | Maximum |
| -------------------- | ------: |
| SDP string           | 256 KiB |
| ICE candidate string |  16 KiB |

These are defensive transport limits, not media-quality settings.

SDP and ICE candidates remain untrusted input.

## Reconnection

After reconnect, an eligible participant rejoins the active ConferenceSession and creates a new peer connection.

The browsers then renegotiate SDP and ICE.

Reconnect does not restore the previous peer connection, negotiation state, capacity slot, or an ended ConferenceSession. It does not extend the Call deadline.

Shared reconnect behavior belongs to [`conferencing-realtime.md`](conferencing-realtime.md).

## Required Tests

Test:

- Authorized offer, answer, and ICE forwarding
- Sender identity derived from socket state
- Arbitrary target rejection
- Cross-session target rejection
- Group Call and Meeting rejection
- Terminal-session rejection
- Malformed or unsupported SDP
- SDP and ICE size bounds
- Missing or expired authentication
- Reconnect and renegotiation
- TURN-relayed browser scenario

## Explicitly Deferred

This contract does not authorize:

- P2P Group Calls
- P2P Meetings
- Direct Call screen sharing
- Recording
- Transcription
- Seamless peer-connection recovery
- Server-side media composition

## Source-of-Truth Boundaries

This document is the source of truth for:

- `p2p:offer`
- `p2p:offer-received`
- `p2p:answer`
- `p2p:answer-received`
- `p2p:ice-candidate`
- `p2p:ice-candidate-received`
- P2P authorization
- P2P payload bounds

Shared socket behavior belongs to [`conferencing-realtime.md`](conferencing-realtime.md). Durable Call behavior belongs to the Calls Context.

## Related Documentation

- [Shared Conferencing Realtime Contract](conferencing-realtime.md)
- [Calls](../contexts/conferencing/calls.md)
- [Conferencing Context](../contexts/conferencing/README.md)
- [Calling Phase](../delivery/phases/03-calling.md)
- [Security Architecture](../architecture/security.md)
