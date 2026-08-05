# Vyora Platform — Target Architecture

> Design only. Nothing described here has been built.

---

## 1. Shape

```
┌──────────────────────────────────────────────────────────┐
│ esytol (existing Next.js multi-product app) — UNCHANGED  │
│   app/vyora/*  ·  lib/vyora/*  ·  localStorage           │
│   ▲                                                       │
│   │ later, feature-flagged, off by default                │
└───┼──────────────────────────────────────────────────────┘
    │
┌───▼──────────────────────────────────────────────────────┐
│ vyora-api/  — separate directory, own package.json        │
│   modular monolith, one deployable                        │
│   health · auth · merchants · parties · ledger            │
│   payments · recovery · statements · sync                 │
└───┬──────────────────────────────────────────────────────┘
    │
┌───▼──────────────────────────────────────────────────────┐
│ PostgreSQL                                                │
│   events (append-only, immutable)                         │
│   projections (rebuildable read models)                   │
└──────────────────────────────────────────────────────────┘
    ▲
┌───┴──────────────────────────────────────────────────────┐
│ React Native (future)                                     │
│   SQLite event store + durable outbox                     │
└──────────────────────────────────────────────────────────┘
```

## 2. Additive, not a monorepo

The API lives in **`vyora-api/`** at the repository root, with its **own `package.json` and
lockfile**. It is not referenced by esytol's build.

| Property                       | Consequence                                  |
| ------------------------------ | -------------------------------------------- |
| No `workspaces` key            | esytol's `npm ci` is byte-identical to today |
| No turbo / nx / pnpm-workspace | no build-graph tooling introduced            |
| No import-path rewrites        | `lib/vyora/*` untouched                      |
| Separate lockfile              | API dependencies cannot break the web build  |
| Vercel root unchanged          | deployment config untouched                  |

**Deleting `vyora-api/` restores today's repository exactly.** That is the property that makes this
reversible, and it is why the monorepo conversion was rejected (ADR-0001).

Contract sharing between the two is deliberately deferred — see §6.

## 3. Modules

One deployable, internally partitioned. Modules communicate through function calls, not HTTP.

| Module       | Responsibility                                      | Phase |
| ------------ | --------------------------------------------------- | ----- |
| `health`     | liveness, version, DB reachability                  | B     |
| `merchants`  | tenant boundary; every query scoped by `merchantId` | B     |
| `parties`    | party CRUD + derived role views                     | B     |
| `ledger`     | credit entries                                      | C     |
| `payments`   | payments                                            | C     |
| `recovery`   | aging, priority, reminder history                   | D     |
| `statements` | per-party statement projection                      | D     |
| `sync`       | push/pull cursors, outbox reconciliation            | D     |
| `auth`       | identity — **design not started**                   | E     |

**Not microservices.** Vyora has one tenant type, one write path and no independent scaling need. A
service boundary now would buy nothing and cost distributed transactions across an event log.

## 4. Storage

**Two tables, conceptually:**

- `events` — append-only, immutable, unique on `eventId`, indexed by `(merchantId, recordedAt)` for
  pull cursors and `(merchantId, aggregateId)` for per-party replay.
- `projections` — rebuildable read models. Never authoritative.

**No balance column anywhere.** Balances are folded from entries, exactly as the client does.

## 5. Contract discipline

- **OpenAPI 3.1 is the source of truth**, authored by hand, not generated from code.
- Request validation derives from the contract.
- Version prefix `/api/v1`.
- Structured errors: `{ code, message, details? }` — `message` is developer-facing; merchant-facing
  wording stays in the client, which already owns it.
- Every mutable resource carries `id` (UUID), `createdAt`, `updatedAt`, `version`.
- `Idempotency-Key` header on every POST.

## 6. Contract sharing — deferred deliberately

The web app and API must eventually agree on types. Three options, **none implemented now**:

| Option                                   | Cost                                        | Verdict                 |
| ---------------------------------------- | ------------------------------------------- | ----------------------- |
| npm workspaces                           | converts esytol to a monorepo               | **rejected** — ADR-0001 |
| Published private package                | registry, versioning, CI                    | premature               |
| **Generated client committed into both** | a build step in `vyora-api/`, output copied | **recommended later**   |

Until the contract stabilises, duplication is cheaper than coupling. Revisit at Phase C.

## 7. What this architecture does not include

No cross-merchant queries · no credit scoring · no shared data between merchants · no analytics ·
no telemetry · no ML · no background jobs beyond sync reconciliation · no push notifications.

These are **out of scope by product decision**, not by omission.

## 8. Failure posture

| Failure            | Behaviour                                                              |
| ------------------ | ---------------------------------------------------------------------- |
| API unreachable    | client stays local-first; outbox grows; nothing is lost                |
| Push rejected      | event stays in outbox, surfaced to a developer, never silently dropped |
| Projection corrupt | rebuild from events; log is authoritative                              |
| DB unavailable     | `/health` reports degraded; writes rejected, never partially applied   |

**The web app must remain fully functional with the API switched off.** That is a hard constraint,
not a nice-to-have — it is what protects the pilot.
