# ADR 0006 — Separate Conversation Calls, Meetings, and Live ConferenceSessions

Status: Accepted  
Recorded: 2026-08-07  
Supersedes: None  
Superseded by: None

## Context

Huddle supports three related but distinct concepts:

- voice or video calls started from existing Chat conversations;
- standalone instant or scheduled Meetings;
- temporary live WebRTC media execution.

These concepts share signaling and media infrastructure, but they do not share the same lifecycle or ownership.

A conversation Call:

- begins from an existing Direct or Group Conversation;
- is immediate rather than scheduled;
- appears in the existing conversation timeline;
- has call-specific response and termination behavior.

A Meeting:

- exists independently from an ordinary Chat conversation;
- may be scheduled;
- has invitations, roles, a link, and lobby admission;
- retains persistent Meeting chat beyond its live media session.

Live WebRTC resources:

- exist only while media is active;
- include transports, producers, consumers, and SFU resources;
- may be lost when the media process fails;
- must not define the lifetime of the durable Call or Meeting.

Using one generic Room or Session aggregate for all three concerns would mix different lifecycle, persistence, and authorization rules.

## Decision

The Conferencing bounded context uses three separate domain concepts:

| Concept             | Responsibility                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| `CallSession`       | Durable lifecycle of a voice or video call associated with an existing Chat Conversation                 |
| `Meeting`           | Durable lifecycle of a standalone Meeting, including scheduling, invitations, roles, link, and admission |
| `ConferenceSession` | One active or preparing live-media execution associated with a CallSession or Meeting                    |

`CallSession` and `Meeting` are separate durable domain models.

`ConferenceSession` represents shared live-media execution and belongs to exactly one:

- `CallSession`; or
- `Meeting`.

Shared WebRTC, mediasoup, coturn, signaling, and participant infrastructure does not make Calls and Meetings the same aggregate.

## Ownership Boundaries

### Conferencing

Conferencing owns:

- `CallSession`;
- `Meeting`;
- `ConferenceSession`;
- participant media lifecycle;
- signaling authorization;
- numeric live-session capacity;
- media-resource coordination;
- live-session failure reconciliation.

### Chat

Chat owns:

- Direct Conversations;
- Group Conversations;
- Meeting Conversations;
- message persistence;
- conversation membership;
- conversation-visible Call and Meeting timeline projections.

Conferencing does not write Chat persistence directly.

### Billing

Billing owns effective product entitlements.

Conferencing consumes only the capabilities and numeric limits required to create protected sessions.

### Identity

Identity owns authentication and user identity.

A stored `userId` reference does not transfer ownership of the user to Conferencing.

## Persistence Boundary

Durable Conferencing lifecycle state is stored in Conferencing-owned PostgreSQL persistence.

Recoverable live presence or short-lived coordination may use Redis.

Process-bound media resources remain in the media process.

The loss of process-bound media resources does not delete durable CallSession, Meeting, or Chat history.

Cross-context Chat projections use the integration pattern established by ADR 0004. This ADR does not redefine that delivery mechanism.

## Rationale

Separating the three concepts provides:

- focused lifecycle models;
- explicit ownership;
- clear durable versus temporary state;
- independent testing of Call and Meeting rules;
- reusable media infrastructure without a generic domain aggregate;
- persistent Meeting chat that is not tied to live media;
- a future extraction seam for media infrastructure.

The separation reflects domain behavior rather than deployment topology.

Calls and Meetings remain part of the same Conferencing bounded context because they share:

- media-session authorization;
- WebRTC signaling;
- participant media state;
- capacity enforcement;
- mediasoup coordination;
- TURN access;
- infrastructure-failure handling.

## Consequences

### Positive

- Call-specific behavior remains independent from Meeting scheduling and roles.
- Meeting lifecycle can evolve without expanding CallSession.
- Chat remains the single owner of message persistence.
- Media-process failure does not erase durable business history.
- Live capacity is represented explicitly by ConferenceSession.
- Future media-service extraction does not require moving Chat ownership.

### Negative

- More domain concepts and adapters are required.
- Developers must distinguish product lifecycle from live-media lifecycle.
- Chat projections are eventually consistent with Conferencing.
- Shared media infrastructure must support two parent lifecycle types.
- Media-process failure requires explicit durable-state reconciliation.

## Alternatives Considered

### One Generic Room or Session Aggregate

Rejected because Calls and Meetings have materially different initiation, scheduling, role, invitation, admission, chat, and termination behavior.

A shared technical implementation is not sufficient reason to merge their domain models.

### Put CallSession inside the Chat Aggregate

Rejected because Chat owns conversations and messages, while Conferencing owns media lifecycle, signaling authorization, capacity, and media-resource failure.

Chat retains only the conversation-visible Call projection.

### Put Meeting Chat inside Conferencing

Rejected because persistent messages, message queries, realtime message delivery, and conversation history belong to Chat.

Conferencing supplies Meeting lifecycle and eligibility facts without owning message persistence.

### Use CallSession as the Live-Media Model

Rejected because the durable Call lifecycle and the temporary live-media execution have different failure and persistence characteristics.

A Meeting also requires live media without becoming a CallSession.

## Capability Sources of Truth

This ADR records only the reason for separating the domain concepts.

Detailed behavior belongs to:

- Call lifecycle and rules: [`../contexts/conferencing/calls.md`](../contexts/conferencing/calls.md)
- Meeting lifecycle and rules: [`../contexts/conferencing/meetings.md`](../contexts/conferencing/meetings.md)
- Shared live-media architecture: [`../contexts/conferencing/README.md`](../contexts/conferencing/README.md)
- Chat ownership and projections: [`../contexts/chat.md`](../contexts/chat.md)
- Product entitlements: [`../product/tiers.md`](../product/tiers.md)
- Cross-context integration: [`0004-cross-context-integration.md`](0004-cross-context-integration.md)
- Persistence and consistency: [`../architecture/data-and-consistency.md`](../architecture/data-and-consistency.md)

## Revisit When

Reconsider this decision when:

- conversation Calls acquire Meeting-like scheduling, links, or roles;
- Meetings support multiple concurrent live sessions;
- recording introduces a separate durable media lifecycle;
- breakout rooms become committed scope;
- anonymous participation changes the identity boundary;
- media-service extraction changes the control-plane boundary.

Shared media infrastructure alone is not sufficient reason to merge the models.
