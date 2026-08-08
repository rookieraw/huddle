# Phase 1 — Identity

Status: Completed  
Completed before: 2026-08 documentation restructure  
Next phase: Phase 2 — Contacts and Chat

## Purpose

Record the delivery boundary completed by Phase 1.

This is a historical delivery record.

It is not the source of truth for Identity's current domain model, API contracts, database schema, or later cross-context capabilities.

Source code and automated tests remain authoritative for exact Phase 1 runtime behavior.

## Objective

Establish the user identity and authentication foundation required by later Huddle capabilities.

## Delivered Scope

Phase 1 delivered:

- user registration;
- email verification;
- credential-based login;
- Google OAuth login;
- GitHub OAuth login;
- access-token handling;
- refresh-token handling;
- Identity domain and application boundaries;
- Identity-owned PostgreSQL persistence;
- Identity unit and integration tests;
- NestJS Identity module integration.

The implementation is located under:

```text
libs/identity/
```

## Architectural Baseline

Phase 1 established Identity as a bounded context inside the modular monolith.

Identity owns:

- user identity;
- credentials;
- OAuth identity links;
- email-verification behavior;
- authentication-token behavior;
- Identity persistence.

Other contexts must not access Identity:

- repositories;
- entities;
- persistence models;
- password data;
- OAuth identity links;
- provider tokens.

At Phase 1 completion, no other bounded context required a formal cross-context Identity Public API.

Adding such an API for a later real consumer is an explicit later-phase integration step. Its absence does not make Phase 1 incomplete.

## Completion Evidence

Phase 1 completion is supported by:

- implemented Identity use cases;
- domain tests;
- application tests;
- persistence integration tests;
- authentication integration;
- Google OAuth integration;
- GitHub OAuth integration;
- successful NestJS application composition.

Exact endpoint names, classes, test names, and persistence details are intentionally not duplicated in this historical record.

## Explicitly Not Included

Phase 1 did not include:

- `displayName`;
- Contacts;
- Direct or Group Conversations;
- Chat Messages;
- voice or video Calls;
- Billing;
- subscription entitlements;
- Meetings;
- Notification delivery;
- cross-context Identity authentication API;
- cross-context Identity directory API;
- cross-context Identity profile-query API;
- user-profile projections;
- Identity Integration Events;
- Identity Transactional Outbox;
- avatar storage;
- account suspension or account-status policy;
- Enterprise SSO;
- Workspace identity.

These exclusions are Phase 1 boundaries, not unfinished Phase 1 requirements.

## Later Identity Evolution

Phase 2 is authorized to add only the Identity capabilities required by Chat, including:

- `displayName`;
- a minimal authentication-verification capability;
- a minimal directory-existence capability;
- a minimal profile-query capability;
- the required migration for existing Phase 1 users.

The current rules for those capabilities belong to:

- [`../../contexts/identity.md`](../../contexts/identity.md)
- [`02-chat.md`](02-chat.md)
- [`../../decisions/0004-cross-context-integration.md`](../../decisions/0004-cross-context-integration.md)

This later evolution does not reopen or alter the completed Phase 1 scope.

## Maintenance Rule

Completed status does not prohibit:

- defect fixes;
- security fixes;
- dependency maintenance;
- compatible refactoring;
- test improvements;
- documentation corrections.

A new Identity capability still requires:

- an active delivery phase that authorizes it;
- updated Identity Context documentation;
- updated public contracts when externally visible;
- appropriate tests;
- an ADR when the architectural decision is significant.

Maintenance must not be used to introduce unrelated feature expansion.

## Source-of-truth Boundaries

This document is the source of truth for:

- Phase 1 completion status;
- Phase 1 delivered boundary;
- Phase 1 explicit exclusions.

This document is not the source of truth for:

- current Identity domain rules;
- later Identity capabilities;
- HTTP payloads;
- token payloads;
- authentication implementation details;
- database schema;
- current test inventory;
- current delivery status after Phase 1.

Those concerns belong to:

- [`../../contexts/identity.md`](../../contexts/identity.md);
- contract documents;
- source code;
- migrations;
- automated tests;
- [`../status.md`](../status.md).
