# Phase 7 — Hardening and Portfolio Preparation

Status: Later  
Depends on: Phase 6 — Notification  
Outcome: Verified committed system and presentation-ready portfolio

## Objective

Strengthen, verify, document, and demonstrate the committed Huddle system after all scheduled product phases are complete.

Phase 7 improves confidence in implemented behavior. It is not a feature-expansion phase.

The first public Portfolio Release occurs at the end of Phase 4. Phase 7 prepares the completed scheduled system for its strongest final portfolio presentation.

## Implementation Authority

A Phase 7 task must serve at least one of these purposes:

- Fix a verified defect.
- Reduce a demonstrated security risk.
- Improve test evidence.
- Improve measured performance.
- Improve failure recovery.
- Improve observability.
- Remove accidental complexity.
- Correct documentation.
- Improve portfolio demonstration reliability.

A change that introduces a new product capability requires a separate Product Scope and Roadmap decision.

Phase 7 must not be used as a general backlog for ideas deferred from earlier phases.

## Context-loading Rule

Load only the documentation required by the hardening task.

| Task                    | Required documentation                                     |
| ----------------------- | ---------------------------------------------------------- |
| Security review         | Security architecture, affected Context, affected contract |
| Performance review      | Data and consistency, affected Context, testing strategy   |
| Failure recovery        | Affected Context and Operations runbook                    |
| Deployment review       | Deployment documentation and ADR 0007                      |
| Portfolio demonstration | Portfolio demo guide, Product Scope, and current status    |
| Documentation review    | Public documentation index and affected sources of truth   |
| Dependency review       | Dependency policy and affected package manifests           |

A Phase 7 label does not justify loading every Context document.

## Included Scope

### Security and Authorization

Review security-sensitive behavior across implemented capabilities, including:

- Authentication and token handling
- OAuth callback validation
- HTTP and socket authorization
- Conversation membership
- Group administration
- Call and Meeting participation
- Billing and Stripe webhooks
- Notification delivery credentials
- CORS and reverse-proxy trust
- Secret storage
- Sensitive log redaction
- Database and administrative network access

For every externally reachable capability, verify:

- Which identity is trusted
- Which relationship grants access
- Which Context owns the decision
- How role or membership changes affect access
- How unauthorized responses avoid leaking protected information

Existence validation must not be treated as authorization.

Detailed security rules remain owned by `architecture/security.md` and the affected Context documents.

### Concurrency and Idempotency

Review operations whose correctness depends on concurrent access or repeated delivery.

Examples include:

- Contact and Direct Conversation uniqueness
- Quota enforcement
- Group membership and administration
- Call and Meeting capacity
- Message idempotency
- Stripe webhook replay
- Integration Event duplication and ordering
- Notification delivery retries

Concurrency behavior must be supported by real persistence tests where database isolation, uniqueness, indexes, or locking are part of the solution.

### Persistence and Consistency

Review implemented persistence flows for:

- Constraints and indexes
- Transaction boundaries
- Retry behavior
- Cursor pagination
- Idempotency
- Cross-store consistency
- Inbox and Outbox recovery
- Redis reconstruction
- Data retention
- Backup and restore

For every cross-context or cross-datastore flow, the documentation must identify:

- Authoritative source
- Consistency expectation
- Retry behavior
- Idempotency mechanism
- Failure visibility
- Recovery path

Detailed policies remain owned by `architecture/data-and-consistency.md`.

### Performance and Capacity

Measure before optimizing.

Review demonstrated application and media workloads, including:

- Contact and conversation queries
- Message-history pagination
- Authorization lookups
- Quota contention
- WebSocket messaging
- Background processing
- Database connections and queries
- Redis use
- mediasoup resource use
- TURN relay behavior

Do not add caches, replicas, brokers, services, or infrastructure based only on assumed future scale.

Product entitlement limits and verified deployment capacity must remain distinguishable.

Media-capacity claims must be supported by recorded tests in the actual demonstration environment.

### Reliability and Recovery

Exercise failures that materially affect the Portfolio environment, including:

- Application and worker restart
- Datastore outage or restart
- Inbox and Outbox recovery
- Stripe webhook retry
- Notification-provider failure
- mediasoup Worker failure
- TURN unavailability
- Backup restoration
- Deployment rollback
- Host reconstruction

The result should describe expected degradation and recovery. It must not imply that every capability remains available during every failure.

Detailed procedures belong to `operations/runbook.md`.

### Observability

Provide enough operational evidence to diagnose failures in the Portfolio environment.

Review:

- Structured logs
- Request or correlation identifiers
- Context and use-case identification
- Error categories
- Health and readiness checks
- Queue and dispatcher state
- Webhook processing state
- Media-worker health
- Datastore availability
- Sensitive-data redaction

A commercial observability platform is not required unless a demonstrated need justifies it.

Logs must not expose secrets, authentication tokens, protected credentials, or private message contents without an explicit diagnostic policy.

### Test-suite Quality

Review:

- Domain invariant tests
- Application use-case tests
- Persistence integration tests
- HTTP and realtime contract tests
- Concurrency tests
- Failure-path tests
- End-to-end portfolio flows
- Flaky tests
- Test isolation
- Test runtime
- Coverage exclusions and regression thresholds

Coverage follows the measured baseline and ratchet policy in `engineering/testing.md`.

A high percentage does not compensate for missing critical behavior tests.

### Dependency Review

Review direct dependencies for:

- Support status
- Known vulnerabilities
- Runtime necessity
- Duplicate functionality
- Development-only classification
- ARM64 compatibility
- License suitability
- Bundle or image impact

Dependency changes require relevant tests and production builds.

Phase 7 must not upgrade every package merely to claim that all dependencies are current.

### Architecture Review

Verify that the implemented system preserves:

- Bounded-context ownership
- Context-owned persistence
- Consumer-owned ports
- Provider-owned public APIs
- Minimal cross-context DTOs
- No leaked domain entities
- No circular Context dependencies
- No cross-context repository access
- No client-authoritative identities
- Domain Event and Integration Event separation

An intentional deviation requires updated documentation and, when architectural, a new ADR.

### Documentation Review

Verify that:

- Every public document has one clear responsibility.
- Product values have one authoritative source.
- Delivery order and status are not duplicated.
- Phase documents remain the implementation authority.
- HTTP and realtime contracts are not duplicated.
- Deployment instructions match executable configuration.
- ADRs record decisions rather than operational procedures.
- Deferred capabilities are not presented as implemented.
- Links resolve.
- Legacy documents are no longer active sources.
- Documentation claims are supported by code, tests, configuration, or recorded evidence.

### Portfolio Demonstration

The final demonstration must be executable by one operator.

It should demonstrate the scheduled system’s most important backend capabilities, including:

- Identity
- Contacts
- Direct and Group Chat
- Direct and Group WebRTC
- Free and Pro entitlement differences
- Stripe test-mode upgrade
- Meetings
- Notification behavior
- Deployment and recovery evidence
- Architecture boundaries

Prepared fixtures, automated clients, recorded metrics, and repeatable scripts may replace manual control of numerous accounts.

The demonstration must not rely on:

- Public tier-override endpoints
- Fake production payments
- Undocumented database edits
- Claims unsupported by visible evidence

The detailed sequence belongs to `operations/portfolio-demo.md`.

## Prioritization

Phase 7 work should be prioritized in this order:

1. Security and data-integrity defects
2. Authorization defects
3. Billing correctness
4. Message or lifecycle loss
5. Concurrency defects
6. Recovery defects
7. Demonstration blockers
8. Measured performance problems
9. Maintainability improvements
10. Cosmetic improvements

Verified correctness problems take priority over speculative infrastructure.

## Evidence Requirements

A hardening claim must be supported by one or more of:

- Automated test
- Integration test
- End-to-end test
- Load or capacity test
- Deployment observation
- Recovery exercise
- Source-code inspection
- Architecture decision
- Official dependency documentation

Performance and capacity evidence must identify its environment and limitations.

## Definition of Done

Phase 7 is complete only when:

- Critical security findings are resolved or explicitly documented.
- Authorization boundaries are verified.
- Concurrency-sensitive behavior has integration evidence.
- Persistence indexes and constraints are reviewed.
- Inbox and Outbox recovery is exercised where implemented.
- Backup and restore are exercised.
- Media-capacity claims match recorded tests.
- Relevant failure behavior is documented.
- Required observability exists.
- Test coverage has no unexplained regression.
- Direct dependencies are reviewed.
- Architecture boundaries are reviewed.
- Public documentation is consistent.
- The one-operator demonstration is rehearsed.
- Known limitations are published.
- `delivery/status.md` reflects the final project state.

## Explicitly Excluded

Phase 7 must not add:

- Enterprise tier
- Workspace or organization ownership
- SAML Enterprise SSO
- Recording
- Anonymous Meeting guests
- Calendar integration
- Webinar capabilities
- Product-event Email Notification
- Comprehensive Notification preferences
- Multiple Slack destinations per user
- Kubernetes
- Independent microservices
- Multi-region deployment
- Additional media nodes
- New paid plans
- Unscheduled third-party integrations

These capabilities require a new Product Scope and Roadmap decision.

## Related Documentation

- [Delivery Roadmap](../roadmap.md)
- [Current Status](../status.md)
- [Product Scope](../../product/scope.md)
- [Security](../../architecture/security.md)
- [Data and Consistency](../../architecture/data-and-consistency.md)
- [Testing Strategy](../../engineering/testing.md)
- [Dependency Policy](../../engineering/dependencies.md)
- [Deployment](../../operations/deployment.md)
- [Runbook](../../operations/runbook.md)
- [Portfolio Demo](../../operations/portfolio-demo.md)
- [Portfolio Deployment ADR](../../decisions/0007-portfolio-deployment-topology.md)
