# Operations Runbook

Status: Initial operational baseline; executable commands must evolve with implementation

## Purpose

This runbook defines how to diagnose and recover Huddle's Portfolio deployment when expected behavior fails.

It covers:

- initial incident assessment;
- application and infrastructure failures;
- persistence and migration failures;
- WebSocket and Chat recovery;
- asynchronous processing;
- Billing and Stripe recovery;
- WebRTC, mediasoup, and coturn failures;
- rollback and restoration decisions.

The deployment procedure belongs in [`deployment.md`](./deployment.md).

The repeatable portfolio demonstration belongs in [`portfolio-demo.md`](./portfolio-demo.md).

This document must not contain production secret values.

---

## Current Limit

The production deployment and several operational capabilities are not implemented yet.

Therefore, this runbook defines:

- diagnostic order;
- safe recovery principles;
- expected operational evidence;
- failure-specific guardrails.

Phase 2.5 must replace placeholders with the actual production Compose file, health endpoints, log commands, and service names.

Later phases add executable procedures for:

- Stripe processing;
- Transactional Outbox recovery;
- coturn;
- mediasoup;
- Meetings;
- Notification delivery.

Do not present a planned recovery procedure as tested until the corresponding recovery exercise has succeeded.

---

## Operating Principles

When handling a failure:

1. Protect durable data before attempting destructive recovery.
2. Identify the failing boundary before restarting unrelated services.
3. Preserve useful diagnostics without exposing secrets.
4. Prefer an idempotent retry over manual state mutation.
5. Use the owning Context's recovery mechanism.
6. Do not convert infrastructure failure into confirmed absence.
7. Do not acknowledge durable work before it can be recovered.
8. Use bounded retries.
9. Roll back only when application and database versions remain compatible.
10. Record what was verified after recovery.

Do not:

- delete database volumes as a first response;
- retry an external operation without understanding its idempotency behavior;
- modify subscription tier directly to compensate for Stripe failure;
- convert a Billing error into synthesized Free;
- mark Inbox or Outbox work complete without applying the corresponding state change;
- expose a private database temporarily for convenience;
- generate artificial traffic to avoid OCI idle-resource policy;
- claim recovery succeeded without verification.

---

## First Response

### 1. Confirm the scope

Determine whether the failure affects:

- one request;
- one authenticated user;
- one Conversation, Call, or Meeting;
- one external provider;
- one application service;
- all application traffic;
- the complete VM.

### 2. Identify the last known change

Check:

- deployed revision or image version;
- configuration changes;
- database migration;
- external-provider configuration;
- certificate renewal;
- firewall or DNS change;
- resource exhaustion;
- host restart or OCI event.

### 3. Preserve evidence

Capture safe evidence such as:

- timestamp;
- deployed revision;
- affected capability;
- correlation identifier;
- safe resource identifier;
- HTTP or realtime error category;
- container state;
- relevant redacted logs;
- CPU, memory, disk, and network observations;
- queue, Inbox, or Outbox status when implemented.

Do not capture secrets, tokens, complete private Messages, or unredacted provider payloads.

### 4. Decide whether to continue or roll back

Continue diagnosis when:

- durable data remains safe;
- the failure is isolated;
- recovery is understood;
- the current version is required to interpret new data safely.

Consider rollback when:

- the failure began with the current application release;
- the previous version is known to be deployable;
- database and event contracts remain backward-compatible;
- rollback will not duplicate an external action.

---

## Diagnostic Order

Use this order to avoid debugging an application while its foundation is unavailable:

```text
OCI host
→ network and DNS
→ TLS and reverse proxy
→ container runtime
→ persistent datastores
→ migrations
→ application readiness
→ authentication
→ HTTP or WebSocket capability
→ asynchronous processing
→ external providers
→ media infrastructure
```

A lower-level failure may explain several higher-level symptoms.

---

## Failure Matrix

| Symptom                                     | Likely boundary                         | First evidence                                   | Safe first action                                   |
| ------------------------------------------- | --------------------------------------- | ------------------------------------------------ | --------------------------------------------------- |
| Entire site unreachable                     | Host, DNS, firewall, proxy              | OCI instance state, DNS resolution, ports 80/443 | Confirm host and network state                      |
| HTTPS fails                                 | DNS, certificate, proxy                 | Certificate status and proxy logs                | Verify DNS and certificate configuration            |
| Frontend works but API fails                | API container or proxy route            | API health and logs                              | Inspect API readiness                               |
| API starts but requests fail                | Configuration, migration, datastore     | Startup logs and dependency health               | Verify required configuration and datastores        |
| Login fails for all users                   | Identity, JWT, database, OAuth config   | Identity-safe error category                     | Verify Identity dependencies                        |
| One OAuth provider fails                    | Provider credentials or callback        | Provider callback error                          | Verify registered callback and secret configuration |
| WebSocket cannot connect                    | Proxy upgrade, origin, authentication   | Upgrade response and gateway logs                | Verify WSS forwarding and token handling            |
| Messages appear after refresh only          | Realtime broadcast                      | MongoDB persistence and socket delivery          | Preserve Message; diagnose broadcast                |
| Messages disappear after refresh            | Persistence                             | MongoDB result                                   | Stop claiming successful acceptance                 |
| Protected mutation returns unavailable      | Billing entitlement lookup              | Billing availability and error category          | Restore Billing; do not assume Free                 |
| Stripe payment completed but tier unchanged | Webhook, Inbox, worker, reconciliation  | Stripe event ID and Inbox state                  | Trace durable receipt before replay                 |
| Duplicate Stripe effects                    | Idempotency or deduplication            | Stripe event ID uniqueness                       | Stop processing and inspect invariants              |
| Chat call timeline missing                  | Outbox dispatch or projection           | Conferencing Outbox and Chat projection          | Replay idempotently                                 |
| Active calls fail together                  | mediasoup Worker or host resources      | Worker state and resource metrics                | End affected sessions consistently                  |
| Direct calls fail on restricted networks    | coturn                                  | ICE candidate and TURN logs                      | Verify TURN reachability and credentials            |
| Deadlines do not fire                       | Timer worker or durable deadline scan   | Durable session deadline                         | Run idempotent overdue reconciliation               |
| Services restart repeatedly                 | Health check, configuration, dependency | Container state and startup logs                 | Stop restart loop and inspect first failure         |
| Writes fail across contexts                 | PostgreSQL, MongoDB, disk               | Datastore health and disk space                  | Protect data and restore capacity                   |
| Queue stops processing                      | Redis or worker                         | Redis health and worker status                   | Restore Redis and recover from durable sources      |

---

## Host or VM Unavailable

### Symptoms

- HTTP, WebSocket, and SSH are all unreachable;
- every component becomes unavailable simultaneously;
- OCI reports the instance stopped, unavailable, or reclaimed.

### Check

Confirm:

- OCI instance lifecycle state;
- public IP address;
- boot and block-volume attachment;
- OCI network rules;
- account limits and Always Free eligibility;
- whether the public address changed;
- DNS still points to the intended address.

### Recovery

If the instance still exists:

1. restore host availability;
2. verify attached persistent storage;
3. start the container runtime;
4. start persistence services;
5. verify migrations;
6. start application services;
7. run deployment verification.

If the instance must be recreated:

1. provision the documented compatible ARM64 host;
2. restore network restrictions;
3. install the container runtime;
4. restore external configuration;
5. restore PostgreSQL and MongoDB from external backups;
6. start Redis as recoverable infrastructure;
7. deploy the selected application revision;
8. verify the complete active release scope.

Active calls and live presence are not recovered.

---

## Disk Pressure

### Symptoms

- database writes fail;
- containers stop or restart;
- image pulls fail;
- logs cannot be written;
- backups fail;
- latency increases sharply.

### Check

Identify which category consumes storage:

- container images;
- container logs;
- PostgreSQL data;
- MongoDB data;
- Redis persistence;
- temporary backups;
- build artifacts;
- operating-system logs.

### Recovery

1. stop nonessential writes if data integrity is at risk;
2. preserve required diagnostics;
3. remove only verified disposable artifacts;
4. retain required previous deployment images;
5. expand storage when justified;
6. verify database health;
7. verify backup capacity;
8. restart affected services only after sufficient space exists.

Do not delete database volumes or the only valid backup to recover space.

---

## Reverse Proxy, DNS, or TLS Failure

### Symptoms

- the public domain fails while internal services remain healthy;
- HTTPS certificate errors occur;
- HTTP succeeds but WebSocket upgrade fails;
- callbacks reach the wrong service.

### Check

Verify:

- DNS resolution;
- public IP;
- certificate validity;
- ports 80 and 443;
- reverse-proxy routes;
- WebSocket upgrade headers;
- forwarded host and protocol;
- frontend origin allowlist;
- OAuth and Stripe callback URLs.

### Recovery

Correct the failing network or proxy layer, then verify:

- HTTP redirects to HTTPS;
- frontend loads;
- API health succeeds;
- authenticated WebSocket connects;
- unauthorized WebSocket is rejected;
- provider callbacks target the expected public URL.

Do not weaken CORS, authentication, or firewall rules merely to make one request succeed.

---

## Container Fails to Start

### Check

Inspect:

- image architecture;
- required environment variables;
- startup command;
- health-check result;
- dependency readiness;
- migration state;
- file and volume permissions;
- memory pressure;
- first startup error before repeated restarts obscure it.

### Recovery

For a configuration error:

1. correct external configuration;
2. validate required variables;
3. restart only the affected service;
4. verify readiness.

For an incompatible image:

1. restore the previous compatible image;
2. verify database compatibility;
3. record the failed image and architecture.

For repeated restart loops:

1. pause automatic restarts where operationally safe;
2. inspect the earliest failure;
3. correct the cause;
4. resume service supervision;
5. verify stable operation.

---

## PostgreSQL Unavailable

PostgreSQL contains durable relational state and durable processing records.

### Impact

Depending on the active phase, failures may affect:

- Identity;
- Chat relational metadata;
- Conferencing lifecycle;
- Billing;
- Notification;
- Inbox and Outbox recovery.

### Check

Verify:

- container or process health;
- storage attachment;
- credentials;
- connection limits;
- disk capacity;
- migration state;
- database logs;
- network isolation.

### Recovery

1. prevent application code from reporting false durable success;
2. restore PostgreSQL availability;
3. verify schema and migration state;
4. verify Context-owned data;
5. inspect pending Inbox and Outbox work;
6. restart dependent workers;
7. verify application health.

A rejected repository call must not be translated into a resolved `null`.

For Billing, PostgreSQL failure is not equivalent to “no Subscription.”

---

## MongoDB Unavailable

MongoDB owns durable Chat entries.

### Impact

New Messages and timeline entries cannot be durably accepted.

Conversation metadata in PostgreSQL does not substitute for Message persistence.

### Recovery

1. stop reporting new Messages as accepted;
2. restore MongoDB availability;
3. verify storage and collection indexes;
4. verify recent persisted entries;
5. resume Message writes;
6. reconcile pending idempotent timeline projections where applicable.

Do not broadcast a Message as successfully accepted before required MongoDB persistence succeeds.

---

## Redis Unavailable

Redis contains recoverable infrastructure and live state.

### Possible Impact

- BullMQ processing pauses;
- realtime presence is lost;
- Socket.IO cross-process coordination may fail;
- live media coordination may fail;
- recoverable timers may be delayed.

### Recovery

1. restore Redis;
2. restart or reconnect workers;
3. reconstruct recoverable state from authoritative stores;
4. scan durable pending Inbox and Outbox records;
5. re-enqueue eligible work idempotently;
6. reconcile overdue durable deadlines.

Do not treat Redis recovery as proof that all durable work has been processed.

Redis must not be the only record of accepted Stripe events, Integration Events, Notifications, or Messages.

---

## Migration Failure

### Before retrying

Determine whether the migration:

- did not start;
- failed before changing data;
- partially changed data;
- completed but application startup failed;
- is backward-compatible with the previous application;
- requires restoration.

### Recovery

1. preserve migration output;
2. stop application rollout;
3. inspect actual schema state;
4. avoid repeatedly rerunning an unknown partial migration;
5. follow the migration's compatibility plan;
6. restore from backup only when required;
7. deploy a compatible application version;
8. verify schema and behavior.

Do not assume every migration is automatically reversible.

Destructive migration recovery must be designed with the migration, not improvised during an incident.

---

## Authentication Failure

### All authentication fails

Check:

- Identity database access;
- JWT signing configuration;
- token verification configuration;
- application time;
- required environment variables;
- recent Identity deployment or migration.

Do not bypass authentication to restore availability.

### One OAuth provider fails

Check:

- provider client identifier;
- provider secret;
- callback URL;
- provider-side application configuration;
- HTTPS;
- OAuth state handling;
- provider availability.

Google and GitHub OAuth are independent authentication providers. Failure of one provider should not invalidate unrelated authentication methods unless shared Identity infrastructure is unavailable.

### Existing tokens fail unexpectedly

Check:

- signing-key rotation;
- issuer and audience;
- token type;
- expiry;
- clock synchronization;
- revocation behavior;
- whether the deployed application uses the intended secret.

Do not log complete tokens during diagnosis.

---

## WebSocket Failure

### Connection cannot be established

Check:

- HTTPS and WSS URL;
- reverse-proxy upgrade behavior;
- allowed origin;
- `handshake.auth.accessToken`;
- token validity;
- API Gateway readiness.

Access tokens must not be moved into query strings as a workaround.

### Connection succeeds but events fail

Check:

- per-event authorization;
- Conversation or Call membership;
- event contract;
- current socket identity;
- Socket.IO room membership;
- persistence result;
- Redis adapter when multiple processes are introduced.

Connection authentication does not replace authorization for each protected operation.

### Reconnection loses expected state

Recover durable state through queries.

Presence, temporary socket membership, and live coordination may need reconstruction. They are not substitutes for durable Message or lifecycle state.

---

## Chat Persistence and Broadcast Divergence

### Message persisted but broadcast failed

This Message remains accepted.

Recovery:

1. preserve the persisted Message;
2. avoid creating a duplicate Message;
3. allow clients to recover through history or reconnect;
4. diagnose broadcast and socket delivery separately;
5. use the operation's idempotency identity if the client retries.

### Broadcast occurred but persistence failed

This is an invariant violation.

Required response:

1. stop reporting durable success;
2. identify how broadcast preceded persistence;
3. correct the ordering;
4. reconcile affected clients and data explicitly;
5. add a regression test.

Accepted ordering is:

```text
Authorize
→ persist
→ acknowledge or broadcast
```

### Duplicate Message attempt

Use the Chat-owned idempotency mechanism.

Do not deduplicate unrelated Messages solely because their text and timestamps appear similar.

---

## Quota Concurrency Failure

Chat quota-protected creation may use a serializable transaction with bounded retries.

Distinguish:

- `QuotaExceeded`: current committed usage is at or above the effective limit;
- concurrency contention: the operation could not safely complete after bounded retries;
- entitlements unavailable: Billing could not determine the effective limit.

Do not retry:

- confirmed quota failure;
- validation failure;
- authorization failure.

Retry serialization conflicts only according to the Chat-owned bounded policy.

When retries are exhausted, return the defined retryable contention outcome rather than silently exceeding the quota.

---

## Billing Entitlements Unavailable

### Symptoms

An entitlement-protected mutation returns a service-unavailable outcome.

### Check

Determine whether Billing returned:

- a confirmed Subscription;
- confirmed absence of a paid Subscription;
- a persistence or dependency failure;
- invalid stored state.

Only confirmed absence produces synthesized Free.

### Recovery

1. restore Billing persistence or dependency availability;
2. verify effective-tier calculation;
3. retry the protected action after Billing is healthy;
4. verify no protected mutation occurred before entitlement resolution.

Do not:

- assume Free;
- assume Pro;
- read Stripe state directly from the consuming Context;
- modify Chat or Conferencing data to bypass Billing.

Billing-independent behavior such as login or ordinary Message reads should remain available where designed.

---

## Stripe Checkout Completed but Pro Is Not Active

The browser return from Stripe is not payment authority.

### Trace

Use the Stripe event or Subscription identifier to determine:

1. whether Stripe produced the expected state;
2. whether the webhook signature was valid;
3. whether the event was durably stored in the Billing Inbox;
4. whether it was enqueued;
5. whether processing ran;
6. whether reconciliation succeeded;
7. whether the Subscription update committed;
8. whether the Inbox record was marked processed;
9. whether the entitlement query observes the new committed state.

### Recovery

If no durable Inbox record exists:

- inspect webhook delivery and endpoint receipt;
- do not manually grant Pro;
- request or wait for provider redelivery where supported.

If a pending Inbox record exists:

- repair the processing dependency;
- replay through the supported idempotent processor.

If local state disagrees with current Stripe state:

- use the Billing reconciliation mechanism;
- do not apply an arbitrary tier update.

---

## Duplicate or Out-of-Order Stripe Events

### Duplicate event

The unique Stripe event identifier must produce an idempotent accepted result.

Do not apply the same transition again.

### Out-of-order event

Do not assume arrival order represents current Stripe state.

Use the Billing reconciliation mechanism to retrieve and apply authoritative current Stripe state where required.

### Processing failure

A failed event must remain visibly pending or failed.

Retries must be bounded.

Do not mark the Inbox record processed unless the corresponding Billing state transition committed successfully.

---

## Outbox Backlog

A provider-owned Outbox records committed facts that require asynchronous delivery.

### Check

Identify:

- provider Context;
- event identity;
- event type and version;
- creation time;
- dispatch attempts;
- last safe error;
- consumer acknowledgement or deduplication state.

### Recovery

1. restore dispatcher or queue availability;
2. select pending records through the implemented recovery mechanism;
3. dispatch idempotently;
4. confirm consumer handling;
5. mark delivery according to the implemented protocol;
6. monitor backlog reduction.

Do not manually recreate Integration Events from memory when the durable Outbox record exists.

Do not delete failed Outbox rows merely to clear a dashboard.

---

## Consumer Projection Failure

Examples include Conferencing lifecycle projection into Chat and Notification creation.

### Recovery

1. confirm the provider fact committed;
2. locate its stable Integration Event identity;
3. verify the consumer's deduplication state;
4. replay through the supported event path;
5. verify the local projection;
6. avoid rewriting provider-owned data.

Consumers must tolerate duplicate delivery.

A consumer failure does not roll back the provider's already committed business transaction.

---

## Call or Meeting Deadline Failure

Durable lifecycle deadlines must not depend only on an in-memory timer.

Examples include:

- unanswered Call timeout;
- maximum Call duration;
- pre-end warning;
- Meeting session end rules.

### Recovery

1. restore the timer worker or scheduler;
2. query overdue durable sessions through the implemented recovery mechanism;
3. apply lifecycle transitions idempotently;
4. persist required Outbox events;
5. reconcile Chat timeline projections;
6. release live media resources.

Reprocessing an already completed deadline must not produce duplicate lifecycle effects.

---

## mediasoup Failure

### Symptoms

- multiple group-call or Meeting participants lose media;
- new transports cannot be created;
- Worker process exits;
- CPU or memory pressure rises;
- signaling succeeds but SFU media fails.

### Recovery

1. identify the affected Worker and sessions;
2. stop routing new sessions to the failed Worker;
3. mark affected durable sessions with the defined infrastructure-failure outcome;
4. release remaining live resources;
5. publish required lifecycle events;
6. restart or replace the Worker;
7. verify media before accepting new sessions.

Huddle does not claim seamless recovery of active media sessions.

Media-process failure must not erase durable Call or Meeting history.

---

## coturn Failure

### Symptoms

- direct calls work on some networks but fail on restrictive NAT or firewall environments;
- relay candidates are absent;
- TURN authentication fails;
- relay allocation fails.

### Check

Verify:

- public DNS or address;
- listener ports;
- relay port range;
- OCI network rules;
- operating-system firewall;
- Docker publication;
- short-lived credential generation;
- credential time and expiry;
- coturn logs without exposing the shared secret.

### Recovery

1. restore TURN reachability;
2. verify temporary credential issuance;
3. verify relay candidate gathering;
4. test an intentionally relayed call;
5. confirm expired credentials remain rejected.

Do not replace short-lived TURN credentials with a public static credential.

---

## Media Capacity Failure

If the configured participant limit cannot be sustained:

1. capture host and session measurements;
2. identify CPU, memory, network, Worker, or codec pressure;
3. stop claiming the scenario as validated;
4. optimize a measured bottleneck;
5. rerun the same scenario;
6. preserve the result as portfolio evidence.

Do not silently change Free or Pro entitlement values.

If necessary, use the documented temporary paid-host fallback for a critical demonstration and clearly identify the tested environment.

---

## Slack Delivery Failure

Notification and Slack integration are introduced in Phase 6.

When implemented:

- the durable in-app Notification remains authoritative;
- Slack delivery is an additional Pro delivery channel;
- delivery failure must remain visible;
- retries must be bounded;
- invalid or revoked credentials require reconnection;
- Huddle and Slack do not attempt bidirectional Message synchronization.

A Slack failure must not delete or invalidate the in-app Notification.

Do not expose Slack access tokens in logs or public API responses.

---

## Backup Failure

### Backup job fails

1. preserve the last known valid backup;
2. identify storage, credential, network, or capacity failure;
3. restore backup execution;
4. verify the new backup artifact;
5. do not delete the previous valid backup until verification succeeds.

### Backup exists but has not been restored

Treat recoverability as unverified.

A successful backup command alone does not prove that the data can be restored.

### External backup unavailable

Do not describe the deployment as recoverable from VM loss until an external backup is available again.

---

## Restore Procedure Contract

The exact commands must be added after backup tooling is implemented.

A restore exercise must:

1. select an identified backup;
2. verify integrity;
3. restore into an isolated target where practical;
4. apply required migrations only when compatible;
5. verify Context-owned relational state;
6. verify Chat Messages and timeline entries;
7. verify Inbox and Outbox records;
8. start a compatible application revision;
9. run functional verification;
10. record the result.

Do not overwrite the only live copy of data merely to test restoration.

---

## Application Rollback

Before rollback, confirm:

- previous image or revision exists;
- current database remains compatible;
- configuration shape remains compatible;
- event contracts remain readable;
- external actions will not be duplicated.

Rollback sequence:

1. stop rollout of the failing version;
2. preserve diagnostics;
3. select the previous verified version;
4. retain current durable data unless the recovery plan says otherwise;
5. start the previous version;
6. verify health, HTTPS, API, and WebSocket;
7. verify affected capability;
8. monitor asynchronous backlog;
9. record the recovered version.

If the database is incompatible with the previous application, do not perform a blind application rollback.

---

## Post-Recovery Verification

After recovery, verify only the capabilities active in the current delivery phase.

The applicable checks may include:

- host reachable;
- HTTPS valid;
- frontend available;
- API ready;
- databases private and healthy;
- login works;
- OAuth callback works;
- authorized WebSocket works;
- unauthorized WebSocket is rejected;
- Message persistence and history work;
- Message broadcast works;
- pending Inbox and Outbox work progresses;
- entitlement-protected actions behave correctly;
- Stripe state reconciles;
- direct and group Calls work;
- TURN relay works;
- mediasoup works;
- backups complete.

Update [`../delivery/status.md`](../delivery/status.md) only when implementation status genuinely changes.

Keep this runbook limited to repeatable operational procedures, symptoms, diagnostics, recovery actions, and verification steps.

---

## Runbook Completion by Phase

### Phase 2.5

Add actual procedures for:

- production Compose inspection;
- service logs;
- health and readiness;
- reverse proxy;
- PostgreSQL;
- MongoDB;
- Redis;
- migrations;
- deployment rollback;
- backup creation;
- basic restoration.

### Phase 3

Add actual procedures for:

- coturn;
- mediasoup;
- media port verification;
- Worker failure;
- durable deadline reconciliation;
- Conferencing Outbox recovery.

### Phase 4

Add actual procedures for:

- Stripe webhook tracing;
- Billing Inbox replay;
- reconciliation;
- BullMQ worker recovery;
- full PostgreSQL and MongoDB restore exercise.

### Phase 5

Add actual procedures for:

- Meeting session recovery;
- lobby and participant-state reconciliation.

### Phase 6

Add actual procedures for:

- Notification processing;
- Slack credential failure;
- failed external delivery replay.

---

## Source-of-Truth Boundaries

| Information                            | Authoritative source                                  |
| -------------------------------------- | ----------------------------------------------------- |
| Deployment topology and procedure      | `docs/operations/deployment.md`                       |
| Operational diagnosis and recovery     | This document                                         |
| Portfolio demonstration                | `docs/operations/portfolio-demo.md`                   |
| Persistence and consistency guarantees | `docs/architecture/data-and-consistency.md`           |
| Security rules                         | `docs/architecture/security.md`                       |
| Context failure semantics              | Owning file under `docs/contexts/`                    |
| Exact HTTP and realtime errors         | `docs/contracts/`                                     |
| Active implementation scope            | Active file under `docs/delivery/phases/`             |
| Current implementation status          | `docs/delivery/status.md`                             |
| Executable service names and commands  | Production configuration and scripts once implemented |

When implementation introduces a recoverable failure mode, the same change must update this runbook with:

- how the failure is detected;
- which state is authoritative;
- whether retry is safe;
- how retry is bounded;
- how recovery is verified.
