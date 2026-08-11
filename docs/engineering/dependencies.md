# Dependency Management

Status: Accepted engineering policy  
Last reviewed: 2026-08-07

## Purpose

This document defines how Huddle selects, installs, updates, verifies, and documents software dependencies.

It does not duplicate package versions from manifests or the lockfile.

Package versions change more frequently than architectural documentation. Copying them into Markdown would create another stale source of truth.

## Sources of Truth

Dependency information follows this authority order:

| Information                                  | Authoritative source                         |
| -------------------------------------------- | -------------------------------------------- |
| Direct dependency declaration                | The owning package's `package.json`          |
| Exact resolved version                       | `pnpm-lock.yaml`                             |
| Package-manager version                      | Root `package.json` `packageManager` field   |
| Workspace package discovery                  | `pnpm-workspace.yaml`                        |
| Dependency build approval                    | `pnpm-workspace.yaml` `allowBuilds`          |
| Dependency policy and update process         | This document                                |
| Why an architectural dependency was selected | Relevant ADR or Context document             |
| Whether a feature is implemented             | Source code, tests, and `delivery/status.md` |

A version written in an issue, chat, planning note, archived document, or installation example is not authoritative.

## Workspace Structure

Huddle is a pnpm Workspace containing:

```text
apps/*
libs/*
```

Current package categories include:

- root engineering tooling;
- `apps/api-gateway`;
- `apps/web`;
- bounded-context libraries;
- shared libraries.

Internal Workspace dependencies use the pnpm Workspace protocol where applicable:

```json
{
  "dependencies": {
    "@huddle/example": "workspace:*"
  }
}
```

A Context library must not add another Context library as a dependency merely to bypass the documented cross-context integration pattern.

## Dependency Ownership

A dependency belongs in the narrowest package that directly requires it.

### Root Dependencies

Root dependencies are reserved for tooling shared across the Workspace, such as:

- formatting;
- repository-wide linting;
- commit conventions;
- Git hooks;
- Workspace orchestration.

A runtime dependency must not be placed at the root solely to make it available implicitly to every package.

### Application Dependencies

An application package owns dependencies required for its composition or runtime hosting, such as:

- NestJS application hosting;
- Next.js application runtime;
- application composition adapters;
- deployment entry points.

The API Gateway may depend on public Context packages for composition.

It must not depend on Context internal source paths.

### Context-Library Dependencies

A Context library owns dependencies required by its own:

- domain implementation;
- application layer;
- persistence adapters;
- provider integrations;
- tests.

A Context must not rely on a dependency being hoisted accidentally from another Workspace package.

### Development Dependencies

Testing, compilation, linting, type definitions, and code generation belong in `devDependencies` unless the deployed runtime requires them.

Package placement must be verified under pnpm's strict dependency resolution rather than assumed from npm-style hoisting.

## Installation Timing

Install a dependency only when an active delivery Phase has a real implementation use for it.

Do not install a future dependency merely because it appears in:

- target architecture;
- a deferred Context capability;
- an archived package plan;
- a possible future adapter;
- a stretch goal.

Examples:

- a package being installed does not authorize the corresponding feature;
- a feature being planned does not require installing its dependency early;
- an unused package must not be treated as evidence that a capability is implemented.

The active Phase document remains the implementation authority.

## Selecting a Dependency

Before adding a dependency, verify:

1. the active use case requires it;
2. the owning package is identified;
3. the standard library or an existing dependency does not already provide the capability;
4. the package's official documentation supports the intended use;
5. the version exists in the official registry;
6. peer dependencies are compatible;
7. Node.js and TypeScript support are compatible;
8. ESM and CommonJS behavior is compatible with the owning package;
9. native build requirements are understood;
10. OCI ARM64 compatibility is acceptable where relevant;
11. license and maintenance status are acceptable;
12. the package does not introduce unnecessary overlapping infrastructure;
13. security advisories have been reviewed;
14. required build scripts are understood before approval.

Search-result summaries and remembered version numbers are insufficient evidence.

Use the official registry, official release notes, and official package documentation.

## Version Declaration

Huddle does not use one universal exact-pin or caret rule for every package.

The declaration strategy is selected by dependency risk.

### Exact Version

Consider an exact version when:

- several packages must move in lockstep;
- code generation must match runtime libraries;
- native components have compatibility risk;
- a framework package has demonstrated breaking minor or patch behavior;
- deployment reproducibility requires deliberate upgrades;
- peer compatibility is narrow.

### Compatible Range

Consider a compatible range when:

- the package follows stable semantic versioning;
- peer compatibility is broad;
- patch and minor security fixes should be adoptable;
- the owning package's tests adequately detect regressions.

### Lockfile

Regardless of declaration style, `pnpm-lock.yaml` is the source of the exact resolved dependency graph.

The lockfile must be committed when dependency resolution changes.

An exact version in `package.json` does not replace the lockfile.

A caret range does not make builds unreproducible when CI and deployment use the committed lockfile correctly.

## Coupled Dependency Groups

Some dependencies must be reviewed and upgraded as a group.

Examples include:

- NestJS runtime and testing packages;
- Prisma CLI, client, adapter, and generated artifacts;
- Next.js, React, and related lint tooling;
- mediasoup server and client compatibility;
- Jest and its TypeScript integration;
- ESLint core, framework configurations, and plugins.

Do not update one member of a coupled group without checking:

- peer dependency ranges;
- release notes;
- build output;
- type checking;
- tests;
- generated code;
- deployment compatibility.

The exact versions remain in manifests and `pnpm-lock.yaml`.

## pnpm Build Approval

pnpm dependency build scripts are controlled by:

`D:\sideproject\Huddle\pnpm-workspace.yaml`

The `allowBuilds` section is executable security configuration.

Before allowing a dependency build script:

1. identify why the script exists;
2. determine whether it is functionally required;
3. review whether it downloads or executes native code;
4. confirm the expected platforms;
5. consider CI and OCI ARM64 behavior;
6. record unusual security or telemetry decisions in the dependency-change review.

Do not copy the current `allowBuilds` list into this document.

The YAML file is the only current list.

A package appearing automatically in `allowBuilds` is not an automatic approval.

## Native Dependencies and ARM64

Dependencies with native components require additional verification.

Relevant categories include:

- password hashing;
- Prisma engines;
- mediasoup;
- image processing;
- database drivers with native acceleration;
- optional serialization acceleration;
- Testcontainers dependencies.

For a native dependency, verify:

- local development platform;
- CI platform;
- Linux container build;
- OCI Ampere A1 ARM64;
- required compiler and system libraries;
- prebuilt-binary availability;
- fallback behavior;
- startup and runtime behavior.

A successful install on Windows or x86 CI does not prove OCI ARM64 compatibility.

Target-environment validation belongs to the relevant delivery Phase.

## ESM and CommonJS Compatibility

Before adding or upgrading a package, verify its module behavior against the owning package's TypeScript and Jest configuration.

Pay particular attention to:

- ESM-only packages;
- dynamic `import()`;
- conditional exports;
- Jest VM behavior;
- generated Prisma modules;
- development versus production export conditions;
- TypeScript module resolution.

Do not add a second library merely to work around a configuration issue without first identifying the actual module-boundary problem.

Any required runtime flag or compatibility workaround must be:

- scoped to the affected package;
- covered by tests;
- documented near executable configuration;
- revisited when the dependency changes materially.

## Framework and Tooling Exceptions

Workspace packages may temporarily require different major versions of a tool when an upstream framework or plugin has incompatible peer requirements.

An exception must be:

- isolated to the affected package;
- visible in that package's manifest;
- supported by a concrete compatibility reason;
- verified by lint, build, and type checking;
- revisited during dependency review.

Do not claim that one root tooling version governs a package that declares and resolves its own conflicting local version.

## Adding a Dependency

A dependency change should include:

1. add the package to the narrowest owning Workspace package;
2. update the lockfile;
3. review new `allowBuilds` entries;
4. review peer dependency warnings;
5. run type checking;
6. run affected tests;
7. run affected linting;
8. run the affected build;
9. run integration tests for persistence or provider adapters;
10. verify target platform behavior when applicable;
11. update documentation only when the dependency changes architecture, setup, operations, or an accepted compatibility exception.

Do not add a package by manually editing only the lockfile.

## Removing a Dependency

Before removing a dependency:

1. confirm no source, script, configuration, generator, or test uses it;
2. remove it from the owning manifest;
3. update the lockfile;
4. remove obsolete build approval;
5. remove obsolete configuration;
6. run affected validation;
7. update architecture or engineering documentation when the dependency represented a documented decision.

An unused package should not remain merely because a future Phase may need it.

A separately scoped cleanup may be preferable when removal would distract from the active feature task.

## Upgrade Process

A dependency upgrade should be performed separately from unrelated feature work when risk is material.

Review:

- official release notes;
- migration guides;
- peer compatibility;
- transitive dependency changes;
- security advisories;
- native build behavior;
- generated code;
- configuration changes;
- deprecations;
- rollback strategy.

After upgrading, run the affected validation set.

For a coupled group, update and verify the group together.

Do not update dependencies solely because a registry reports a newer version.

## Verification Commands

Run the commands appropriate to the change from:

`D:\sideproject\Huddle`

Typical Workspace validation includes:

```powershell
pnpm install --frozen-lockfile
pnpm list --depth=0
pnpm dedupe --check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Run package-specific integration or end-to-end tests when the root command does not cover them.

The exact CI command sequence belongs to executable CI configuration.

A Markdown command list does not override the scripts in the manifests.

## Dependency Security

Dependency review includes:

- known vulnerabilities;
- package provenance;
- maintenance activity;
- unexpected install scripts;
- transitive native binaries;
- telemetry;
- secret handling;
- runtime network behavior;
- license suitability.

A vulnerability report must be evaluated in the context of:

- affected version;
- reachable code path;
- deployed environment;
- available fix;
- upgrade risk.

Do not suppress a vulnerability solely to make an automated report green.

Do not perform an unrelated major upgrade without understanding its compatibility impact.

## Known Dependency-Hygiene Follow-ups

The documentation migration identified differences that require a later, separately scoped dependency review:

- NestJS packages are not declared with one consistent exact-or-range policy across all Workspace packages.
- TypeScript declaration strategy differs between packages.
- API Gateway and root ESLint declarations do not currently express one clearly documented resolution policy.
- Some later-phase framework packages are already installed even though their product capability is not implemented.
- Existing `allowBuilds` approvals should be reviewed against current functional need and target-platform behavior.

These are not automatically Phase 2 blockers.

They must not be silently “fixed” inside the documentation restructure.

Any cleanup should:

- inspect the actual lockfile resolution;
- identify affected packages;
- verify peer dependencies;
- run the complete affected validation set;
- avoid combining unrelated major upgrades.

## Deferred Dependency Planning

This document does not maintain versions or installation commands for future dependencies.

When a later Phase begins:

1. identify the exact implementation need;
2. confirm the package is still appropriate;
3. verify its then-current official version;
4. evaluate alternatives;
5. install it only in the owning package;
6. record a significant architectural choice in an ADR when required.

An archived package plan must not be executed without revalidation.

## Update Triggers

Update this document when:

- dependency authority changes;
- pnpm policy changes;
- build-script approval policy changes;
- Workspace ownership rules change;
- a recurring compatibility exception is accepted;
- native dependency validation changes materially;
- the deployment architecture changes dependency requirements.

Do not update it for every patch-version change.

Version changes belong in manifests and the lockfile.

## Source-of-truth Boundaries

This document is the source of truth for:

- dependency ownership;
- installation timing;
- version-selection policy;
- coupled-package review;
- build-script approval policy;
- native dependency validation;
- dependency update and removal process;
- dependency hygiene follow-ups.

This document is not the source of truth for:

- current package versions;
- exact resolved transitive dependencies;
- feature implementation status;
- CI script definitions;
- future package versions;
- Docker image versions.

Those concerns belong to:

- package manifests;
- `pnpm-lock.yaml`;
- `pnpm-workspace.yaml`;
- executable CI configuration;
- delivery status;
- deployment configuration.
