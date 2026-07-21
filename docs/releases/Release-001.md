# Release-001

**AIOS Sprint 001 — Professional engineering workflow + Epic A / PR-1 (aging engine).**
Domain only: no UI, no reminders, no navigation, no unfinished features wired in.

| Field              | Value                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| **Epic**           | A — Recovery Engine · Mission A1 (Aging & Overdue) · **PR-1** (Cap 5 · D12)                                                 |
| **Branch**         | `develop` (integration branch; auto-deploys to Vercel Preview)                                                              |
| **Commit**         | `8e3fe79` — `feat(vyora): aging engine — Epic A / Mission A1 / PR-1` (this doc lands in the follow-up commit on `develop`)  |
| **Preview URL**    | https://esytol-3o0a98s6x-esytol.vercel.app · branch alias: https://esytol-git-develop-esytol.vercel.app · app path `/vyora` |
| **Production URL** | https://esytol.com/vyora — **UNCHANGED this release** (production deploys only from `main`; see Protection)                 |
| **Status**         | ✅ Tests pass · ✅ Build succeeds · ✅ Deployment (Preview) succeeds · ✅ Release doc updated                               |

---

## Files Changed

| File                           | Change  | Purpose                                                                                                                                                                                                             |
| ------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/vyora/aging.ts`           | **new** | Pure aging engine: `allocateFifo`, `agingForParty`, `overdueList`, `portfolioAging`, `daysBetween` + exported interfaces (`AllocationLot`, `OpenLot`, `PartyAging`, `OverdueRow`, `PortfolioAging`, `AgingBucket`). |
| `tests/vyora/aging.test.ts`    | **new** | 20 unit tests.                                                                                                                                                                                                      |
| `tests/vyora/aging.bench.ts`   | **new** | Vitest benchmarks (`npm run bench`).                                                                                                                                                                                |
| `.github/workflows/ci.yml`     | mod     | CI now also gates the `develop` branch.                                                                                                                                                                             |
| `package.json`                 | mod     | Added `bench` script (`vitest bench --run`).                                                                                                                                                                        |
| `docs/releases/Release-001.md` | **new** | This document.                                                                                                                                                                                                      |

**Not touched (by design — PR-1 is domain-only):** no screens, no `VyoraProvider`, no routes/navigation, no data-model change. `aging.ts` is not imported by any route yet, so the `/vyora` bundle sizes are unchanged.

---

## Tests

- **New:** `tests/vyora/aging.test.ts` — **20 tests, all passing.** Covers: `daysBetween`; FIFO allocation (oldest-first, partial, over-payment, due-date-basis ordering); overdue truth-table (passed due date → overdue; **undated → "open", never fabricated overdue**; future due → not overdue; due-today → not yet overdue); bucket boundaries (30 → `30-60`, 60 → `60+`); fully-paid → nothing open; partial payment reduces oldest first; **receivable-side only** (payable contact never aged; both-directions ages only receivable); `overdueList` ranking (amount × days, tie-break oldest-first) and exclusions; `portfolioAging` totals + overdue count; **determinism** (repeat-call equality + a source guard asserting no `new Date(` / `Date.now(`).
- **Full suite regression:** **1987 / 1987 passing** across **106 files** (1967 baseline + 20 new). No regressions.
- Commands: `npm run test:run` · `npm run test:coverage`.

## Coverage (`lib/vyora/aging.ts`)

| Metric     | Result             |
| ---------- | ------------------ |
| Statements | **98.64%** (73/74) |
| Branches   | **88.09%** (37/42) |
| Functions  | **100%** (11/11)   |
| Lines      | **98.46%** (64/65) |

Only uncovered branch: the FIFO sort tie-breaker's equal-`createdAt` case (`aging.ts:114`, returns `0`) — a defensive branch for two credits sharing an identical due/entry date **and** creation timestamp; sort order stays stable regardless.

## Benchmark (`npm run bench`)

Vitest bench, local dev machine (**not** the target phone — treat as relative signal, absolute numbers will be slower on a mid-range Android):

| Scenario                                                                  | Throughput  | Mean         |
| ------------------------------------------------------------------------- | ----------- | ------------ |
| `agingForParty` · 1 contact (20 entries)                                  | 8,179 ops/s | **~0.12 ms** |
| `overdueList` · 100 contacts × 10 (~1k entries) — _typical busy merchant_ | 468 ops/s   | **~2.1 ms**  |
| `portfolioAging` · 1,000 contacts × 20 (~20k entries)                     | 6.0 ops/s   | **~167 ms**  |
| `overdueList` · 1,000 contacts × 20 (~20k entries) — _stress ceiling_     | 3.2 ops/s   | **~309 ms**  |

**Reading:** a typical merchant is effectively instant (~2 ms). The 20k-entry stress ceiling (~309 ms per full recompute) confirms the Engineering Review's requirement: **aging must be memoized once per data change (not recomputed per render)** when it is wired to the UI in PR-2. PR-1 ships the engine only; the memoization lands with the first consumer.

---

## Continuous Deployment (established this sprint)

- **Integration branch `develop`** → every push/merge triggers a **Vercel Preview** deployment automatically (verified live: commit `8e3fe79` built and deployed to the Preview URL above via Vercel's Git integration). CI (`type-check · lint · format · test · build`) also runs on `develop`.
- **Production protection:** production (`esytol.com`) deploys **only from `main`**. This `develop` release did **not** touch production. Promotion to production is a deliberate, separate `main` merge — never an automatic side effect of a `develop` push.
- **Recommended hardening (not applied — needs Founder sign-off, changes repo governance):** a GitHub branch-protection rule on `main` (require PR + passing CI, block direct pushes). Flagged rather than imposed, since the team currently commits directly to `main`.

## Rollback

- **Preview / develop:** `git revert 8e3fe79` on `develop` and push → Vercel builds a clean Preview; or in Vercel, redeploy the previous Preview. `aging.ts` is unreferenced by any route, so reverting has **zero runtime effect** on the app.
- **Production:** unaffected by this release. If a later promotion to `main` needs undoing: revert the merge commit on `main` (auto-redeploys prod), or use Vercel **Instant Rollback** to the last known-good production deployment.
- **Branch-level:** `develop` can be deleted without affecting `main`/production.

---

## Definition of Done — met

- [x] Tests pass (20 new · 1987/1987 full suite)
- [x] Build succeeds (`npm run build`)
- [x] Deployment succeeds (Vercel Preview, commit `8e3fe79`)
- [x] Release document updated (this file)

**Scope stop:** PR-1 only. **PR-2 not started** (no UI, reminders, or navigation).
