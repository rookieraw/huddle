# Testing Strategy

Status: Accepted engineering policy  
Last reviewed: 2026-08-22

## Purpose

This document defines Huddle's system-wide testing strategy.

It describes:

- which test layer should prove which behavior;
- when mocks, fakes, real datastores, browsers, or external test environments are appropriate;
- how frontend, concurrency, time, persistence, realtime behavior, and failure recovery are tested;
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
13. A failing test is RED evidence only when it fails because the intended behavior is absent or incorrect.
14. Boundary claims require evidence from every translation, persistence, wiring, or compatibility layer that can violate them.
15. Frontend tests prove user-observable behavior and contract translation rather than framework internals.
16. Client-side hiding or disabling never replaces backend authorization evidence.

## Sources of Testing Authority

| Information                        | Authoritative source            |
| ---------------------------------- | ------------------------------- |
| System-wide testing policy         | This document                   |
| Cross-capability user experience   | `product/user-experience.md`    |
| Context invariants requiring tests | Context document                |
| Current Phase acceptance tests     | Active Phase document           |
| Exact test scripts                 | Owning package's `package.json` |
| Exact CI sequence                  | Executable CI configuration     |
| Current test implementation        | Source code                     |
| Current coverage result            | Generated coverage output       |
| Deployment and capacity evidence   | Operations records              |
| Current implementation status      | `delivery/status.md`            |

A test example in archived documentation is not current implementation authority.

## Test-Driven Change Evidence

A TDD cycle proves one observable behavior at a time.

### RED Evidence

RED is established only when:

- the new or changed test has been executed;
- the test reaches the intended assertion or observable failure;
- the failure is caused by the absent or incorrect behavior;
- unrelated existing failures are distinguished from the intended RED.

Compilation errors, test-discovery failures, invalid configuration, unavailable infrastructure, and unrelated assertion failures do not prove RED.

### GREEN Evidence

GREEN is established only when:

- the previously failing test passes;
- the smallest directly affected regression set passes;
- required higher-layer evidence is not replaced by a lower-layer fake or mock.

Passing one focused test does not prove persistence, dependency-injection wiring, transport compatibility, browser behavior, accessibility, or complete application composition unless that test actually exercises the claimed layer.

### REFACTOR Evidence

A refactor must preserve observable behavior.

Run the focused behavior tests and verification for every layer structurally affected by the refactor. A refactor that adds a new behavior begins a new TDD cycle.

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
- no browser;
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

Interface tests verify the behavior of an HTTP controller, realtime gateway, provider callback boundary, or frontend contract adapter.

Typical backend subjects include:

- DTO validation;
- authentication guard wiring;
- actor identity extraction;
- authorization outcome mapping;
- application error to transport error mapping;
- response serialization;
- Socket.IO acknowledgement behavior;
- external-provider signature handling;
- invalid payload rejection.

Typical frontend-adapter subjects include:

- request and response translation;
- stable public-error mapping;
- token or session outcome mapping after its transport is accepted;
- pagination and cursor translation;
- realtime acknowledgement translation;
- duplicate or late delivery handling;
- preservation of dependency failure versus valid empty results.

A controller can often be tested without booting the complete application when only error mapping or delegation is under test.

A frontend adapter can often be tested without rendering the complete application when only contract translation is under test.

Use the full application or browser only when DI, middleware, pipes, guards, raw body, routing, session behavior, navigation, or transport wiring is part of the behavior being proved.

### Frontend Component Tests

Frontend component tests verify user-observable presentation and interaction in a controlled rendering environment.

Typical subjects include:

- accessible names and semantic structure;
- keyboard interaction;
- focus movement;
- loading, empty, pending, confirmed, failed, and unavailable states;
- validation feedback;
- enabled and disabled control behavior;
- preservation of safe user input after failure;
- navigation intent;
- responsive presentation behavior that can be proven without a real browser.

Component tests should assert what a user can perceive or operate.

Avoid assertions tied only to:

- internal hook calls;
- private component state;
- CSS implementation details with no user-visible effect;
- framework-generated markup unrelated to behavior;
- snapshots that obscure meaningful interaction.

A component test does not prove:

- backend authorization;
- HTTP routing;
- persistence;
- realtime delivery;
- provider callbacks;
- browser storage security;
- production responsive layout.

### End-to-End Tests

End-to-end tests verify a small number of critical vertical journeys through production-like application composition.

They should prove that major layers work together.

Examples include:

- registration through authenticated access;
- a browser Authentication and session journey after its transport is accepted;
- Contacts through opening a Direct Conversation;
- persistent Message send and history retrieval;
- realtime Message delivery and durable reconciliation;
- entitlement-protected mutation;
- webhook-driven subscription transition;
- Call or Meeting authorization through realtime transport.

E2E suites remain intentionally smaller than Domain, component, and integration suites.

Do not repeat every validation edge case through full application bootstrap or a real browser when a lower layer already proves it adequately.

A browser test using mocked network responses does not prove backend routing, authorization, persistence, or application composition.

## Boundary and Compatibility Verification

Every translation boundary must validate the runtime data it receives.

For untyped or externally decoded values:

- test missing required values;
- test values of the wrong runtime type;
- test malformed values relevant to the contract;
- do not treat a TypeScript annotation or generic decoder parameter as runtime validation.

Different boundary claims require different evidence:

| Claim                                                   | Required evidence                                        |
| ------------------------------------------------------- | -------------------------------------------------------- |
| Application orchestration and outcome translation       | Application test through the owned port                  |
| Repository mapping or persisted result                  | Real persistence integration test                        |
| Exact adapter query shape or batching call count        | Focused adapter test                                     |
| Package entrypoint exposure                             | Import or compilation evidence                           |
| NestJS provider exposure                                | Consumer-module resolution test through the public token |
| Existing HTTP or realtime path remains compatible       | Representative interface or end-to-end test              |
| Frontend public-contract translation                    | Focused frontend adapter test                            |
| User-observable component interaction                   | Frontend component test                                  |
| Complete browser journey                                | Browser E2E through the claimed composition              |
| Missing result remains distinct from dependency failure | Success, missing-result, and failure-path tests          |

One test may prove more than one claim only when it actually crosses all relevant boundaries.

A fake repository can prove that an application service calls one port operation. It cannot prove the datastore query, persistence mapping, provider export, application composition, or frontend behavior behind that port.

A mocked frontend response can prove presentation mapping. It cannot prove the backend contract or deployed journey.

## Risk-Based Test Depth

Testing depth is selected according to risk.

### Highest-Risk Areas

Require strong multi-layer evidence:

- authentication;
- browser token and refresh handling;
- credential handling;
- OAuth account linking and callback handoff;
- authorization;
- cross-user data isolation;
- Billing entitlements;
- Stripe webhook authenticity and idempotency;
- Outbox and Inbox recovery;
- quota concurrency;
- ownership transfer;
- Message idempotency;
- realtime UI reconciliation after uncertain delivery;
- Meeting history boundaries;
- signaling authorization;
- participant capacity;
- secret handling;
- destructive migrations;
- backup and restore.

### Medium-Risk Areas

Usually require Domain or application tests plus selected integration, component, or browser tests:

- ordinary lifecycle transitions;
- pagination;
- profile batching;
- read-state transitions;
- role changes;
- delivery retry classification;
- projection updates.
- cross-capability navigation;
- pending and failure presentation;
- responsive layout transitions affecting operation.

### Lower-Risk Areas

May require focused unit, component, or interface tests:

- straightforward formatting;
- simple mapping;
- presentation-only helpers;
- static content;
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

A pure Domain package may reasonably have higher coverage than infrastructure glue, presentation composition, or generated code.

### Coverage Is Not Completion

A high percentage does not prove:

- authorization correctness;
- database constraints;
- concurrency safety;
- idempotency;
- browser interoperability;
- accessibility;
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

## Frontend Testing

Frontend tests are selected by user-visible risk and the boundary being claimed.

The accepted cross-capability experience belongs to:

[`../product/user-experience.md`](../product/user-experience.md)

The applicable Phase owns required journeys and completion evidence.

### Pure Presentation Logic

Test pure functions without a component renderer when possible.

Examples include:

- timestamp presentation;
- initials or placeholder-avatar derivation;
- display-value normalization;
- ordering of already-authorized view data;
- user-visible status mapping from a trusted frontend model.

Do not copy Domain validation or authorization rules into presentation helpers.

### Component Interaction

Use component tests for:

- semantic structure;
- accessible names;
- keyboard operation;
- focus behavior;
- loading and empty states;
- validation feedback;
- pending, confirmed, and failed mutations;
- dependency-unavailable presentation;
- retry controls;
- preservation of safe user input;
- narrow-layout interaction where a real browser is not required.

Prefer role, label, visible text, and user interaction assertions over internal component structure.

A component hidden by authorization-derived input does not prove the backend authorization decision.

### Public-Contract Translation

Frontend HTTP and realtime adapters require focused tests for applicable:

- request construction;
- response narrowing;
- stable error mapping;
- pagination and cursor behavior;
- client-operation identity;
- token-expiration outcome;
- acknowledgement mapping;
- missing result versus dependency failure;
- unsupported or malformed runtime payloads.

Static TypeScript types do not validate runtime HTTP or Socket.IO data.

Do not create frontend-only meanings that contradict the owning public contract.

### Browser Journeys

Use real-browser E2E tests for a small number of critical integrated journeys, including applicable:

- Authentication and session establishment after the browser transport is accepted;
- session expiration and reauthentication;
- Contacts through opening a Direct Conversation;
- Message send through durable history;
- realtime delivery across two authenticated sessions;
- disconnect, reconnect, and durable reconciliation;
- entitlement-protected behavior;
- OAuth or provider redirect behavior where environment validation is required;
- keyboard navigation across major application regions;
- representative narrow-screen operation.

A browser test must state whether it uses:

- real application composition;
- controlled provider behavior;
- mocked network responses;
- a deployed environment.

Do not use a mocked browser journey as evidence for backend persistence, authorization, provider integration, or deployment.

### Realtime Presentation and Reconciliation

Frontend realtime tests verify applicable:

- connected state;
- disconnected state;
- reconnecting state;
- token-expiration transition;
- duplicate delivery;
- late delivery;
- acknowledgement loss;
- uncertain local pending state;
- durable history reconciliation;
- removal of stale or duplicate presentation.

Do not manufacture an ordering or retry guarantee absent from the realtime contract.

### Accessibility Evidence

The applicable Phase or frontend-foundation task must define the accepted accessibility target before implementation.

Evidence should cover applicable:

- semantic landmarks;
- headings and labels;
- keyboard-only operation;
- visible focus;
- dialog and menu focus management;
- status and error announcement;
- non-color-only meaning;
- reduced-motion behavior;
- contrast;
- automated checks;
- focused manual checks for behavior automation cannot prove reliably.

Automated accessibility checks do not replace keyboard and assistive-technology review of critical journeys.

### Responsive Evidence

The supported-browser and responsive baseline must be explicit before implementation.

Verify representative:

- desktop layout;
- narrow-screen layout;
- navigation transition;
- Conversation-list and active-Conversation transition;
- overflow behavior;
- touch-target operability where applicable;
- focus preservation after responsive layout changes;
- absence of hover-only core behavior.

Pixel-identical layouts are not required across browsers or viewport sizes.

Responsive evidence proves operability and comprehension, not visual sameness.

### Test Doubles

Frontend tests may use controlled responses to isolate presentation behavior.

A test double must preserve the semantic distinction between:

- success;
- valid empty result;
- validation failure;
- authentication failure;
- authorization failure;
- dependency unavailable;
- unexpected failure;
- accepted asynchronous work still pending.

Do not use one generic failure response when the user-visible behavior depends on the owning contract category.

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

Backend realtime evidence and frontend realtime-presentation evidence are separate claims.

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

Browser Authentication tests must distinguish user-visible session behavior from the backend security evidence for token verification, storage, rotation, CSRF, XSS, CORS, and provider callback handling.

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

They must not assume an in-memory object, frontend state, or Redis queue is durable when PostgreSQL or MongoDB is the authoritative source.

## Test Data

Test data must be:

- deterministic;
- isolated;
- non-sensitive;
- explicit about ownership;
- safely removable;
- representative of boundary conditions.

Do not use production credentials or real private user data.

Frontend fixtures must not contain real tokens, private Messages, provider secrets, or personal account data.

Factories and builders should express meaningful domain or user-visible state rather than hide important setup behind overly generic defaults.

## Test Organization

Follow the owning package's executable test configuration.

Prefer names that identify the behavior under test.

Separate tests by concern when they require different:

- bootstrapping;
- renderer or browser;
- datastore;
- timeout;
- environment;
- transport;
- cleanup.

Do not impose one repository-wide folder pattern if package tooling requires different layouts.

Do not scatter one use case or frontend journey's tests across many files without a clear layer or behavior distinction.

## Avoiding Duplicate Tests

Before adding a test, identify which layer owns the behavior.

Examples:

- Domain invariant: prove in Domain tests.
- Use-case saves after success: prove in application test.
- Unique constraint: prove in persistence integration test.
- HTTP error mapping: prove in interface test.
- Frontend contract translation: prove in frontend adapter test.
- User-visible component state: prove in component test.
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
- frontend unit and component tests where implemented;
- persistence integration tests;
- end-to-end tests;
- build.

The exact order and commands belong to executable CI configuration.

Testcontainers-based tests may run in the existing CI job while project size remains manageable.

Browser tests may run in the existing CI structure while their environment and runtime remain reliable. Parallelization or separate jobs require measured need.

Parallelization should be introduced only when measured CI duration justifies the added complexity.

A passing local suite is not sufficient when the Phase requires CI, browser, provider, or target-environment evidence.

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
- browser timing;
- focus and animation timing;
- resource exhaustion.

A temporarily quarantined test requires a visible owner, reason, and follow-up. Silent permanent quarantine is not acceptable.

## Phase Completion Evidence

A Phase may be marked complete only when:

- its required tests pass;
- required integration tests use the real dependency;
- critical failure paths are covered;
- concurrency claims are verified;
- contracts are tested where applicable;
- required user-visible browser journeys pass where the Phase includes frontend delivery;
- accessibility and responsive evidence meets the accepted Phase baseline;
- CI passes;
- target-environment validation is recorded where required;
- known gaps are documented;
- `delivery/status.md` is updated.

A checklist item is not completion evidence without the corresponding implementation or test result.

## Update Triggers

Update this document when:

- test-layer responsibility changes;
- frontend verification responsibility changes;
- coverage policy changes;
- CI test execution changes materially;
- a new datastore or external-provider category is introduced;
- media validation strategy changes;
- a recurring reliability problem requires a new policy;
- a recurring boundary-validation or compatibility gap requires a new policy.

Do not update this document for every individual test case.

Context-specific tests belong to the Context and active Phase documents.

## Source-of-truth Boundaries

This document is the source of truth for:

- test-layer responsibilities;
- TDD evidence requirements;
- boundary and compatibility verification;
- frontend testing;
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
- selected frontend test dependencies;
- every Context test case;
- every frontend component test;
- current coverage percentage;
- current test inventory;
- supported-browser product policy;
- accessibility conformance target;
- Phase-specific completion criteria;
- CI implementation.

Those concerns belong to package manifests, source code, generated reports, Product experience, active Phase documents, and executable CI configuration.
