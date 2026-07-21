# Continuous Deployment — esytol / Vyora

> **Goal:** development deploys **automatically** after merge; production deploys **only after release approval.**
> Platform: **Vercel** (Git-connected) + **GitHub Actions** (gate). **No secret values live in this repo** — only
> secret _names_. This document is the source of truth; the repo artifacts referenced below implement it.

## Target environments

| Environment     | URL                            | Branch    | Deploys                                            | Indexed?                                |
| --------------- | ------------------------------ | --------- | -------------------------------------------------- | --------------------------------------- |
| **Development** | `https://dev.esytol.com/vyora` | `develop` | **Automatically** on every merge/push to `develop` | No (Vyora is `noindex`)                 |
| **Production**  | `https://www.esytol.com/vyora` | `main`    | **Only after release approval** (gated workflow)   | No (Vyora is `noindex`; public site is) |

Repo artifacts that implement this: [`vercel.json`](../../vercel.json) · [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) ·
[`.github/workflows/deploy-production.yml`](../../.github/workflows/deploy-production.yml).

---

## 1. Branch strategy

```
feat/*  ──PR──▶  develop  ──PR + approval──▶  main
  │                 │                           │
  │                 │ (auto)                    │ (gated)
short-lived      dev.esytol.com           www.esytol.com
work branches    (Development)              (Production)
```

| Branch            | Role                                                                                                  | Protection                                                                | Deploy target                               |
| ----------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------- |
| `feat/*`, `fix/*` | Short-lived work branches; one PR each into `develop`.                                                | PR + green CI to merge.                                                   | Vercel **Preview** (unique per-branch URL). |
| `develop`         | **Integration / Development.** Always deployable; what `dev.esytol.com` serves.                       | PR + green CI to merge.                                                   | **Development** — auto.                     |
| `main`            | **Production.** Only ever receives reviewed merges from `develop`; each merge is a release candidate. | PR + green CI; **no direct pushes** (recommended branch-protection rule). | **Production** — gated.                     |

**Release flow:** cut work on `feat/*` → PR into `develop` (auto-deploys to Dev for testing) → when a set of changes is
release-ready, PR `develop → main` → merge → **publish a GitHub Release** → the production workflow **waits for a human
approval** → deploys to `www.esytol.com`.

---

## 2. Deployment architecture

```
                         ┌───────────────────────── GitHub ─────────────────────────┐
   push feat/* ─────────▶│  CI (ci.yml): type-check · lint · format · test · build   │
                         └───────────────┬──────────────────────────────────────────┘
                                         │ green
   merge → develop ──────────────────────┼──▶ Vercel Git integration (AUTOMATIC)
                                         │        └─▶ Preview build ─▶ alias: dev.esytol.com  ✅ Development
                                         │
   merge → main  ────────────────────────┘   (Vercel auto-deploy for `main` is DISABLED — vercel.json)
                                             │
   publish GitHub Release  ─────────────────▶│  deploy-production.yml
                                             │    1. Environment: production ──▶ ⏸ REQUIRED REVIEWER APPROVAL
                                             │    2. npm ci + quality gate (defense in depth)
                                             │    3. vercel pull/build/deploy --prod (Vercel CLI + VERCEL_* secrets)
                                             │    4. verify www.esytol.com/vyora = 200 + robots noindex
                                             └────────────────────────────────▶ www.esytol.com  ✅ Production
```

**Why this shape:**

- **Development is automatic** — Vercel's native Git integration builds every `develop` push and serves it at the
  `dev.esytol.com` branch-domain. No workflow needed; nothing to approve. Fast feedback.
- **Production is gated** — Vercel's _automatic_ production deploy on `main` is turned **off** in `vercel.json`
  (`git.deploymentEnabled.main = false`), so the **only** way to production is `deploy-production.yml`, which is pinned
  to the `production` GitHub Environment. That environment's **Required reviewers** setting is the release-approval gate:
  the run pauses until a maintainer clicks **Approve**. Preview/dev deploys are unaffected.

---

## 3. Rollback process

**Production (fastest first):**

1. **Vercel Instant Rollback** — Vercel dashboard → Project → Deployments → pick the last known-good **Production**
   deployment → **Promote / Rollback**. Serves the previous build in seconds; no rebuild. _Primary path._
2. **Re-deploy a known-good release** — re-run `deploy-production.yml` (`workflow_dispatch`) from an earlier tag; passes
   through the same approval + verify.
3. **Revert the code** — `git revert <merge-commit>` on `main` → PR → approve → the workflow ships the reverted build.

**Development:** redeploy the previous `develop` commit in Vercel, or `git revert` on `develop` (auto-redeploys). Low
stakes — nothing customer-facing.

**Vyora-specific safety:** Vyora is **local-first** — merchant data lives only in the browser and is **never** touched by
a deploy or rollback. A rollback changes only the served code, never anyone's ledger. (For the current Epic-A work,
`aging.ts` is not yet wired to any screen, so rolling it back has zero runtime effect.)

**Rollback SLA:** production issue → Instant Rollback within minutes; root-cause fix flows back through
`feat/* → develop → main` normally.

---

## 4. Environment variables

**Principle: no values in Git.** Runtime secrets live in **Vercel** (per-environment); CI/deploy secrets live in
**GitHub Actions secrets**. This repo and its logs contain **names only**.

**Vyora needs ZERO environment variables or secrets** — it is local-first with no backend, no API, no auth. Everything
below belongs to the surrounding **esytol** app.

### Runtime (set in Vercel → Project → Settings → Environment Variables)

| Name                    | Development | Preview | Production | Purpose                                                                | Value          |
| ----------------------- | :---------: | :-----: | :--------: | ---------------------------------------------------------------------- | -------------- |
| `ESYTOL_API_KEYS`       |     opt     |   opt   |     ✅     | SHA-256-hashed API keys for the Income-Tax API (raw key never stored). | 🔒 Vercel only |
| `RAPIDAPI_PROXY_SECRET` |     opt     |   opt   |     ✅     | Verifies requests arrive via the RapidAPI proxy.                       | 🔒 Vercel only |

> Any other existing Vercel project env vars remain configured per-environment as they are today; this document does not
> change them. Only add a variable to an environment that actually needs it.

### CI / Deploy (set in GitHub → Settings → Secrets and variables → Actions)

| Name                | Used by                 | Purpose                                                       | Value            |
| ------------------- | ----------------------- | ------------------------------------------------------------- | ---------------- |
| `VERCEL_TOKEN`      | `deploy-production.yml` | Authenticates the Vercel CLI for the gated production deploy. | 🔒 GitHub secret |
| `VERCEL_ORG_ID`     | `deploy-production.yml` | Target Vercel org/team.                                       | 🔒 GitHub secret |
| `VERCEL_PROJECT_ID` | `deploy-production.yml` | Target Vercel project (`esytol`).                             | 🔒 GitHub secret |

**Rules:** never `echo` a secret; never commit `.env*` (already git-ignored); reference secrets only as
`${{ secrets.NAME }}` / `$VERCEL_TOKEN`; rotate immediately if a value ever appears in a log, PR, or chat.

---

## 5. Build workflow

Two workflows, one native integration:

| Trigger                                           | Mechanism                           | What runs                                                                       | Outcome                          |
| ------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------- | -------------------------------- |
| push / PR to `main` or `develop`, any PR          | **`ci.yml`** (GitHub Actions)       | `type-check · lint · format:check · test:run · build`                           | Green gate to merge.             |
| merge/push to `develop`                           | **Vercel Git integration** (native) | Vercel build                                                                    | Auto-deploy → `dev.esytol.com`.  |
| GitHub **Release published** (or manual dispatch) | **`deploy-production.yml`**         | approval → `npm ci` → quality gate → `vercel pull/build/deploy --prod` → verify | Gated deploy → `www.esytol.com`. |

Build command is the app default (`next build`); the production workflow uses `vercel build --prod` +
`vercel deploy --prebuilt --prod` so the artifact that is verified is exactly the artifact that ships.

---

## 6. Verification checklist

**Before merging to `develop`**

- [ ] `ci.yml` green (type-check · lint · format · test · build).
- [ ] `npm run validate` green locally; new tests added for new behavior.

**After Development deploy (`dev.esytol.com`)**

- [ ] `https://dev.esytol.com/vyora` returns **200**; app loads.
- [ ] Vyora is `noindex` (view-source: robots meta) and the **Alpha banner** shows.
- [ ] Core flow smoke: record credit / record payment / open a statement — no console errors.
- [ ] Data persists across reload (localStorage); "Add to Home Screen" works (iOS data-retention note).

**Release approval (before Production)**

- [ ] Changes have been exercised on Dev.
- [ ] GitHub Release notes written; `deploy-production.yml` triggered.
- [ ] **Required reviewer approves** the `production` environment run.

**After Production deploy (`www.esytol.com`)**

- [ ] Workflow's verify step passed (`/vyora` = 200, `robots.txt` disallows `/vyora`).
- [ ] `https://www.esytol.com/vyora` loads; Alpha banner present; apex `esytol.com` still 308→`www`.
- [ ] Public site (`/`, pricing, API docs) unaffected.
- [ ] Rollback target identified (previous prod deployment noted, in case).

**Always**

- [ ] No secret value in the repo, workflow logs, PR, or release notes.
- [ ] `docs/releases/Release-00X.md` updated for the release.

---

## Activation steps (Founder-console — I cannot do these; they need dashboard/DNS/secret access)

This CD design is **authored in the repo but not yet active in production.** To turn it on:

1. **DNS:** add a CNAME for `dev.esytol.com` → Vercel (per Vercel's domain instructions).
2. **Vercel → Domains:** assign `dev.esytol.com` to the **`develop`** branch; confirm `www.esytol.com` is the
   **Production** domain (and `esytol.com` redirects to `www`).
3. **GitHub → Settings → Secrets → Actions:** add `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
4. **GitHub → Settings → Environments → `production`:** add **Required reviewers** (this _is_ the release-approval gate).
5. **(Recommended) GitHub → Settings → Branches:** protect `main` — require PR + passing CI, block direct pushes.
6. **Only then** promote this config to production via the normal gated flow (PR `develop → main` → Release → approve).
   ⚠️ Because `vercel.json` disables Vercel's automatic production deploy on `main`, **step 3 must be done before this
   config reaches `main`**, or production will have no deploy path.

> Until activated, this config lives on `develop` and affects only Dev/Preview. Production keeps deploying exactly as it
> does today.
