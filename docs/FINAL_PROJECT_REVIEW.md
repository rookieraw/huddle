# Final Project Review: Huddle — Full-Stack Chat & Video Conferencing App

## Junior Backend Engineer Portfolio

**Status:** Phase 0 implementation in progress
**Date:** July 5, 2026 (package versions corrected July 8, 2026 — see note below)
**Reviewer:** Complete plan consolidation & validation

> **Version correction note (July 8, 2026):** Three package versions below were found not to
> exist on the npm registry during actual Phase 0 install (`@nestjs/config@4.1.0`,
> `jsonwebtoken@9.0.10`, `mediasoup-client@3.21.1`), and two more were significantly stale
> (`@nestjs/swagger`, `@nestjs/bullmq`). The corrected values are reflected below and match
> `PACKAGE_LIST.md`, which remains the authoritative source — always verify against
> `registry.npmjs.org` before installing, rather than trusting either document at face value.

---

## 1. PROJECT GOAL VALIDATION

### Your Goal

**Land a Junior Backend Engineer offer** by demonstrating:

- ✅ Clean, testable backend architecture (DDD + TDD)
- ✅ Database design competence (PostgreSQL + MongoDB strategy)
- ✅ Real-world features (auth, payments, real-time)
- ✅ Production-quality code (testing, CI/CD, linting, git conventions)

### Your Background

- ✅ Node.js + Express (known unknowns: NestJS, TDD at scale)
- ✅ PostgreSQL + MySQL (small project, not deeply familiar)
- ✅ Python basics (sufficient for understanding concepts)
- ✅ **Gap to fill:** Backend systems design, modular architecture, real-time systems, payment integration

### This Project Fills That Gap

By building Phases 0-8, you'll have:

- Auth system with password hashing (argon2id) + OAuth (understanding design trade-offs)
- Real-time architecture (Socket.io, Redis, presence tracking)
- Payment integration (Stripe webhooks with idempotency)
- 1:1 and group video (WebRTC signaling, SFU concepts)
- Modular codebase designed for microservices

**Result:** Every junior backend interview question about "how would you design X" has a working answer you built.

---

## 2. APP FEATURE SET (Confirmed)

### Free Tier

- 1:1 chat: Unlimited
- 1:1 video: Unlimited
- Group chat: 1 room, max 5 members
- Group video: Not available
- Storage: 1 GB

### Pro Tier ($10/month)

- 1:1 chat: Unlimited
- 1:1 video: Unlimited
- Group chat: Unlimited rooms, 50 members/room
- Group video: Max 10 participants
- Recording: 10 hours/month
- Storage: 10 GB
- Integrations: Slack notifications
- Support: Email (24h)

### Enterprise Tier ($180/year)

- All Pro features
- Group video: Unlimited participants
- Recording: Unlimited storage
- Team workspaces with RBAC
- SSO (SAML/OpenID)
- Custom branding
- Audit logs (90 days)
- SLA: 99.9% uptime guarantee

**Features by Phase:**

| Phase | Feature                                                     | Status              |
| ----- | ----------------------------------------------------------- | ------------------- |
| 2     | Register, email verify, login, JWT, OAuth                   | CRITICAL            |
| 3     | 1:1 chat real-time                                          | CRITICAL            |
| 4     | Group chat rooms, membership                                | CRITICAL            |
| 5     | 1:1 WebRTC video (P2P)                                      | CRITICAL            |
| 6     | Stripe subscriptions, webhook idempotency                   | CRITICAL            |
| 7     | Group video (mediasoup SFU), recording, Slack notifications | CRITICAL            |
| 8     | Deploy, docs, E2E tests, live demo                          | CRITICAL            |
| 9     | Team workspaces, membership                                 | IMPORTANT (if time) |
| 10    | RBAC, role-based features                                   | IMPORTANT (if time) |
| 11    | SSO, custom branding, audit logs                            | NICE-TO-HAVE        |
| 12-14 | API access, advanced notifications, microservices design    | DESIGN ONLY         |

---

## 3. TECHNOLOGY STACK (Validated July 2026, corrected July 8, 2026)

### Confirmed Package Versions

**Backend Core:**

- NestJS: 11.1.27
- TypeScript: 6.0.3 (transition release toward v7)
- Node.js: 24 LTS

**Databases:**

- PostgreSQL: 17-alpine (Docker)
- MongoDB: 8.0 (Docker — `mongo:8.0-noble`; the official image has no Alpine variant, unlike Postgres/Redis)
- Redis: 7.4-alpine (Docker)
- Prisma: 7.8.0 (PostgreSQL ORM)
- Mongoose: 9.7.3 (MongoDB ODM)

**Real-time & Caching:**

- Socket.io: 4.8.3
- ioredis: 5.11.1 (✅ Supports Redis 2.6.12+ with complete compatibility for Redis 7.x)
- BullMQ: 5.79.2 (job queues)
- @socket.io/redis-adapter: 8.3.0

**Authentication:**

- argon2: 0.44.0 (memory-hard password hashing, OWASP-recommended)
- Passport.js: 0.7.0 + strategies
- @nestjs/jwt: 11.0.2

**Payments:**

- Stripe: 22.3.0 (Node.js SDK)

**Video/WebRTC:**

- mediasoup: 3.21.0
- mediasoup-client: 3.21.0

**Frontend:**

- Next.js: 16.2.10
- React: 19.2.7
- TailwindCSS: 4.3.2
- @tanstack/react-query: 5.101.2

**Development:**

- ESLint: 10.6.0 (flat config) — **except `apps/web`, pinned to `^9.39.5`** (deliberate
  exception: `eslint-plugin-react`, pulled in via `eslint-config-next`, has no ESLint 10
  support yet; see `DEVELOPMENT_DOCUMENT.md` §8.2)
- Prettier: 3.9.4
- husky: 9.1.7
- lint-staged: 17.0.8
- commitlint: 21.2.0
- commitizen: 4.3.2
- Jest: 30.4.2
- ts-jest: 29.4.11
- Supertest: 7.2.2
- Testcontainers: 12.0.4 (real Postgres/Mongo/Redis in tests)

**Package Manager & Monorepo:**

- pnpm: pinned via Corepack's `packageManager` field in root `package.json` (not hardcoded
  here — pnpm ships new releases too frequently for a version number in prose to stay current;
  run `corepack use pnpm@latest` once in Phase 0 to write the real, current pin)

**Why Not:**

- ❌ Turbo.js: Not needed for small monorepo, adds complexity without interview value
- ❌ TypeScript 5.9: v6.0.3 is the transition release; shows ecosystem awareness
- ❌ redis@6.1.0: Supports only Redis 7.2+; ioredis supports 2.6.12+ (more flexible)
- ❌ LiveKit: mediasoup teaches more; you understand the SFU architecture
- ❌ Kubernetes/K3s: Document in Phase 9; don't build for junior portfolio

---

## 4. ARCHITECTURE (DDD + Modular Monolith)

### Directory Structure

```
/
  /apps
    /api-gateway      # NestJS (currently monolith, designed for microservice extraction)
    /web              # Next.js 16 App Router
  /libs
    /shared-kernel    # Shared types, DTOs, Zod schemas
    /identity         # Auth, users, sessions, OAuth
    /chat             # 1:1 & group messaging
    /conferencing     # Video calls, WebRTC signaling, mediasoup
    /billing          # Subscriptions, Stripe integration
    /notification     # Email, Slack webhooks, BullMQ jobs
  /infra
    /docker           # Dockerfiles for services
  docker-compose.yml
  pnpm-workspace.yaml
```

### DDD Layering (Per Bounded Context)

```
/libs/<context>/
  /domain            # Entities, value objects, domain events, repo interfaces
  /application       # Use cases, commands, queries
  /infrastructure    # Prisma/Mongoose repos, external API adapters
  /interface         # NestJS controllers, Socket.io gateways, DTOs
```

### Key Architectural Decisions

**Multi-Redis Database Logical Separation:**

```
Redis DB 0: Sessions, JWT blocklist, user presence
Redis DB 1: Room/Lobby state, queue positions, waiting lists
Redis DB 2: Rate limiting counters (future)
```

**Database Strategy:**

- PostgreSQL: Strong consistency (users, subscriptions, auth, room metadata)
- MongoDB: High-write volume (chat messages, flexible schema)
- Redis: Ephemeral, fast access (presence, session state, pub/sub)

**BullMQ Queue Organization:**

- `subscription-webhook-processor`: Async Stripe webhook handling (idempotent)
- `email-queue`: Async email delivery
- `notification-queue`: Slack/webhook notifications
- `image-processing-queue`: Video background processing (future)

---

## 5. REFINED 14-PHASE ROADMAP (Incorporating Gemini Insights)

### 🔴 CRITICAL PATH: Phases 1-8 (~14 weeks)

| Phase | Feature                                                                                                                 | Duration | Additions from Gemini Review                                                                                                           |
| ----- | ----------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | Scaffold: Monorepo, Docker, CI/CD, ESLint/Prettier/husky/commitlint                                                     | 1w       | Exact directory structure matching DDD patterns                                                                                        |
| **2** | **Identity**: Register, email verify, login, JWT dual-tokens, OAuth (Google/GitHub), argon2id                           | 2.5w     | Enforce JWT payload validation; token refresh prevents exfiltration                                                                    |
| **3** | **Chat (1:1)**: Socket.io, Mongo, Redis adapter, presence, message history fetch on join                                | 1.5w     | JWT validation on all Socket.io handshakes (security boundary)                                                                         |
| **4** | **Chat (Group)**: Rooms, membership, tier limits, room queries, history on join                                         | 1w       | Room membership enforcement at domain layer; multi-user race condition handling                                                        |
| **5** | **Video (1:1)**: WebRTC P2P signaling, TURN server (coturn), browser APIs                                               | 2w       | Signaling gateway over Socket.io; strict room boundary enforcement                                                                     |
| **6** | **Billing**: Stripe subscriptions, webhook idempotency, tier enforcement, domain events                                 | 2w       | **Key addition:** Return 200 OK immediately, process via `subscription-webhook-processor` BullMQ queue; idempotency by Stripe event ID |
| **7** | **Video (Group)**: mediasoup SFU, recording (basic), Slack notifications, **teams-style lobby with organizer approval** | 2.5w     | **Key addition:** Guest approval system; waiting room with queue position; organizer review modal; Redis db 1 for lobby state          |
| **8** | **Deploy + Polish**: Live demo (Railway/Render), README, architecture diagrams, E2E tests, code coverage                | 1.5w     | Swagger docs, shared DTO validation across stack, deployment documentation                                                             |

**After Phase 8:** Portfolio is complete. Can apply to jobs.

### 🟡 IMPORTANT: Phases 9-11 (Build only if 3+ weeks left)

| Phase  | Feature                                                                   | Duration |
| ------ | ------------------------------------------------------------------------- | -------- |
| **9**  | **Teams**: Team aggregates, membership, shared rooms, team invites        | 2w       |
| **10** | **RBAC**: Owner/Admin/Member roles, permission gates                      | 1.5w     |
| **11** | **Enterprise**: SSO, custom branding, audit logs (90-day), SLA commitment | 2w       |

### 🟢 NICE-TO-HAVE: Phases 12-14 (Design documents only)

| Phase  | Feature                                                                                                       | Why Design Only                                                |
| ------ | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **12** | **API Access & Rate Limiting**: Public REST API, API keys, per-client limits                                  | Design thinking without implementation                         |
| **13** | **Advanced Notifications**: Email digests, push notifications, webhook integrations                           | Integration details, secondary to core                         |
| **14** | **Microservices Extraction**: Chat service, video signaling service, identity gateway, gRPC, Protocol Buffers | Architecture conversation; implement only if senior-level role |

---

## 6. TESTING STRATEGY (TDD Applied Honestly)

### Domain Layer (Red-Green-Refactor, 100% coverage target)

```typescript
// Test pure business logic, no I/O
describe('User subscription limits', () => {
  it('free user can create 1 room only', () => {
    /* ... */
  });
  it('free user has 120 min/month group video', () => {
    /* ... */
  });
  it('pro user has unlimited group participants', () => {
    /* ... */
  });
});
```

### Application Layer (Mocked repos, >80% coverage)

```typescript
// Test use cases with mocked dependencies
describe('UpgradeSubscriptionUseCase', () => {
  it('creates Stripe checkout session', () => {
    /* ... */
  });
  it('publishes SubscriptionCreated event', () => {
    /* ... */
  });
});
```

### Infrastructure Layer (Real Testcontainers, >80% coverage)

```typescript
// Real ephemeral databases in Docker
beforeAll(async () => {
  postgres = await new PostgreSQLContainer().start();
  mongodb = await new MongoDBContainer().start();
  redis = await new RedisContainer().start();
});
```

### Interface Layer (E2E, critical flows only)

```typescript
// HTTP + WebSocket assertions
it('register → verify → login → create room → send message', () => {
  /* ... */
});
it('Stripe webhook is idempotent (fire twice, only one subscription)', () => {
  /* ... */
});
```

---

## 7. CODE QUALITY & GIT CONVENTIONS

### Linting & Formatting (Automated)

- **ESLint 10.6.0** (flat config): Shared rules for backend + frontend
- **Prettier 3.9.4**: Single `.prettierrc` for entire monorepo
- **husky + lint-staged**: Pre-commit hooks; lint only staged files
- **TypeScript strict mode**: No `any`, full type safety

### Git Commit Conventions (Enforced)

```
type(scope): subject

feat(identity): add argon2id password hashing
fix(chat): correct redis adapter reconnection
test(billing): add stripe webhook idempotency tests
docs(architecture): explain DDD bounded contexts
```

**Tools:**

- **commitlint 21.2.0**: Validates commit message format
- **commitizen 4.3.2**: Interactive prompt (optional)
- **Scopes:** identity, chat, conferencing, billing, notification, web, infra, docs

### CI/CD (GitHub Actions)

```
On every push to main:
1. Lint (ESLint + Prettier check)
2. Type check (TypeScript strict mode)
3. Unit tests (Jest, domain + application)
4. Integration tests (Testcontainers, real DBs)
5. Build (NestJS + Next.js)
6. Report coverage
```

---

## 8. DEPLOYMENT & SCALING

### Phase 8 (Monolith)

```
Single Docker container:
  - NestJS backend (all contexts in one process)
  - Next.js static files
  - PostgreSQL (managed, e.g., Railway)
  - MongoDB (managed, e.g., MongoDB Atlas)
  - Redis (managed, e.g., Railway)
  - Coturn TURN server (Docker container)

Platform: Railway.app or Render.com (~$15-30/month)
```

### Phase 14 (Microservices, design only)

```
API Gateway (Identity + Billing):
  ↓ gRPC or NestJS microservices transport
Chat Service (high volume, eventual consistency)
Conferencing Service (low latency)
Notification Service (async)

Orchestration: Kubernetes (designed but not implemented)
```

---

## 9. GEMINI INSIGHTS INTEGRATED

### What We Took

1. **Teams-style Lobby Waiting Room** (Phase 7):
   - Guest joins group video → enters waiting room
   - Organizer sees approval modal
   - Organizer clicks "Approve" → guest gets token
   - Queue position shown in real-time

2. **Webhook + BullMQ Pattern** (Phase 6):
   - Return 200 OK immediately (blocks Stripe retries)
   - Offload to `subscription-webhook-processor` queue
   - Idempotency via BullMQ job ID (Stripe event ID)

3. **Multi-Redis Database Separation**:
   - DB 0: Sessions + presence
   - DB 1: Room/Lobby state + queue

4. **Detailed Phase Checklists**:
   - Break each phase into 5-10 specific tasks
   - Clear acceptance criteria per task

### What We Rejected

- ❌ Nginx Edge Proxy (DevOps, not backend)
- ❌ K3s from start (Phase 14 design only)
- ❌ gRPC in Phase 4 (Phase 14 design only)
- ❌ OpenTelemetry + Jaeger (Phase 14 design only)
- ❌ LiveKit (mediasoup teaches more)
- ❌ MinIO S3 (Phase 8+ stretch, not critical)

---

## 10. INTERVIEW READINESS (What You'll Answer)

By shipping Phases 0-8, you can answer:

| Question                                           | Your Answer                                                                                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **"Why argon2 over bcrypt?"**                      | Memory-hard, OWASP-recommended, prevents GPU/ASIC parallelization attacks                                                                   |
| **"How does JWT refresh token rotation work?"**    | Access token in memory (15m), refresh token in httpOnly cookie (7d), refresh rotates both; prevents exfiltration                            |
| **"How does Socket.io scale across servers?"**     | Redis adapter pub/subs events; one server connects to Redis, broadcasts to all others                                                       |
| **"Why Postgres AND MongoDB?"**                    | Postgres for strong consistency (users, payments), Mongo for high-volume flexible writes (messages)                                         |
| **"How do you prevent duplicate Stripe charges?"** | Webhook idempotency: return 200 immediately, process async via BullMQ with Stripe event ID as job ID; same event → same job → no duplicates |
| **"How does WebRTC signaling work?"**              | Offer/answer SDP exchange, ICE candidates for NAT traversal, TURN server when P2P fails                                                     |
| **"What's an SFU?"**                               | Selective Forwarding Unit; receives each participant's stream, forwards to others; scales better than mesh                                  |
| **"Why modular monolith?"**                        | Feature velocity now, designed for microservice extraction later (each module becomes independent service)                                  |
| **"How would you extract to microservices?"**      | Each bounded context becomes own NestJS service; gRPC for low-latency IPC; Kubernetes for orchestration                                     |

---

## 11. WHAT'S DIFFERENT FROM JAN 2025 PLAN

| Decision                | Then            | Now                             | Why                                                   |
| ----------------------- | --------------- | ------------------------------- | ----------------------------------------------------- |
| **TypeScript**          | 5.9.2 (stable)  | 6.0.3 (transition)              | Shows ecosystem awareness; v7 coming with Go compiler |
| **Jest**                | 29.7.0          | 30.4.2                          | Tested with NestJS 11 now; worth upgrading            |
| **Redis client**        | Considered both | ioredis only                    | Broader version support (2.6.12+); redis only 7.2+    |
| **Turbo.js**            | Not mentioned   | Explicitly rejected             | Scope creep; pnpm + root scripts enough               |
| **Team/Lobby features** | Phase 9         | Phase 7 addition                | Gemini insight; elevates group video experience       |
| **Webhook pattern**     | Generic async   | BullMQ queue + immediate 200 OK | Gemini insight; proper idempotency pattern            |
| **Redis DB separation** | Single shared   | Multi-DB logical separation     | Gemini insight; cleaner architecture                  |

---

## 12. SUCCESS CRITERIA (Final Checkpoint)

### After Phase 8, Your Portfolio Proves:

- ✅ **Backend Architecture:** DDD layering, clear domain boundaries, modular design
- ✅ **Database Competence:** Postgres (ACID, migrations), MongoDB (schema flexibility), Redis (pub/sub)
- ✅ **Real-time Systems:** Socket.io, presence, message history, room state
- ✅ **Authentication:** Password hashing, JWT tokens, OAuth providers, token refresh
- ✅ **Payment Integration:** Stripe, webhook validation, idempotency, tier enforcement
- ✅ **WebRTC:** P2P signaling, SFU concepts, media streaming
- ✅ **Testing:** TDD on domain layer, integration tests with real containers, E2E flows
- ✅ **Code Quality:** Linting, formatting, conventional commits, clear git history
- ✅ **Deployment:** Live demo URL, CI/CD pipeline, production-ready Docker setup
- ✅ **Documentation:** README explains architecture, decisions, trade-offs

### Interview Outcome:

**Interviewer:** "Walk me through how you handle Stripe webhook retries."
**You:** "Return 200 immediately, process async via BullMQ with Stripe event ID as job ID. Same event fires twice? Same job ID, only processes once. This is idempotency."
**Interviewer:** "Good. How does your monolith scale to microservices?"
**You:** "Each bounded context (Identity, Chat, Billing, Conferencing) is already isolated in `/libs`. To extract: give it its own NestJS server, swap Socket.io transport for gRPC, run independently on Kubernetes."
**Interviewer:** "You've thought about this."
**You:** ✅ Hired.

---

## 13. TIMELINE (Realistic with Buffers)

```
Week 1:       Phase 1 (scaffold)
Weeks 2-3.5:  Phase 2 (identity + auth)
Weeks 4-5.5:  Phase 3 (1:1 chat)
Week 6:       Phase 4 (group chat)
Weeks 7-8:    Phase 5 (1:1 video)
Weeks 9-10:   Phase 6 (billing + Stripe)
Weeks 11-12:  Phase 7 (group video + lobby + Slack)
Weeks 13-14:  Phase 8 (deploy + polish)

Buffer: +20-30% for debugging, integration issues, mediasoup learning

If ahead of schedule:
Weeks 15-16:  Phase 9 (teams)
Weeks 17-18:  Phase 10 (RBAC)
Weeks 19-20:  Phase 11 (enterprise)

Ongoing: Phases 12-14 (design docs in README)
```

---

## 14. WHAT YOU NEED NOW

### To Proceed:

✅ **Understand & agree with:**

- Tech stack (validated package versions)
- Architecture (DDD + modular monolith)
- 14-phase roadmap (realistic scope)
- Testing strategy (TDD on domain, integration tests with containers)
- Team/Lobby feature (Phase 7 addition from Gemini)
- Webhook pattern (Phase 6 idempotency improvement)
- Not building Turbo/K8s/gRPC in phases 0-8

✅ **Ready for:**

- Updated PACKAGE_LIST.md (with all July 2026 versions)
- Development Document (detailed DDD design, schemas, API contracts, Phase 0 checklist)
- Phase 0 setup (monorepo, Docker, linting, CI/CD)

---

## 15. FINAL VALIDATION CHECKLIST

Before you start coding, confirm:

- [ ] Goal is clear: Junior Backend Engineer offer via strong portfolio
- [ ] Tech stack is finalized: NestJS 11, Next.js 16, PostgreSQL 17, MongoDB 8, Redis 7.4
- [ ] Package versions approved: All July 2026 latest (except where we rejected upgrades)
- [ ] Architecture understood: DDD layering, modular monolith designed for microservices
- [ ] Roadmap is realistic: 14 weeks critical path (Phases 1-8), 5+ weeks important (9-11)
- [ ] Testing approach accepted: TDD on domain, integration tests with real containers
- [ ] Gemini insights integrated: Lobby approval system, webhook idempotency pattern, multi-Redis DB
- [ ] Know what NOT to build: No Turbo, no K8s in phases 0-8, no gRPC yet, no OpenTelemetry tracing
- [ ] Interview prep mental model: You can walk through architecture, auth, payments, video, testing

**Once all are checked:**
→ Next: Updated PACKAGE_LIST.md (versions finalized)
→ Then: Development Document (detailed design, ready to code)
→ Finally: Phase 0 (start building)

---

## ✅ PROJECT PLAN IS SOLID

You have:

1. **Clear goal** (Junior Backend Engineer offer)
2. **Realistic scope** (14 weeks critical path)
3. **Strong architecture** (DDD + modular monolith)
4. **Modern stack** (NestJS 11, Next.js 16, tested versions)
5. **Interview-winning features** (auth, real-time, payments, video)
6. **Professional practices** (TDD, linting, git conventions, CI/CD)

**Status: in active Phase 0 implementation.** See `DEVELOPMENT_DOCUMENT.md` §8 for the live
setup checklist and §8.2 for implementation notes/lessons learned as they're discovered.
