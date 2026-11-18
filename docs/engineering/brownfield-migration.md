# Brownfield Migration Principles

Status: Accepted engineering policy  
Last reviewed: 2026-11-19

## Purpose

This document describes how Huddle changes behavior that is already
implemented, and how known deviations from adopted standards are recorded and
retired.

It applies to every change that alters implemented behavior or a contract:
HTTP, realtime, Integration Events, persistence, and configuration.

The decision and its rationale are recorded in
[ADR 0009](../decisions/0009-adopt-named-standards-and-brownfield-migration-principles.md).
The adopted standards and their deviations are listed in the
[shared HTTP contract](../contracts/http.md#standards-conformance) and the
[security architecture](../architecture/security.md#standards-conformance).

## The Five Principles

### 1. Change in Small Steps

Replace or improve an existing part behind a stable boundary, one reviewable
outcome at a time. Route new behavior to the replacement and retire the old
part once nothing depends on it (Strangler Fig). Never replace a working part
in one large rewrite.

An outcome that would change several independent behaviors at once is split
before implementation.

### 2. Record Current Behavior Before Changing It

Before an outcome changes implemented behavior, the behavior it changes is
recorded by a test that passes against the unchanged code and pins the
observable behavior (a characterization test), or by an existing test that
already pins it.

A characterization test records what the code does, not what it should do.
It is not RED evidence for the change; see
[Test-Driven Change Evidence](testing.md#test-driven-change-evidence).

### 3. Change Contracts Expand-then-Contract

For a contract element that an owning contract defines and marks
Implemented, and not Transitional:

1. **Expand** — add the new form alongside the old one, so existing clients
   keep working.
2. **Migrate** — move every known consumer to the new form.
3. **Contract** — remove the old form in a later change.

These may change in one step, because no client was promised them or the
owning contract announced the change first:

- behavior that no contract defines as stable, such as framework-generated
  output recorded only as observed current behavior;
- behavior that an owning contract marks Transitional;
- a [Known defect or Decided change](../contracts/http.md#known-defects-and-decided-changes)
  that the owning contract records before the change is implemented.

A change that cannot have an expand step, such as a status change, is
recorded as a Decided change before it is implemented.

### 4. Label Implemented Versus Accepted

Every contract element carries its state as defined in
[Contract States](../contracts/http.md#contract-states). An accepted target is
never described as implemented, and current implementation state is owned by
[`delivery/status.md`](../delivery/status.md).

### 5. Record Each Known Deviation with Its Plan

Each known deviation from an adopted standard is recorded with its plan: a
fix plan, or a recorded decision to accept it permanently. What counts as a
deviation is defined in
[ADR 0009](../decisions/0009-adopt-named-standards-and-brownfield-migration-principles.md#deviation-records).

## Deviation Records

### Where a Record Is Kept

Each adopted RFC clause is listed in exactly one standards section: the
[shared HTTP contract](../contracts/http.md#standards-conformance) or the
[security architecture](../architecture/security.md#standards-conformance).

- A record goes to the deviation register of the document whose standards
  section lists its RFC clauses.
- A record that cites only ASVS 5.0 requirements goes to the security
  architecture register.
- An ASVS requirement cited alongside an RFC clause does not move the record.
- If a deviation's RFC clauses are listed in different documents, it is
  recorded as one row in each register. Each row cites only that document's
  clauses and links to the other row.

### Record Format

One row per deviation per register:

| Field               | Content                                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| Behavior            | What Huddle does, naming the affected operations and linking to their owning contract where one exists          |
| Standard and clause | Only the clauses that count, each with its version and keyword or level; analogy adoptions labeled              |
| Current behavior    | The observable behavior, without mechanism or library detail; a link instead where an owning document states it |
| Reason              | Why the behavior exists or is kept                                                                              |
| Decision date       | The date the project owner decided the record                                                                   |
| Plan                | A fix plan naming the outcome or change that closes it, or "Accepted permanently"                               |

A register lists the deviations known when it was last updated. It is not the
result of a conformance assessment.

### Lifecycle

- **Found** — a change that discovers a deviation records it in the same
  change, or reports it as a candidate when recording it is outside that
  change's scope.
- **Decided** — the owner decides the plan; the row records the decision
  date.
- **Fixed** — the change that meets the clause removes the row in the same
  change. A row with several parts stays until every part is closed. Rows
  split across registers are removed independently, each by the change that
  meets its own clauses.
- **Accepted permanently** — the row stays as the record of the decision. It
  is reconsidered only by a new owner decision.

A gap that no counting clause covers is not recorded in a register. It is
tracked as a candidate outcome.

## Update Triggers

Update this document when:

- a migration principle changes;
- the deviation record format, placement, or lifecycle changes.

Individual deviations are recorded in the registers, not here.

## Source-of-truth Boundaries

This document is the source of truth for:

- how a change applies the Brownfield Migration Principles;
- the deviation record format, placement, and lifecycle.

This document is not the source of truth for:

- the decision to adopt the standards and principles, which belongs to
  [ADR 0009](../decisions/0009-adopt-named-standards-and-brownfield-migration-principles.md);
- the adopted standards and the deviation registers, which belong to the
  [shared HTTP contract](../contracts/http.md#standards-conformance) and the
  [security architecture](../architecture/security.md#standards-conformance);
- TDD evidence rules, which belong to [`testing.md`](testing.md);
- contract states, which belong to
  [Contract States](../contracts/http.md#contract-states).
