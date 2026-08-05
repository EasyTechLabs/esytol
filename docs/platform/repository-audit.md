# Repository Audit — VYORA-PLATFORM-001 Phase 0

> Factual findings only, gathered 2026-08-05 before any change was made.
> Commit audited: `ab015aa248c1254c908dbe274ae9c94cfd5d53eb`

---

## 1. Location and Git state

|                  |                                                   |
| ---------------- | ------------------------------------------------- |
| Path             | `C:\Users\dell\OneDrive\Desktop\my ai pro\esytol` |
| Active branch    | `release/rc1-dev`                                 |
| HEAD             | `ab015aa248c1254c908dbe274ae9c94cfd5d53eb`        |
| `origin/develop` | `ab015aa` — **identical**, branch is in sync      |
| Working tree     | **clean** — no unrelated changes                  |

**Note:** the repository is `esytol`, a multi-product Next.js application. Vyora is one product inside
it, alongside an EMI calculator, JSON tools, income-tax engine and others. There is no standalone
"Vyora repository".

## 2. Toolchain

|                 |                                                                                     |
| --------------- | ----------------------------------------------------------------------------------- |
| Package manager | **npm** — `package-lock.json` present, no pnpm/yarn lockfile                        |
| Framework       | **Next.js `^15.5.20`** (App Router)                                                 |
| UI              | React `^19.0.0`                                                                     |
| Language        | TypeScript `^5.7.0`, `strict: true`, target ES2017                                  |
| Test runner     | Vitest `^4.0.0`, jsdom environment                                                  |
| Monorepo        | **None.** No `apps/`, `packages/`, `workspaces`, turbo, nx, pnpm-workspace or lerna |

**Migration implication:** Phase 3's `apps/api` + `packages/*` layout requires **introducing a
monorepo where none exists**. That is a structural change to a repository serving several shipped
products, and it is the single largest risk in this milestone.

## 3. Validation commands (from `package.json`)

| Script         | Command                                             |
| -------------- | --------------------------------------------------- |
| `type-check`   | `tsc --noEmit`                                      |
| `lint`         | `eslint .`                                          |
| `format:check` | `prettier --check .`                                |
| `test:run`     | `vitest run`                                        |
| `build`        | `next build`                                        |
| `bench`        | `vitest bench --run`                                |
| `validate`     | type-check → lint → format:check → test:run → build |

**Last measured result (2026-08-02, commit `ab015aa`):** `npm run validate` **GREEN** —
120/120 test files, 2,338/2,338 tests, build compiled. CI run
[30714506605](https://github.com/EasyTechLabs/esytol/actions/runs/30714506605) succeeded in 169s.

## 4. CI/CD

| File                                      | Purpose                                                                                        |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`                | runs the full gate on push to `[main, develop]` and on PRs                                     |
| `.github/workflows/deploy-production.yml` | production deploy, gated behind the `production` GitHub Environment (required reviewers)       |
| `vercel.json`                             | `{"git":{"deploymentEnabled":{"main":false}}}` — disables Vercel's automatic production deploy |

**Constraint:** production reaches `www.esytol.com` only by publishing a GitHub Release and a human
approving the environment. Any backend work must not bypass this.

## 5. Vyora domain model — `lib/vyora/`

| Module                                                                                                          | Responsibility                                                                     |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `types.ts`                                                                                                      | `Party`, `Transaction`, `Payment`, `VyoraData`, `PartyBalance`, `ActivityItem`     |
| `events.ts`                                                                                                     | append-only `LedgerEvent` union; `applyEvent`, `reduceEvents`                      |
| `store.ts`                                                                                                      | localStorage persistence, v1→v2 migration                                          |
| `ledger.ts`                                                                                                     | derived index set (party, transaction, balance, statistics, timeline, search, due) |
| `selectors.ts`                                                                                                  | memoized read surface over the ledger                                              |
| `commands.ts`                                                                                                   | the only mutation path — validate → execute → emit → result                        |
| `workflow.ts`                                                                                                   | explicit state machines per write workflow                                         |
| `recovery.ts`                                                                                                   | collection worklist and priority scoring                                           |
| `closing.ts`, `duedates.ts`, `settings.ts`, `productivity.ts`, `feedback.ts`, `pwa.ts`, `debug.ts`, `format.ts` | feature domains                                                                    |

## 6. Persistence — local only

Four browser keys, all on the merchant's device:

| Key                 | Contents                              |
| ------------------- | ------------------------------------- |
| `vyora.events.v2`   | the event log — **source of truth**   |
| `vyora.alpha.v1`    | pre-v2 state, read once for migration |
| `vyora.settings.v1` | merchant profile and preferences      |
| `vyora.pwa.v1`      | install-banner / tutorial flags       |

**There is no server, no database, no account and no network call carrying ledger data.** This is
architectural, deliberate and documented across `vyora/README.md`, `ProgramPlan.md` and
`docs/VyoraEventLog.md`.

## 7. Key domain concepts for API design

- **Party** — one contact who may be customer, supplier, or both. Direction lives on the _entry_,
  not on the party. An API `Customer` resource must not assume a fixed role.
- **Derived balances** — every balance is computed from entries, never stored. A cloud schema that
  stores balances introduces a second source of truth.
- **Event log is authoritative** — `VyoraData` is a _projection_. Sync must reconcile **events**,
  not state, or offline devices cannot converge.
- **Commands carry validation** — the server must re-validate; the client contract is not a
  security boundary.
- **Idempotency** — every event already has a stable UUID (`evt_*`, `pty_*`, `txn_*`, `pay_*`),
  which is a natural idempotency key for sync.

## 8. Migration constraints

1. **No monorepo exists** — introducing one touches every shipped product in this repository.
2. **Local-first is a product principle, not an implementation detail.** `vyora/README.md`:
   _"no backend, no accounts, no cloud (cloud is an evidence-gated future spike, not a default)."_
   `ProgramPlan.md` rates building cloud before pilot validation as a **High** risk.
3. **The pilot has not run.** No merchant has used Vyora. There is no adoption evidence to justify
   cloud scope yet.
4. **Production is gated.** Any API deployment must respect the existing approval workflow.
5. **The event log format is v2 and on-device.** Any server-side model must be able to ingest it
   without a lossy translation.
