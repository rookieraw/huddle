# Local Development Setup

## Purpose

This document is the authoritative guide for running Huddle in a local development environment.

It covers:

- workspace installation;
- local environment variables;
- infrastructure containers;
- database initialization;
- application startup;
- local verification;
- common environment problems.

Production deployment belongs in [`../operations/deployment.md`](../operations/deployment.md). Dependency ownership and version policy belong in [`dependencies.md`](./dependencies.md).

---

## Current Development Baseline

Huddle is a pnpm workspace containing:

| Path                 | Responsibility                                                  |
| -------------------- | --------------------------------------------------------------- |
| `apps/api-gateway`   | NestJS HTTP, WebSocket, and application composition entry point |
| `apps/web`           | Next.js frontend                                                |
| `libs/identity`      | Identity Bounded Context                                        |
| `libs/chat`          | Chat Bounded Context                                            |
| `libs/conferencing`  | Conferencing Bounded Context                                    |
| `libs/billing`       | Billing Bounded Context                                         |
| `libs/notification`  | Notification Bounded Context                                    |
| `libs/shared-kernel` | Deliberately small shared kernel                                |

The current CI environment uses Node.js 24.

The required pnpm version is defined by the root `package.json` `packageManager` field. Do not maintain a second pnpm version number in this document.

---

## Prerequisites

Install the following before starting:

- Git;
- Node.js 24;
- Corepack or the pnpm version declared by the repository;
- Docker Engine or Docker Desktop;
- Docker Compose.

Docker must be running before executing integration or E2E tests backed by Testcontainers.

### Windows Development

Phase 1 development has been completed on Windows.

Native Windows remains suitable for the current HTTP, Identity, PostgreSQL, and ordinary application work. Before media infrastructure such as coturn or mediasoup becomes active, WSL2 with Docker integration is recommended because the production runtime and media dependencies are Linux-oriented.

Do not maintain separate Windows and WSL clones that edit the same working tree simultaneously.

---

## First-Time Setup

Run workspace-level commands from the repository root.

### 1. Install the workspace package manager

```bash
corepack enable
```

The repository's `packageManager` field determines the pnpm version.

### 2. Install dependencies

For a reproducible installation using the committed lockfile:

```bash
pnpm install --frozen-lockfile
```

Use an ordinary `pnpm install` only when intentionally changing dependencies or regenerating the lockfile.

Approved dependency build scripts are defined in `pnpm-workspace.yaml`. Do not approve a newly requested build script without reviewing the package and recording the decision there.

### 3. Create the local environment file

PowerShell:

```powershell
Copy-Item .env.example .env
```

POSIX shell:

```bash
cp .env.example .env
```

The local `.env` file must not be committed.

Replace development placeholders before exercising the associated functionality, especially:

- `JWT_SECRET`;
- Google OAuth credentials;
- GitHub OAuth credentials.

OAuth callback URLs must continue to match both the local API address and the callback URL registered with the provider.

The authoritative list of required local variables is `.env.example`. This document describes the setup process but does not duplicate the complete variable list.

### 4. Start local infrastructure

```bash
docker compose up -d
```

The current Compose configuration starts:

| Service    | Default host port | Current role                                              |
| ---------- | ----------------: | --------------------------------------------------------- |
| PostgreSQL |            `5432` | Identity persistence; later relational context schemas    |
| MongoDB    |           `27017` | Provisioned for the Chat entry collection                 |
| Redis      |            `6379` | Provisioned for ephemeral and asynchronous infrastructure |

MongoDB and Redis may be running before their corresponding phase begins using them. A running container does not mean that the related feature has already been implemented.

Check container state with:

```bash
docker compose ps
```

### 5. Generate the Identity Prisma Client

```bash
pnpm --dir libs/identity exec prisma generate
```

Prisma reads the repository-root `.env` through `libs/identity/prisma.config.ts`.

### 6. Apply checked-in Identity migrations

```bash
pnpm --dir libs/identity exec prisma migrate deploy
```

`migrate deploy` applies existing migrations without creating a new migration.

Creating a migration is an implementation task and should be done deliberately when the owning context's schema changes, not as part of ordinary startup.

### 7. Start the applications

```bash
pnpm dev
```

The root command starts workspace packages that define a development script.

Default local addresses:

| Application | Address                 |
| ----------- | ----------------------- |
| Web         | `http://localhost:3000` |
| API Gateway | `http://localhost:4000` |

Keep the root terminal running while developing.

---

## Environment Variable Loading

Docker Compose automatically reads the repository-root `.env` for host-port overrides.

The API Gateway loads the same root file through `ConfigModule`.

Identity's Prisma configuration also resolves the root `.env` when Prisma commands are run from `libs/identity`, including commands invoked through:

```bash
pnpm --dir libs/identity exec prisma <command>
```

Do not add context-specific `.env` files unless a later architectural decision explicitly changes this convention.

Production secrets must not be stored in the repository or copied from local development files.

---

## Local Port Allocation

| Service                 | Default | Override                  |
| ----------------------- | ------: | ------------------------- |
| Next.js web application |  `3000` | Application configuration |
| NestJS API Gateway      |  `4000` | `PORT`                    |
| PostgreSQL host port    |  `5432` | `POSTGRES_HOST_PORT`      |
| MongoDB host port       | `27017` | `MONGO_HOST_PORT`         |
| Redis host port         |  `6379` | `REDIS_HOST_PORT`         |

If a database port is already in use, change its host-side value in `.env`. Internal container ports remain unchanged.

When changing the PostgreSQL host port, update `DATABASE_URL` to match.

Future coturn and mediasoup port ranges must be documented when their executable configuration is introduced. Planned values are not active local setup requirements.

---

## Routine Commands

Run these commands from the repository root unless stated otherwise.

| Command               | Purpose                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`            | Start applications in development mode                                  |
| `pnpm build`          | Build all workspace packages that define a build script                 |
| `pnpm typecheck`      | Type-check all participating packages                                   |
| `pnpm test`           | Run each package's default test suite                                   |
| `pnpm lint`           | Run package lint scripts                                                |
| `docker compose ps`   | Inspect local infrastructure                                            |
| `docker compose stop` | Stop containers without removing them                                   |
| `docker compose down` | Remove containers and the Compose network while retaining named volumes |

Some current lint scripts include automatic fixes. Review the working tree after running `pnpm lint`.

The root `pnpm test` command does not replace the explicit integration and E2E commands below.

---

## Integration and E2E Verification

### Identity integration tests

```bash
pnpm --filter @huddle/identity test:integration
```

These tests use Testcontainers and create an ephemeral PostgreSQL container. They do not depend on the persistent PostgreSQL container from `docker-compose.yml`.

### API Gateway E2E tests

Build the workspace first so the test resolves context packages through their compiled runtime exports:

```bash
pnpm build
pnpm --filter api-gateway test:e2e
```

The E2E suite also requires Docker because it uses Testcontainers.

The complete testing strategy is defined in [`testing.md`](./testing.md).

---

## Stopping the Environment

Stop applications with the terminal interrupt command, then stop infrastructure without deleting local data:

```bash
docker compose stop
```

To remove Compose containers while retaining named data volumes:

```bash
docker compose down
```

Using `docker compose down --volumes` deletes the local PostgreSQL, MongoDB, and Redis volumes. Treat it as a destructive reset and use it only when the stored local data is intentionally disposable.

---

## Troubleshooting

### A default port is already in use

Change the relevant host-port override in `.env`.

On Windows, the process using a port can be inspected with:

```powershell
Get-NetTCPConnection -LocalPort 5432
```

Replace `5432` with the conflicting port.

Remember to keep `DATABASE_URL` consistent with `POSTGRES_HOST_PORT`.

### Prisma cannot resolve `DATABASE_URL`

Confirm that:

1. `.env` exists at the repository root;
2. `DATABASE_URL` is defined;
3. the Prisma command is executed through `libs/identity`;
4. PostgreSQL is reachable when running a migration.

Client generation requires the variable to be present because Prisma configuration validates it, even when generation does not connect to the database.

### Prisma Client cannot be imported

Regenerate the context-owned client:

```bash
pnpm --dir libs/identity exec prisma generate
```

Then rebuild the workspace:

```bash
pnpm build
```

### Testcontainers cannot start

Confirm that Docker is running and accessible from the current shell.

When using WSL2, confirm that Docker integration is enabled for the selected distribution.

### A package build script is blocked during installation

Review the package before changing `pnpm-workspace.yaml`.

The `allowBuilds` section is the authoritative allow-or-deny list. Do not restore obsolete pnpm build-approval fields in `package.json`.

### A filtered Jest pattern is ignored

Separate pnpm arguments from Jest arguments with `--`:

```bash
pnpm --filter @huddle/identity test -- <pattern>
```

### The applications start but OAuth fails

Confirm that:

- real provider credentials replaced the placeholders;
- the callback URL registered with the provider exactly matches `.env`;
- the callback uses the API Gateway address rather than the frontend address.

---

## Source-of-Truth Boundaries

| Information                                              | Authoritative source                       |
| -------------------------------------------------------- | ------------------------------------------ |
| Direct dependency declarations                           | Owning `package.json`                      |
| Exact resolved dependency graph                          | `pnpm-lock.yaml`                           |
| Workspace membership and dependency build approval       | `pnpm-workspace.yaml`                      |
| Required local environment variables                     | `.env.example`                             |
| Infrastructure images, ports, health checks, and volumes | `docker-compose.yml`                       |
| Identity relational schema and migrations                | `libs/identity/src/infrastructure/prisma/` |
| CI runtime and command sequence                          | `.github/workflows/ci.yml`                 |
| Dependency policy                                        | `docs/engineering/dependencies.md`         |
| Test strategy                                            | `docs/engineering/testing.md`              |
| Production deployment                                    | `docs/operations/deployment.md`            |

When executable configuration and prose disagree, verify whether the configuration changed intentionally. Update this guide in the same change rather than preserving a conflicting duplicate.
