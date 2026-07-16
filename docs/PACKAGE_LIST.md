# Final Package List — Huddle (Full-Stack Chat & Video Conferencing App)

**Companion docs:** `FINAL_PROJECT_REVIEW.md`, `DEVELOPMENT_DOCUMENT.md`
**Date:** July 2026 — versions below reflect what is **actually installed** as of Phase 0,
Step 8, verified against the npm registry at each install point (not just planning-time
estimates). Where a package hasn't been installed yet (later-phase dependencies like
`mediasoup`, `stripe`, `@prisma/client`), the version listed is the last-verified registry
value at planning time — re-verify against the registry immediately before actually installing
it, since drift has been the norm, not the exception, throughout this project so far.

**Verification note:** every version in this document has been checked directly against
`registry.npmjs.org`, not just searched/recalled. This has repeatedly found real errors:
`@nestjs/config@4.1.0` (real latest at the time: `4.0.4`), `jsonwebtoken@9.0.10` (real latest:
`9.0.3`), `mediasoup-client@3.21.1` (real latest: `3.21.0`) didn't exist at all; `@nestjs/swagger`
and `@nestjs/bullmq` were significantly stale; and during actual Phase 0 install, `prettier`
and `@commitlint/cli` were each found one patch version behind what this doc originally listed.
If in doubt, the reliable check is `curl -s https://registry.npmjs.org/<package-name> | grep '"latest"'`
— not this document, and not a web search — since a doc is a snapshot the moment it's written,
and registries move continuously.

---

## Versioning Strategy: Exact Pin vs. Caret Range

Not every package is pinned the same way. Two tiers:

| Tier                   | Rule                                                                                                  | Why                                                                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Exact pin** (no `^`) | Framework packages with cross-package version coupling, or a history of breaking minor/patch releases | `@nestjs/*` must all move together as a group; TypeScript and mediasoup have both broken projects on seemingly-safe version bumps before           |
| **Caret range** (`^`)  | Everything else                                                                                       | Low architectural risk — a patch/minor bump fixing a security issue or bug shouldn't require you to manually notice and hand-edit a version number |

**`pnpm-lock.yaml` is the real reproducibility mechanism either way** — once you run
`pnpm install`, the exact resolved version of every package (including transitive
dependencies) is frozen in the lockfile, regardless of which range is declared in
`package.json`. Exact-pinning in `package.json` on top of that is only worth doing where you
specifically want to _block_ `pnpm update` from silently moving a package, not as the primary
guarantee of reproducibility.

---

## Actually Installed — Root Workspace Tooling (Phase 0, Steps 1-8)

This section reflects real, verified `pnpm add` results — not a plan, an install log.

### Package Manager

```
pnpm — pinned via Corepack's `packageManager` field in root package.json (not hardcoded in
prose; run `corepack use pnpm@latest` once, which writes the real, current, exact version —
this project resolved to pnpm@11.10.0 with a SHA-pinned integrity hash)
```

Note: an earlier install briefly introduced a duplicate, conflicting `devEngines.packageManager`
field (auto-added by pnpm itself during an unrelated `pnpm add`) — removed, since
`packageManager` was already established as the single source of truth in Step 1.

**Build-approval settings (`allowBuilds` in `pnpm-workspace.yaml`) — confirmed correct
mechanism for pnpm 11:** pnpm 11 removed the older `onlyBuiltDependencies` /
`neverBuiltDependencies` / `ignoredBuiltDependencies` / `ignoreDepScripts` settings entirely,
and no longer reads a `"pnpm"` field from `package.json` at all — `allowBuilds` in
`pnpm-workspace.yaml` is now the only mechanism. Every package with a postinstall/build script
gets explicitly reviewed and set to `true` or `false` (pnpm auto-adds a placeholder entry for
anything flagged during install, specifically so it gets a deliberate decision rather than
being silently skipped):

```yaml
allowBuilds:
  sharp: true # Next.js image optimization — functionally required
  unrs-resolver: true # module resolution used by ESLint tooling — functionally required
  msgpackr-extract:
    true # native accel for bullmq's msgpack job serialization (via
    # @nestjs/bullmq); has a working pure-JS fallback either way, but
    # will be genuinely exercised once Phase 6 builds the billing
    # webhook queue
  '@scarf/scarf':
    false # pure telemetry beacon (via @nestjs/swagger's dependency tree,
    # "like Google Analytics for your npm packages" per its own
    # description) — no functional relationship to Swagger's actual
    # documentation-generation behavior, denied deliberately
```

`msgpackr-extract` and `@scarf/scarf` only surfaced during the first CI run (Linux,
`ubuntu-latest`) — not during local Windows installs — because `msgpackr-extract` ships
platform-specific optional native binaries, and different platforms resolve different
optional variants requiring a build step. Worth expecting more platform-specific surprises
like this the first time any new environment (a CI runner, a teammate's machine, WSL2) installs
this project's dependencies.

### Linting & Formatting Toolchain (root-level, governs `libs/*`; `apps/*` keep their own configs)

| Package                  | Installed version | Notes                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eslint`                 | `10.6.0`          | Root, all six `libs/*`, and `apps/api-gateway`. **Exception: `apps/web` pins `^9.39.5`** — see below.                                                                                                                                                                                                                                                                                                      |
| `@eslint/js`             | `10.0.1`          | Initial install resolved a stale `9.39.4` (pnpm's `minimumReleaseAge` safety default held back the just-published 10.x); corrected via `pnpm up -L -w`.                                                                                                                                                                                                                                                    |
| `typescript-eslint`      | `8.63.0`          | Same stale-resolution issue as `@eslint/js`; corrected alongside it. Declares peer support for `eslint@^10.0.0`, confirmed before upgrading.                                                                                                                                                                                                                                                               |
| `eslint-plugin-prettier` | `^5.5.6`          |                                                                                                                                                                                                                                                                                                                                                                                                            |
| `eslint-config-prettier` | `^10.1.8`         |                                                                                                                                                                                                                                                                                                                                                                                                            |
| `globals`                | `^17.7.0`         |                                                                                                                                                                                                                                                                                                                                                                                                            |
| `prettier`               | `^3.9.5`          | **Must be installed as a direct dependency**, not left as a transitive dependency of `eslint-plugin-prettier`/`eslint-config-prettier` — under pnpm's strict `node_modules` layout, only direct dependencies get their binaries symlinked into `node_modules/.bin`, which is what `pnpm exec`/`lint-staged` actually resolve against. Version bumped from originally-planned `3.9.4` (stale by one patch). |

**Why `apps/web` pins `eslint@^9.39.5` instead of the monorepo's `10.6.0`:** `eslint-plugin-react`
(pulled in transitively via `eslint-config-next`) has no release supporting ESLint 10 — its own
peer dependency range caps at `eslint: '^9.7'` even in its current latest version, and there's
no newer release in progress (checked npm dist-tags directly). ESLint 10 changed its internal
rule-context API (removed the old `context.getFilename()` method), which `eslint-plugin-react`
still calls internally, causing a hard crash under ESLint 10. This is a genuine upstream gap,
not a misconfiguration — pnpm workspaces resolve each package's dependencies independently, so
this one-package exception coexists without conflict. Revisit once `eslint-plugin-react` (or
Next's ESLint tooling more broadly) ships ESLint 10 support.

### Git Hooks & Commit Conventions (Step 8)

| Package                           | Installed version                                                    |
| --------------------------------- | -------------------------------------------------------------------- |
| `husky`                           | `^9.1.7`                                                             |
| `lint-staged`                     | `^17.0.8`                                                            |
| `@commitlint/cli`                 | `^21.2.1` (bumped from originally-planned `21.2.0`, one patch stale) |
| `@commitlint/config-conventional` | `^21.2.0`                                                            |
| `commitizen`                      | `^4.3.2`                                                             |
| `cz-conventional-changelog`       | `^3.3.0`                                                             |

**Husky v9 setup note:** use `pnpm exec husky init`, not `pnpm dlx husky init` — once husky is
a real pinned dependency (added via `pnpm add -D -w husky@^9.1.7`), `dlx` would fetch and run
whatever's currently latest on the registry instead of the version actually pinned in this
project, reintroducing the same "which version actually ran" ambiguity already fixed once via
the `devEngines`/`packageManager` cleanup above.

---

## Installation Command (Monorepo Root) — Original Plan, Phases 1+

The commands below are the **original Phase 1+ plan** for later-phase dependencies (Identity,
Chat, Conferencing, Billing). Re-verify every version against the registry immediately before
actually running each install — this project has found real drift or nonexistent versions on
more than half of the doc revisions so far, so treat this as a draft to check, not a source of
truth to trust at face value.

```bash
# --- Exact pins: NestJS family (must move in lockstep), TypeScript, Prisma, mediasoup ---
pnpm add --save-prod \
  @nestjs/common@11.1.27 \
  @nestjs/core@11.1.27 \
  @nestjs/platform-express@11.1.27 \
  @nestjs/microservices@11.1.27 \
  @nestjs/websockets@11.1.27 \
  @nestjs/platform-socket.io@11.1.27 \
  @nestjs/config@4.0.4 \
  @nestjs/jwt@11.0.2 \
  @nestjs/passport@11.0.5 \
  @nestjs/swagger@11.4.5 \
  @nestjs/bullmq@11.0.4 \
  @prisma/client@7.8.0 \
  @prisma/adapter-pg@7.8.0 \
  mediasoup@3.21.0 \
  mediasoup-client@3.21.0

# --- Caret ranges: everything else, low risk to auto-update within range ---
pnpm add --save-prod \
  reflect-metadata@^0.2.2 \
  rxjs@^7.8.2 \
  class-validator@^0.15.1 \
  class-transformer@^0.5.1 \
  zod@^4.4.3 \
  helmet@^8.2.0 \
  passport@^0.7.0 \
  passport-jwt@^4.0.1 \
  passport-google-oauth20@^2.0.0 \
  passport-github2@^0.1.12 \
  jsonwebtoken@^9.0.3 \
  argon2@^0.44.0 \
  socket.io@^4.8.3 \
  socket.io-client@^4.8.3 \
  @socket.io/redis-adapter@^8.3.0 \
  ioredis@^5.11.1 \
  bullmq@^5.79.2 \
  stripe@^22.3.0 \
  mongoose@^9.7.3 \
  dotenv@^17.4.2 \
  nodemailer@^9.0.3

pnpm add --save-dev \
  typescript@6.0.3 \
  prisma@7.8.0

pnpm add --save-dev \
  @types/node@^26.1.0 \
  ts-loader@^9.6.2 \
  ts-node@^10.9.2 \
  jest@^30.4.2 \
  ts-jest@^29.4.11 \
  @nestjs/testing@11.1.27 \
  supertest@^7.2.2 \
  @testcontainers/postgresql@^12.0.4 \
  @testcontainers/mongodb@^12.0.4 \
  @testcontainers/redis@^12.0.4 \
  @types/jest@^30.0.0 \
  @types/supertest@^7.2.0 \
  @types/express@^5.0.6 \
  @types/passport-jwt@^4.0.1 \
  @types/passport-google-oauth20@^2.0.17 \
  @types/passport-github2@^1.2.9

# Frontend (apps/web) — Next.js/React pinned exact (framework coupling), rest caret
pnpm add --save-prod \
  next@16.2.10 \
  react@19.2.7 \
  react-dom@19.2.7

pnpm add --save-prod \
  tailwindcss@^4.3.2 \
  @tanstack/react-query@^5.101.2 \
  socket.io-client@^4.8.3 \
  zod@^4.4.3
```

**Note on `@nestjs/testing` and `prisma` (CLI):** kept as exact pins even though they're
devDependencies, because they must match their runtime counterparts (`@nestjs/core`,
`@prisma/client`) exactly to avoid subtle API mismatches during test runs and codegen.

---

## Complete Reference by Category

_Versions below are what was verified current at planning time for not-yet-installed
packages, and actual installed versions for anything already in the project (Steps 1-8 above
take precedence over this table for anything covered there — e.g. `prettier`, `eslint`,
`typescript-eslint` versions here reflect what's really installed, not the original plan)._

### Backend Core (NestJS)

| Package                      | Version |
| ---------------------------- | ------- |
| `@nestjs/common`             | 11.1.27 |
| `@nestjs/core`               | 11.1.27 |
| `@nestjs/platform-express`   | 11.1.27 |
| `@nestjs/microservices`      | 11.1.27 |
| `@nestjs/websockets`         | 11.1.27 |
| `@nestjs/platform-socket.io` | 11.1.27 |
| `@nestjs/config`             | 4.0.4   |
| `@nestjs/swagger`            | 11.4.5  |
| `@nestjs/bullmq`             | 11.0.4  |
| `@nestjs/testing`            | 11.1.27 |
| `reflect-metadata`           | 0.2.2   |
| `rxjs`                       | 7.8.2   |

### Auth & Security

| Package                   | Version |
| ------------------------- | ------- |
| `@nestjs/jwt`             | 11.0.2  |
| `@nestjs/passport`        | 11.0.5  |
| `passport`                | 0.7.0   |
| `passport-jwt`            | 4.0.1   |
| `passport-google-oauth20` | 2.0.0   |
| `passport-github2`        | 0.1.12  |
| `jsonwebtoken`            | 9.0.3   |
| `argon2`                  | 0.44.0  |
| `helmet`                  | 8.2.0   |

### Databases & ORMs

| Package              | Version |
| -------------------- | ------- |
| `@prisma/client`     | 7.8.0   |
| `@prisma/adapter-pg` | 7.8.0   |
| `prisma` (CLI, dev)  | 7.8.0   |
| `mongoose`           | 9.7.3   |

### Real-time & Caching

| Package                    | Version |
| -------------------------- | ------- |
| `socket.io`                | 4.8.3   |
| `socket.io-client`         | 4.8.3   |
| `@socket.io/redis-adapter` | 8.3.0   |
| `ioredis`                  | 5.11.1  |
| `bullmq`                   | 5.79.2  |

**Redis client decision (confirmed):** `ioredis@5.11.1` only. The `redis` npm package
(v5.12.1 / v6.1.0) was evaluated and rejected — both versions officially list support for
Redis 7.2.z/7.4.z/8.0.z only, while ioredis's own README states "Supports Redis >= 2.6.12.
Completely compatible with Redis 7.x." Broader support, zero risk with your Redis 7.4 Docker
image, proven at scale. `redis` package is not installed anywhere in this project.

### Video Conferencing (WebRTC)

| Package            | Version |
| ------------------ | ------- |
| `mediasoup`        | 3.21.0  |
| `mediasoup-client` | 3.21.0  |

### Payments

| Package  | Version |
| -------- | ------- |
| `stripe` | 22.3.0  |

### Validation

| Package             | Version |
| ------------------- | ------- |
| `class-validator`   | 0.15.1  |
| `class-transformer` | 0.5.1   |
| `zod`               | 4.4.3   |

### Email

| Package      | Version |
| ------------ | ------- |
| `nodemailer` | 9.0.3   |

### Config

| Package  | Version |
| -------- | ------- |
| `dotenv` | 17.4.2  |

### Frontend

| Package                 | Version |
| ----------------------- | ------- |
| `next`                  | 16.2.10 |
| `react`                 | 19.2.7  |
| `react-dom`             | 19.2.7  |
| `tailwindcss`           | 4.3.2   |
| `@tanstack/react-query` | 5.101.2 |

### Development Tools — Actually Installed (see full detail in "Actually Installed" section above)

| Package                           | Version | Scope                                                                |
| --------------------------------- | ------- | -------------------------------------------------------------------- |
| `typescript`                      | 6.0.3   | Root/`api-gateway` (exact pin). `apps/web` also uses `6.0.3`, exact. |
| `ts-loader`                       | ^9.6.2  | `api-gateway`                                                        |
| `ts-node`                         | ^10.9.2 | `api-gateway`                                                        |
| `eslint`                          | 10.6.0  | Root, `libs/*`, `api-gateway`                                        |
| `eslint`                          | ^9.39.5 | `apps/web` only — see exception note above                           |
| `@eslint/js`                      | 10.0.1  | Root (governs `libs/*`)                                              |
| `typescript-eslint`               | 8.63.0  | Root (governs `libs/*`)                                              |
| `eslint-plugin-prettier`          | ^5.5.6  | Root                                                                 |
| `eslint-config-prettier`          | ^10.1.8 | Root                                                                 |
| `globals`                         | ^17.7.0 | Root                                                                 |
| `prettier`                        | ^3.9.5  | Root, direct dependency (see note above on why this must be direct)  |
| `husky`                           | ^9.1.7  | Root                                                                 |
| `lint-staged`                     | ^17.0.8 | Root                                                                 |
| `@commitlint/cli`                 | ^21.2.1 | Root                                                                 |
| `@commitlint/config-conventional` | ^21.2.0 | Root                                                                 |
| `commitizen`                      | ^4.3.2  | Root                                                                 |
| `cz-conventional-changelog`       | ^3.3.0  | Root                                                                 |

### Testing (Phase 1+, not yet installed)

| Package                      | Version |
| ---------------------------- | ------- |
| `jest`                       | 30.4.2  |
| `ts-jest`                    | 29.4.11 |
| `supertest`                  | 7.2.2   |
| `@testcontainers/postgresql` | 12.0.4  |
| `@testcontainers/mongodb`    | 12.0.4  |
| `@testcontainers/redis`      | 12.0.4  |

### Type Definitions

| Package                          | Version |
| -------------------------------- | ------- |
| `@types/node`                    | 26.1.0  |
| `@types/jest`                    | 30.0.0  |
| `@types/supertest`               | 7.2.0   |
| `@types/express`                 | 5.0.6   |
| `@types/passport-jwt`            | 4.0.1   |
| `@types/passport-google-oauth20` | 2.0.17  |
| `@types/passport-github2`        | 1.2.9   |

---

## Key Version Decisions & Rationale

| Package            | Choice                                          | Why                                                                                                                                                                                                                                                                                                                                           |
| ------------------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TypeScript**     | 6.0.3                                           | Transition release preparing for the native Go-based compiler in v7. Ecosystem (NestJS 11, ts-jest 29.4.11) has caught up in the 6 months since 5.9 was current. Required real fixes on install: explicit `rootDir`, explicit `types` array (no longer auto-includes `@types/*`), `baseUrl` deprecation — see `DEVELOPMENT_DOCUMENT.md` §8.2. |
| **Jest**           | 30.4.2                                          | Major bump from 29, but tested compatible with NestJS 11 `@nestjs/testing`. Test thoroughly on first install.                                                                                                                                                                                                                                 |
| **ioredis**        | 5.11.1 (not `redis`)                            | Broadest Redis server version support (2.6.12+), confirmed via README. `redis` package only supports 7.2.z+.                                                                                                                                                                                                                                  |
| **Testcontainers** | 12.0.4                                          | Jumped two majors (10→12) since original evaluation — check release notes for API changes before writing infra-layer tests.                                                                                                                                                                                                                   |
| **Turbo.js**       | Not used                                        | Explicitly rejected — monorepo is small (2 apps + 6 libs), `pnpm -r --parallel run <script>` is sufficient and adds zero extra tooling/debugging surface.                                                                                                                                                                                     |
| **redis (Docker)** | 7.4-alpine                                      | Matches `ioredis`'s "completely compatible" claim; no reason to jump to Redis 8 licensing changes for a portfolio project.                                                                                                                                                                                                                    |
| **Prisma**         | 7.8.0                                           | Latest with driver adapter model (`@prisma/adapter-pg`), supports multi-schema separation used in `DEVELOPMENT_DOCUMENT.md` §5.1.                                                                                                                                                                                                             |
| **pnpm**           | Not hardcoded here                              | Ships new releases very frequently (often weekly) — hardcoding a number in prose goes stale within days. Pinned instead via Corepack's `packageManager` field in root `package.json`.                                                                                                                                                         |
| **ESLint**         | 10.6.0 everywhere except `apps/web` (`^9.39.5`) | `eslint-plugin-react` (via `eslint-config-next`) has no ESLint 10 support yet — genuine upstream gap, not a mistake. See detail above.                                                                                                                                                                                                        |

---

## Docker Images

```yaml
services:
  postgres:
    image: postgres:17-alpine
  mongodb:
    image: mongo:8.0-noble
  redis:
    image: redis:7.4-alpine
  coturn:
    image: coturn/coturn:latest # TURN server, Phase 5 (1:1 video NAT traversal)
```

**Note on `mongo:8.0-noble`:** unlike Postgres and Redis, the official MongoDB image does not
publish Alpine variants — only Ubuntu-based tags (`noble` = Ubuntu 24.04). `mongo:8.0-alpine`
does not exist and will fail to pull (`failed to resolve reference`). `mongo:8.0-noble` is the
correct, current official tag.

**Port note:** Postgres's host-side port is configurable via `POSTGRES_HOST_PORT` (defaults to
`5432`) to avoid colliding with a local Postgres install — see `DEVELOPMENT_DOCUMENT.md` §8.1
for the full local-development port allocation table.

---

## Verification After Install

```bash
pnpm list --depth=0
pnpm dedupe --check
pnpm exec tsc --version        # should print 6.0.3
pnpm exec nest --version       # should print 11.x
pnpm exec next --version       # should print 16.2.10
```

---

## Status

✅ Phase 0 root tooling (Steps 1-8): versions above reflect **actual, verified installs**, not
just plans.
⚠️ Phase 1+ package versions (Identity, Chat, Conferencing, Billing): last verified at planning
time — **re-check against the registry immediately before installing**, given the drift found
repeatedly in this project so far.
✅ Consistent with `FINAL_PROJECT_REVIEW.md` and `DEVELOPMENT_DOCUMENT.md`.
