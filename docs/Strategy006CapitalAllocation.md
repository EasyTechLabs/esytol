# STRATEGY-006 — Capital Allocation Framework

```
── Sprint Declaration (STRATEGY-004) ─────────────────
Platform:             Esytol / EasyTechLabs
Domain:               Platform-wide (governance)
Category:             n/a (strategy / governance)
Tool(s):              n/a
Priority Score:       n/a
Admission Result:     n/a
Capital Allocation:   n/a (this document defines the capital-allocation gate)
Dependencies:         STRATEGY-003, STRATEGY-004, STRATEGY-005, OBSERVATION.md
Expected Maintenance: reviewed quarterly (the CEO review it defines)
Platform Impact:      Adds the third and final governance gate — where engineering hours
                      are invested. No code, architecture, domain, engine, or test changes.
──────────────────────────────────────────────────────
```

> **Status:** Governing policy · proposed, awaiting founder ratification.
> **Authority:** Subordinate to [STRATEGY-003](../../easytech-workspace/Governance/STRATEGY-003.md). Completes the governance stack begun by [STRATEGY-004](../../easytech-workspace/Governance/STRATEGY-004-PlatformExpansionFramework.md) and [STRATEGY-005](Strategy005RevenueFirst.md). This is the **final constitutional document before EasyTechLabs enters an execution-first phase.**
> **Scope:** How EasyTechLabs allocates its single scarcest resource — **engineering hours** — across its portfolio of engines.
> **Last Updated:** 2026-07-18
> **Owner (document):** Chief Executive / Capital Allocation
> **Related:** [EnginePortfolio](EnginePortfolio.md) · [CapitalAllocationPolicy](CapitalAllocationPolicy.md) · [EngineInvestmentProfile](EngineInvestmentProfile.md) · [PortfolioHealth](PortfolioHealth.md) · [QuarterlyBusinessReview](QuarterlyBusinessReview.md)

---

## The thesis

EasyTechLabs has one engineer and a finite number of hours in a day. **Engineering time is
the only capital the company spends, and it is non-recoverable** — an hour spent on one
engine is an hour permanently unavailable to every other. The three prior strategies made
the company disciplined about _what to build_; none of them decided _what to build first
when everything is admissible_. This document is that decision system.

It treats every engine as a **position in a portfolio** and every sprint as a **capital
allocation**. The question it answers is exact and recurring:

> **"Given 100 engineering hours this month, where do they go — and why not somewhere else?"**

## The complete governance stack (three gates, in series)

From ratification, **no sprint may begin until all three gates pass, in order:**

| Gate              | Document            | Question                                             | Fails if                                                                                                |
| ----------------- | ------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **1. Admission**  | STRATEGY-004        | Does this deserve to exist?                          | Any hard gate fails (determinism, privacy, brand, trust model, no accounts, no backend-for-core)        |
| **2. Selection**  | STRATEGY-005        | Is it worth building?                                | [Business Score](ProductScorecard.md) < 70 (Build tier), or no revenue path / loss-leader justification |
| **3. Allocation** | STRATEGY-006 (this) | Should it get hours _now_, ahead of everything else? | It does not fit the quarter's capital plan, or a higher-return position is starved                      |

A proposal can be admissible (Gate 1), commercially sound (Gate 2), and **still not funded**
(Gate 3) because the hours are better spent elsewhere this quarter. Gate 3 is where
opportunity cost becomes an explicit, recorded decision instead of an accident.

## The five ideas this framework is built on

1. **Portfolio, not backlog.** Every engine belongs to exactly one primary portfolio —
   Revenue, Acquisition, Authority, Platform, or Experimental — each with its own KPI,
   lifespan, and success/failure criteria. See [EnginePortfolio](EnginePortfolio.md).
2. **Allocation is stage-dependent, not fixed.** A pre-revenue company and a scaling company
   allocate differently. The percentages are a function of the company's stage, and today's
   stage is **pre-revenue**, so capital is deliberately concentrated on proving the first
   payment. See [CapitalAllocationPolicy](CapitalAllocationPolicy.md).
3. **Maintenance is a first charge, not discretionary.** Correctness is the product
   (STRATEGY-003). A fixed share of every 100 hours is reserved to keep existing engines
   correct (yearly tax rules, dependency drift) _before_ any discretionary allocation.
4. **Every engine carries a standard investment profile.** One page, sixteen fields, so a
   funding decision is made on evidence, not memory. See [EngineInvestmentProfile](EngineInvestmentProfile.md).
5. **The portfolio is reviewed as a portfolio, quarterly.** Every engine is graded
   earning / growing / strategic / reusable and given a verdict: invest more, freeze, or
   retire. See [QuarterlyBusinessReview](QuarterlyBusinessReview.md).

## What this framework refuses to do

- It will not fund an engine because it is interesting to build. (Gate 2 already blocks that;
  Gate 3 blocks the subtler version — funding a _good_ engine at the expense of a _better_ one.)
- It will not pretend allocation is precise. Hours are estimated in half-days, not minutes;
  the discipline is in the _ranking and the recorded trade-off_, not false precision.
- It will not allocate against fabricated returns. Where a KPI is unmeasurable (Gate 0 pending),
  it is written **"unknown"** and the position is funded on strategic logic, explicitly labelled
  as a bet — never on an invented number.

## The mandate

From ratification:

- Every **roadmap** is a capital plan: it states the quarter's stage, the allocation split,
  and the ranked funded positions with their opportunity cost. See [roadmap governance](QuarterlyBusinessReview.md#roadmap-governance).
- Every **sprint** records its Capital Allocation line in the Sprint Declaration and cannot
  begin until Gate 3 approves.
- Every **quarter**, the CEO review re-grades the portfolio and re-sets the allocation.

This is mandatory governance for every future roadmap and sprint, subordinate only to
STRATEGY-003, -004, and -005. It is the last governance document the company needs before it
stops writing governance and starts executing against it.
