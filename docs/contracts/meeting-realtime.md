# Meeting Realtime Contract

Status: Planned for Phase 5  
Last reviewed: 2026-08-08

## Purpose

This document defines Meeting-specific realtime behavior:

- Lobby entry
- Lobby state notification
- Admission and denial
- Affected-user status notification
- Meeting state notification

Shared connection, authentication, acknowledgement, ConferenceSession join, participant, expiration, and recovery behavior belongs to [`conferencing-realtime.md`](conferencing-realtime.md).

Meeting media signaling belongs to [`conferencing-sfu.md`](conferencing-sfu.md).

This document does not define Meeting creation, scheduling, durable lifecycle commands, Chat persistence, product limits, or anonymous access.

## Delivery Boundary

This contract is planned for Phase 5.

Phase 3 must not implement these events merely because their shapes are documented.

Initially, Meeting participants must be registered Huddle users.

## Meeting Link Boundary

A Meeting link:

- Identifies an entry path.
- Does not replace authentication.
- Does not grant automatic admission.
- Does not assign a role.
- Does not reserve media capacity.
- Does not grant Chat history by itself.

The exact link-token format belongs to the future Meeting HTTP contract.

## Applicable Errors

Commands use the acknowledgement envelope from [`conferencing-realtime.md`](conferencing-realtime.md).

Applicable errors include:

- `INVALID_PAYLOAD`
- `AUTHENTICATION_EXPIRED`
- `SESSION_UNAVAILABLE`
- `ACCESS_DENIED`
- `INVALID_SESSION_STATE`
- `LOBBY_REQUIRED`
- `LOBBY_ACCESS_DENIED`
- `CAPACITY_REACHED`
- `INTERNAL_ERROR`

Lobby admission and live-media capacity are separate decisions.

## Enter Lobby

Client event:

```text
meeting:lobby:enter
```

Payload:

```typescript
type EnterMeetingLobbyCommand = {
  meetingId: string;
  meetingLinkToken: string;
};
```

Success:

```typescript
type EnterMeetingLobbyResult = {
  meetingId: string;
  status: 'PENDING' | 'ADMITTED';
};
```

Behavior:

- Formally invited eligible users may already be admitted.
- Registered non-invited link users enter `PENDING`.
- Terminal Meetings reject entry.
- Lobby presence does not reserve media capacity.
- The server derives the requester from trusted socket state.

The payload must not accept an authoritative requester `userId`.

## Lobby Updated

Server event for the organizer and co-organizers:

```text
meeting:lobby:updated
```

Payload:

```typescript
type MeetingLobbyUpdatedEvent = {
  meetingId: string;
  pending: Array<{
    userId: string;
    requestedAt: string;
  }>;
};
```

Only the organizer and current co-organizers receive the complete pending list.

Ordinary attendees must not receive organizer-level lobby state.

## Admit Lobby User

Client event:

```text
meeting:lobby:admit
```

Payload:

```typescript
type AdmitMeetingLobbyUserCommand = {
  meetingId: string;
  targetUserId: string;
};
```

Success:

```typescript
type AdmitMeetingLobbyUserResult = {
  meetingId: string;
  userId: string;
  admittedAt: string;
};
```

Admission:

- Requires current organizer or co-organizer authority.
- Is idempotent.
- Commits durable participant eligibility.
- Establishes the Meeting Chat history boundary.
- Does not reserve media capacity.
- Does not bypass the `conference:join` capacity check.

The acting user comes from trusted socket state.

## Deny Lobby User

Client event:

```text
meeting:lobby:deny
```

Payload:

```typescript
type DenyMeetingLobbyUserCommand = {
  meetingId: string;
  targetUserId: string;
};
```

Success:

```typescript
type DenyMeetingLobbyUserResult = {
  meetingId: string;
  userId: string;
};
```

Denial:

- Requires current organizer or co-organizer authority.
- Removes current lobby presence.
- Creates no participant eligibility.
- Creates no Meeting Chat access.
- Does not permanently ban another lobby attempt.

Permanent banning is deferred.

## Lobby Status Changed

Server event to the affected user:

```text
meeting:lobby:status-changed
```

Payload:

```typescript
type MeetingLobbyStatusChangedEvent = {
  meetingId: string;
  status: 'PENDING' | 'ADMITTED' | 'DENIED';
  admittedAt?: string;
};
```

After `ADMITTED`, the participant may attempt `conference:join` when a live ConferenceSession exists.

Admission does not guarantee available capacity.

A denied attempt grants no Meeting Chat access.

## Meeting State Changed

Server event:

```text
meeting:state-changed
```

Payload:

```typescript
type MeetingStateChangedEvent = {
  meetingId: string;
  conferenceSessionId: string | null;
  status: 'AVAILABLE' | 'ACTIVE' | 'COMPLETED' | 'CANCELED' | 'ARCHIVED';
  lifecycleVersion: number;
};
```

This event notifies eligible users of committed Meeting state.

It is not the durable source of Meeting lifecycle.

An older `lifecycleVersion` must not replace newer client state.

Meeting Chat lifecycle projection uses Integration Events rather than this Socket.IO event.

## ConferenceSession and Media Boundary

After admission, a participant uses `conference:join` from [`conferencing-realtime.md`](conferencing-realtime.md).

Join still verifies:

- Meeting is joinable.
- Participant remains eligible.
- Required admission exists.
- ConferenceSession belongs to the Meeting.
- Capacity is available.

Meeting voice, video, and authorized screen sharing use [`conferencing-sfu.md`](conferencing-sfu.md).

Phase 5 permits screen sharing only for the organizer and co-organizers.

## Reconnection

Committed admission remains durable across socket reconnect.

Lobby presence, ConferenceSession participation, capacity slots, transports, Producers, and Consumers are not automatically restored.

Shared recovery belongs to [`conferencing-realtime.md`](conferencing-realtime.md) and [`conferencing-sfu.md`](conferencing-sfu.md).

## Authorization and Privacy

The server verifies the authenticated principal, Meeting lifecycle, current role, lobby state, target user state, and current eligibility.

The client cannot provide authoritative acting identity, Meeting role, admission authority, lifecycle state, lifecycle version, subscription tier, or participant limit.

The contract must not disclose the complete lobby list or organizer-only state to ordinary attendees.

Possession of a Meeting link token is not administration or join authorization.

## Required Tests

Test in Phase 5:

- Authenticated lobby entry
- Invalid link or terminal Meeting rejection
- Formally invited participant behavior
- Non-invited registered user enters `PENDING`
- Organizer and co-organizer receive lobby state
- Attendee cannot receive or administer lobby state
- Organizer and co-organizer admission
- Admission idempotency
- Admission establishes the Chat history boundary
- Admission does not reserve capacity
- Denial creates no eligibility or Chat access
- Affected user receives lobby status
- Lifecycle-version ordering
- Admitted participant still encounters capacity enforcement
- Reconnect preserves admission but not live resources
- Organizer and co-organizer screen sharing
- Attendee screen sharing rejection

## Explicitly Deferred

This contract does not authorize:

- Anonymous Meeting guests
- Permanent lobby bans
- Attendee screen sharing
- Presenter or webinar roles
- Hand raising
- Breakout rooms
- Recording
- Transcription
- Calendar integration
- Remote participant mute
- Meeting access without authentication

## Source-of-Truth Boundaries

This document is the source of truth for:

- `meeting:lobby:enter`
- `meeting:lobby:updated`
- `meeting:lobby:admit`
- `meeting:lobby:deny`
- `meeting:lobby:status-changed`
- `meeting:state-changed`
- Meeting lobby transport behavior

Shared ConferenceSession events belong to [`conferencing-realtime.md`](conferencing-realtime.md). SFU signaling belongs to [`conferencing-sfu.md`](conferencing-sfu.md). Durable Meeting rules belong to the Meetings Context.

## Related Documentation

- [Shared Conferencing Realtime Contract](conferencing-realtime.md)
- [Conferencing SFU Contract](conferencing-sfu.md)
- [Meetings](../contexts/conferencing/meetings.md)
- [Conferencing Context](../contexts/conferencing/README.md)
- [Meeting Phase](../delivery/phases/05-meetings.md)
- [Integration Events](integration-events.md)
