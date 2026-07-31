# Phase Progress Checklist — Huddle

**Purpose:** For each phase, this is the concrete "target" — what must be true before you move
to the next phase. Each item references the exact section of `DEVELOPMENT_DOCUMENT.md` that
specifies it, so you're never guessing what "done" means.

**How to use this file:** Check items off as you go. Don't move to the next phase until every
box in the current phase is checked. This file is the only thing that grows a little each
phase (checkboxes flipped) — it does not get new prose sections per phase.

**Phase numbering:** This checklist condenses the original 14-phase roadmap's critical path
(Phases 1-8 in `FINAL_PROJECT_REVIEW.md`) into 7 groups below, since some original phases
(e.g. 1:1 chat and group chat) share the same domain code and are easier to verify together.
Mapping:

| This checklist                       | `FINAL_PROJECT_REVIEW.md` roadmap |
| ------------------------------------ | --------------------------------- |
| Phase 0 — Scaffold                   | Phase 1                           |
| Phase 1 — Identity                   | Phase 2                           |
| Phase 2 — Chat (1:1 + Group)         | Phases 3-4                        |
| Phase 3 — Video (1:1)                | Phase 5                           |
| Phase 4 — Billing                    | Phase 6                           |
| Phase 5 — Video (Group + Standalone) | Phase 7                           |
| Phase 6 — Deploy + Polish            | Phase 8                           |

---

## Phase 0 — Scaffold

Target defined in: `DEVELOPMENT_DOCUMENT.md` §8

- [x] `pnpm-workspace.yaml` + root scripts working
- [x] `docker-compose up` brings up Postgres 17, MongoDB 8.0, Redis 7.4
- [x] `apps/api-gateway` (NestJS) and `apps/web` (Next.js) both boot via `pnpm dev`
- [x] Empty `libs/*` folder skeletons exist per §3 directory structure
- [x] ESLint + Prettier + husky + lint-staged + commitlint enforced on commit
- [x] `main` branch protected on GitHub (PR + passing CI required to merge), GitHub Flow adopted
- [x] CI (`ci.yml`) green on a push with no code yet
- [x] `docs/` folder created, all four planning docs moved into it

**Done when:** fresh clone → install → `docker-compose up` → `pnpm dev` → both apps respond.

**Phase 0 complete.** First real commit (`chore: scaffold monorepo structure`) pushed to
`main`; CI (`checkout` → `pnpm install` → `lint` → `typecheck` → `test` → `build`) confirmed
green on GitHub Actions. Branch protection on `main` requires PR + passing CI status check
(deliberately _not_ requiring human approval — solo repo, GitHub disallows self-approval).
Squash-merge is the only enabled merge method, with commit messages defaulting to PR
title + description. Full implementation notes, including several real bugs found and fixed
along the way, are in `DEVELOPMENT_DOCUMENT.md` §8.2 — worth a skim before starting Phase 1,
since a few (the `lint-staged` binary-resolution issue, the pnpm 11 build-approval changes)
are the kind of thing that could resurface in a different form later.

---

## Phase 1 — Identity

Target defined in: `DEVELOPMENT_DOCUMENT.md` §4.1, §6.1 (Identity endpoints)

- [x] `User` entity implemented exactly as specced (register, registerViaOAuth, verifyEmail, verifyPassword)
- [x] `PasswordHash` VO using argon2id
- [x] Prisma schema `identity` namespace migrated (`users`, `oauth_providers`, `refresh_tokens`)
- [ ] All REST endpoints in §6.1 Identity section return correct status codes
- [x] Google + GitHub OAuth flows work end-to-end (manual test)
- [x] Domain-layer unit tests: register, duplicate email, password too short, OAuth pre-verified
- [ ] E2E test: register → verify email → login → receive JWT pair

**Done when:** you can register, verify, log in, refresh token, and OAuth-login via Postman/curl.

OAuth login supports linking multiple providers to one account (`User.oauthProviders` is
a list, not a single slot) — a user can sign in with both Google and GitHub. Linking onto
an existing password-based account by matching email requires **both** sides to be
verified: the OAuth provider must assert the email is verified, _and_ the existing account
must have already completed its own `/auth/verify` flow. This closes an account
pre-hijacking vector (an attacker pre-registering a victim's email with an unverified
password, then inheriting the victim's later legitimate OAuth login). See
`OAuthLoginUseCase` and its spec for the full set of linking/conflict scenarios.

`/auth/verify` is implemented as `GET /auth/verify?token=<token>`, not the
`POST /auth/verify-email {token}` originally specified in `DEVELOPMENT_DOCUMENT.md` §6.1 —
the doc was updated to match, since verification is reached by clicking a link in an actual
email (a browser GET navigation), not a form submission.

---

## Phase 2 — Chat (1:1 + Group)

Target defined in: `DEVELOPMENT_DOCUMENT.md` §4.2, §5.2, §6.1 (Chat), §6.2 (`/chat` namespace)

- [ ] `GroupChatRoom`, `DirectConversation`, `Message` entities implemented
- [ ] Prisma `chat` schema migrated; Mongoose `chat_messages` collection wired
- [ ] `TierLimitCheckPort` + `BillingTierAdapter` implemented (even with Billing stubbed to always return Free limits initially)
- [ ] Group room create/rename/add-member/remove-member enforce domain rules (owner-only, max members)
- [ ] `/chat` Socket.io namespace: `join-room`, `send-message`, `message-received` all work
- [ ] JWT validated on socket handshake; non-members rejected on `join-room`
- [ ] Domain tests: member limit exceeded, owner-only rename, empty message rejected
- [ ] E2E test: two users, 1:1 conversation, messages persist and are retrievable via history endpoint

**Done when:** two browser tabs (different users) can chat 1:1 and in a group room in real time.

---

## Phase 3 — Video (1:1)

Target defined in: `DEVELOPMENT_DOCUMENT.md` §4.3 (`startFromChatRoom`, kind: one-to-one), §6.2 (`webrtc-offer`/`webrtc-answer`/`ice-candidate`)

- [ ] `VideoSession.startFromChatRoom` used with `maxParticipants: 2`
- [ ] coturn TURN server running in Docker, reachable
- [ ] WebRTC signaling gateway relays offer/answer/ICE candidates correctly
- [ ] Frontend `useWebRTCP2P` hook establishes a working peer connection
- [ ] Call can be started from a 1:1 chat thread (`StartCallButton`)
- [ ] Session ends cleanly when either party leaves (`leave()` → auto-end when 0 participants)
- [ ] Domain tests: session full rejection, leave triggers auto-end at 0 participants

**Done when:** two browser tabs can see/hear each other via a call started from the chat UI.

---

## Phase 4 — Billing

Target defined in: `DEVELOPMENT_DOCUMENT.md` §4.4 (incl. §4.4.0 tier table), §5.1 (`Subscription`, `ProcessedWebhookEvent`), §6.1 (Billing endpoints)

- [ ] `Tier` VO with the four enforced limits from §4.4.0
- [ ] `Subscription` entity: createFree, upgradeTo, markPastDue
- [ ] Stripe checkout session creation endpoint works (test mode)
- [ ] Webhook endpoint returns 200 immediately, queues job via `subscription-webhook-processor`
- [ ] Idempotency verified: same Stripe event ID fired twice → only one `TierChangedEvent`, `ProcessedWebhookEvent` row prevents reprocessing
- [ ] `BillingTierAdapter` (stub from Phase 2) replaced with real implementation — Chat/Conferencing limits now reflect actual subscription tier
- [ ] E2E test: upgrade via Stripe test card → tier changes → group room member limit updates accordingly

**Done when:** upgrading tiers in Stripe test mode actually changes what Chat/Conferencing will allow.

---

## Phase 5 — Video (Group + Standalone/Teams-style)

Target defined in: `DEVELOPMENT_DOCUMENT.md` §4.3 (full entity), §5.3 (Redis lobby), §6.2 (lobby events)

- [ ] `VideoSession.startStandalone` implemented with lobby approval
- [ ] mediasoup workers/routers set up; SFU produce/consume working for 3+ participants
- [ ] Lobby flow: `request-entry` → `lobby-pending`/`lobby-queue-updated` → host `approve-guest` → `admitted`
- [ ] Confirm linked-to-chat sessions bypass lobby (domain test from §7 example passes)
- [ ] Group video launched from a group chat room notifies members (`call-started` event on `/chat`)
- [ ] Basic recording: start/stop, `Recording` entity persisted with storage path + duration
- [ ] Slack notification fires on session start (Notification context, BullMQ)
- [ ] E2E test: standalone session, one guest goes through lobby, host approves, guest joins

**Done when:** you can share a standalone meeting link, have a guest wait in a lobby, approve them, and have 3+ people on video together — separately, you can also start a group call directly from a chat room with no lobby step.

---

## Phase 6 — Deploy + Polish

Target defined in: `FINAL_PROJECT_REVIEW.md` Phase 8 row (see mapping table above)

- [ ] Deployed to Railway/Render/Fly.io, live URL works
- [ ] README covers: architecture diagram, setup instructions, feature list, tech decisions
- [ ] E2E test suite green in CI against deployed-equivalent config
- [ ] Code coverage report generated and linked in README
- [ ] Swagger docs available at a `/docs` route

**Done when:** a stranger can open the live URL, register, chat, and start a video call without your help.

---

## Notes on Using This File

- If a phase's implementation reveals the design needs to change, update the relevant section
  of `DEVELOPMENT_DOCUMENT.md` first, _then_ adjust the checklist here — never let this file
  contradict the design doc.
- If you skip the Team/RBAC/Enterprise/microservices phases per the "if time is short"
  guidance in `FINAL_PROJECT_REVIEW.md`, that's fine — this checklist only covers the
  critical path (Phases 1-8 in the original roadmap, condensed to 7 groups here per the
  mapping table at the top of this file).
- This file does not replace tests. A checked box means "implemented and manually verified,"
  not "passes review." The test suite is the actual source of truth for correctness.
