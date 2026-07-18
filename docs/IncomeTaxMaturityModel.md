# Income Tax Engine — Maturity Model

> **Purpose:** Define the four levels the Income Tax Engine climbs from a calculator to an enterprise-grade computation engine, so every task has a clear "which level does this unlock" answer. Part of [EXECUTION-001](Execution001IncomeTax.md).
> **Status:** Execution plan
> **Last Updated:** 2026-07-18

Each level is a **gate**: the engine does not advance until every criterion of the current
level is met and evidenced. This prevents the classic failure of adding Level-3 features to a
Level-1 engine. Today the engine sits at **Level 1 (complete) → Level 2 (partial)**.

## Level 1 — Correct Calculator

_"It computes the right number for the common case."_

- **Definition:** A deterministic calculator that produces the correct tax for the mainstream
  taxpayer (salaried individual < 60), both regimes, with rebate, surcharge, and cess.
- **Exit criteria:** ✅ Both regimes · ✅ §87A + marginal relief · ✅ surcharge marginal relief ·
  ✅ cess · ✅ slab breakdown · ✅ property-tested (1,000 scenarios) · ✅ deployed & forge-verified.
- **Status:** **Complete.** This is where the engine is today, and it is genuinely good.
- **Gap to next:** correctness _breadth_ (years, ages, special-rate income) and provenance.

## Level 2 — Trusted Engine

_"It is provably correct, for any year, and shows its working with citations."_

- **Definition:** The engine any professional or auditor would trust — multi-year, section-cited,
  reproducible, with a transparent, verifiable computation trace.
- **Exit criteria:**
  1. **Year-versioned rules** (A1/A8): an `assessmentYear` parameter selects a versioned ruleset;
     AY 2024-25, 2025-26, 2026-27 supported, history preserved.
  2. **§288B rounding** applied (A4).
  3. **Section-level provenance** (A5): every computation step maps to its statute (§115BAC, §87A,
     §288B, First Schedule surcharge), surfaced in the output.
  4. **Golden reference vectors** (A6): a corpus of ITD-worked-example cases, versioned per year,
     regression-locked.
  5. **A structured, cited computation trace** (A13): step → statute → amount, machine-readable.
- **Status:** **Partial** — trace/citation and versioning are missing.
- **Gap to next:** completeness of _scope_ and an external contract.

## Level 3 — Complete Tax Platform

_"It covers the taxpayer population, not just the common case — and is callable."_

- **Definition:** Covers the realistic breadth of Indian personal taxation and exposes a stable,
  documented interface others can build on.
- **Exit criteria:**
  1. **Age/status breadth** (A2): senior / super-senior slabs; HUF where in scope. Anything _not_
     supported is **explicitly declared**, never silently wrong.
  2. **Special-rate income** (A3): STCG/LTCG/VDA handled at their statutory rates, or explicitly
     out-of-scope with a clear error — no silent slab-taxing of capital gains.
  3. **A clean, versioned domain contract** (A9/A12): a public request/response schema decoupled
     from the UI model and from `lib/emi`.
  4. **An OpenAPI-described API surface** (A9): stateless, validated, error-enveloped, ready to
     list on a marketplace.
  5. **AI/agent surface** (A13): an MCP tool definition so an agent can invoke it.
- **Status:** Not started.
- **Gap to next:** the enterprise-grade guarantees (audit, versioning, change management).

## Level 4 — Enterprise-Grade Computation Engine

_"A payroll SaaS or a bank can depend on it under contract."_

- **Definition:** A dependency others build compliance products on — versioned, auditable,
  documented, and change-managed to a contract.
- **Exit criteria:**
  1. **Engine semver + changelog** (A11): every rule change is a versioned, dated release.
  2. **Computation audit stamp** (A11): each result carries `{engineVersion, assessmentYear,
rulesetVersion, computedAt}` so any figure is reproducibly attributable.
  3. **Compliance mapping document** (A5/A11): every rule → its statutory source, maintained.
  4. **Contract-grade tests** (A6): golden vectors per supported year, plus backward-compatibility
     tests that fail if a past year's answer changes.
  5. **A change-management process** (Part 6): how a new Finance Act enters the engine safely.
  6. **SLA-ready docs + examples** for integrators.
- **Status:** Not started. This is the destination.

## The ladder at a glance

| Level                     | One line                    | Primary Revenue Matrix surface unlocked  | Status         |
| ------------------------- | --------------------------- | ---------------------------------------- | -------------- |
| 1 · Correct Calculator    | Right number, common case   | Website (Live)                           | ✅ Complete    |
| 2 · Trusted Engine        | Provable, any year, cited   | Website (deepened) · AI citation         | 🟡 Partial     |
| 3 · Complete Tax Platform | Full scope + callable       | **API · AI-tool (MCP)**                  | ⬜ Not started |
| 4 · Enterprise Engine     | Depend on it under contract | **White-label · Enterprise · Licensing** | ⬜ Not started |

**The revenue insight:** the first payment does not require Level 4. A **Level 2 engine with a
minimal Level-3 API surface** (year-versioned + a clean contract + an OpenAPI listing) is enough
to earn on RapidAPI. The [Roadmap](IncomeTaxRoadmap.md) sequences exactly that shortest path
first, then climbs toward Level 4.
