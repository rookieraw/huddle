# Product Scope

Status: Accepted  
Last reviewed: 2026-08-23

## Purpose

Huddle is a backend-focused portfolio project for demonstrating the design and implementation of a real-time communication platform.

The project emphasizes:

- Domain-Driven Design
- A modular monolith with explicit bounded-context boundaries
- Real-time messaging
- WebRTC calling and conferencing
- Subscription-based entitlements
- Reliable asynchronous processing
- Testing, deployment, and operational reasoning

Huddle is developed incrementally. A capability being part of the committed product scope does not mean it is available in the current development phase.

The delivery order and current implementation status are defined separately in the delivery documentation.

## Product Areas

### Identity

Identity provides user authentication and account identity.

Committed capabilities include:

- User registration
- Email verification
- Credential-based login
- Google OAuth login
- GitHub OAuth login
- Access and refresh token handling
- A user-facing display name

Enterprise identity features such as SAML-based SSO are not part of the current scope.

### Contacts

Registered users can maintain a contact list independently from their conversation list.

Committed capabilities include:

- Contact requests
- Accepting or rejecting a contact request
- Listing contacts
- Removing a contact
- Starting or opening a direct conversation from a contact

A contact relationship does not automatically create a conversation.

### Chat

Chat supports persistent communication between registered Huddle users.

Committed conversation types are:

- Direct conversation
- Group conversation
- Meeting conversation

Committed capabilities include:

- Persistent messages
- Cursor-based message history
- Real-time message delivery
- Client-generated message idempotency
- Conversation membership
- Group invitations
- Administrative group management
- Call and meeting timeline entries

Direct conversations are unique per pair of users.

A meeting conversation remains a meeting-owned conversation and is not converted into a normal group conversation.

### Calling

Calling provides voice and video communication from direct and group conversations.

Committed capabilities include:

- One-to-one voice calls
- One-to-one video calls
- Group voice calls
- Group video calls
- Accepting or rejecting an incoming call
- Unanswered-call timeout
- Rejoining an active call
- Ending a call after all participants leave
- Maximum call duration
- Warning participants before forced termination
- Persistent call lifecycle entries in the related conversation

One-to-one calls use direct peer-to-peer WebRTC where possible, with TURN fallback.

Group calls use a mediasoup Selective Forwarding Unit.

Recording is not part of the committed calling scope.

### Meetings

Meetings provide a structured conferencing experience separate from ordinary group calls.

Committed capabilities include:

- Instant meetings
- Scheduled meetings
- Meeting links
- Invited participants
- Lobby admission
- Organizer, co-organizer, and attendee roles
- Voice and video
- Screen sharing
- Persistent meeting chat

Formally invited users may participate in meeting chat before, during, and after the meeting.

Users admitted through a meeting link gain access to meeting chat only after admission and do not receive earlier chat history.

After a meeting completes:

- The live media session is closed.
- The meeting conversation remains writable for eligible participants.
- New participants cannot be added.

Canceled or archived meetings have read-only chat.

Anonymous guests are deferred. The initial meeting implementation supports registered Huddle users only.

### Billing

Billing provides Free and Pro subscription entitlements.

Committed capabilities include:

- Free as the default effective tier
- Pro subscription checkout
- Stripe customer and subscription tracking
- Stripe webhook processing
- Effective entitlement resolution
- Upgrade and cancellation handling
- Immediate effective downgrade to Free when a subscription becomes past due
- Non-destructive quota enforcement after downgrade

Enterprise subscriptions are deferred until Huddle introduces a Workspace or organization ownership model.

Exact tier capabilities and limits are defined only in `tiers.md`.

### Notification

Notification delivers user-facing information produced from committed events in other bounded contexts.

Committed capabilities include:

- Durable in-app Notifications
- Read and unread state
- Authenticated realtime in-app delivery
- Recovery of missed Notifications from persistence
- Reliable Integration Event consumption
- Idempotent Notification creation
- Observable retry and terminal failure
- A minimal user-owned Slack connection
- Pro-only Slack notification delivery to one supported destination

Slack delivery is limited to selected safe Notification summaries.

The committed Slack scope does not include:

- Huddle and Slack message synchronization
- Importing Slack channels as Huddle Conversations
- Sending Huddle Chat Messages from Slack
- Workspace-owned Slack administration
- Arbitrary destination routing
- A comprehensive event-by-channel preference matrix

Product-event Email Notification is deferred.

Authentication-critical Email, such as registration verification, remains owned by Identity and is unaffected by this decision.

Notification is implemented after the initial Portfolio Release. Its inclusion in the committed product scope does not authorize earlier phases to implement it.

## Portfolio Release Scope

The first public portfolio release includes:

- Completed Identity functionality
- Contacts
- Direct and group chat
- One-to-one calling
- Group calling
- WebRTC and TURN fallback
- Free and Pro Billing
- Stripe webhook processing
- Automated testing
- CI/CD
- A publicly accessible demonstration deployment
- Operational and architecture documentation

Standalone Meetings and Notification are committed post-release capabilities.

## Deferred Capabilities

The following capabilities are intentionally deferred:

- Enterprise tier
- Workspace or organization ownership
- SAML-based enterprise SSO
- Transactional product-event Email Notifications
- Anonymous meeting guests
- Calendar integration
- Recording
- Recording storage quotas
- Advanced meeting moderation
- Native mobile applications
- Complete offline operation
- Complete Progressive Web App behavior
- Multi-region deployment
- High-availability media infrastructure
- Independent microservice deployment

Deferred capabilities require an explicit roadmap or architecture decision before implementation.

## Stretch Capabilities

Stretch capabilities may be explored only after committed phases are complete:

- Meeting recording
- Advanced moderation
- Calendar synchronization
- Additional external integrations
- Media-node horizontal scaling
- Service extraction from the modular monolith

A stretch capability does not become current scope merely because an architectural extension point exists.

## Product Constraints

Huddle intentionally follows these constraints:

- Only Free and Pro are currently modeled as user-facing tiers.
- Existing data is not automatically deleted after a downgrade.
- Quota-protected growth is blocked when usage is at or above the effective limit.
- Entitlement-protected mutations fail closed when effective entitlements cannot be determined.
- Existing messages and conversations remain readable when Billing is unavailable.
- Current deployment targets a low-traffic portfolio environment and does not claim production-scale availability.
- Capacity claims require test evidence.

## Non-goals

Huddle does not currently aim to demonstrate:

- A production-scale Microsoft Teams replacement
- A complete enterprise collaboration suite
- Kubernetes administration
- Multi-region availability
- Premature microservice decomposition
- Unlimited resource claims
- Production service-level guarantees

The project favors explicit boundaries, reliable behavior, and explainable trade-offs over feature count.

## Source-of-truth Boundaries

This document is the source of truth for:

- Product capability boundaries
- Committed, deferred, and stretch scope
- Portfolio Release inclusion

This document is not the source of truth for:

- Tier limits and entitlements
- Delivery phase timing
- Current implementation status
- HTTP or realtime contracts
- Domain models
- Deployment procedures

Those concerns belong to their respective documentation sections.
