# ADR 0007 — Use a Single-host OCI Portfolio Deployment

Status: Accepted  
Recorded: 2026-08-07  
Supersedes: None  
Superseded by: None

## Context

The Huddle Portfolio Release is expected to demonstrate more than ordinary HTTP application hosting.

Its planned runtime includes:

- Next.js
- NestJS
- PostgreSQL
- MongoDB
- Redis
- WebSocket
- Stripe webhook processing
- Background workers
- Peer-to-peer WebRTC
- mediasoup
- coturn

The WebRTC components require control over public networking, including UDP traffic and TURN relay ports. This makes an HTTP-only application platform insufficient for the complete deployment.

The project is maintained by one developer and should avoid a permanent hosting charge where practical.

The deployment architecture must therefore balance:

- Media-networking requirements
- Persistent data
- Operational simplicity
- Reproducibility
- Cost
- Portfolio demonstration needs

## Decision

The baseline Portfolio deployment targets one OCI Always Free Ampere A1 Linux virtual machine.

The target deployment uses:

- One Linux host
- Docker Compose
- A reverse proxy
- Next.js
- One primary NestJS application
- Application workers where required
- PostgreSQL
- MongoDB
- Redis
- mediasoup
- coturn

Render is not part of the baseline deployment.

This topology is intended for low-traffic portfolio demonstration and engineering validation. It is not presented as a production high-availability environment and carries no availability guarantee.

The executable deployment configuration, network rules, backup procedures, and operational verification steps belong to the Operations documentation.

## Rationale

A conventional OCI Linux VM provides the host and network control needed for:

- Long-running application processes
- WebSocket connections
- Public TCP and UDP ingress
- mediasoup media transports
- TURN listeners and relay traffic
- Persistent storage
- Docker-based deployment
- Direct operating-system administration

A single host keeps the environment understandable and affordable for one developer while still allowing the project to demonstrate application, persistence, queue, realtime, and media infrastructure.

Docker Compose is proportionate to the current deployment scale. No demonstrated orchestration requirement justifies Kubernetes.

## Logical Topology

```text
Internet
├── Reverse proxy
│   ├── Next.js
│   └── NestJS API Gateway
├── mediasoup media transports
└── coturn relay transports

NestJS application and workers
├── PostgreSQL
├── MongoDB
└── Redis
```

This is a logical topology only. The current executable state and exact configuration are maintained in the deployment documentation.

## Deployment Boundary

Only services that require public access may be exposed.

Public access categories include:

- HTTPS
- WebSocket
- Restricted administrative access
- mediasoup media transports
- coturn listeners and relay transports

PostgreSQL, MongoDB, Redis, application-internal ports, and container-management interfaces must not be publicly exposed.

Exact ports, firewall rules, certificates, DNS, and host configuration are owned by `operations/deployment.md`.

## ARM64 Compatibility

OCI Ampere A1 uses ARM64.

The target architecture therefore requires compatibility validation for:

- Node.js and application dependencies
- Container images
- Native dependencies
- mediasoup Worker
- coturn
- PostgreSQL
- MongoDB
- Redis
- Reverse proxy

An accepted deployment target is not proof that every component already runs successfully on that target.

Compatibility must be demonstrated during the relevant delivery phases and recorded in the Operations documentation.

## Capacity and Availability

Configured product limits do not prove that the selected host can sustain those limits.

Before Portfolio Release, the deployment must be validated against the accepted demonstration scenarios, including direct calls, TURN-relayed calls, and group media sessions.

If the environment cannot support an accepted scenario:

1. Record the measured limitation.
2. Investigate the demonstrated bottleneck.
3. Re-test after mitigation.
4. Use a temporary suitable host for a critical demonstration when necessary.
5. Record a new ADR if the baseline topology must materially change.

Product entitlements must not be silently changed to conceal an infrastructure limitation.

The topology also accepts that:

- Free compute capacity may be unavailable.
- An eligible instance may be reclaimed under provider policy.
- Every component shares one host-level failure boundary.
- Databases and media workloads compete for host resources.
- Host maintenance can interrupt the complete application.
- Active media sessions are not recoverable after a host or process failure.

The project must not generate artificial traffic to evade an idle-resource policy.

## Persistence and Recovery

PostgreSQL and MongoDB require persistent storage and backups outside the VM failure boundary.

Redis may support queue recovery, but durable business work must remain recoverable from its authoritative PostgreSQL Inbox or Outbox records where applicable.

Backup, restore, migration, rollback, and host-reconstruction procedures are maintained in the Operations documentation rather than this ADR.

## Secrets

Deployment secrets must remain outside:

- The Git repository
- Container images
- Frontend bundles
- Ordinary application logs

Committed environment templates may contain variable names and safe descriptions, but not secret values.

Detailed secret handling belongs to the Security and Operations documentation.

## Consequences

### Positive

- The complete portfolio system can run on one understandable host.
- The platform provides the UDP and TURN networking control required by the selected WebRTC design.
- Docker Compose matches the current scale and team size.
- The topology avoids a required permanent hosting charge while eligible free resources remain available.
- Deployment and media-networking behavior remain directly observable.
- The environment can later be reconstructed on another compatible Linux VM.

### Negative

- ARM64 compatibility requires explicit validation.
- Free resource availability is not guaranteed.
- One host is one failure domain.
- The deployment has no high availability.
- Datastores and media processes compete for CPU, memory, storage, and network capacity.
- Backup, restore, patching, and host reconstruction remain the developer’s responsibility.
- A temporary paid environment may be required for a reliable demonstration.

## Alternatives Considered

### Render-only Deployment

Rejected because the complete mediasoup and coturn topology requires public UDP and relay-port control that is not provided by the selected Render application-hosting model.

### Render Frontend with a Separate Media Host

Deferred because it adds cross-origin, authentication, deployment, and failure-surface complexity while still requiring a general-purpose VM.

### Google Compute Engine

Technically suitable as a general-purpose VM and retained as a possible temporary paid or trial fallback.

It is not the zero-cost baseline because the permanent free allocation and eligible regions are not a good fit for the complete application and media stack.

### DigitalOcean Droplet

Technically suitable and retained as a possible temporary paid fallback.

It is not the baseline because an always-running suitable Droplet introduces a recurring cost.

### Multiple OCI Virtual Machines Immediately

Deferred until measurements demonstrate a need for resource or failure isolation.

Splitting components across hosts adds networking and operational complexity and may divide the available free capacity.

### Managed Databases

Deferred because they introduce additional cost before independent scaling, backup, or operational requirements justify them.

### Kubernetes

Rejected for the current scope because the project has one developer, one baseline host, and no demonstrated scheduling or orchestration requirement.

## Future Evolution

If a bounded context is later extracted as a service, it may initially run as a separate process or container while preserving its application contracts and persistence ownership.

Running several service containers on the same VM may demonstrate independent deployment units, but it does not provide host-level failure isolation.

A later topology may separate application, data, and media workloads only after a concrete capacity, security, scaling, deployment, or availability requirement is demonstrated.

Any material platform or topology change requires a new ADR that supersedes this one.

## Revisit When

Reconsider this decision when:

- Required ARM64 compatibility cannot be achieved.
- OCI free capacity is unavailable for an unacceptable period.
- Media testing cannot satisfy the accepted demonstration scenarios.
- Host reclamation makes the portfolio environment unreliable.
- Independent failure isolation becomes necessary.
- A context requires independent scaling or deployment.
- Managed infrastructure becomes operationally or financially justified.
- Multiple media nodes are required.
- Deployment operations exceed what Docker Compose can manage safely.
- The project gains real production users or availability commitments.

## Related Documentation

- [System Architecture](../architecture/system.md)
- [Security](../architecture/security.md)
- [Deployment](../operations/deployment.md)
- [Runbook](../operations/runbook.md)
- [Portfolio Demo](../operations/portfolio-demo.md)
- [DDD Modular Monolith](0001-modular-monolith.md)
- [Context-owned Persistence](0002-context-owned-persistence.md)
- [Deployment Foundation Phase](../delivery/phases/02.5-deployment-foundation.md)
- [Billing and Portfolio Release Phase](../delivery/phases/04-billing-and-portfolio-release.md)
