# Subscription Tiers and Entitlements

Status: Accepted  
Last reviewed: 2026-08-07

## Purpose

This document is the single source of truth for Huddle’s user-facing subscription tiers, entitlement values, and quota behavior.

Huddle currently supports:

- Free
- Pro

Enterprise is not modeled until Huddle introduces Workspace or organization ownership.

A capability appearing in this document defines its intended entitlement. It does not override the delivery roadmap or imply that the capability is already implemented.

## Tier Comparison

| Capability                                 |                    Free |      Pro |
| ------------------------------------------ | ----------------------: | -------: |
| Monthly price                              |                      $0 |  $10 USD |
| Owned group conversations                  |                       1 |       20 |
| Members per group conversation             |                       5 |       50 |
| Direct voice calls                         |                Included | Included |
| Direct video calls                         |                Included | Included |
| Group voice calls                          |                Included | Included |
| Group video calls                          |                Included | Included |
| Concurrent group-call participants         |                       5 |       10 |
| Create or start standalone meetings        |            Not included | Included |
| Join an eligible meeting                   |                Included | Included |
| Concurrent standalone-meeting participants | Determined by organizer |       10 |
| Slack integration                          |            Not included | Included |

Participant limits include the initiating user or meeting organizer.

## Unrestricted Capabilities

The following capabilities do not currently have tier quotas:

- Contacts
- Direct conversations
- Direct messages
- Group messages within an existing eligible conversation
- Message-history reads
- One-to-one call duration within the global call-duration policy
- Joining a meeting when the user is eligible and the meeting has capacity

“Unrestricted” means that Huddle does not currently enforce a subscription quota for the capability. It is not a promise of infinite infrastructure capacity or unlimited acceptable use.

## Group Conversation Quotas

### Owned Group Conversations

The owned-group quota counts group conversations for which the user is the current owner.

It does not count:

- Direct conversations
- Meeting conversations
- Group conversations in which the user is only a member or administrator

Ownership transfer must validate the receiving user’s effective owned-group limit before the transfer is accepted.

### Group Members

The member limit applies independently to each group conversation.

The count includes:

- The owner
- Administrators
- Ordinary active members

Pending invitations do not consume member capacity.

Capacity is checked again when an invitation is accepted or a member is otherwise added. An invitation does not guarantee that capacity will still be available later.

Meeting conversations do not use the group-conversation member quota.

## Calling Entitlements

### Direct Calls

Free and Pro users may start and receive:

- One-to-one voice calls
- One-to-one video calls

Direct-call availability is not determined by the group-call participant entitlement.

### Group Calls

Free and Pro users may start group voice and group video calls.

The initiating user’s effective entitlement determines the session capacity when the session is created:

| Initiator tier | Session capacity |
| -------------- | ---------------: |
| Free           |   5 participants |
| Pro            |  10 participants |

The capacity includes the initiator.

The numeric capacity is stored on the call session. Billing is not queried again for each participant join.

Therefore:

- A downgrade does not shrink an active call.
- An upgrade does not expand an active call.
- Rejoining remains subject to the existing session capacity.
- A new call uses the initiator’s latest effective entitlement.

## Standalone Meeting Entitlements

Only a Pro user may create or start a standalone meeting.

A scheduled meeting is preserved if its organizer later becomes Free, but its live conference session cannot start until the organizer is entitled again. A downgrade after the live session starts does not shrink or terminate that active session.

An eligible Free or Pro user may join a meeting created by a Pro organizer.

The meeting capacity is:

```text
10 concurrent participants, including the organizer
```

The numeric limit is snapshotted when the live conference session is created.

Meeting chat:

- Does not count as an owned group conversation.
- Does not consume the group-conversation member quota.
- Remains governed by meeting eligibility and lifecycle rules.

Standalone Meetings are delivered after the initial Portfolio Release. Their entitlement is defined here in advance so the later implementation uses the established Billing contract.

## Slack Integration

Slack integration is a Pro entitlement.

It is delivered with the Notification phase and must not be implemented by an earlier phase merely because its entitlement is already defined.

The Free tier must not expose a functional Slack integration.

## Deferred Capabilities Without Entitlements

The following capabilities do not currently have Free or Pro entitlement values:

- Recording
- Recording storage
- Calendar integration
- Anonymous meeting guests
- Enterprise SSO
- Workspace administration

These capabilities are deferred or stretch scope.

A future implementation must first update the product scope, delivery roadmap, and this document. No tier assignment may be inferred before those sources are updated.

## Effective Tier Boundary

Free is the default user-facing tier.

Billing determines the effective tier from its authoritative paid-subscription state.

Confirmed absence of a paid Subscription produces Free through a deliberate Billing domain rule.

Billing unavailability is not the same as confirmed absence and must not be interpreted as Free or Pro.

The detailed mapping from Subscription lifecycle state to effective tier, including cancellation, `past_due`, period expiry, and the no-grace-period policy, belongs only to:

[`../contexts/billing.md`](../contexts/billing.md)

This document defines what Free and Pro permit after Billing has produced a confirmed effective tier. It does not define Stripe or Subscription lifecycle state.

## Quota Enforcement

Entitlements are checked at the start of each protected growth operation.

The general rule is:

```text
Growth is allowed only when current usage < effective limit.
```

Examples:

- A group with 4 members and a limit of 5 may add one member.
- A group with exactly 5 members may not add another member.
- A downgraded group with 30 members and a limit of 5 may not add another member.
- A user owning 20 group conversations under Pro may not create another one.
- A downgraded user owning 8 group conversations under Free may not create another one.

A quota check and its protected mutation must be concurrency-safe.

## Downgrade Policy

Downgrades are non-destructive.

Huddle does not automatically:

- Delete group conversations
- Remove members
- Delete messages
- Terminate an active call whose capacity was already snapshotted
- Delete meeting history

When existing usage is at or above the new limit, further growth is blocked.

The user must reduce usage below the effective limit before another resource can be added.

Reaching exactly the limit is still at quota.

## Entitlement Resolution Boundary

This document classifies which capabilities are protected by Free or Pro entitlements.

It does not define:

- how Billing persistence is queried;
- how dependency failures are represented;
- which transitional adapter is active in a delivery phase;
- transport-specific error responses.

Consumers enforce the confirmed entitlement inside their own Context.

A client-provided tier or entitlement object is never authoritative.

Protected-operation failure behavior belongs to:

- [`../contexts/billing.md`](../contexts/billing.md);
- the consuming Context document;
- [`../architecture/security.md`](../architecture/security.md).

Transitional static adapters and their replacement timing belong only to the relevant delivery Phase documents.

## Source-of-truth Boundaries

This document is the source of truth for:

- Supported subscription tiers
- Tier prices
- Entitlement values
- Numeric quota limits
- User-visible downgrade behavior
- Entitlement-protected capability classification

This document is not the source of truth for:

- Stripe persistence models
- Billing use cases
- HTTP error responses
- Call and meeting lifecycle state machines
- Delivery timing
- Current implementation status

Those concerns belong to their respective context, contract, and delivery documents.
