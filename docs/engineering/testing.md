# Testing Strategy

Status: Accepted engineering policy  
Last reviewed: 2026-08-07

## Purpose

This document defines Huddle's system-wide testing strategy.

It describes:

- which test layer should prove which behavior;
- when mocks, fakes, real datastores, or external test environments are appropriate;
- how concurrency, time, persistence, realtime behavior, and failure recovery are tested;
- how coverage is measured and improved;
- which evidence is required before a Phase is considered complete.

It does not duplicate each Context's test cases or each Phase's Definition of Done.

## Testing Principles

Huddle follows these principles:

1. Test behavior at the lowest layer that can prove it reliably.
2. Do not test the same rule unnecessarily at every layer.
3. Pure domain rules should not require infrastructure.
4. Application tests verify orchestration through ports.
5. Persistence guarantees require real persistence integration tests.
6. HTTP and realtime contracts require interface-level tests.
7. Critical user journeys require a small number of end-to-end tests.
8. Concurrency claims require concurrent integration tests.
9. Failure and recovery paths are first-class behavior.
10. Time-dependent tests use an injected clock.
11. Coverage is evidence, not the objective.
12. Capacity claims require measured target-environment evidence.

## Sources of Testing Authority

| Information                        | Authoritative source            |
| ---------------------------------- | ------------------------------- |
| System-wide testing policy         | This document                   |
| Context invariants requiring tests | Context document                |
| Current Phase acceptance tests     | Active Phase document           |
| Exact test scripts                 | Owning package's `package.json` |
| Exact CI sequence                  | Executable CI configuration     |
| Current test implementation        | Source code                     |
| Current coverage result            | Generated coverage output       |
| Deployment and capacity evidence   | Operations records              |
| Current implementation status      | `delivery/status.md`            |

A test example in archived documentation is not current implementation authority.

## Test Layers

### Domain Tests

Domain tests verify pure business behavior.

They should normally use:

- real domain objects;
- value objects;
- deterministic inputs;
- injected clock values where required;
- no database;
- no NestJS container;
- no HTTP;
- no provider SDK;
- no unnecessary mocks.

Typical subjects include:

- invariant enforcement;
- lifecycle transitions;
- authorization rules represented in the domain;
- quota comparison;
- ownership transitions;
- role behavior;
- effective-tier calculation;
- idempotent domain operations.

A Domain test should fail because a business rule changed, not because infrastructure configuration changed.

### Application Tests

Application tests verify use-case orchestration.

They may use fakes or mocks for application ports.

Typical subjects include:

- loading required aggregates;
- calling a consumer-owned port;
- performing validation before mutation;
- saving a successful result;
- not saving after failure;
- translating dependency outcomes;
- publishing or recording required domain results;
- enforcing application-level ordering.

Application tests should not re-test every internal branch already proven by a Domain test.

They should focus on what the use case coordinates.

### Persistence Integration Tests

Persistence integration tests verify behavior that mocks cannot prove.

Use a real datastore for:

- database constraints;
- repository mapping;
- migrations;
- schema validation;
- indexes;
- transaction isolation;
- optimistic concurrency;
- row locking;
- serialization failure;
- retry behavior;
- idempotency uniqueness;
- Outbox and Inbox atomicity;
- cursor ordering.

Relevant datastores include:

- PostgreSQL;
- MongoDB;
- Redis when real command or queue behavior matters.

A mocked repository cannot prove:

- a unique constraint;
- a compound index;
- a real transaction boundary;
- concurrent final-slot behavior;
- serialization failure;
- MongoDB schema validation;
- Redis or BullMQ recovery behavior.

### Interface Tests

Interface tests verify the behavior of an HTTP controller, realtime gateway, or provider callback boundary.

Typical subjects include:

- DTO validation;
- authentication guard wiring;
- actor identity extraction;
- authorization outcome mapping;
- application error to transport error mapping;
- response serialization;
- Socket.IO acknowledgement behavior;
- external-provider signature handling;
- invalid payload rejection.

A controller can often be tested without booting the complete application when only error mapping or delegation is under test.

Use the full application only when DI, middleware, pipes, guards, raw body, routing, or transport wiring is part of the behavior being proved.

### End-to-End Tests

End-to-end tests verify a small number of critical vertical journeys through production-like application composition.

They should prove that major layers work together.

Examples include:

- registration through authenticated access;
- persistent Message send and history retrieval;
- entitlement-protected mutation;
- webhook-driven subscription transition;
- Call or Meeting authorization through realtime transport.

E2E suites remain intentionally smaller than Domain and integration suites.

Do not repeat every validation edge case through full application bootstrap when a lower layer already proves it adequately.

## Risk-Based Test Depth

Testing depth is selected according to risk.

### Highest-Risk Areas

Require strong multi-layer evidence:

- authentication;
- credential handling;
- OAuth account linking;
- authorization;
- cross-user data isolation;
- Billing entitlements;
- Stripe webhook authenticity and idempotency;
- Outbox and Inbox recovery;
- quota concurrency;
- ownership transfer;
- Message idempotency;
- Meeting history boundaries;
- signaling authorization;
- participant capacity;
- secret handling;
- destructive migrations;
- backup and restore.

### Medium-Risk Areas

Usually require Domain or application tests plus selected integration tests:

- ordinary lifecycle transitions;
- pagination;
- profile batching;
- read-state transitions;
- role changes;
- delivery retry classification;
- projection updates.

### Lower-Risk Areas

May require focused unit or interface tests:

- straightforward formatting;
- simple mapping;
- presentation-only helpers;
- configuration with no business effect.

Low risk does not mean no testing. It means using the smallest test capable of proving the behavior.

## Coverage Policy

Huddle does not use one arbitrary repository-wide percentage as proof of quality.

Coverage is used to:

- identify untested executable paths;
- establish a baseline;
- prevent accidental regression;
- focus review on high-risk code;
- support a gradual coverage ratchet.

### Coverage Ratchet

When a package gains meaningful implementation:

1. measure its current coverage;
2. identify high-risk gaps;
3. add tests for those gaps;
4. record a realistic baseline;
5. avoid reducing the accepted baseline without explanation;
6. raise the threshold when evidence supports it.

Thresholds may differ by package or layer.

A pure Domain package may reasonably have higher coverage than infrastructure glue or generated code.

### Coverage Is Not Completion

A high percentage does not prove:

- authorization correctness;
- database constraints;
- concurrency safety;
- idempotency;
- recovery;
- deployment compatibility;
- media capacity;
- external-provider behavior.

A lower percentage does not automatically mean an untested critical path if exclusions and risk-based evidence are justified.

Generated code, migrations, configuration-only files, and unreachable framework scaffolding may require justified treatment rather than artificial tests.

## Testcontainers

Use Testcontainers when a test must prove behavior against a real datastore or service boundary.

Expected uses include:

- PostgreSQL repository integration;
- MongoDB schema and index behavior;
- Redis behavior;
- migration execution;
- application E2E requiring real persistence.

### Requirements

A Testcontainers test should:

- start an isolated ephemeral dependency;
- configure the application before importing or compiling components that read environment values;
- apply required migrations or initialization;
- avoid dependence on a developer's local database;
- use deterministic data;
- clean up safely;
- expose useful diagnostics on failure;
- use bounded timeouts;
- run in CI where the Phase requires it.

### Container Reuse

Reuse one container across tests only when:

- isolation is preserved;
- cleanup is reliable;
- runtime improvement is material;
- shared state cannot make ordering significant.

Do not optimize container startup before test reliability is established.

### Platform Considerations

Testcontainers behavior must be verified on:

- the primary development environment;
- CI Linux;
- Docker runtime used by contributors.

A passing local Windows test does not prove Linux or OCI behavior.

A passing Testcontainers test does not replace target OCI ARM64 validation for native media components.

## PostgreSQL Testing

Use real PostgreSQL integration tests for:

- migrations;
- unique constraints;
- foreign keys;
- transaction isolation;
- serializable retry;
- concurrency-safe quotas;
- Outbox atomicity;
- Inbox atomicity;
- lifecycle version persistence.

Tests for concurrent behavior must issue genuinely overlapping operations.

Sequentially calling the same use case twice does not prove race safety.

When testing serialization retries, verify:

- the conflict actually occurs;
- only the accepted transient error is retried;
- attempts are bounded;
- backoff does not create unbounded test duration;
- exhaustion produces the documented application error;
- non-retryable failures are not retried.

## MongoDB Testing

Use real MongoDB integration tests for:

- collection schema validation;
- supported document variants;
- compound indexes;
- uniqueness used for idempotency;
- stable cursor ordering;
- duplicate timestamps;
- Conversation-scoped history;
- timeline create or update behavior;
- lifecycle version protection.

Do not claim an index exists because it appears in design documentation.

Verify executable index creation.

MongoDB document flexibility does not remove schema or compatibility testing.

## Redis and BullMQ Testing

Use real Redis or BullMQ integration tests when behavior depends on:

- queue job identity;
- retry scheduling;
- worker interruption;
- Redis restart;
- pending-work recovery;
- socket adapter behavior;
- key expiry;
- coordination semantics.

Do not use Redis as the only test evidence for durable recovery.

Recovery tests must prove that PostgreSQL Outbox, Inbox, Notification, or other durable state can reconstruct pending work.

## Time-Dependent Testing

Backend time is authoritative for lifecycle decisions.

Use an injected clock or explicit `now` argument for:

- token expiry where supported by the unit under test;
- Call unanswered timeout;
- maximum Call duration;
- warning deadlines;
- Meeting schedule boundaries;
- Subscription period boundaries;
- retry scheduling;
- Notification timestamps.

Do not make tests wait for real minutes or hours.

Test applicable boundaries immediately:

- just before;
- exactly at;
- just after.

The production scheduler and the domain time calculation require separate tests.

## Concurrency Testing

Concurrency tests are required when two valid requests may violate one invariant.

Examples include:

- opposing Contact requests;
- Direct Conversation creation;
- final Group quota slot;
- invitation acceptance at capacity;
- ownership transfer;
- one non-ended Call per Conversation;
- final participant-capacity slot;
- duplicate Checkout initiation;
- duplicate webhook receipt.

A concurrency test should verify:

- all requests begin from the intended competing state;
- the operations overlap;
- the invariant remains valid;
- the accepted results are deterministic at the domain level;
- persistence contains no duplicate or over-limit result;
- infrastructure errors are translated.

Avoid tests that pass only because operations accidentally execute sequentially.

## Idempotency Testing

For every idempotent operation, test:

- initial success;
- duplicate after success;
- concurrent duplicate where relevant;
- duplicate after process restart where relevant;
- failure before persistence;
- failure after persistence but before acknowledgement;
- return or recovery of the accepted result;
- absence of duplicate side effects.

Incoming-event deduplication and outgoing-request idempotency require separate tests.

## Integration Event Testing

Provider tests verify:

- committed provider state;
- Outbox insertion in the same transaction;
- public Integration Event mapping;
- stable event identity;
- contract version;
- lifecycle version where required.

Consumer tests verify:

- duplicate delivery;
- unsupported version;
- invalid payload;
- idempotent local update;
- stale-event protection;
- failure after local commit;
- safe redelivery;
- recovery after restart.

A Domain Event test does not prove Integration Event delivery.

## External Provider Testing

Application logic should depend on ports rather than provider SDKs directly.

Use controlled fakes for:

- application orchestration;
- provider success;
- temporary failure;
- permanent failure;
- timeout;
- revoked authorization.

Use provider test modes, fixtures, or local signature utilities for applicable integration tests.

Examples include:

- OAuth callback validation;
- Stripe Checkout test mode;
- Stripe webhook signatures;
- Slack OAuth callback;
- Slack rate limiting or revoked credentials.

Tests must not:

- create unintended real charges;
- send unintended real Slack messages;
- use production credentials;
- depend on uncontrolled external accounts;
- log provider secrets.

Provider test success does not replace Huddle persistence and reconciliation tests.

## Realtime Testing

Realtime tests verify applicable:

- authentication handshake;
- invalid and expired token rejection;
- trusted socket principal;
- unauthorized room or session join;
- actor spoofing rejection;
- payload validation;
- persisted-before-broadcast behavior;
- duplicate command handling;
- reconnect;
- missed-event recovery;
- authorization change while connected.

Joining a Socket.IO room does not remove the need to test authorization for later protected events.

## WebRTC and Media Testing

Media testing requires several levels.

### Control-Plane Tests

Verify:

- Call or Meeting authorization;
- signaling scope;
- participant eligibility;
- capacity;
- resource ownership;
- lifecycle transitions;
- cleanup commands.

### Browser and Network Tests

Verify:

- offer and answer exchange;
- ICE candidate exchange;
- direct peer-to-peer media;
- TURN fallback;
- mediasoup produce and consume;
- participant disconnect;
- screen-share authorization where implemented.

### Target-Environment Validation

Verify on OCI ARM64:

- native package installation;
- Worker startup;
- announced public address;
- UDP behavior;
- TURN relay;
- media resource cleanup;
- CPU;
- memory;
- network usage;
- documented participant scenarios;
- worker failure.

Configured participant limits are not capacity evidence.

## Security Testing

Security-oriented tests include applicable:

- invalid token;
- expired token;
- token-type confusion;
- actor spoofing;
- cross-user resource access;
- unauthorized Group administration;
- unauthorized signaling;
- Meeting history-boundary bypass;
- client-provided tier;
- client-provided Stripe price;
- invalid external-provider signature;
- secret redaction;
- CORS rejection;
- private datastore exposure.

Test the backend decision, not merely whether the frontend hides a control.

## Failure and Recovery Testing

A feature that relies on asynchronous or external work must test applicable failure points.

Examples include:

- persistence unavailable;
- queue unavailable;
- worker interruption;
- Redis restart;
- process restart;
- duplicate delivery;
- out-of-order delivery;
- external provider unavailable;
- retry exhaustion;
- media worker failure;
- backup restoration.

Recovery tests verify the documented recovery source.

They must not assume an in-memory object or Redis queue is durable when PostgreSQL or MongoDB is the authoritative source.

## Test Data

Test data must be:

- deterministic;
- isolated;
- non-sensitive;
- explicit about ownership;
- safely removable;
- representative of boundary conditions.

Do not use production credentials or real private user data.

Factories and builders should express meaningful domain state rather than hide important setup behind overly generic defaults.

## Test Organization

Follow the owning package's executable test configuration.

Prefer names that identify the behavior under test.

Separate tests by concern when they require different:

- bootstrapping;
- datastore;
- timeout;
- environment;
- transport;
- cleanup.

Do not impose one repository-wide folder pattern if package tooling requires different layouts.

Do not scatter one use case's tests across many files without a clear layer or behavior distinction.

## Avoiding Duplicate Tests

Before adding a test, identify which layer owns the behavior.

Examples:

- Domain invariant: prove in Domain tests.
- Use-case saves after success: prove in application test.
- Unique constraint: prove in persistence integration test.
- HTTP error mapping: prove in interface test.
- Critical complete journey: prove once in E2E.

A higher-level smoke test may overlap a lower-level rule, but it should prove integration rather than repeat every branch.

Tests that only duplicate another layer's assertion increase maintenance cost without increasing confidence.

## CI Expectations

CI should run the validation required by the current delivery state.

Applicable steps include:

- deterministic dependency installation;
- code generation;
- lint;
- type checking;
- Domain and application tests;
- persistence integration tests;
- end-to-end tests;
- build.

The exact order and commands belong to executable CI configuration.

Testcontainers-based tests may run in the existing CI job while project size remains manageable.

Parallelization should be introduced only when measured CI duration justifies the added complexity.

A passing local suite is not sufficient when the Phase requires CI or target-environment evidence.

## Handling Flaky Tests

A flaky test is a defect.

Do not solve flakiness by:

- adding unbounded retries;
- increasing arbitrary sleeps;
- weakening assertions;
- ignoring the suite;
- making test order significant.

Investigate:

- shared state;
- clock dependence;
- race conditions;
- missing cleanup;
- network assumptions;
- port collisions;
- container readiness;
- asynchronous acknowledgement;
- resource exhaustion.

A temporarily quarantined test requires a visible owner, reason, and follow-up. Silent permanent quarantine is not acceptable.

## Phase Completion Evidence

A Phase may be marked complete only when:

- its required tests pass;
- required integration tests use the real dependency;
- critical failure paths are covered;
- concurrency claims are verified;
- contracts are tested where applicable;
- CI passes;
- target-environment validation is recorded where required;
- known gaps are documented;
- `delivery/status.md` is updated.

A checklist item is not completion evidence without the corresponding implementation or test result.

## Update Triggers

Update this document when:

- test-layer responsibility changes;
- coverage policy changes;
- CI test execution changes materially;
- a new datastore or external-provider category is introduced;
- media validation strategy changes;
- a recurring reliability problem requires a new policy.

Do not update this document for every individual test case.

Context-specific tests belong to the Context and active Phase documents.

## Source-of-truth Boundaries

This document is the source of truth for:

- test-layer responsibilities;
- risk-based testing;
- coverage-ratchet policy;
- Testcontainers policy;
- time and concurrency testing;
- idempotency testing;
- external-provider testing;
- realtime and media testing;
- failure and recovery testing;
- CI testing expectations.

This document is not the source of truth for:

- exact package versions;
- exact test script names;
- every Context test case;
- current coverage percentage;
- current test inventory;
- Phase-specific completion criteria;
- CI implementation.

Those concerns belong to package manifests, source code, generated reports, active Phase documents, and executable CI configuration.
