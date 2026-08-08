# ADR-0003 — Sync reconciles events, not state

**Status:** Accepted · **Date:** 2026-08-05

## Context

VYORA-PLATFORM-001 proposed REST resource sync — `GET/POST/PATCH` on customers, with the server
holding current state.

Vyora's source of truth is an **append-only event log** (`vyora.events.v2`). `VyoraData` is a
_projection_, rebuilt by folding events. Balances are never stored anywhere, on device or otherwise.

State-based sync cannot work here. If two devices each `PATCH` a party after a day offline, one
overwrites the other and an entry silently disappears. With a shared ledger, that is a merchant
losing money they are owed.

## Decision

**Sync transfers events. The server appends; it never overwrites.**

- Client pushes outbox events; server replies `accepted[]` / `duplicate[]` / `rejected[]`
- Client pulls by `recordedAt` cursor, excluding its own `deviceId`
- Pulled events are applied through the **same `applyEvent`** used locally — one reducer, not two
- `eventId` (client-generated UUID) is the idempotency key
- Server stores `events` (immutable) plus rebuildable `projections`
- **`occurredAt` (device clock) and `recordedAt` (server clock) are both required** — one orders the
  merchant's timeline, the other orders the sync cursor

## Consequences

**Good**

- Concurrent edits on multiple devices merge without loss — events are additive
- Duplicate pushes are free to handle
- A device offline for weeks reconciles by pushing a longer batch
- Projections are a cache; if they disagree with the log, the log wins and they are rebuilt
- The client's existing reducer is reused, so client and server cannot diverge in interpretation

**Bad**

- The event table grows monotonically and needs a compaction strategy eventually
- Projection rebuilds are O(events) — acceptable now (20k events replays in 0.49 ms client-side)
- Snapshot events (`ImportCompleted`, `RestoreCompleted`) do not fit a cursor model at all

**Decision on snapshots:** the sync endpoint **rejects** them in v1. Import and restore stay
device-local. A snapshot arriving out of order would silently discard newer events from another
device — the exact failure this ADR exists to prevent.

## Conflicts

**Impossible by construction:** simultaneous entries on two devices · duplicate pushes ·
out-of-order arrival · long offline periods.

**Needing domain rules — unresolved:**

- two devices creating the same party by name → propose surfacing a merge prompt, never auto-merging
- `ContactUpdated` on the same field from two devices → propose last-write-wins by `occurredAt`
- **`ContactDeleted` on one device while another records an entry for that party** → no safe
  automatic answer; **highest-risk open question**

These block Phase D, not Phase B.
