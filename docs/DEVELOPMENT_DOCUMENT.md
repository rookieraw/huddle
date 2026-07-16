# Development Document

## Huddle — Full-Stack Chat & Video Conferencing Platform

**Purpose:** Detailed technical design ready for implementation, starting at Phase 0.
**Companion doc:** `FINAL_PROJECT_REVIEW.md` (goals, roadmap, package versions)
**Date:** July 2026

### Table of Contents

1. Core Design Principle: Chat and Video Are Separate, Linkable Modules
2. Bounded Contexts (Final)
3. Directory Structure (Exact, Monorepo)
4. Domain Entity & Aggregate Design
   - 4.1 Identity Context
   - 4.2 Chat Context
   - 4.3 Conferencing Context — the "one entity, three flavors" design
   - 4.4 Billing Context
     - 4.4.0 Tier Comparison (Full Feature Set)
   - 4.5 Cross-Context Port Example (the microservice-ready seam)
5. Database Schemas
   - 5.1 PostgreSQL — Prisma Schemas (Per-Context)
   - 5.2 MongoDB — Mongoose Schemas
   - 5.3 Redis — Key Design & Database Separation
6. API Contracts
   - 6.1 REST Endpoints
   - 6.2 WebSocket Events
7. Testing Plan Per Layer
8. Phase 0 Setup Checklist
   - 8.1 Port Allocation (Local Development)
   - 8.2 Implementation Notes & Lessons Learned (Phase 0)
9. What Changed From the Original Plan (Summary of Today's Session)

---

---

## 1. Core Design Principle: Chat and Video Are Separate, Linkable Modules

This is the most important architectural decision in this document, so it's stated first.

**Group Chat** (`libs/chat`) is a **persistent messaging space**. It owns:

- Room identity, membership, name, settings
- Message history (MongoDB)
- Nothing about video/media

**Conferencing** (`libs/conferencing`) is an **ephemeral session concern**. It owns:

- Video session lifecycle (start, join, leave, end)
- mediasoup SFU orchestration, WebRTC signaling
- Lobby/waiting room + organizer approval
- Recording metadata

**The link between them is a soft reference, not a merge:**

```
VideoSession.linkedChatRoomId?: string   // optional FK, nullable
```

A video session MAY reference a chat room (to notify members, show "call in progress" in the
chat UI) but a chat room has zero knowledge of video sessions. This keeps the dependency
one-directional: `conferencing` → `chat` (read-only, via domain event or lookup), never the
reverse. This is what we called **"video with optional chat integration"**, and it applies
uniformly to:

- **Individual (1:1) conferencing** — can be started from a 1:1 DM thread, or standalone
- **Group conferencing** — can be started from a group chat room, or standalone (scheduled meeting)
- **"Teams-style" ad-hoc online conferencing** — always standalone, no linked chat room; entry
  is via a shareable meeting link/code, with the lobby + organizer-approval flow from the
  Gemini review

This single design pattern satisfies all three product surfaces (1:1, group, and Teams-style
open conferencing) without special-casing any of them at the domain level. A `VideoSession` is
a `VideoSession` regardless of how many participants or whether it was launched from chat.

---

## 2. Bounded Contexts (Final)

| Context          | Owns                                                                                     | Storage                                            |
| ---------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Identity**     | Users, credentials, OAuth links, sessions, JWT refresh tokens                            | PostgreSQL                                         |
| **Chat**         | 1:1 conversations, group chat rooms, membership, messages                                | PostgreSQL (rooms/membership) + MongoDB (messages) |
| **Conferencing** | Video sessions (1:1, group, standalone), signaling, lobby, mediasoup routers, recordings | PostgreSQL (session metadata) + Redis (live state) |
| **Billing**      | Subscriptions, tiers, Stripe customers, invoices                                         | PostgreSQL                                         |
| **Notification** | Email delivery, Slack webhook delivery, BullMQ processors                                | PostgreSQL (log) + BullMQ/Redis (queue)            |

### Context Relationships (Dependency Direction)

```
Notification  ← subscribes to events from all contexts (one-way, decoupled via events)
Billing       ← standalone, publishes events (SubscriptionCreated, TierChanged)
Conferencing  → reads Chat (optional linkedChatRoomId lookup), reads Billing (tier limits)
Chat          → reads Identity (member validation), reads Billing (tier limits: room/member caps)
Identity      → standalone, published events only (UserCreated, UserVerified)
```

No context imports another context's domain/application layer directly. Cross-context reads
happen through:

1. **Domain events** (preferred — e.g., Notification reacts to `MessageCreated`)
2. **Application-layer port interfaces** implemented by a thin adapter that calls another
   context's public use case (e.g., Conferencing's `CheckTierLimitsPort` implemented by an
   adapter calling into Billing's application layer)

This keeps the boundary honest now, and is _exactly_ the seam microservice extraction will
later cut along in Phase 14: replace the in-process adapter with a gRPC client, no domain code
changes.

---

## 3. Directory Structure (Exact, Monorepo)

```
huddle/
├── .github/
│   └── workflows/
│       └── ci.yml
├── infra/
│   └── docker/
│       ├── postgres/
│       ├── mongo/
│       └── coturn/                      # TURN server config (Phase 5)
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json                          # root scripts: pnpm -r run <script>
├── .eslintrc / eslint.config.js          # flat config, shared
├── .prettierrc
├── commitlint.config.js
│
├── apps/
│   ├── web/                              # Next.js 16 frontend
│   │   ├── next.config.ts
│   │   ├── package.json
│   │   └── src/
│   │       ├── app/
│   │       │   ├── layout.tsx
│   │       │   ├── page.tsx                        # dashboard / workspace list
│   │       │   ├── login/page.tsx
│   │       │   ├── register/page.tsx
│   │       │   ├── profile/page.tsx
│   │       │   ├── billing/page.tsx
│   │       │   ├── chat/
│   │       │   │   ├── page.tsx                    # chat list (1:1 + group)
│   │       │   │   └── [roomId]/page.tsx           # chat room view
│   │       │   └── conference/
│   │       │       ├── page.tsx                    # conferencing hub (schedule/join)
│   │       │       └── [sessionId]/page.tsx        # active video room
│   │       ├── components/
│   │       │   ├── ui/                             # shadcn primitives
│   │       │   └── shared/
│   │       │       ├── chat/
│   │       │       │   ├── ChatRoomList.tsx
│   │       │       │   ├── MessageList.tsx
│   │       │       │   ├── MessageInput.tsx
│   │       │       │   ├── MembersPanel.tsx
│   │       │       │   ├── GroupSettingsModal.tsx  # rename, add/remove members
│   │       │       │   └── StartCallButton.tsx     # spawns VideoSession, links room
│   │       │       └── conference/
│   │       │           ├── ParticipantGrid.tsx
│   │       │           ├── VideoControls.tsx
│   │       │           ├── LobbyQueue.tsx           # guest waiting view
│   │       │           ├── OrganizerReviewModal.tsx # host approves guests
│   │       │           └── OptionalChatPanel.tsx    # collapsible chat during a call
│   │       ├── hooks/
│   │       │   ├── useWebRTCP2P.ts                 # 1:1 native RTCPeerConnection
│   │       │   ├── useMediasoupRoom.ts              # group SFU client wiring
│   │       │   └── useSocket.ts
│   │       └── lib/
│   │           ├── api-client.ts                    # fetch wrapper + TanStack Query
│   │           └── socket-client.ts
│   │
│   └── api-gateway/                      # NestJS monolith (Phase 0-8), splits in Phase 14
│       ├── package.json
│       ├── src/
│       │   ├── app.module.ts             # mounts all libs/* modules
│       │   └── main.ts                   # helmet, global pipes, Swagger, adapters
│       └── test/
│           └── app.e2e-spec.ts
│
├── libs/
│   ├── shared-kernel/
│   │   └── src/
│   │       ├── dto/                      # Zod schemas, shared request/response types
│   │       ├── events/                   # Domain event base classes + event names
│   │       └── errors/                   # Shared error/exception classes
│   │
│   ├── identity/
│   │   └── src/
│   │       ├── domain/
│   │       │   ├── user.entity.ts
│   │       │   ├── password.vo.ts
│   │       │   ├── refresh-token.entity.ts
│   │       │   └── events/
│   │       │       ├── user-created.event.ts
│   │       │       └── user-verified.event.ts
│   │       ├── application/
│   │       │   ├── ports/
│   │       │   │   └── user.repository.port.ts
│   │       │   └── use-cases/
│   │       │       ├── register-user.use-case.ts
│   │       │       ├── verify-email.use-case.ts
│   │       │       ├── login.use-case.ts
│   │       │       ├── refresh-token.use-case.ts
│   │       │       └── oauth-login.use-case.ts
│   │       ├── infrastructure/
│   │       │   ├── prisma/
│   │       │   │   └── schema.prisma
│   │       │   ├── prisma-user.repository.ts
│   │       │   └── passport/
│   │       │       ├── jwt.strategy.ts
│   │       │       ├── google.strategy.ts
│   │       │       └── github.strategy.ts
│   │       └── interface/
│   │           ├── identity.controller.ts
│   │           ├── dto/
│   │           └── identity.module.ts
│   │
│   ├── chat/
│   │   └── src/
│   │       ├── domain/
│   │       │   ├── chat-room.entity.ts           # shared base
│   │       │   ├── direct-conversation.entity.ts # 1:1
│   │       │   ├── group-chat-room.entity.ts     # group (name, owner, members)
│   │       │   ├── message.entity.ts
│   │       │   └── events/
│   │       │       ├── message-created.event.ts
│   │       │       ├── group-room-created.event.ts
│   │       │       └── member-added.event.ts
│   │       ├── application/
│   │       │   ├── ports/
│   │       │   │   ├── chat-room.repository.port.ts
│   │       │   │   ├── message.repository.port.ts
│   │       │   │   └── tier-limit-check.port.ts   # implemented by billing adapter
│   │       │   └── use-cases/
│   │       │       ├── create-group-room.use-case.ts
│   │       │       ├── add-member.use-case.ts
│   │       │       ├── remove-member.use-case.ts
│   │       │       ├── rename-group.use-case.ts
│   │       │       ├── send-message.use-case.ts
│   │       │       └── get-message-history.use-case.ts
│   │       ├── infrastructure/
│   │       │   ├── prisma/schema.prisma           # rooms + membership
│   │       │   ├── mongoose/message.schema.ts      # messages
│   │       │   ├── prisma-chat-room.repository.ts
│   │       │   └── mongo-message.repository.ts
│   │       └── interface/
│   │           ├── chat.gateway.ts                 # Socket.io namespace /chat
│   │           ├── chat.controller.ts              # REST: room CRUD, history
│   │           └── chat.module.ts
│   │
│   ├── conferencing/
│   │   └── src/
│   │       ├── domain/
│   │       │   ├── video-session.entity.ts         # 1:1, group, standalone — ONE entity
│   │       │   ├── participant.vo.ts
│   │       │   ├── lobby-entry.vo.ts
│   │       │   ├── recording.entity.ts
│   │       │   └── events/
│   │       │       ├── session-started.event.ts
│   │       │       ├── session-ended.event.ts
│   │       │       └── guest-approved.event.ts
│   │       ├── application/
│   │       │   ├── ports/
│   │       │   │   ├── video-session.repository.port.ts
│   │       │   │   ├── chat-room-lookup.port.ts    # implemented by chat adapter
│   │       │   │   └── tier-limit-check.port.ts    # implemented by billing adapter
│   │       │   └── use-cases/
│   │       │       ├── start-session.use-case.ts   # linkedChatRoomId optional
│   │       │       ├── join-session.use-case.ts
│   │       │       ├── request-lobby-entry.use-case.ts
│   │       │       ├── approve-guest.use-case.ts
│   │       │       ├── leave-session.use-case.ts
│   │       │       └── end-session.use-case.ts
│   │       ├── infrastructure/
│   │       │   ├── prisma/schema.prisma            # session metadata, recordings
│   │       │   ├── redis/
│   │       │   │   ├── presence.repository.ts      # Redis DB 0
│   │       │   │   └── lobby-queue.repository.ts   # Redis DB 1
│   │       │   ├── mediasoup/
│   │       │   │   ├── mediasoup-worker.manager.ts
│   │       │   │   └── mediasoup-router.service.ts
│   │       │   └── chat-lookup.adapter.ts          # calls chat use-case in-process
│   │       └── interface/
│   │           ├── signaling.gateway.ts            # Socket.io namespace /conferencing
│   │           ├── lobby.gateway.ts                # lobby-specific events
│   │           ├── conferencing.controller.ts      # REST: schedule, history
│   │           └── conferencing.module.ts
│   │
│   ├── billing/
│   │   └── src/
│   │       ├── domain/
│   │       │   ├── subscription.entity.ts
│   │       │   ├── tier.vo.ts                      # Free/Pro/Enterprise + limits
│   │       │   └── events/
│   │       │       ├── subscription-created.event.ts
│   │       │       └── tier-changed.event.ts
│   │       ├── application/
│   │       │   ├── ports/stripe-gateway.port.ts
│   │       │   └── use-cases/
│   │       │       ├── create-checkout-session.use-case.ts
│   │       │       ├── handle-webhook.use-case.ts
│   │       │       └── get-tier-limits.use-case.ts
│   │       ├── infrastructure/
│   │       │   ├── prisma/schema.prisma
│   │       │   ├── stripe.gateway.ts
│   │       │   └── bullmq/
│   │       │       └── subscription-webhook.processor.ts
│   │       └── interface/
│   │           ├── billing.controller.ts           # webhook endpoint + checkout
│   │           └── billing.module.ts
│   │
│   └── notification/
│       └── src/
│           ├── application/
│           │   └── use-cases/
│           │       ├── send-verification-email.use-case.ts
│           │       └── send-slack-notification.use-case.ts
│           ├── infrastructure/
│           │   ├── nodemailer.gateway.ts
│           │   ├── slack-webhook.gateway.ts
│           │   └── bullmq/
│           │       ├── email.processor.ts
│           │       └── notification.processor.ts
│           └── interface/
│               └── notification.module.ts          # listens to domain events
```

**Key point for interviews:** every context's `interface` layer is the _only_ place NestJS
decorators, Socket.io gateways, and HTTP controllers live. `domain` has zero framework
imports — it's plain TypeScript classes. This is what makes the domain layer trivially
unit-testable without mocks and portable to a future microservice.

# 4. Domain Entity & Aggregate Design

Framework-agnostic TypeScript. No decorators, no imports from `@nestjs/*`, `prisma`, or
`mongoose` in this layer.

---

## 4.1 Identity Context

```typescript
// libs/identity/src/domain/user.entity.ts
export class User {
  private constructor(
    public readonly id: string,
    private email: string,
    private passwordHash: PasswordHash | null, // null if OAuth-only account
    private emailVerified: boolean,
    private readonly createdAt: Date,
  ) {}

  static register(
    email: string,
    plainPassword: string,
  ): { user: User; event: UserCreatedEvent } {
    const hash = PasswordHash.fromPlainText(plainPassword); // argon2id inside VO
    const user = new User(crypto.randomUUID(), email, hash, false, new Date());
    return { user, event: new UserCreatedEvent(user.id, user.email) };
  }

  static registerViaOAuth(
    email: string,
    provider: 'google' | 'github',
  ): { user: User; event: UserCreatedEvent } {
    const user = new User(crypto.randomUUID(), email, null, true, new Date()); // OAuth = pre-verified
    return { user, event: new UserCreatedEvent(user.id, user.email) };
  }

  verifyEmail(): UserVerifiedEvent {
    if (this.emailVerified) throw new DomainError('Email already verified');
    this.emailVerified = true;
    return new UserVerifiedEvent(this.id);
  }

  async verifyPassword(plainPassword: string): Promise<boolean> {
    if (!this.passwordHash) return false; // OAuth-only account, no password login
    return this.passwordHash.verify(plainPassword);
  }

  isEmailVerified(): boolean {
    return this.emailVerified;
  }
}
```

```typescript
// libs/identity/src/domain/password.vo.ts
export class PasswordHash {
  private constructor(private readonly hash: string) {}

  static async fromPlainText(plain: string): Promise<PasswordHash> {
    if (plain.length < 8)
      throw new DomainError('Password must be at least 8 characters');
    const hash = await argon2.hash(plain, { type: argon2.argon2id });
    return new PasswordHash(hash);
  }

  async verify(plain: string): Promise<boolean> {
    return argon2.verify(this.hash, plain);
  }
}
```

**Design notes:**

- `PasswordHash` value object wraps argon2id; domain never touches raw hashing calls elsewhere
- `User.register` vs `registerViaOAuth` are two static factories — this encodes the business
  rule "OAuth accounts don't need email verification" directly in the entity, not in a
  controller `if` statement
- `passwordHash` can be `null` — models the real-world case of an OAuth-only user

---

## 4.2 Chat Context

```typescript
// libs/chat/src/domain/group-chat-room.entity.ts
export class GroupChatRoom {
  private constructor(
    public readonly id: string,
    private name: string,
    private readonly ownerId: string,
    private members: Set<string>,
    private readonly maxMembers: number, // from tier limits at creation time
    private readonly createdAt: Date,
  ) {}

  static create(params: {
    name: string;
    ownerId: string;
    maxMembers: number; // resolved via TierLimitCheckPort before calling this
  }): { room: GroupChatRoom; event: GroupRoomCreatedEvent } {
    const room = new GroupChatRoom(
      crypto.randomUUID(),
      params.name,
      params.ownerId,
      new Set([params.ownerId]),
      params.maxMembers,
      new Date(),
    );
    return { room, event: new GroupRoomCreatedEvent(room.id, params.ownerId) };
  }

  addMember(userId: string): MemberAddedEvent {
    if (this.members.has(userId))
      throw new DomainError('User already a member');
    if (this.members.size >= this.maxMembers) {
      throw new DomainError(
        `Room limit reached (${this.maxMembers} members max for this tier)`,
      );
    }
    this.members.add(userId);
    return new MemberAddedEvent(this.id, userId);
  }

  removeMember(userId: string, requestedBy: string): void {
    if (requestedBy !== this.ownerId && requestedBy !== userId) {
      throw new DomainError('Only the owner can remove other members');
    }
    if (userId === this.ownerId)
      throw new DomainError(
        'Owner cannot be removed; transfer ownership first',
      );
    this.members.delete(userId);
  }

  rename(newName: string, requestedBy: string): void {
    if (requestedBy !== this.ownerId)
      throw new DomainError('Only the owner can rename the room');
    if (newName.trim().length === 0)
      throw new DomainError('Room name cannot be empty');
    this.name = newName;
  }

  isMember(userId: string): boolean {
    return this.members.has(userId);
  }
  getMemberIds(): string[] {
    return [...this.members];
  }
}
```

```typescript
// libs/chat/src/domain/message.entity.ts
export class Message {
  private constructor(
    public readonly id: string,
    public readonly roomId: string,
    public readonly senderId: string,
    private readonly content: string,
    public readonly createdAt: Date,
  ) {}

  static create(
    roomId: string,
    senderId: string,
    content: string,
  ): { message: Message; event: MessageCreatedEvent } {
    if (content.trim().length === 0)
      throw new DomainError('Message cannot be empty');
    if (content.length > 5000)
      throw new DomainError('Message exceeds max length');
    const message = new Message(
      crypto.randomUUID(),
      roomId,
      senderId,
      content,
      new Date(),
    );
    return {
      message,
      event: new MessageCreatedEvent(message.id, roomId, senderId),
    };
  }

  getContent(): string {
    return this.content;
  }
}
```

**Design notes:**

- `maxMembers` is baked into the entity at creation time (resolved once via
  `TierLimitCheckPort`, an application-layer port implemented by an adapter that calls
  Billing). The entity itself has zero knowledge of "tiers" — it just enforces a number. This
  keeps Chat decoupled from Billing's internal model.
- `DirectConversation` (1:1) is a much simpler sibling entity: exactly 2 participants, no
  owner/rename/member concepts. Not shown in full here, but it lives in the same domain folder
  and shares the `Message` entity.

---

## 4.3 Conferencing Context — the "one entity, three flavors" design

This is the piece that implements **"video with optional chat integration."**

```typescript
// libs/conferencing/src/domain/video-session.entity.ts
export type SessionKind = 'one-to-one' | 'group' | 'standalone';

export class VideoSession {
  private constructor(
    public readonly id: string,
    public readonly kind: SessionKind,
    private readonly hostId: string,
    private readonly linkedChatRoomId: string | null, // <-- the optional link
    private readonly maxParticipants: number, // from tier limits
    private readonly requiresLobbyApproval: boolean, // true for standalone/group by default
    private participants: Set<string>,
    private lobby: Map<string, LobbyEntry>, // userId -> LobbyEntry (waiting)
    private status: 'active' | 'ended',
    public readonly startedAt: Date,
    private endedAt: Date | null,
  ) {}

  static startFromChatRoom(params: {
    hostId: string;
    chatRoomId: string;
    maxParticipants: number;
  }): { session: VideoSession; event: SessionStartedEvent } {
    // Started from a 1:1 or group chat room — link is set, no lobby needed (already trusted members)
    const session = new VideoSession(
      crypto.randomUUID(),
      'group',
      params.hostId,
      params.chatRoomId,
      params.maxParticipants,
      false,
      new Set([params.hostId]),
      new Map(),
      'active',
      new Date(),
      null,
    );
    return {
      session,
      event: new SessionStartedEvent(
        session.id,
        params.hostId,
        params.chatRoomId,
      ),
    };
  }

  static startStandalone(params: {
    hostId: string;
    maxParticipants: number;
    requiresLobbyApproval: boolean;
  }): { session: VideoSession; event: SessionStartedEvent } {
    // Teams-style: no chat room, anyone with the link can request entry, lobby gate applies
    const session = new VideoSession(
      crypto.randomUUID(),
      'standalone',
      params.hostId,
      null,
      params.maxParticipants,
      params.requiresLobbyApproval,
      new Set([params.hostId]),
      new Map(),
      'active',
      new Date(),
      null,
    );
    return {
      session,
      event: new SessionStartedEvent(session.id, params.hostId, null),
    };
  }

  requestEntry(userId: string, displayName: string): LobbyEntry | 'admitted' {
    if (this.status === 'ended') throw new DomainError('Session has ended');
    if (this.participants.size >= this.maxParticipants) {
      throw new DomainError(
        `Session full (${this.maxParticipants} max for host's tier)`,
      );
    }
    if (!this.requiresLobbyApproval || this.linkedChatRoomId !== null) {
      // Linked-to-chat sessions skip the lobby: members are already trusted
      this.participants.add(userId);
      return 'admitted';
    }
    const entry = LobbyEntry.create(userId, displayName);
    this.lobby.set(userId, entry);
    return entry;
  }

  approveGuest(userId: string, approvedBy: string): GuestApprovedEvent {
    if (approvedBy !== this.hostId)
      throw new DomainError('Only the host can approve guests');
    const entry = this.lobby.get(userId);
    if (!entry) throw new DomainError('No pending lobby entry for this user');
    this.lobby.delete(userId);
    this.participants.add(userId);
    return new GuestApprovedEvent(this.id, userId);
  }

  leave(userId: string): void {
    this.participants.delete(userId);
    if (this.participants.size === 0) this.end();
  }

  end(): SessionEndedEvent {
    this.status = 'ended';
    this.endedAt = new Date();
    return new SessionEndedEvent(this.id, this.endedAt);
  }

  getLinkedChatRoomId(): string | null {
    return this.linkedChatRoomId;
  }
  getParticipantIds(): string[] {
    return [...this.participants];
  }
}
```

**This single entity design is the key architectural payoff of today's discussion:**

| Product surface                   | How it's modeled                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| **1:1 call from a DM**            | `startFromChatRoom({ kind derived as 'one-to-one' via maxParticipants=2 })`              |
| **Group call from group chat**    | `startFromChatRoom(...)`, `linkedChatRoomId` set, lobby skipped (members pre-trusted)    |
| **Teams-style open conferencing** | `startStandalone(...)`, `linkedChatRoomId` is `null`, lobby approval required by default |

No subclassing, no separate `OneToOneCall` / `GroupCall` / `TeamsMeeting` entities. One
`VideoSession` aggregate, differentiated by two fields (`linkedChatRoomId`, `requiresLobbyApproval`)
and a `kind` tag used only for analytics/UI labeling — not for branching business rules beyond
what's shown above. This is intentionally minimal: resist the urge to add a `kind`-based
`switch` anywhere in application/infrastructure code. If you find yourself writing one, it's a
sign the rule belongs back in the entity.

---

## 4.4 Billing Context

### 4.4.0 Tier Comparison (Full Feature Set)

This is the complete product definition of the three tiers. The columns marked **Enforced
(Phase 0-8)** are the only fields the domain layer actually checks in code right now — they're
what `Tier.DEFINITIONS` (below) encodes. Columns marked **Design only (Phase 9-11)** are real
product features that belong to Team/RBAC/Enterprise phases and are not implemented in the
critical path; they're listed here so the full tier picture lives in one place instead of only
in `FINAL_PROJECT_REVIEW.md`.

| Feature                  | Free              | Pro ($10/mo) | Enterprise ($180/yr)  | Enforced?                                                                                      |
| ------------------------ | ----------------- | ------------ | --------------------- | ---------------------------------------------------------------------------------------------- |
| 1:1 chat                 | Unlimited         | Unlimited    | Unlimited             | — (no limit modeled)                                                                           |
| 1:1 video                | Unlimited         | Unlimited    | Unlimited             | — (no limit modeled)                                                                           |
| Group chat rooms         | 1                 | Unlimited    | Unlimited             | ✅ Phase 0-8 (`maxGroupRooms`)                                                                 |
| Members per group room   | 5                 | 50           | Unlimited             | ✅ Phase 0-8 (`maxMembersPerRoom`)                                                             |
| Group video participants | 0 (not available) | 10           | Unlimited             | ✅ Phase 0-8 (`maxVideoParticipants`)                                                          |
| Recording                | —                 | 10 hrs/month | Unlimited + backup    | ✅ Phase 0-8 (`recordingHoursPerMonth`, quota check only — storage backend is Phase 8 stretch) |
| Storage quota            | 1 GB              | 10 GB        | 100 GB                | ⚠️ Design only — not enforced in Phase 0-8                                                     |
| Contacts                 | 25                | 100          | Unlimited             | ⚠️ Design only — not enforced in Phase 0-8                                                     |
| Slack integration        | —                 | ✅           | ✅                    | ⚠️ Phase 7 (Notification context), not tier-gated in code yet                                  |
| Team workspaces / RBAC   | —                 | —            | ✅ Owner/Admin/Member | ❌ Phase 9-10                                                                                  |
| SSO (SAML/OpenID)        | —                 | —            | ✅                    | ❌ Phase 11                                                                                    |
| Custom branding          | —                 | —            | ✅                    | ❌ Phase 11                                                                                    |
| Audit logs (90 days)     | —                 | —            | ✅                    | ❌ Phase 11                                                                                    |
| SLA / priority support   | Community         | Email (24h)  | 99.9% SLA + phone     | ❌ Not modeled — support process, not code                                                     |

**Why the split matters for your interview story:** it shows you deliberately scoped what the
domain layer enforces vs. what's a roadmap item, rather than either (a) hardcoding a giant
feature-flag `if` tree for things you never built, or (b) pretending the product only has four
numeric limits. `Tier.limits()` returns exactly the four enforced fields; everything else is
tracked as a Phase 9-11/design-only feature until it has a corresponding domain rule.

```typescript
// libs/billing/src/domain/tier.vo.ts
export class Tier {
  private static readonly DEFINITIONS: Record<string, TierLimits> = {
    free: {
      maxGroupRooms: 1,
      maxMembersPerRoom: 5,
      maxVideoParticipants: 0,
      recordingHoursPerMonth: 0,
    },
    pro: {
      maxGroupRooms: Infinity,
      maxMembersPerRoom: 50,
      maxVideoParticipants: 10,
      recordingHoursPerMonth: 10,
    },
    enterprise: {
      maxGroupRooms: Infinity,
      maxMembersPerRoom: Infinity,
      maxVideoParticipants: Infinity,
      recordingHoursPerMonth: Infinity,
    },
  };

  private constructor(private readonly name: string) {}

  static fromName(name: 'free' | 'pro' | 'enterprise'): Tier {
    return new Tier(name);
  }

  limits(): TierLimits {
    return Tier.DEFINITIONS[this.name];
  }
  getName(): string {
    return this.name;
  }
}

interface TierLimits {
  maxGroupRooms: number;
  maxMembersPerRoom: number;
  maxVideoParticipants: number;
  recordingHoursPerMonth: number;
}
```

```typescript
// libs/billing/src/domain/subscription.entity.ts
export class Subscription {
  private constructor(
    public readonly id: string,
    public readonly userId: string,
    private tier: Tier,
    private readonly stripeCustomerId: string,
    private stripeSubscriptionId: string | null,
    private status: 'active' | 'past_due' | 'canceled',
  ) {}

  static createFree(userId: string, stripeCustomerId: string): Subscription {
    return new Subscription(
      crypto.randomUUID(),
      userId,
      Tier.fromName('free'),
      stripeCustomerId,
      null,
      'active',
    );
  }

  upgradeTo(newTier: Tier, stripeSubscriptionId: string): TierChangedEvent {
    const oldTierName = this.tier.getName();
    this.tier = newTier;
    this.stripeSubscriptionId = stripeSubscriptionId;
    this.status = 'active';
    return new TierChangedEvent(this.userId, oldTierName, newTier.getName());
  }

  markPastDue(): void {
    this.status = 'past_due';
  }

  getLimits(): TierLimits {
    return this.tier.limits();
  }
}
```

**Design notes:**

- `Tier` is a value object with a static lookup table — no database round-trip needed to know
  the limits for a tier name. This is what `ChatRoom` and `VideoSession` ultimately consult
  (through the `TierLimitCheckPort` adapter) to get `maxMembers` / `maxParticipants` numbers.
- This is the cleanest seam for the Gemini-inspired webhook pattern: `handle-webhook.use-case.ts`
  calls `subscription.upgradeTo(...)`, publishes `TierChangedEvent`, and that's it — no direct
  coupling to Chat or Conferencing.

---

## 4.5 Cross-Context Port Example (the microservice-ready seam)

```typescript
// libs/chat/src/application/ports/tier-limit-check.port.ts
export interface TierLimitCheckPort {
  getMaxMembersForUser(userId: string): Promise<number>;
}

// libs/chat/src/infrastructure/billing-tier.adapter.ts (Phase 0-8: in-process call)
@Injectable()
export class BillingTierAdapter implements TierLimitCheckPort {
  constructor(private readonly getTierLimitsUseCase: GetTierLimitsUseCase) {} // from billing lib

  async getMaxMembersForUser(userId: string): Promise<number> {
    const limits = await this.getTierLimitsUseCase.execute(userId);
    return limits.maxMembersPerRoom;
  }
}

// Phase 14 (microservice extraction): same interface, new implementation
// class BillingTierGrpcAdapter implements TierLimitCheckPort {
//   async getMaxMembersForUser(userId: string) {
//     const res = await this.billingGrpcClient.getTierLimits({ userId });
//     return res.maxMembersPerRoom;
//   }
// }
```

This is the concrete answer to "how would you extract this to microservices" — the port
interface never changes, only the adapter's implementation swaps from an in-process call to a
gRPC client.

# 5. Database Schemas

## 5.1 PostgreSQL — Prisma Schemas (Per-Context)

Each bounded context owns its own `schema.prisma` and its own migration history. In the
monolith phase they point at the same physical PostgreSQL instance but **different schemas**
(Postgres "schema" = namespace), so extraction later is a `pg_dump`/restore of one namespace,
not a data migration project.

### Identity (`libs/identity/src/infrastructure/prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client"
  output   = "./generated"
}

datasource db {
  provider = "postgresql"
  schemas  = ["identity"]
}

model User {
  id            String   @id @default(uuid())
  email         String   @unique
  passwordHash  String?  @map("password_hash")   // null for OAuth-only accounts
  emailVerified Boolean  @default(false) @map("email_verified")
  createdAt     DateTime @default(now()) @map("created_at")

  oauthProviders OAuthProvider[]
  refreshTokens  RefreshToken[]

  @@map("users")
  @@schema("identity")
}

model OAuthProvider {
  id             String @id @default(uuid())
  userId         String @map("user_id")
  provider       String // 'google' | 'github'
  providerUserId String @map("provider_user_id")
  user           User   @relation(fields: [userId], references: [id])

  @@unique([provider, providerUserId])
  @@map("oauth_providers")
  @@schema("identity")
}

model RefreshToken {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  tokenHash String   @map("token_hash")
  expiresAt DateTime @map("expires_at")
  revoked   Boolean  @default(false)
  user      User     @relation(fields: [userId], references: [id])

  @@map("refresh_tokens")
  @@schema("identity")
}
```

### Chat (`libs/chat/src/infrastructure/prisma/schema.prisma`)

```prisma
datasource db {
  provider = "postgresql"
  schemas  = ["chat"]
}

model GroupChatRoom {
  id         String   @id @default(uuid())
  name       String
  ownerId    String   @map("owner_id")
  maxMembers Int      @map("max_members")   // snapshot from tier at creation time
  createdAt  DateTime @default(now()) @map("created_at")

  members GroupChatMember[]

  @@map("group_chat_rooms")
  @@schema("chat")
}

model GroupChatMember {
  id       String   @id @default(uuid())
  roomId   String   @map("room_id")
  userId   String   @map("user_id")
  joinedAt DateTime @default(now()) @map("joined_at")
  room     GroupChatRoom @relation(fields: [roomId], references: [id])

  @@unique([roomId, userId])
  @@map("group_chat_members")
  @@schema("chat")
}

model DirectConversation {
  id           String   @id @default(uuid())
  userAId      String   @map("user_a_id")
  userBId      String   @map("user_b_id")
  createdAt    DateTime @default(now()) @map("created_at")

  @@unique([userAId, userBId])
  @@map("direct_conversations")
  @@schema("chat")
}
```

### Conferencing (`libs/conferencing/src/infrastructure/prisma/schema.prisma`)

```prisma
datasource db {
  provider = "postgresql"
  schemas  = ["conferencing"]
}

model VideoSession {
  id                     String    @id @default(uuid())
  kind                   String    // 'one-to-one' | 'group' | 'standalone'
  hostId                 String    @map("host_id")
  linkedChatRoomId       String?   @map("linked_chat_room_id")   // soft reference, no FK constraint (cross-context)
  maxParticipants        Int       @map("max_participants")
  requiresLobbyApproval  Boolean   @map("requires_lobby_approval")
  status                 String    @default("active")
  startedAt              DateTime  @default(now()) @map("started_at")
  endedAt                DateTime? @map("ended_at")

  recordings Recording[]

  @@index([linkedChatRoomId])
  @@map("video_sessions")
  @@schema("conferencing")
}

model Recording {
  id          String   @id @default(uuid())
  sessionId   String   @map("session_id")
  storagePath String   @map("storage_path")
  durationSec Int      @map("duration_sec")
  createdAt   DateTime @default(now()) @map("created_at")
  session     VideoSession @relation(fields: [sessionId], references: [id])

  @@map("recordings")
  @@schema("conferencing")
}
```

> **Note on `linkedChatRoomId`:** deliberately **no** Prisma `@relation` to Chat's
> `GroupChatRoom` — that would require a single shared Prisma schema/client across contexts,
> which defeats the bounded-context isolation. It's stored as a plain string and resolved via
> the `ChatRoomLookupPort` adapter at the application layer when needed (e.g., to display the
> room name in the "call in progress" chat banner).

### Billing (`libs/billing/src/infrastructure/prisma/schema.prisma`)

```prisma
datasource db {
  provider = "postgresql"
  schemas  = ["billing"]
}

model Subscription {
  id                   String   @id @default(uuid())
  userId               String   @unique @map("user_id")
  tier                 String   @default("free")   // 'free' | 'pro' | 'enterprise'
  stripeCustomerId     String   @map("stripe_customer_id")
  stripeSubscriptionId String?  @map("stripe_subscription_id")
  status               String   @default("active")
  createdAt            DateTime @default(now()) @map("created_at")
  updatedAt            DateTime @updatedAt @map("updated_at")

  @@map("subscriptions")
  @@schema("billing")
}

model ProcessedWebhookEvent {
  stripeEventId String   @id @map("stripe_event_id")   // idempotency key
  processedAt   DateTime @default(now()) @map("processed_at")

  @@map("processed_webhook_events")
  @@schema("billing")
}
```

`ProcessedWebhookEvent` is the durable half of the idempotency pattern: the BullMQ job ID
(Stripe event ID) prevents duplicate _queueing_, and this table is the belt-and-suspenders
check inside the processor before applying the tier change, in case the queue itself is ever
replayed (e.g., manual retry from the BullMQ dashboard).

---

## 5.2 MongoDB — Mongoose Schemas

### Messages (`libs/chat/src/infrastructure/mongoose/message.schema.ts`)

```typescript
import { Schema, model } from 'mongoose';

const MessageSchema = new Schema({
  roomId: { type: String, required: true, index: true },
  roomType: { type: String, enum: ['direct', 'group'], required: true },
  senderId: { type: String, required: true },
  content: { type: String, required: true, maxlength: 5000 },
  createdAt: { type: Date, default: Date.now, index: true },
});

// Compound index for the most common query: "latest N messages for a room"
MessageSchema.index({ roomId: 1, createdAt: -1 });

export const MessageModel = model('Message', MessageSchema, 'chat_messages');
```

### Recordings metadata mirror (optional, for fast text search — Phase 7+)

Kept minimal; recording binary storage/paths live in Postgres (`Recording` model above).
MongoDB is not used for conferencing in Phases 0-8 — video session state during an active call
lives in Redis (below), and finalized session records live in Postgres. This avoids a third
storage system for a concern that doesn't need Mongo's flexible-schema strengths.

---

## 5.3 Redis — Key Design & Database Separation

Per the Gemini-inspired multi-DB separation:

```
Redis DB 0 — Identity/Presence (ephemeral, short TTL)
  session:{userId}              -> JWT session metadata
  presence:{userId}              -> 'online' | 'away', TTL 60s heartbeat

Redis DB 1 — Conferencing live state
  session:{sessionId}:participants   -> Set of userIds currently in call
  session:{sessionId}:lobby          -> Hash of {userId: LobbyEntry JSON}, waiting for approval
  session:{sessionId}:router          -> mediasoup router ID for this session (worker affinity)

Redis DB 2 — Reserved (future: rate limiting counters)
```

```typescript
// libs/conferencing/src/infrastructure/redis/lobby-queue.repository.ts
@Injectable()
export class LobbyQueueRepository {
  private readonly redis: Redis; // ioredis, db: 1

  constructor(@Inject('REDIS_DB_1') redis: Redis) {
    this.redis = redis;
  }

  async addToLobby(sessionId: string, entry: LobbyEntry): Promise<void> {
    await this.redis.hset(
      `session:${sessionId}:lobby`,
      entry.userId,
      JSON.stringify(entry),
    );
  }

  async removeFromLobby(sessionId: string, userId: string): Promise<void> {
    await this.redis.hdel(`session:${sessionId}:lobby`, userId);
  }

  async getLobby(sessionId: string): Promise<LobbyEntry[]> {
    const raw = await this.redis.hgetall(`session:${sessionId}:lobby`);
    return Object.values(raw).map((v) => JSON.parse(v));
  }
}
```

This is exactly where the Gemini review's "Redis db 1, Lobby Waiting Registry" idea lands in
your architecture — same concept, adapted to the unified `VideoSession` entity instead of a
separate media-meeting module.

# 6. API Contracts

## 6.1 REST Endpoints

### Identity

```
POST   /auth/register              { email, password }              -> 201 { userId }
POST   /auth/verify-email          { token }                         -> 200
POST   /auth/login                 { email, password }               -> 200 { accessToken, refreshToken }
POST   /auth/refresh               { refreshToken }                  -> 200 { accessToken, refreshToken }
POST   /auth/logout                (auth required)                   -> 204
GET    /auth/oauth/google          -> redirect to Google
GET    /auth/oauth/google/callback -> redirect with tokens
GET    /auth/oauth/github          -> redirect to GitHub
GET    /auth/oauth/github/callback -> redirect with tokens
GET    /users/me                   (auth required)                   -> 200 { id, email, tier }
```

### Chat

```
GET    /chat/conversations                       (auth) -> 200 [ { id, kind, peer/name, lastMessage } ]
POST   /chat/conversations/direct                { peerUserId }      -> 201 { conversationId }
POST   /chat/rooms                               { name }            -> 201 { roomId }  (tier-limit checked)
GET    /chat/rooms/:roomId                        (auth, member)      -> 200 { room, members }
PATCH  /chat/rooms/:roomId                        { name }            -> 200 (owner only)
POST   /chat/rooms/:roomId/members                { userId }          -> 201 (tier-limit checked)
DELETE /chat/rooms/:roomId/members/:userId        (owner or self)     -> 204
GET    /chat/rooms/:roomId/messages?before=<ts>&limit=50 -> 200 [ messages ]  (history, paginated)
```

### Conferencing

```
POST   /conference/sessions                { linkedChatRoomId?, requiresLobbyApproval? } -> 201 { sessionId }
GET    /conference/sessions/:id            (auth)                     -> 200 { session, participants }
POST   /conference/sessions/:id/leave      (auth)                     -> 204
POST   /conference/sessions/:id/end        (host only)                -> 204
GET    /conference/history                 (auth)                     -> 200 [ past sessions ]
```

### Billing

```
POST   /billing/checkout-session           { targetTier }             -> 200 { stripeCheckoutUrl }
POST   /billing/webhooks/stripe            (Stripe signature header)  -> 200 { received: true }  (always, per idempotency pattern)
GET    /billing/subscription               (auth)                     -> 200 { tier, status, limits }
```

---

## 6.2 WebSocket Events

### `/chat` namespace (`chat.gateway.ts`)

**Client → Server**

```
join-room          { roomId }
leave-room          { roomId }
send-message        { roomId, content }
```

**Server → Client**

```
message-received    { messageId, roomId, senderId, content, createdAt }
member-joined        { roomId, userId }
member-left          { roomId, userId }
call-started          { roomId, sessionId, hostId }   // notifies chat when a linked video session starts
call-ended            { roomId, sessionId }
```

Handshake requires a valid JWT (validated in the gateway's `handleConnection`), and `join-room`
is rejected server-side if the user isn't a member of that room (domain-layer check via
`chat-room.repository.port.ts`, not just a client-trusted claim).

### `/conferencing` namespace (`signaling.gateway.ts` + `lobby.gateway.ts`)

**Client → Server**

```
request-entry        { sessionId, displayName }        // may land in lobby or be admitted immediately
webrtc-offer          { sessionId, targetUserId, sdp }   // 1:1 signaling
webrtc-answer          { sessionId, targetUserId, sdp }
ice-candidate          { sessionId, targetUserId, candidate }
produce                { sessionId, kind, rtpParameters } // mediasoup: start sending media
consume                { sessionId, producerId }          // mediasoup: start receiving media
leave-session          { sessionId }
```

**Server → Client**

```
admitted               { sessionId }                      // entry granted immediately (linked-to-chat sessions)
lobby-pending           { sessionId }                      // waiting for host approval
lobby-queue-updated      { sessionId, pendingGuests: [...] }  // sent to host only
guest-approved           { sessionId, userId }
participant-joined       { sessionId, userId }
participant-left          { sessionId, userId }
session-ended             { sessionId }
new-producer               { sessionId, producerId, userId } // mediasoup: notify others to consume
```

**Host-only events**

```
Client → Server: approve-guest { sessionId, userId }
Client → Server: reject-guest  { sessionId, userId }
```

This event set is what implements the Teams-style lobby flow end to end: `request-entry` →
(if standalone + lobby required) `lobby-pending` to guest + `lobby-queue-updated` to host →
host emits `approve-guest` → guest receives `admitted` → both sides proceed to
`produce`/`consume` for mediasoup media exchange.

# 7. Testing Plan Per Layer

| Layer              | Tool                            | What's tested                                     | Example                                                                                                   |
| ------------------ | ------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Domain**         | Jest, no mocks                  | Pure business rules                               | `GroupChatRoom.addMember` throws when `maxMembers` reached                                                |
| **Domain**         | Jest, no mocks                  | `VideoSession` lobby vs immediate-admit branching | `requestEntry` admits immediately when `linkedChatRoomId` is set, even if `requiresLobbyApproval` is true |
| **Application**    | Jest + mocked ports             | Use case orchestration                            | `StartSessionUseCase` calls `TierLimitCheckPort.getMaxParticipants` before creating the session           |
| **Infrastructure** | Jest + Testcontainers           | Real Prisma/Mongoose/Redis round-trips            | `PrismaChatRoomRepository.save` then `.findById` returns equivalent entity                                |
| **Interface**      | Supertest + real Testcontainers | HTTP + WebSocket contracts                        | Register → verify → login → create room → send message, full E2E                                          |
| **Interface**      | Supertest                       | Billing webhook idempotency                       | POST same Stripe event ID twice → only one `TierChangedEvent` published                                   |

**Domain-layer test example (the one that matters most for TDD discipline):**

```typescript
describe('VideoSession — video with optional chat integration', () => {
  it('admits immediately when linked to a chat room, bypassing lobby', () => {
    const { session } = VideoSession.startFromChatRoom({
      hostId: 'host1',
      chatRoomId: 'room1',
      maxParticipants: 10,
    });
    const result = session.requestEntry('user2', 'User Two');
    expect(result).toBe('admitted');
  });

  it('places guest in lobby for standalone sessions requiring approval', () => {
    const { session } = VideoSession.startStandalone({
      hostId: 'host1',
      maxParticipants: 10,
      requiresLobbyApproval: true,
    });
    const result = session.requestEntry('guest1', 'Guest One');
    expect(result).toBeInstanceOf(LobbyEntry);
  });

  it('rejects entry once maxParticipants is reached', () => {
    const { session } = VideoSession.startStandalone({
      hostId: 'host1',
      maxParticipants: 1,
      requiresLobbyApproval: false,
    });
    expect(() => session.requestEntry('guest1', 'Guest One')).toThrow(
      /Session full/,
    );
  });
});
```

---

## 8. Phase 0 Setup Checklist

- [x] Run `corepack use pnpm@latest` to pin the current pnpm version into root `package.json`'s
      `packageManager` field (see `PACKAGE_LIST.md` note — pnpm updates too often to hardcode
      a version number in prose docs)
- [x] Init pnpm workspace: `pnpm-workspace.yaml` listing `apps/*`, `libs/*`
- [x] Root `package.json` scripts: `dev`, `build`, `test`, `lint` all using `pnpm -r --parallel run <script>`
- [x] `docker-compose.yml`: postgres:17-alpine, mongo:8.0-noble, redis:7.4-alpine
- [x] Scaffold `apps/api-gateway` via `nest new` inside the monorepo path
- [x] Scaffold `apps/web` via `create-next-app` (App Router, TypeScript, Tailwind)
- [x] Create empty `libs/{shared-kernel,identity,chat,conferencing,billing,notification}` with
      the folder skeleton from Section 3 (top-level `domain`/`application`/`infrastructure`/
      `interface` only, each with a `.gitkeep`; deeper sub-folders deferred to Phase 1, created
      naturally alongside the first real file in each)
- [x] Prettier config at root (single `.prettierrc`, consolidated — see §8.2)
- [x] ESLint: root `eslint.config.mjs` scoped to `libs/*` only; `apps/api-gateway` and
      `apps/web` keep their own CLI-generated flat configs (different rule sets — Nest/Node vs.
      Next/React — not worth forcing into one shared config; see §8.2 for real compatibility
      issues hit and resolved)
- [x] husky + lint-staged: pre-commit runs lint-staged
- [x] commitlint + commitizen: commit-msg hook validates Conventional Commits
- [x] GitHub Actions `ci.yml`: install → lint → typecheck → unit test → build (Testcontainers
      integration step intentionally deferred to Phase 1 — see §8.2)
- [x] Adopt **GitHub Flow** as the git workflow (see note below) — protect `main` on GitHub
      (require PR + passing CI before merge), agree on squash-merge as the default merge strategy
- [x] `.env.example` at root documenting all required environment variables
- [x] Verify `docker-compose up` brings up all three databases and they're reachable
- [x] Verify `pnpm -r --parallel run dev` boots both `api-gateway` and `web` concurrently
- [x] Create `docs/` folder at repo root; move all four planning docs into it
      (`FINAL_PROJECT_REVIEW.md`, `DEVELOPMENT_DOCUMENT.md`, `PACKAGE_LIST.md`, `PHASE_CHECKLIST.md`)
- [x] Write a short root `README.md`: what Huddle is, tech stack summary, setup steps, link to `docs/`
- [x] First commit: `chore: scaffold monorepo structure`

**Definition of done for Phase 0:** a fresh clone + `pnpm install` + `docker-compose up` +
`pnpm dev` gets you a running (empty) NestJS API and Next.js frontend, with lint/format/commit
hooks enforced, and CI green on push.

**Git workflow: GitHub Flow (not Git Flow, not pure Trunk-Based Development).**
`main` is always deployable. Every feature/fix gets a short-lived branch named
`<type>/<scope>-<short-desc>` (matching the commitlint scope, e.g. `feat/identity-jwt-auth`),
opened as a PR even when working solo, merged only after CI passes (lint, typecheck, unit +
integration tests), and squash-merged so `main`'s history reads as one clean commit per
completed feature. Rejected Git Flow (no parallel release versions to support) and GitLab Flow
(single deploy target, no staging/production branch split needed) as unnecessary ceremony for
this project's scope.

---

### 8.1 Port Allocation (Local Development)

Discovered the hard way during Phase 0 implementation: Next.js and NestJS both default to port
3000, and Docker services can collide with anything you already run locally (e.g. an
existing local PostgreSQL install). The full picture, so this doesn't surprise you again in a
later phase:

| Service                                    | Port                                     | Status                                                                                                                |
| ------------------------------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `apps/web` (Next.js)                       | 3000                                     | Standard default, kept as-is                                                                                          |
| `apps/api-gateway` (Nest HTTP + Socket.io) | 4000                                     | Changed from Nest's 3000 default to avoid colliding with `apps/web` — set via `process.env.PORT ?? 4000` in `main.ts` |
| PostgreSQL (Docker, host-side)             | `${POSTGRES_HOST_PORT:-5432}`            | Configurable per-developer via `.env` (see §8.2)                                                                      |
| MongoDB (Docker, host-side)                | `${MONGO_HOST_PORT:-27017}`              | Same pattern as Postgres, for consistency — no conflict observed yet, but any developer could hit one                 |
| Redis (Docker, host-side)                  | `${REDIS_HOST_PORT:-6379}`               | Same pattern                                                                                                          |
| coturn (Phase 3, TURN server)              | 3478 (typical)                           | Not yet configured — verify for conflicts when Phase 3 starts                                                         |
| mediasoup (Phase 5, RTP/SFU)               | Dynamic UDP range, typically 40000-49999 | Needs explicit Docker port range exposure when Phase 5 starts — not yet configured                                    |

**Rule of thumb going forward:** whenever a new service or container is introduced in a later
phase, check this table first, add a row for it, and verify with `netstat -ano | findstr :<port>`
(Windows/git bash) before assuming the default port is free.

---

### 8.2 Implementation Notes & Lessons Learned (Phase 0)

Real issues hit while actually scaffolding Phase 0 — kept here so they aren't rediscovered
from scratch in a later phase or on a fresh machine.

**Docker image tags**

- `mongo:8.0-alpine` does not exist. The official MongoDB image publishes only Ubuntu-based
  tags (`noble` = Ubuntu 24.04) — no Alpine variant, unlike Postgres and Redis. Use
  `mongo:8.0-noble`.

**Package versions**

- `PACKAGE_LIST.md` has contained incorrect or stale version numbers multiple times during
  planning (`@nestjs/config@4.1.0`, `jsonwebtoken@9.0.10`, `mediasoup-client@3.21.1` all
  turned out not to exist on the registry; `@nestjs/swagger` and `@nestjs/bullmq` were listed
  well behind their actual latest). **Always verify with
  `curl -s https://registry.npmjs.org/<package-name> | grep '"latest"'` before running an
  install command**, rather than trusting a version table at face value — this cost real time
  more than once during Phase 0.

**TypeScript 6.0 breaking changes** (hit while getting `apps/api-gateway` to boot)

- `types` now defaults to an **empty array** instead of auto-including everything under
  `node_modules/@types`. This surfaces as `Cannot find name 'process'` (or similar "cannot
  find name" errors for any ambient global) even when the corresponding `@types/*` package is
  correctly installed. Fix: explicitly list `"types": ["node", "express", "jest"]` (or
  whichever ambient globals the project actually needs) in `tsconfig.json`.
- `rootDir` must now be set explicitly (TS5011) — it's no longer silently inferred from your
  source layout.
- `baseUrl` alone (with no matching `paths`) is deprecated (TS5101). If nothing uses it,
  delete it rather than suppressing the warning. (Note: Next.js 16's own generated
  `tsconfig.json` does _not_ hit this — it uses `paths` without `baseUrl`, which has been
  valid since TS 4.1, so no fix was needed in `apps/web`.)

**`nest-cli.json`**

- `sourceRoot` must be `"src"`, not a path re-including the app folder name (e.g. NOT
  `"api-gateway/src"`) — `nest-cli.json` already lives inside `apps/api-gateway/`, so
  `sourceRoot` is relative to that. Getting this wrong doesn't break `pnpm dev`/`pnpm build`
  (those read `rootDir` from `tsconfig.json` instead), but it does break `nest generate`
  commands, which will create files under a wrong nested path.
- `pnpm dlx @nestjs/cli new <name> --skip-git` skips generating a nested `.gitignore` inside
  the new app folder (confirmed on this project's Nest CLI version) — not just `git init`.
  The root `.gitignore` already covers `apps/*/node_modules` etc. via pattern matching, so no
  action needed, but don't expect a per-app `.gitignore` to exist.

**Build cache / `dist/` race condition**

- With `nest-cli.json`'s `"deleteOutDir": true`, `nest start --watch` (build-mode `tsc -b`
  against `tsconfig.build.json`) can intermittently fail with
  `Error: Cannot find module '.../dist/main'` right after boot. Root cause: `tsc -b` always
  maintains an incremental build-info cache (named `tsconfig.build.tsbuildinfo`, placed in
  `outDir`) regardless of the `"incremental"` tsconfig setting — build mode requires it
  structurally. If a stale cache survives the `deleteOutDir` wipe (or races it), `tsc -b`
  wrongly concludes nothing changed and skips emitting `dist/main.js`. Setting
  `"incremental": false` in `tsconfig.json` resolved this in practice. The `.tsbuildinfo` file
  will still be regenerated regardless — that's expected, not a leftover to chase down; it's
  gitignored (`*.tsbuildinfo`) like any other local build artifact.

**pnpm workspace / monorepo commands**

- Run workspace-level pnpm commands (`approve-builds`, `install`, `-r` commands) **from the
  repo root**, not from inside an individual app folder. Running `pnpm approve-builds` from
  `apps/web` created a _second_, stray `pnpm-workspace.yaml` inside `apps/web` itself (holding
  only the build-approval settings) instead of updating the root one — which then confused
  Next.js/Turbopack's workspace-root detection (`Warning: Next.js inferred your workspace
root...`). Fix: merge `allowBuilds`/`ignoredBuiltDependencies` into the root
  `pnpm-workspace.yaml` and delete the stray one.
- `pnpm create next-app` (and similar scaffolding commands) can trigger
  `[ERR_PNPM_IGNORED_BUILDS]` for packages with native post-install build scripts (`sharp`,
  `unrs-resolver` for this project) — this is pnpm's supply-chain-safety default, not an
  error in the scaffold. Run `pnpm approve-builds` (from the repo root) and select the
  legitimate packages, then re-run `pnpm install`.

**ESLint/Prettier setup across a mixed monorepo (Step 7)**

- `apps/api-gateway` and `apps/web` deliberately keep their own separate, CLI-generated
  ESLint flat configs rather than sharing one root config — they need genuinely different
  rule sets (Nest/Node vs. Next/React), and forcing them into one shared config would mean
  stripping plugins each app actually needs. Only `libs/*` (framework-agnostic domain code)
  uses the root `eslint.config.mjs`, and only with non-type-aware rules (`tseslint.configs.recommended`,
  not `recommendedTypeChecked`) since the libs have no `tsconfig.json` yet — upgrade this once
  each lib gets one alongside its first real file in Phase 1.
- **A `lint` script pointed at an empty folder is a hard ESLint error, not a soft no-op.**
  Initially added `"lint": "eslint src"` to each of the six libs' `package.json` on the
  assumption it would be harmless until Phase 1 populates them — it isn't. With zero `.ts`
  files present (only `.gitkeep` placeholders), ESLint's flat-config engine reports _all_
  files as unmatched/ignored and exits with an error, unlike `pnpm -r run <script>`, which
  gracefully skips a package that's _missing_ the script entirely. Different failure modes:
  a missing script is fine; a script with nothing valid to act on is not. Removed the `lint`
  script from all six libs; will re-add once each lib has real source files.
- **`pnpm`'s `minimumReleaseAge` safety default can silently resolve older-than-expected
  versions.** An install for `@eslint/js` and `typescript-eslint` (no version pinned, expecting
  latest) resolved to versions a full minor/major behind actual current — not a bug, but pnpm
  intentionally holding back very recently published releases for a short safety window.
  Fixed via `pnpm up -L -w <pkg>` once the newer versions cleared that window. Worth
  double-checking resolved versions after any unpinned install, not just assuming "latest
  requested" means "latest available."
- **`pnpm` can auto-add a `devEngines.packageManager` field that conflicts with an existing
  `packageManager` field**, triggering a "specify different versions, packageManager will be
  ignored" warning. Since `packageManager` (via Corepack, set up in Step 1) was already the
  intended single source of truth for the pinned pnpm version, the auto-added `devEngines`
  block was deleted rather than reconciled — one field, one source of truth, consistent with
  how `nest-cli.json`'s duplicate `.gitignore` and duplicate `pnpm-workspace.yaml` issues were
  each resolved earlier.
- **`pnpm init`/`corepack use pnpm@latest` (recent pnpm versions) auto-adds `"type": "module"`
  to a freshly created root `package.json`** — a real, deliberate pnpm default (tracked in
  pnpm's own GitHub issue #9480), not something either of us set. **Decision: removed it**, for
  consistency — every other `package.json` in this monorepo (`apps/*`, `libs/*`) is implicitly
  CommonJS with no `"type"` field, so root staying CommonJS-by-default too means one convention
  monorepo-wide, with `.mjs`/`.cjs` used explicitly wherever a specific root-level file needs to
  opt out (e.g. `eslint.config.mjs`, which forces ESM via extension regardless of `"type"`
  either way). The alternative (keeping `"type": "module"`) would have meant verifying ESM
  config support per tool going forward rather than assuming it — a real, recurring cost given
  not every tool's config loader supports it.
- **ESLint 10 is not yet supported by `eslint-plugin-react`** (pulled in transitively via
  `eslint-config-next`), which caps its own peer dependency at `eslint: '^9.7'` even in its
  latest published release — a genuine upstream gap (ESLint 10 changed its internal rule
  context API, removing the old `context.getFilename()` method that `eslint-plugin-react`
  still calls internally), not a misconfiguration. **Fix:** `apps/web` pins its own
  `eslint` devDependency to `^9.39.5` (the current latest 9.x release) while root, `libs/*`,
  and `apps/api-gateway` all stay on `eslint@10.6.0` — pnpm workspaces resolve each package's
  dependencies independently, so this split coexists without conflict. This is a deliberate,
  documented exception to `PACKAGE_LIST.md`'s single `eslint@10.6.0` line, not an
  inconsistency — revisit once `eslint-plugin-react` (or Next's ESLint tooling more broadly)
  ships ESLint 10 support.
- **`typescript-eslint`'s `parserOptions.projectService: true` requires every linted file to
  belong to a recognized TS project** — including test files. Since `tsconfig.json` in
  `api-gateway` excludes `test/` (needed for the `rootDir` fix earlier in this same section),
  ESLint had nowhere to place `test/app.e2e-spec.ts` and failed with _"was not found by the
  project service."_ Fixed using `typescript-eslint`'s documented escape hatch for this exact
  case: `projectService: { allowDefaultProject: ['test/*.ts'] }` (note: `**` globs are
  explicitly disallowed in this option — it's meant for a small, named set of out-of-project
  files, not whole directory trees).

**husky + lint-staged + commitlint (Step 8)**

- **`pnpm dlx <pkg>` vs. `pnpm exec <pkg>`** matter once a tool is a real, pinned project
  dependency. `pnpm dlx husky init` would fetch whatever's currently latest on the registry to
  run that command — potentially a different version than the one deliberately pinned via
  `pnpm add -D -w husky@^9.1.7` moments earlier. Once a package is an actual dependency, use
  `pnpm exec` so the already-installed, pinned version runs, not a fresh `dlx` fetch. Same
  class of "single source of truth" issue as the `devEngines`/`packageManager` duplication
  from Step 7.
- **ESLint's flat config only loads one config file per invocation — no per-directory
  cascading** (confirmed directly from ESLint's own blog/docs, not assumed). This matters
  directly for `.lintstagedrc.json` in a multi-app monorepo: a single bare `eslint --fix`
  command run from the repo root would silently use only the root `eslint.config.mjs`,
  ignoring `apps/api-gateway` and `apps/web`'s own configs entirely. Fixed by having
  `.lintstagedrc.json` pass `--config <app>/eslint.config.mjs` explicitly per glob group,
  rather than relying on cwd-based auto-resolution. (Prettier doesn't have this problem — it
  still does its own nearest-config-file search per file.)
- **`eslint:recommended` (and any config block with no `files` restriction) applies to every
  file ESLint sees, including root-level plain `.js` tooling files** like
  `commitlint.config.js` — this surfaced as a `'module' is not defined` error, since Node
  globals were only declared inside the block scoped to `files: ['libs/**/*.ts']`. Fixed by
  adding `commitlint.config.js` (and any future root-level plain `.js`/`.cjs` config file) to
  the root `eslint.config.mjs`'s `ignores` list — that config was only ever meant to govern
  `libs/*`, not incidentally catch loose root files it was never designed for.
- **CRLF line endings can still slip through even with `.gitattributes` in place**, showing up
  as a `prettier/prettier` "Delete ␍" lint error on individual files (hit on both
  `commitlint.config.js` and `eslint.config.mjs`). `.gitattributes` normalizes line endings on
  `git add`/`commit`, but doesn't prevent an editor from _saving_ a file as CRLF in the first
  place — worth also setting `"files.eol": "\n"` in a **committed** `.vscode/settings.json`
  (not just personal user-level VS Code settings), so anyone opening the repo gets LF by
  default rather than relying solely on the git-side normalization catching it after the fact.
  `git add --renormalize .` remains the correct way to sweep any already-affected tracked
  files repo-wide, not just the one you happened to notice.
- **`pnpm -r run lint` only runs each workspace _package's own_ `lint` script — it never
  touches loose files at the repo root** (`eslint.config.mjs`, `commitlint.config.js`, etc.),
  since those aren't inside any package's own lint glob. Lint/format root-level files by
  naming them directly: `pnpm exec eslint <file> --fix` / `pnpm exec prettier --write <file>`.
- **A package can be present in `node_modules` without being runnable.** `prettier --write`
  failed inside `lint-staged` with a "not recognized as an internal or external command"
  error, even though `prettier` was technically on disk — because it was only ever pulled in
  as a _transitive_ dependency (via `eslint-plugin-prettier`/`eslint-config-prettier`), never
  installed directly. Under pnpm's default strict, non-hoisted `node_modules` layout, only
  _directly declared_ dependencies get their binaries symlinked into `node_modules/.bin`,
  which is what `pnpm exec` and `lint-staged` actually resolve commands against. Fixed via
  `pnpm add -D -w prettier@^3.9.5` (registry check found `3.9.5` current, one patch ahead of
  `PACKAGE_LIST.md`'s `3.9.4`) — install any tool whose _CLI_ you invoke directly as a real
  dependency, not just whatever pulls it in transitively.
- **Testing pre-commit hooks safely, before the project's real first commit, needs a slightly
  different undo procedure than normal.** Two things learned the hard way: (1) if many files
  are already staged for the eventual Step 10 commit, isolate the hook test to a single
  throwaway file first (`git reset` to unstage everything, `git add` just the one file, test,
  then `git add .` again afterward to restore full staging) rather than accidentally
  committing everything staged at the time; (2) `git reset --soft HEAD~1` — the normal way to
  undo a test commit while keeping its staged changes — doesn't work on a repo's very first
  commit, since `HEAD~1` doesn't exist yet. Use `git update-ref -d HEAD` instead, which deletes
  the branch ref entirely (returning to "no commits yet") without touching the working tree or
  index. `git log --oneline` is the authoritative way to confirm this worked — VS Code's Git
  Graph extension can show a stale cached view immediately after, catching up only once
  manually refreshed.

**GitHub Actions CI (Step 9)**

- Verified current major versions for every action before writing the workflow, rather than
  assuming: `actions/checkout@v6`, `actions/setup-node@v6`, `pnpm/action-setup@v6`.
- `pnpm/action-setup@v6` needs no `version:` input — it auto-reads the pinned version from
  root `package.json`'s `packageManager` field, keeping CI and local dev on the exact same
  pnpm version with zero separate number to maintain.
- `actions/setup-node`'s `cache: pnpm` must be set explicitly — pnpm caching isn't
  auto-detected the way npm's is.
- The Testcontainers/integration-test CI step was deliberately left out of `ci.yml` entirely
  rather than stubbed — no such tests exist until Phase 1 introduces real
  infrastructure-layer repositories to test against. Same "don't wire up what doesn't exist
  yet" principle as the `libs/*` lint-script mistake in Step 7.

**A `git commit` can silently run a different tool version than `pnpm -r run lint` does —
the most subtle bug hit in Phase 0 (Step 10).** `.lintstagedrc.json` ran a bare `eslint`
command for both `apps/api-gateway` and `apps/web`. `lint-staged` executes commands with `cwd`
set to the **repo root**, not the individual app folder — so under pnpm's strict,
non-hoisted `node_modules`, that bare `eslint` resolved to the **root's** pinned
`eslint@10.6.0`, not `apps/web`'s separately-pinned `eslint@^9.39.5`, even though the
`--config apps/web/eslint.config.mjs` flag correctly pointed at `web`'s config file — the
config path and the binary executing it were silently mismatched. This reproduced the exact
`eslint-plugin-react`/ESLint 10 crash (`contextOrFilename.getFilename is not a function`,
tracked upstream at `vercel/next.js#89764` — confirmed a real, still-open compatibility gap,
and confirmed via that thread that workarounds like manually setting `settings.react.version`
are unreliable "whack-a-mole" fixes other rules still crash on afterward). The first
suspected culprit was `next.config.ts` needing a `globalIgnores` entry (a plain config file
with no JSX, plausible target for exclusion) — but an isolated test proved this was a red
herring: running `pnpm exec eslint next.config.ts` directly from within `apps/web` (correct
cwd, correct resolved binary) passed clean, proving the file itself was never the problem.
**Fix:** point `.lintstagedrc.json` at each app's own local binary explicitly —
`apps/api-gateway/node_modules/.bin/eslint` / `apps/web/node_modules/.bin/eslint` — rather
than a bare `eslint` command that resolves relative to `lint-staged`'s own cwd. `libs/**/*.ts`
was unaffected, since root _is_ the correct binary for `libs` anyway. Lesson: in a mixed-version
monorepo, verify which binary a tool command actually resolves to, not just which config
file it's pointed at — the two can silently diverge based on invocation `cwd`.

**pnpm 11 removed the old build-approval settings entirely — `allowBuilds` is now the only
mechanism, and `package.json`'s `"pnpm"` field is no longer read at all.** Confirmed directly
from pnpm 11's own release notes: `onlyBuiltDependencies`, `onlyBuiltDependenciesFile`,
`neverBuiltDependencies`, `ignoredBuiltDependencies`, and `ignoreDepScripts` are all gone;
`allowBuilds` (in `pnpm-workspace.yaml` only) replaces them. A config edit had briefly kept an
`ignoredBuiltDependencies` block alongside `allowBuilds` — that block was silently doing
nothing (unrecognized YAML keys don't error, they're just ignored), an easy trap. Per pnpm's
own docs: the default for any package **not** listed in `allowBuilds` is deny
(`strictDepBuilds` defaults to `true`, causing a hard error rather than a warning) — but the
better practice is still to list every reviewed package explicitly with `true`/`false` rather
than relying on silent omission, since pnpm itself auto-adds placeholder entries for anything
flagged during install specifically so each one gets a deliberate, visible decision.

- CI's first real run (Linux, `ubuntu-latest`) surfaced two _new_ flagged packages —
  `@scarf/scarf` and `msgpackr-extract` — that never appeared during local (Windows) installs,
  because `msgpackr-extract` ships platform-specific optional native binaries; different
  platforms resolve different optional variants needing a build step.
- Traced both to their actual source rather than guessing: `msgpackr-extract` comes via
  `@nestjs/bullmq` → `bullmq` → `msgpackr` (binary job-data serialization); `@scarf/scarf`
  comes via `@nestjs/swagger`'s dependency tree. Both `@nestjs/bullmq` and `@nestjs/swagger`
  were already installed in Step 4 (bundled into the initial exact-pin `@nestjs/*` install,
  not deferred to a later phase).
- **Decision, made deliberately rather than blanket-approving everything the way `sharp`/
  `unrs-resolver` were:** `msgpackr-extract: true` (real, if optional, functional benefit —
  `bullmq` falls back to a working pure-JS implementation either way, but the native path
  will actually be exercised once Phase 6 builds the billing webhook queue) and
  `"@scarf/scarf": false` (pure telemetry beacon — "like Google Analytics for your npm
  packages," per its own npm description — with zero functional relationship to Swagger's
  actual documentation-generation behavior). Final `pnpm-workspace.yaml`:
  ```yaml
  allowBuilds:
    sharp: true
    unrs-resolver: true
    msgpackr-extract: true
    '@scarf/scarf': false
  ```

**`typescript-eslint`'s `tseslint.config(...)` helper is itself deprecated** in favor of
`defineConfig` from `eslint/config` (part of ESLint core) — the two are functionally
identical, `tseslint.config` was always just a thin wrapper. Migrated root `eslint.config.mjs`
accordingly; this also makes root and `apps/web` consistent in which top-level config helper
they use (only `apps/api-gateway`, per Nest's own scaffold convention, still uses the older
pattern directly — worth checking if Nest's own generated config shows the same deprecation
warning in a future Nest CLI version).

**A stray nested lockfile is easy to miss until you actually read the commit's file list.**
`apps/web/pnpm-lock.yaml` — a leftover from `create-next-app` scaffolding before it became
part of the pnpm workspace — got committed alongside the real root lockfile. A pnpm workspace
should have exactly one lockfile, at the root. Fixed via `git commit --amend --no-edit` before
pushing (safe specifically because nothing had been pushed yet — no shared history to
disrupt), keeping Phase 0's history as one accurate commit rather than a "scaffold" commit
immediately followed by a fixup.

**GitHub repository & branch protection setup, decided deliberately for solo portfolio use —
not just "turn everything on":**

- Created the GitHub repo empty (no auto-generated README/`.gitignore`/license) specifically
  to avoid a conflicting history on the very first push, since the local repo already had
  these staged.
- Branch protection on `main`: require a pull request before merging, require the CI status
  check to pass — **but explicitly left "Require approvals" unchecked.** GitHub disables
  self-approval on your own PRs with no admin bypass; enabling this with a required count of 1
  would have locked out every merge entirely, since there's no second reviewer. The three
  sibling sub-options ("dismiss stale approvals," "require Code Owners review," "require
  approval of the most recent push") are all moot once "Require approvals" itself is off, and
  were left unchecked too.
- **Real gotcha:** the status-check search box matches the workflow's **job id**
  (`build-and-test`), not the top-level `name:` field in `ci.yml` (`CI`) — searching "CI" in
  the branch-protection status-check picker finds nothing.
- Merge button settings: only "Allow squash merging" enabled (merge commits and rebase merging
  both disabled) — enforces the GitHub Flow decision already stated above, rather than leaving
  it as an unenforced convention anyone could violate by picking the wrong button on a PR.
  Squash commit message format explicitly set to "Pull request title and description" rather
  than left on GitHub's own default (which, for any PR with 2+ commits, dumps the full list of
  every individual commit message into the squash commit — exactly the noise squashing is
  meant to eliminate).
- **PR granularity decision for solo, job-hunting-portfolio use:** open one PR per meaningful
  `PHASE_CHECKLIST.md` line item, not one per commit — enough that each PR is a real,
  reviewable unit of work with an honest description (what was built, why, what was tested),
  not empty process ceremony. The self-review nature of a solo repo means the usual "second
  pair of eyes" value of a PR is absent regardless of how it's configured; the actual value
  kept is the CI gate plus a demonstrable, explainable history — worth being honest about
  that tradeoff rather than pretending the process is identical to a team's.

**Local environment specifics (Windows + git bash)**

- No POSIX `lsof`; use `netstat -ano | findstr :<port>` to check for local port conflicts
  before assigning a Docker host-port mapping.
- A `.gitattributes` forcing `eol=lf` for `*.sh` and `.husky/*` is worth keeping even after a
  planned migration to WSL2 (see below) — it's a repository-level guarantee (protects any
  future clone, any contributor, any editor), not a per-machine one, and is independent of
  which shell produced the file.
- Plan to migrate primary development to **WSL2 (Ubuntu)** before Phase 3 (1:1 video) at the
  latest, ideally before Phase 5 (mediasoup) — mediasoup's native C++ worker compilation and
  Testcontainers' Docker socket access are both meaningfully more reliable inside a real Linux
  environment than on native Windows, even via git bash.

---

## 9. What Changed From the Original Plan (Summary of Today's Session)

1. **Group chat and group video are separate bounded contexts**, linked by an optional,
   nullable `linkedChatRoomId` on `VideoSession` — never the reverse.
2. **One `VideoSession` entity covers all three product surfaces** (1:1, group-from-chat,
   standalone/Teams-style) via two fields, not three separate entity types.
3. **Lobby/organizer-approval logic lives inside the entity** (`requestEntry`,
   `approveGuest`), and is automatically bypassed when a session is linked to a chat room
   (members are pre-trusted) — this single `if` branch is the entire implementation of
   "video with optional chat integration."
4. Cross-context reads (Chat needs tier limits from Billing, Conferencing needs chat room
   lookup) go through **port interfaces + in-process adapters**, the exact seam Phase 14 will
   cut along for microservice extraction.
