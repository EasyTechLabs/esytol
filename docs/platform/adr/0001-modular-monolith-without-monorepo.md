# ADR-0001 — Modular monolith in an additive directory, not a monorepo

**Status:** Accepted · **Date:** 2026-08-05

## Context

`esytol` is a multi-product Next.js application (Vyora, EMI calculator, JSON tools, income-tax
engine). It uses npm with a single `package-lock.json`, has no `workspaces` key, and no turbo, nx,
lerna or pnpm-workspace. Its production deploy is gated behind a GitHub Environment with required
reviewers.

VYORA-PLATFORM-001 proposed `apps/api` + `packages/*`, which requires converting the repository to a
monorepo.

## Decision

**Build the API as `vyora-api/` at the repository root, with its own `package.json` and lockfile.
Do not introduce workspaces or a build-graph tool.**

The API is a **modular monolith**: one deployable, internally partitioned into health, merchants,
parties, ledger, payments, recovery, statements, sync and auth. Modules talk by function call.

## Consequences

**Good**

- esytol's build, lockfile, CI and Vercel configuration are untouched
- `rm -rf vyora-api/` restores the repository exactly — the rollback is complete and obvious
- API dependency changes cannot break the web build
- Three shipped products keep their existing release path

**Bad**

- Types are duplicated between web and API until a contract-sharing mechanism is chosen
- Two `npm ci` runs in CI once the API is built
- No shared build cache

**Accepted trade-off:** duplication is cheaper than coupling while the contract is unstable.
Contract sharing is deferred to Phase C (`target-architecture.md` §6).

## Alternatives rejected

| Alternative         | Why not                                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| npm workspaces      | changes the build root for three shipped products; touches CI and Vercel; not reversible in one step                                |
| Turborepo / Nx      | all of the above, plus a new tool to learn and maintain                                                                             |
| Separate repository | loses atomic commits across contract and consumer; heavier for a solo team                                                          |
| Microservices       | one tenant type, one write path, no independent scaling need; would add distributed transactions across an event log for no benefit |
