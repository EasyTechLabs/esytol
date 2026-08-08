# Vyora Platform — Migration Plan

> Design only. Phase A is the only phase authorised today.

---

## Principle

**The pilot ships local-first and stays local-first.** Every phase below is additive, gated, and
individually reversible. No merchant's data reaches a server until Phase E, and only with their
explicit consent.

---

## Phase A — Design and contract approval _(current)_

**Deliverables:** these documents, plus a reviewed OpenAPI 3.1 contract.
**Code written:** none.
**Exit criteria:** founder approves the Party model, the event envelope, the sync protocol, and the
four open questions in `domain-model.md` §7 are answered.
**Rollback:** delete `docs/platform/`. Nothing else exists.

## Phase B — Isolated API, synthetic data only

**Build:** `vyora-api/` — health, merchants, parties. PostgreSQL via Docker Compose. Migrations,
seed data, integration tests, contract validation.
**Data:** synthetic only. **No merchant data. No production deployment. Localhost only.**
**Exit criteria:** contract tests green; a synthetic event log round-trips through push → store →
projection → pull and reproduces the same projection the client would compute.
**Rollback:** `rm -rf vyora-api/`. esytol is untouched by construction.

## Phase C — Local developer integration, flag off

**Build:** a repository interface in the web app so the party domain can use either the local
implementation or a remote one. Remote path behind
`NEXT_PUBLIC_VYORA_API_PARTIES_ENABLED`, **defaulting to `false`**.
**Data:** developer machines only.
**Exit criteria:** with the flag off, `npm run validate` is byte-identical to today and the merchant
experience is unchanged. With it on locally, party list/create/update use the API, and an API failure
surfaces visibly — **never a silent lost write**.
**Rollback:** the flag. It defaults off, so rollback is "change nothing".

## Phase D — Opt-in internal sync testing

**Build:** the `sync` module — push/pull cursors, outbox reconciliation, device registration.
**Data:** team devices only, with deliberately seeded books. **Still no merchant data.**
**Exit criteria:** two devices converge on the same projection after independent offline edits;
duplicate pushes are idempotent; a device offline for a week reconciles cleanly.
**Rollback:** disable the sync endpoint. Clients keep working; their outboxes grow harmlessly.

## Phase E — Limited cloud beta _(blocked)_

**Preconditions, all mandatory:**

1. Pilot has run and produced evidence that merchants _want_ multi-device
2. Real authentication — not the development identity boundary
3. Privacy policy and explicit, revocable merchant consent
4. Deletion and retention answered (`domain-model.md` §7.2 — erasure vs immutability)
5. Server-side backup and restore, tested
6. The delete/create race resolved (`domain-model.md` §6)

**Rollback:** merchants revert to local-only; their device already holds the complete log, so nothing
is lost by switching cloud off. **This is the property that makes cloud safe to try** — the local log
is never a cache of the server; the server is a copy of the local log.

---

## Sequencing rule

**No phase begins until the previous phase's exit criteria are demonstrated, not asserted.**

## What could invalidate this plan

- The pilot shows merchants never use a second device → Phases D and E are wasted; stop at C.
- The pilot shows data-leaving-the-phone is a dealbreaker → cloud becomes opt-in-forever, never default.
- Erasure vs immutability proves unresolvable under Indian data rules → the event store needs
  crypto-shredding before Phase E, which is a significant redesign.

**All three are cheaper to discover during a pilot than after building Phase E.**
