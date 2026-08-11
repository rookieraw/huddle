# Portfolio Deployment

Status: Planned target; not yet an executable deployment procedure  
Platform terms last verified: 2026-08-07

## Purpose

This document defines Huddle's Portfolio deployment environment and the operational contract that the executable deployment configuration must satisfy.

It covers:

- target hosting topology;
- public and private network boundaries;
- deployment sequencing;
- persistence and backup requirements;
- rollback expectations;
- ARM64 validation;
- future service-extraction deployment paths.

Local development belongs in [`../engineering/setup.md`](../engineering/setup.md).

Incident response and recurring operational procedures belong in [`runbook.md`](./runbook.md).

The rationale for choosing this topology belongs in [ADR 0007](../decisions/0007-portfolio-deployment-topology.md).

---

## Current Readiness

The accepted target is an OCI Always Free deployment, but the repository does not yet contain a complete production deployment.

The current `docker-compose.yml` is for local infrastructure only. It must not be represented as a production deployment definition.

As of this document revision, the repository does not yet provide:

- production application Dockerfiles;
- production Docker Compose configuration;
- reverse-proxy configuration;
- automated OCI provisioning;
- deployed health and readiness checks;
- exercised backup and restore scripts;
- exercised rollback automation;
- coturn production configuration;
- mediasoup production network configuration.

These artifacts are introduced incrementally by the active delivery phases.

Phase 2.5 owns the initial deployable HTTP and Chat foundation. Phase 3 adds media infrastructure. Phase 4 exercises the complete Portfolio Release procedure.

Until Phase 2.5 is complete, the workflow in this document is a required deployment contract, not a claim that every command has already been automated.

---

## Accepted Platform

The Portfolio environment targets one OCI Ampere A1 Linux virtual machine in the tenancy's home region.

The current Oracle Always Free documentation lists an aggregate allowance equivalent to:

- 2 Ampere A1 OCPUs;
- 12 GB memory;
- Always Free block-storage capacity shared across eligible boot and block volumes.

The OCI Console is authoritative for the account's actual limits and eligibility at provisioning time.

Do not assume that an old blog post, tutorial, or previous OCI allowance remains current.

The deployment is:

- ARM64;
- single host;
- Docker Compose based;
- intended for low-traffic portfolio demonstration;
- operated by one developer;
- designed without a production SLA.

It does not claim:

- high availability;
- zero-downtime deployment;
- horizontal scaling;
- multi-region recovery;
- independent datastore failure isolation;
- production media capacity.

---

## Target Topology

The accepted logical deployment is:

```text
Internet
  |
  +-- HTTPS / WebSocket --> Reverse Proxy
  |                          |
  |                          +-- Next.js
  |                          |
  |                          +-- NestJS API Gateway
  |
  +-- WebRTC media --------> mediasoup
  |
  +-- TURN traffic --------> coturn

Private container network
  |
  +-- PostgreSQL
  +-- MongoDB
  +-- Redis
  +-- Application workers when a real consumer exists
```

All components initially run on the same OCI VM.

Colocation reduces cost and operational surface area, but it also makes the VM a single failure domain.

The complete architectural rationale and rejected alternatives are recorded in [ADR 0007](../decisions/0007-portfolio-deployment-topology.md).

---

## Deployment Stages

### Stage 1 — Phase 2.5 Foundation

Deploy:

- reverse proxy;
- Next.js;
- NestJS API Gateway;
- PostgreSQL;
- MongoDB;
- Redis.

Validate:

- ARM64 application images;
- HTTPS;
- HTTP health;
- WebSocket upgrade;
- authenticated Chat traffic;
- persistence across container recreation;
- migration execution;
- rollback.

Do not expose coturn or mediasoup ports during this stage.

### Stage 2 — Phase 3 Media Infrastructure

Add:

- coturn;
- mediasoup;
- media-related application configuration;
- required UDP and TCP ingress;
- TURN credential generation;
- media health and capacity evidence.

Validate:

- direct peer-to-peer WebRTC;
- TURN-relayed direct calls;
- mediasoup group voice;
- mediasoup group video;
- participant join and leave;
- session termination;
- ARM64 native dependencies;
- CPU, memory, and network behavior.

### Stage 3 — Phase 4 Portfolio Release

Add and validate:

- Stripe Checkout;
- Stripe webhook receipt;
- durable webhook Inbox processing;
- BullMQ workers;
- real Billing entitlements;
- backup and restore exercise;
- deployment rollback exercise;
- repeatable Free-to-Pro demonstration.

Meetings and Notification remain later delivery phases.

---

## Public Network Exposure

Network access must be permitted consistently at all applicable layers:

1. OCI Virtual Cloud Network or Network Security Group;
2. operating-system firewall;
3. Docker port publication;
4. reverse-proxy routing;
5. application origin and authentication policy.

Opening a port at only one layer is insufficient.

### Phase 2.5 Public Ingress

| Port | Protocol | Purpose             | Exposure                             |
| ---: | -------- | ------------------- | ------------------------------------ |
|   22 | TCP      | Administrative SSH  | Restricted by source where practical |
|   80 | TCP      | Redirect to HTTPS   | Public                               |
|  443 | TCP      | HTTPS and WebSocket | Public                               |

SSH must use key-based authentication.

Password-based SSH login and direct root login should be disabled where supported by the selected host image.

### Phase 3 Media Ingress

| Port or range             | Protocol                                | Purpose               | Status                                                 |
| ------------------------- | --------------------------------------- | --------------------- | ------------------------------------------------------ |
| 3478                      | UDP and TCP                             | TURN listener         | Planned for Phase 3                                    |
| 5349                      | TCP and UDP where configured            | TURN over TLS or DTLS | Optional; decided with executable coturn configuration |
| mediasoup transport range | UDP, with TCP fallback where configured | SFU media             | Must be defined and validated in Phase 3               |
| TURN relay range          | UDP and TCP as configured               | Relayed media         | Must be defined and validated in Phase 3               |

The exact mediasoup and TURN relay ranges must come from committed executable configuration before the ports are opened.

Do not copy generic internet examples with unnecessarily broad ranges.

### Private Services

The following must not be publicly reachable:

- PostgreSQL;
- MongoDB;
- Redis;
- internal NestJS ports;
- application worker ports;
- Docker daemon;
- container-management interfaces;
- debug endpoints;
- metrics endpoints not protected by an explicit access policy.

Databases may publish host ports in local development. That does not authorize equivalent publication in the Portfolio deployment.

---

## DNS, HTTPS, and Reverse Proxy

The deployed environment requires:

- a controlled domain or subdomain;
- DNS resolving to the OCI public address;
- a valid TLS certificate;
- HTTP-to-HTTPS redirect;
- WebSocket upgrade forwarding;
- forwarding of the original host and protocol;
- request-size and timeout settings appropriate to the implemented APIs;
- explicit frontend origin configuration;
- restricted production CORS.

The reverse proxy is the public HTTP boundary.

Next.js and the NestJS API Gateway should remain reachable through the private container network rather than through independent public host ports.

The selected reverse-proxy implementation and its executable configuration become authoritative when added to the repository.

---

## Host Preparation Contract

Host preparation remains manual until automation is implemented.

The prepared host must provide:

- a supported ARM64 Linux image;
- a non-root deployment user;
- key-based SSH access;
- current security updates;
- Docker Engine;
- Docker Compose;
- a deployment directory owned by the deployment user;
- persistent storage for PostgreSQL and MongoDB;
- sufficient free disk space for images, data, logs, and temporary backups;
- time synchronization;
- configured OCI and operating-system firewall rules;
- a documented way to inspect logs and service state.

Administrative actions on the OCI account and host are performed by the project owner.

Secrets must not be entered into shell history when a safer injection mechanism is available.

---

## Required Production Artifacts

Phase 2.5 must introduce committed executable artifacts for:

- Next.js production image;
- NestJS API Gateway production image;
- production Docker Compose topology;
- reverse proxy;
- container health checks;
- production environment-variable template;
- migration execution;
- application startup;
- application shutdown;
- ARM64 image validation.

Phase 3 must add executable artifacts for:

- coturn;
- mediasoup networking;
- announced public media address;
- TURN credential configuration;
- media port ranges;
- media health verification.

Documentation must link to these files after they exist. It must not duplicate their complete configuration.

---

## Configuration Environments

Huddle distinguishes:

| Environment | Purpose                                    |
| ----------- | ------------------------------------------ |
| Local       | Developer workstation and local containers |
| Test        | Automated isolated tests and CI            |
| Portfolio   | Public OCI demonstration deployment        |

Portfolio configuration must not silently fall back to local defaults.

Environment-specific configuration includes:

- public application URLs;
- allowed browser origins;
- database credentials;
- JWT signing material;
- OAuth callback URLs;
- Stripe credentials and webhook secret;
- authentication-critical Email provider credentials when configured;
- Slack credentials when implemented;
- TURN shared secret;
- mediasoup announced address;
- logging behavior.

The committed environment template contains variable names and safe descriptions only.

---

## Secret Handling

Deployment secrets must remain outside:

- Git history;
- committed Compose files;
- container-image layers;
- frontend bundles;
- ordinary logs;
- public documentation.

At minimum, protect:

- database passwords;
- JWT signing material;
- Google and GitHub OAuth secrets;
- Stripe secret keys;
- Stripe webhook signing secret;
- authentication Email-provider credentials;
- Slack client secret and user tokens;
- TURN shared secret;
- deployment credentials.

A leaked secret must be rotated. Removing it only from the latest file revision is insufficient.

The Portfolio deployment must use different values from local development and automated tests.

---

## Deployment Procedure Contract

The exact commands must be added after the production artifacts exist. The implemented procedure must preserve the following order.

### 1. Pre-deployment checks

Confirm:

- CI passed for the selected revision;
- the revision or image version is recorded;
- required ARM64 images exist or can be reproduced;
- configuration changes are reviewed;
- migration compatibility is understood;
- adequate disk space exists;
- an appropriate backup exists before a risky migration;
- the previously deployable version remains available.

### 2. Obtain the selected artifact

Deploy a specific immutable revision or image tag.

Do not deploy an unidentified working tree or depend solely on a mutable `latest` tag.

### 3. Supply external configuration

Install or update the Portfolio environment configuration without committing secret values.

Validate required variables before modifying running services.

### 4. Start persistence dependencies

Start and verify:

- PostgreSQL;
- MongoDB;
- Redis.

Application startup must not be treated as successful when a required datastore is unavailable.

### 5. Run migrations

Apply context-owned PostgreSQL migrations before starting code that requires them.

Create required MongoDB collections, validation, and indexes through the owning Chat deployment mechanism.

A deployment must not assume that container startup automatically produces the required database state unless executable configuration explicitly performs and verifies that step.

### 6. Start application services

Start:

- API Gateway;
- Next.js;
- required worker processes;
- reverse proxy.

Start media services only after their delivery phase introduces them.

### 7. Verify the release

Verify at least:

- container state;
- application health;
- HTTPS;
- HTTP-to-HTTPS redirect;
- frontend delivery;
- API response;
- OAuth callback configuration;
- authorized WebSocket connection;
- unauthorized WebSocket rejection;
- Chat send and receive when Chat is deployed;
- database access;
- absence of public database ports.

Later phases add Stripe, coturn, mediasoup, Meeting, and Notification checks.

### 8. Accept or roll back

Mark the deployment successful only after required verification passes.

If verification fails:

1. stop further rollout;
2. preserve useful diagnostics without exposing secrets;
3. determine whether the failure is application, configuration, migration, provider, or infrastructure related;
4. roll back the application when compatible;
5. restore data only when the recovery plan explicitly requires it;
6. record the failed revision and result.

Detailed failure procedures belong in [`runbook.md`](./runbook.md).

---

## Database Migration Policy

Each Bounded Context owns its migrations.

A deployment must not introduce cross-context database relations merely because contexts currently share one PostgreSQL server.

Required migration rules:

- migrations are committed;
- migrations are reviewed with the feature that requires them;
- production deployment uses the checked-in migration history;
- destructive changes require an explicit compatibility plan;
- backward-compatible expansion is preferred before contraction;
- application rollback compatibility is considered before applying a migration;
- a successful backup is not assumed until restoration has been exercised.

Automatically reversing every migration is not a valid rollback strategy.

When a migration prevents application rollback, the deployment decision must identify that point before release.

---

## Persistent Data and Backup

### PostgreSQL

PostgreSQL contains durable relational business state.

The deployment must provide:

- persistent storage;
- scheduled logical backup;
- backup integrity checks;
- protected backup credentials;
- retention policy;
- an external backup copy;
- documented restoration.

### MongoDB

MongoDB contains durable Chat entry data.

The deployment must provide:

- persistent storage;
- scheduled logical backup;
- required collection validation and indexes;
- retention policy;
- an external backup copy;
- documented restoration.

### Redis

Redis supports ephemeral state, coordination, and BullMQ.

Redis may use persistence to improve recovery, but it must not be the sole authoritative record of:

- accepted Stripe webhook work;
- Integration Events;
- Notifications;
- Chat messages;
- subscription state.

Durable Inbox or Outbox records remain in PostgreSQL where required by the owning Context.

### Backup Failure Boundary

A backup stored only on the OCI VM does not protect against VM or storage loss.

Required backups must eventually leave the VM failure boundary, for example through appropriately protected external object storage.

Phase 4 must exercise PostgreSQL and MongoDB restoration before the Portfolio Release is described as recoverable.

---

## Rollback Policy

Retain:

- the previously deployed application image or revision;
- its required configuration shape;
- migration compatibility information;
- the last successful verification result.

Application rollback is appropriate when:

- the previous application remains compatible with the current database;
- no external provider state requires reconciliation;
- the failure is isolated to the new application version.

Rollback alone may be insufficient after:

- destructive migration;
- partially processed Stripe events;
- changed OAuth callback configuration;
- incompatible event-contract deployment;
- irreversible external-provider action.

In those cases, follow an explicit recovery procedure rather than repeatedly restarting or redeploying.

---

## Health and Readiness

Production services must distinguish where useful:

- process health;
- readiness to accept traffic;
- dependency availability.

A health response must not expose:

- secrets;
- credentials;
- internal stack traces;
- private network topology;
- raw provider errors.

Health checks should support Compose restart and deployment verification without turning temporary external-provider failure into uncontrolled restart loops.

Exact endpoints become authoritative in the HTTP contract and executable application configuration when implemented.

---

## Logs and Operational Evidence

The deployment must make it possible to inspect:

- container startup and shutdown;
- application errors;
- migration result;
- HTTP and WebSocket health;
- worker failures and retries;
- Stripe webhook processing;
- Outbox and Inbox backlog;
- coturn behavior;
- mediasoup Worker health;
- resource pressure.

Logs must not contain:

- passwords;
- access or refresh tokens;
- OAuth tokens;
- provider secrets;
- TURN shared secret;
- full private Message content by default;
- unredacted sensitive webhook payloads.

Operational evidence for a portfolio demonstration may include:

- CI result;
- deployed revision;
- health output;
- container status;
- backup and restore result;
- selected resource measurements;
- automated capacity-test result.

Do not describe unmeasured capacity as production performance.

---

## ARM64 Validation

OCI Ampere A1 is ARM64.

Phase 2.5 validates:

- Node.js runtime;
- pnpm installation;
- application dependency installation;
- Prisma generation;
- application builds;
- PostgreSQL image;
- MongoDB image;
- Redis image;
- reverse-proxy image;
- application container images.

Phase 3 additionally validates:

- mediasoup package installation;
- mediasoup Worker execution;
- coturn image or binary;
- media transport;
- native dependency behavior;
- container shutdown and restart.

A multi-platform image manifest is optional. A verified `linux/arm64` build is required for the accepted OCI target.

Do not claim ARM64 support merely because a package advertises it.

---

## Capacity and Resource Policy

The single VM shares CPU, memory, storage, and network capacity among:

- frontend;
- API;
- workers;
- PostgreSQL;
- MongoDB;
- Redis;
- mediasoup;
- coturn.

Before Portfolio Release, measure at least:

- idle memory;
- normal Chat workload;
- direct call behavior;
- TURN-relayed call behavior;
- Free group-call scenario;
- Pro group-call scenario;
- mediasoup CPU and memory;
- storage growth;
- container restart behavior.

Product entitlement values come from [`../product/tiers.md`](../product/tiers.md).

Configured entitlement limits do not prove that the host can sustain those limits. Capacity claims require recorded test evidence.

If the Always Free VM cannot support the accepted demonstration:

1. record the failure;
2. identify the measured bottleneck;
3. optimize only supported bottlenecks;
4. retest;
5. use a temporary paid compatible host for an important demonstration if necessary;
6. create a new ADR if the default topology must change.

Do not silently lower product entitlements to make an unverified deployment appear successful.

---

## OCI Always Free Constraints

The selected platform has accepted limitations:

- resources must be created in the tenancy's home region where required;
- eligible capacity may be temporarily unavailable;
- the free allowance is account-wide;
- limits shown in the OCI Console are authoritative;
- ARM64 compatibility requires validation;
- one VM is one failure domain;
- low-utilization Always Free instances may be reclaimed under Oracle's published policy;
- free-service terms may change;
- the environment has no production SLA.

Huddle must be reconstructable from:

- repository configuration;
- reproducible application artifacts;
- externally supplied secrets;
- external PostgreSQL and MongoDB backups;
- this deployment procedure;
- the operational runbook.

Do not generate artificial traffic merely to evade an idle-resource policy.

Before provisioning or resizing resources, confirm their Always Free eligibility and the account's remaining limits in the OCI Console.

---

## Microservice Deployment Evolution

The current deployment remains a modular monolith.

Storing another Context's identifier does not by itself require a network dependency or separate deployment.

### Step 1 — Modular Monolith

```text
One API deployment
One application composition root
Context libraries loaded in process
Context-owned schemas and repositories
```

This is the committed Portfolio architecture.

### Step 2 — Extract One Context Process

Extract only when a concrete requirement justifies it.

Preserve:

- consumer-owned ports;
- provider Public APIs;
- minimal DTOs;
- Integration Event contracts;
- context-owned persistence;
- API Gateway composition boundaries.

Replace an in-process adapter with a network adapter without rewriting the consuming domain model.

### Step 3 — Separate Containers on One Host

An extracted service may first run as an independent container on the same OCI VM.

This demonstrates:

- independent process lifecycle;
- network boundary;
- independent image;
- independent migration ownership;
- failure and retry handling.

It does not provide host-level failure isolation.

### Step 4 — Separate Hosts

Move a service or media component to another host only when required by:

- independent scaling;
- CPU or memory isolation;
- deployment cadence;
- security boundary;
- failure isolation;
- media capacity.

The first likely physical split is between application/data workloads and media/TURN workloads, but it is not committed scope.

### Step 5 — Managed Infrastructure

A future production-oriented system may introduce:

- managed PostgreSQL;
- managed MongoDB;
- managed Redis;
- dedicated media nodes;
- load balancing;
- container orchestration;
- service-to-service authentication;
- centralized observability.

Kubernetes is not a default consequence of extracting a service. It requires an independently justified operational decision.

---

## Deployment Change Rules

Update this document in the same change when:

- the production Compose path changes;
- a public port or media range changes;
- the reverse proxy changes;
- a new persistent service is introduced;
- a new secret category is introduced;
- backup or restore procedures change;
- the OCI topology changes;
- a service is extracted;
- rollback behavior changes;
- the executable deployment procedure changes.

Create or supersede an ADR when the deployment strategy itself changes materially.

Ordinary command corrections and operational details do not require a new ADR.

---

## Source-of-Truth Boundaries

| Information                                | Authoritative source                                          |
| ------------------------------------------ | ------------------------------------------------------------- |
| Deployment-platform decision and rationale | `docs/decisions/0007-portfolio-deployment-topology.md`        |
| Actual service definitions                 | Production Docker Compose configuration once implemented      |
| Container build behavior                   | Owning Dockerfiles once implemented                           |
| Reverse-proxy routing                      | Committed proxy configuration once implemented                |
| Exact media ranges                         | Committed mediasoup and coturn configuration once implemented |
| Deployment procedure                       | This document                                                 |
| Failure recovery                           | `docs/operations/runbook.md`                                  |
| Portfolio demonstration                    | `docs/operations/portfolio-demo.md`                           |
| Product limits                             | `docs/product/tiers.md`                                       |
| Delivery authorization                     | Active file under `docs/delivery/phases/`                     |
| Current implementation status              | `docs/delivery/status.md`                                     |
| Local development                          | `docs/engineering/setup.md`                                   |
| Security principles                        | `docs/architecture/security.md`                               |
| Executable CI behavior                     | `.github/workflows/ci.yml`                                    |

Executable configuration overrides duplicated operational detail, but a discrepancy must be resolved by updating this document rather than leaving two conflicting descriptions.

---

## External References

Platform conditions were last checked on 2026-08-07.

- [Oracle Cloud Infrastructure Free Tier](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm)
- [OCI Always Free Resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)

Platform limits and policies are external facts and must be rechecked before provisioning, resizing, or making public cost claims.
