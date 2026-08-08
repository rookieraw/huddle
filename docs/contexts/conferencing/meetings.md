# Meetings

Status: Accepted target; Phase 5 implementation  
Parent bounded context: Conferencing  
Last reviewed: 2026-08-07

## Responsibility

Meetings defines standalone structured conferencing.

It owns:

- Instant and scheduled Meeting lifecycle
- Organizer and co-organizer roles
- Invitations and RSVP
- Meeting link
- Lobby admission
- Participant eligibility
- Live ConferenceSession creation
- Meeting lifecycle Integration Events

It does not own:

- Meeting messages
- Identity credentials
- Effective subscription state
- Notification delivery
- Ordinary Group Conversation administration

## Meeting Types

Huddle supports:

- `INSTANT`
- `SCHEDULED`

An Instant Meeting is created for immediate use.

A Scheduled Meeting stores a server-authoritative scheduled time but does not start automatically.

The organizer explicitly starts the live session.

Recurring Meetings are deferred.

## Meeting Model

A Meeting contains concepts equivalent to:

- Meeting identifier
- Meeting type
- Organizer identifier
- Title
- Scheduled start when applicable
- Unguessable link identifier
- Lifecycle status
- Invitations
- Participants
- Roles
- Creation timestamp
- Started timestamp
- Completed timestamp
- Canceled timestamp
- Archived timestamp
- Lifecycle version

Exact persistence fields belong to the implementation.

## Lifecycle

The lifecycle is equivalent to:

```text
AVAILABLE
→ ACTIVE
→ COMPLETED
```

Alternative terminal path:

```text
AVAILABLE
→ CANCELED
```

A completed or canceled Meeting may later become:

```text
ARCHIVED
```

Required rules:

- Only an available Meeting may start.
- Only one active ConferenceSession may exist.
- An active Meeting ends as completed, not canceled.
- A canceled Meeting cannot start.
- A completed Meeting cannot start another ConferenceSession.
- An archived Meeting is terminal.
- Meeting state is not reopened by a stale event.

Exact enum names may follow repository conventions while preserving these meanings.

## Entitlement

Creating or starting a Meeting requires the organizer’s current effective entitlement.

Authoritative capability and participant values belong only to:

```text
product/tiers.md
```

### Scheduled Meeting Downgrade

If the organizer becomes Free after scheduling:

- The Meeting remains stored.
- Invitations remain.
- Existing Meeting chat remains.
- The live ConferenceSession cannot start.
- The organizer may start after becoming entitled again.

### Active Meeting Downgrade

If the organizer becomes Free after the ConferenceSession starts:

- The active session continues.
- Its capacity does not shrink.
- Participants are not removed.
- Completion behavior remains unchanged.

Entitlement failure occurs before protected mutation and is not interpreted as Free or Pro.

## Roles

Meeting roles are:

- `ORGANIZER`
- `CO_ORGANIZER`
- `ATTENDEE`

They are unrelated to Chat Group administrator roles.

### Organizer

Every Meeting has exactly one organizer.

The organizer may:

- Start the Meeting
- End the active Meeting
- Cancel an available Meeting
- Archive a completed or canceled Meeting
- Assign or remove co-organizer status
- Invite participants
- Revoke invitations
- Admit or deny lobby users
- Remove non-organizer live participants
- Share screen

The organizer:

- Cannot be removed
- Cannot be demoted
- Is the entitlement owner
- Is not transferable in the initial Meeting scope

### Co-organizer

A co-organizer may:

- Invite participants
- Revoke invitations when authorized by policy
- Admit or deny lobby users
- Remove non-organizer live participants
- Share screen

A co-organizer may not:

- Replace the organizer
- Change the entitlement owner
- Archive the Meeting
- Cancel the Meeting
- Start the Meeting in the initial implementation

### Attendee

An attendee may:

- Join when eligible and capacity is available
- Use voice and video
- Send Meeting messages according to Chat eligibility
- Leave and rejoin while the Meeting remains active

An attendee may not:

- Admit lobby users
- Change roles
- Remove participants
- Start, cancel, archive, or end the Meeting
- Share screen in the initial implementation

A separate Presenter role is deferred until a concrete capability requires it.

## Invitations and RSVP

The organizer or an authorized co-organizer may formally invite a registered Huddle user.

A formal invitation:

- Grants Meeting-chat eligibility immediately.
- Allows the invited user to join without the non-invited link-user lobby path.
- Does not create a ContactRelationship.
- Does not create Group membership.
- Does not reserve concurrent media capacity.
- Is idempotent for the Meeting and target user.

RSVP states may include equivalents of:

- Pending
- Accepted
- Declined

RSVP expresses expected attendance.

Declining:

- Does not remove Meeting-chat eligibility.
- Does not delete prior messages.
- Does not prevent later attendance while the invitation remains valid.

### Invitation Revocation

The organizer or authorized co-organizer may revoke an invitation.

Revocation:

- Removes future Meeting access.
- Removes future Meeting-chat access.
- Does not delete messages already sent.
- Does not alter other participants.
- Does not convert the user into a link-admitted participant.

## Meeting Link

Every Meeting has an unguessable link identifier.

The link:

- Identifies the Meeting.
- Does not replace authentication.
- Does not grant automatic admission.
- Does not expose Meeting details beyond the authorized response.
- Cannot be used to join a canceled, completed, or archived Meeting.

Registered users only are supported initially.

Anonymous guests are deferred.

## Lobby

A registered non-invited user opening a valid Meeting link enters the lobby.

Lobby flow:

```text
Authenticate
→ validate Meeting and link
→ enter lobby
→ organizer or co-organizer admits or denies
→ create durable participant eligibility
→ assign Chat history boundary
→ join live session when active and capacity permits
```

Lobby presence may be stored in Redis.

Admission must be durable in PostgreSQL.

### Admission

Admission:

- Is authorized only for organizer or co-organizer.
- Is idempotent.
- Rejects invalid Meeting lifecycle.
- Does not reserve a permanent media slot.
- Creates participant eligibility.
- Establishes the Chat visibility boundary.

The visibility boundary is equivalent to:

```text
historyVisibleFrom = admittedAt
```

### Denial

Denial:

- Removes current lobby presence.
- Does not create participant eligibility.
- Does not create Meeting-chat access.
- Does not prevent a later lobby attempt unless a separate moderation rule exists.

Banning is deferred.

## Participant Capacity

Invitations and participant eligibility do not consume concurrent media capacity.

Capacity is enforced when joining the active ConferenceSession.

Accepted sequence:

```text
Resolve organizer entitlement at start
→ obtain numeric participant limit
→ create ConferenceSession(maxParticipants)
```

The capacity includes the organizer.

Joins:

- Use the numeric snapshot.
- Do not query Billing.
- Must be concurrency-safe.
- Reject when capacity is reached.
- Do not delete participant eligibility when rejected for temporary capacity.

An eligible participant may join later when capacity becomes available.

## ConferenceSession

Meeting and ConferenceSession are separate.

Meeting owns:

- Schedule
- Link
- Invitations
- RSVP
- Roles
- Lobby policy
- Durable lifecycle

ConferenceSession owns:

- Active media
- Joined participants
- Numeric capacity
- mediasoup resources
- Screen-share producer
- Live termination

One Meeting has at most one active ConferenceSession.

A completed ConferenceSession does not delete the Meeting.

## Starting a Meeting

Only the organizer starts the Meeting in the initial implementation.

Start flow:

```text
Authenticate organizer
→ authorize Meeting
→ resolve entitlement
→ verify AVAILABLE lifecycle
→ snapshot capacity
→ create ConferenceSession
→ transition Meeting to ACTIVE
→ persist Outbox lifecycle fact
```

The Meeting and its initial ConferenceSession state commit atomically within Conferencing-owned PostgreSQL persistence.

## Ending a Meeting

The organizer may end the active Meeting.

Ending:

- Transitions Meeting to `COMPLETED`.
- Ends the ConferenceSession.
- Releases mediasoup resources.
- Produces the lifecycle Integration Event.
- Leaves existing eligible Meeting chat writable.
- Prevents new participants from being added.

An infrastructure failure may also terminate the live ConferenceSession.

The durable Meeting and Chat history remain.

## Cancel and Archive

### Cancel

Only an available Meeting may be canceled.

Cancellation:

- Prevents start.
- Prevents new participation.
- Makes Meeting chat read-only.
- Preserves existing history.

### Archive

A completed or canceled Meeting may be archived.

Archive:

- Is terminal.
- Preserves history.
- Keeps Meeting chat read-only.
- Prevents future live sessions and participation.

## Meeting Chat

Chat owns the Meeting Conversation and messages.

Conferencing provides lifecycle and eligibility facts through versioned Integration Events.

### Formally Invited User

May read and write:

- Before start
- During the Meeting
- After completion

RSVP decline does not remove access.

### Link-admitted User

May read and write from:

```text
admittedAt
```

Earlier messages remain inaccessible through backend enforcement.

### Lifecycle Effect

| Meeting state | Existing eligible user |
| ------------- | ---------------------- |
| Available     | Read and write         |
| Active        | Read and write         |
| Completed     | Read and write         |
| Canceled      | Read only              |
| Archived      | Read only              |

Meeting Conversation:

- Remains type `MEETING`.
- Does not consume Group quotas.
- Never converts to Group.
- Accepts no new participant after completion.

## Screen Sharing

The initial implementation permits screen sharing by:

- Organizer
- Co-organizer

Required behavior:

- Only an active joined participant with permission may start.
- Screen sharing is a distinct media producer.
- Ending screen sharing does not end the Meeting.
- Disconnect releases the producer.
- Screen media is not persisted.
- Recording is not introduced.

Attendee screen sharing requires a future Presenter or permission decision.

## Cross-context Integration

### Identity

Conferencing uses:

- Authentication verification
- Directory validation for client-supplied invitee IDs
- Minimal profile data when required

### Billing

Conferencing resolves the organizer’s entitlement for:

- Meeting creation
- Meeting start
- ConferenceSession capacity snapshot

### Chat

Conferencing produces lifecycle and eligibility Integration Events.

Chat creates and updates:

- Meeting Conversation
- Meeting membership
- History visibility
- Writable or read-only state

### Notification

Phase 6 may consume selected Meeting facts such as invitations or lifecycle changes.

## Integration Events

Required provider facts include equivalents of:

- Meeting created
- Participant invited
- Invitation revoked
- Lobby participant admitted
- Meeting started
- Meeting completed
- Meeting canceled
- Meeting archived

Events are:

- Provider-owned
- Versioned
- Written through the Conferencing Outbox
- Delivered at least once
- Consumed idempotently
- Protected from stale lifecycle overwrite

Exact payloads belong only to:

```text
contracts/integration-events.md
```

## Persistence

PostgreSQL stores:

- Meeting
- Invitation
- RSVP
- Participant eligibility
- Role
- Admission
- ConferenceSession metadata
- Capacity snapshot
- Lifecycle version
- Transactional Outbox

Redis may store:

- Lobby presence
- Connected participant presence
- Socket mapping
- Short-lived coordination

mediasoup resources remain in process memory.

## Failure Behavior

Meetings distinguishes:

- Authentication failure
- Organizer not entitled
- Entitlements unavailable
- Invalid link
- Meeting unavailable
- Lobby admission required
- Admission denied
- Role unauthorized
- Capacity reached
- ConferenceSession already active
- Invalid lifecycle transition
- Chat projection pending
- Media unavailable

A delayed Chat projection does not roll back a committed Meeting.

## Required Tests

Critical tests include:

- Instant Meeting creation
- Scheduled Meeting creation
- Organizer entitlement
- Downgrade before start
- Downgrade after start
- Organizer invariants
- Co-organizer permissions
- Attendee restrictions
- Invitation idempotency
- RSVP decline retains Chat eligibility
- Invitation revocation
- Authenticated link access
- Lobby admission and denial
- Admission history boundary
- Invitations do not reserve capacity
- Concurrent final-capacity joins
- One ConferenceSession
- Completion
- Cancellation
- Archive
- Chat writable and read-only transitions
- Duplicate and out-of-order Integration Events
- Screen-share authorization
- Media failure with durable state preserved

## Deferred

Meetings does not include:

- Anonymous guests
- Recurring Meetings
- Calendar integration
- Recording
- Transcription
- Presenter role
- Attendee screen sharing
- Breakout rooms
- Webinar behavior
- Organizer transfer
- Banning
- Multiple active ConferenceSessions
- Multiple media nodes

These require explicit product and phase decisions.

## Source-of-truth Boundaries

This document is the source of truth for:

- Meeting lifecycle
- Meeting roles and permissions
- Invitation and RSVP behavior
- Link and lobby behavior
- Participant-capacity semantics
- Meeting-chat eligibility facts
- Screen-sharing authorization
- Meeting Integration Event meaning

This document is not the source of truth for:

- Tier values
- Chat message persistence
- Realtime payloads
- Exact database schema
- mediasoup configuration
- Current implementation status

Those concerns belong to Product, Chat, Contracts, Conferencing, Operations, code, tests, and Delivery documentation.
