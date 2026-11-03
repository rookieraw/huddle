# Chat HTTP Contract

Status: Index of Chat HTTP contract files; operation states are owned by those files
Last reviewed: 2026-11-03

## Purpose

This document indexes the Chat HTTP contract files and owns the rules that apply
to more than one Chat contract file. Each exact operation, with its contract-state
marker, is defined in the listed file for its capability.

A capability appearing in the Chat Context or Phase 2 does not create an HTTP
endpoint automatically.

## Contract Files

| Capability | Contract file                                    |
| ---------- | ------------------------------------------------ |
| Contacts   | [`chat-contacts-http.md`](chat-contacts-http.md) |

A capability gets a row here in the same change that creates its contract file.

## Source-of-Truth Boundary

| Concern                              | Authoritative source                                                                                                                     |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Exact Chat HTTP operations           | The contract file listed above for the capability                                                                                        |
| Shared HTTP envelope and conventions | [`http.md`](http.md)                                                                                                                     |
| Phase authorization                  | [`../delivery/phases/02-chat.md`](../delivery/phases/02-chat.md)                                                                         |
| Current implementation state         | [`../delivery/status.md`](../delivery/status.md)                                                                                         |
| System-wide security principles      | [`../architecture/security.md`](../architecture/security.md)                                                                             |
| Cross-context integration            | [`../decisions/0004-cross-context-integration.md`](../decisions/0004-cross-context-integration.md)                                       |
| HTTP transport placement             | [`../decisions/0008-place-http-transport-by-integration-boundary.md`](../decisions/0008-place-http-transport-by-integration-boundary.md) |
| Executable behavior                  | Chat and API Gateway source code and tests                                                                                               |

An operation retains `Implemented` state only while its controller behavior,
transport tests, shared HTTP conventions, and its contract file remain aligned. An
`Accepted` operation is a decided transport target, not evidence of an endpoint.

## Chat-wide Rules

A rule that applies to more than one Chat contract file is added to this document.
A rule specific to one capability stays in that capability's contract file.

## Related Documentation

- [Shared HTTP Contract](http.md)
- [Chat Contacts HTTP Contract](chat-contacts-http.md)
- [Chat Context](../contexts/chat.md)
- [Phase 2 — Contacts and Chat](../delivery/phases/02-chat.md)
- [Current Status](../delivery/status.md)
- [Security Architecture](../architecture/security.md)
- [Cross-context Integration ADR](../decisions/0004-cross-context-integration.md)
- [HTTP Transport Placement ADR](../decisions/0008-place-http-transport-by-integration-boundary.md)
