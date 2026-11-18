# ADR 0009 — Adopt Named Standards and Brownfield Migration Principles

Status: Accepted  
Recorded: 2026-11-18  
Supersedes: None  
Superseded by: None

## Context

Huddle's public documentation cites external standards only case by case. For
example, the shared HTTP contract cites RFC 9110 and RFC 6750 for the `401`
challenge, and the Identity HTTP contract cites RFC 9110 for one status
decision. No project-wide statement says which standards Huddle follows, at
which version, or what happens when implemented behavior does not follow
them.

Huddle is also a brownfield codebase. Identity was delivered before most
shared HTTP conventions existed, and several of its behaviors are documented
as transitional, as known defects, or as decided changes. Chat delivers later
capabilities against those conventions. Later outcomes change implemented
behavior that clients may already rely on, and known gaps against common
security and HTTP practice exist today.

Without a written policy, each outcome decides again which standard applies,
gaps are discovered repeatedly, and a reviewer has no stable reference for
judging conformance or the way a change replaces existing behavior.

## Decision

### Adopted Standards

Huddle follows these standards:

- RFC 9110 (HTTP Semantics);
- RFC 6749 (OAuth 2.0 Authorization Framework);
- RFC 6750 (OAuth 2.0 Bearer Token Usage);
- RFC 7636 (Proof Key for Code Exchange);
- RFC 9700 (OAuth 2.0 Security Best Current Practice);
- RFC 9457 (Problem Details for HTTP APIs), subject to
  [Problem Details](#problem-details-rfc-9457);
- RFC 3339 (Date and Time on the Internet: Timestamps);
- RFC 7519 (JSON Web Token) and RFC 8725 (JSON Web Token Best Current
  Practices), where JWTs are used;
- OWASP Application Security Verification Standard (ASVS) 5.0, Level 2, with
  emphasis on V9 Self-contained Tokens, V10 OAuth and OIDC, and V16 Security
  Logging and Error Handling.

An ASVS 5.0 Level 2 target is a verification target for design, review, and
tests. It is not a claim of a completed assessment or certification.

### Standards by Role

A standard applies to Huddle according to the role Huddle plays:

| Huddle role                                | Applied directly                                                                                 | Adopted by analogy                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Application                                | ASVS 5.0 Levels 1 and 2, in every chapter except the V10 sections listed as not applicable below | —                                                                                                  |
| HTTP API                                   | RFC 9110, RFC 3339                                                                               | —                                                                                                  |
| OAuth client of external sign-in providers | RFC 6749 client requirements, RFC 7636, RFC 9700 client requirements, ASVS 5.0 V10.1 and V10.2   | —                                                                                                  |
| Issuer and verifier of its own tokens      | RFC 7519, RFC 8725, ASVS 5.0 V9                                                                  | RFC 6749 §5.1 for responses that carry Huddle's tokens; RFC 6750 for Huddle's bearer access tokens |

Huddle's own tokens are not OAuth tokens issued by an authorization server,
so RFC 6749 §5.1 and RFC 6750 do not bind them directly. Huddle applies them
as if they did, because the same risks apply. A citation of a clause adopted
by analogy carries the label "(adopted by analogy)".

Not applicable, because Huddle plays none of these roles: the
authorization-server requirements of RFC 6749 and RFC 9700, and ASVS 5.0
V10.3 OAuth Resource Server, V10.4 OAuth Authorization Server, V10.5 OIDC
Client, V10.6 OpenID Provider, and V10.7 Consent Management. Huddle accepts no
access token issued by an OAuth authorization server, and its sign-in uses
OAuth without OpenID Connect ID Tokens.

The HTTP standards and their deviations are stated in the
[shared HTTP contract](../contracts/http.md#standards-conformance). The
security standards and their deviations are stated in the
[security architecture](../architecture/security.md#standards-conformance).

### Citations

Every citation names the exact version of the standard:

- an ASVS citation carries the `ASVS 5.0` prefix, for example
  `ASVS 5.0 V16.3.1`;
- an RFC citation names the RFC number and section, for example
  `RFC 9110 §15.5.2`; an RFC number identifies one fixed text, so it already
  carries its version.

A later version of a standard is adopted only by a new decision.

### Deviation Records

A deviation is implemented behavior that does not meet a clause of an adopted
standard that counts:

- an RFC clause counts at MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD,
  SHOULD NOT, or RECOMMENDED; MAY and OPTIONAL never count;
- an ASVS 5.0 requirement counts at Level 1 or 2; Level 3 never counts;
- a clause counts only when it applies to Huddle directly or by analogy, as
  stated in [Standards by Role](#standards-by-role).

A clause that is SHOULD-level still counts: departing from it is legitimate,
but the reason is recorded.

Each known deviation is recorded with the standard and clause, the current
behavior, the reason, the owner decision date, and either a fix plan or a
decision to accept it permanently. A gap that no counting clause covers is
not a deviation; it is tracked as a candidate outcome.

The record format, where a record is kept, and its lifecycle are defined in
[Brownfield Migration Principles](../engineering/brownfield-migration.md#deviation-records).

### Brownfield Migration Principles

"Brownfield Migration Principles" is Huddle's name for incremental
modernization of an existing system, drawing on the Strangler Fig,
Expand-then-Contract, and Characterization Testing patterns. Every outcome
that changes implemented behavior follows five rules:

1. Change existing systems in small steps; never as a big rewrite.
2. Record current behavior before changing it.
3. Change contracts expand-then-contract.
4. Label what is Implemented separately from what is Accepted.
5. Record each known deviation together with its plan: a fix plan, or a
   recorded decision to accept it permanently.

Expand-then-contract governs contract elements that an owning contract
defines and marks Implemented, and not Transitional. The following may change
in one step:

- behavior that no contract defines as stable, such as framework-generated
  output recorded only as observed current behavior;
- behavior that an owning contract marks Transitional;
- a Known defect or a Decided change, as
  [the shared HTTP contract defines them](../contracts/http.md#known-defects-and-decided-changes),
  that the owning contract records before the change is implemented.

A change that cannot have an expand step, such as a status change, is
recorded as a Decided change before it is implemented.

How a change applies these rules is described in
[Brownfield Migration Principles](../engineering/brownfield-migration.md).

### Problem Details (RFC 9457)

The current API version keeps Huddle's
[stable application error envelope](../contracts/http.md#stable-application-error-envelope)
and does not use Problem Details.

RFC 9457 describes problem details as one way to convey errors, not the only
one, and contains no requirement that an HTTP API use it. Not using it is
therefore a design decision, not a deviation, and has no deviation record.

A new API version reconsiders this decision.

## Rationale

Named standards give implementers and reviewers one external reference for
behavior that Huddle's own contracts do not decide case by case. Explicit
versions keep a citation stable when a standard is revised.

Assigning standards to roles prevents two opposite errors: ignoring a
standard because Huddle is not literally the party it addresses, and
applying requirements written for a role Huddle does not play.

The counting rule makes every known gap reach exactly one outcome. A
deviation is recorded where a requirement exists, and a gap that no
requirement covers becomes ordinary candidate work rather than a claimed
standards violation.

The Brownfield Migration Principles keep changes to implemented behavior
reviewable. Recording behavior first exposes what a change actually alters,
and expand-then-contract lets clients move to a new contract without a
breaking switch. Limiting expand-then-contract to Implemented,
non-transitional elements avoids ceremony for behavior that no client was
promised.

Huddle's error envelope already carries what RFC 9457 standardizes for its
clients: a stable code, a fixed message, field details, and the status in the
status line. Changing the format would reopen accepted contracts and
implemented Chat behavior without a consumer that needs the media type.

## Consequences

### Positive

- Reviews judge conformance against one written policy.
- Known gaps are visible, each with a reason and a plan, in the document that
  owns the affected domain.
- Implemented behavior changes in small, reviewable steps with recorded
  starting behavior.
- The Identity error envelope and later outcomes are built and reviewed
  against the same rules.

### Negative

- Recording and maintaining deviations adds documentation work to changes
  that touch them.
- Applying standards by analogy requires judgment that a reviewer must check.
- Expand-then-contract can require a transition period in which two forms of
  a contract coexist.
- A Level 2 target sets expectations that the current implementation does
  not yet meet; the recorded deviations make that explicit.

This decision changes no route, payload, status, error code, or implemented
behavior.

## Alternatives Considered

### Cite Standards Case by Case

Rejected because it gives reviewers no stable baseline and lets the same gap
be rediscovered or decided differently in each outcome.

### ASVS Level 1 or Level 3

Level 1 omits the token, OAuth, and logging requirements that matter most for
Huddle's authentication design. Level 3 targets high-assurance systems and
would add requirements without a corresponding risk in the Portfolio
deployment.

### Fix Every Gap Before Adopting the Policy

Rejected because it would combine many unrelated changes into one large
rewrite, which the Brownfield Migration Principles themselves rule out.

### One Central Deviation Register

Rejected because a deviation belongs next to the rule it departs from. A
separate register would drift from the HTTP and security documents that own
those rules.

### Adopt Problem Details Now

Rejected for the current API version. It would require reopening accepted
error contracts and migrating implemented Chat responses before the Identity
envelope work, without a consumer that needs `application/problem+json`.

## Revisit When

- OWASP publishes a new major ASVS version, or a listed RFC is obsoleted.
- Huddle takes on a role it does not play today, such as an OAuth
  authorization server, an OpenID Connect client, or a resource server for
  externally issued tokens.
- A new API version is introduced, for the Problem Details decision.
- The Portfolio deployment begins handling real user data at a scale that
  justifies Level 3 requirements.

## Related Documentation

- [Shared HTTP Contract](../contracts/http.md)
- [Security Architecture](../architecture/security.md)
- [Brownfield Migration Principles](../engineering/brownfield-migration.md)
- [Testing Strategy](../engineering/testing.md)
- [Documentation Principles](../README.md#documentation-principles)
