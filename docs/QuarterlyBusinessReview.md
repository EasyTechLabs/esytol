# Quarterly Business Review, Engine Lifecycle & Roadmap Governance

> **Purpose:** The operating rhythm of capital allocation — how a roadmap is governed (Part 4), how an engine moves through its lifecycle (Part 6), and how the portfolio is re-graded and re-funded every quarter (Part 7). Governed by [STRATEGY-006](Strategy006CapitalAllocation.md).
> **Status:** Mandatory governance artifact
> **Last Updated:** 2026-07-18
> **Related:** ProductFactory `Execution/WeeklyCEOReport.md` (this is its quarterly counterpart) · [PortfolioHealth](PortfolioHealth.md)

---

## Roadmap governance (Part 4)

A roadmap is a capital plan. Every roadmap **proposal** — a request to fund a position this
quarter — must answer all seven questions, in writing, before it can be ranked. Vague or
missing answers are an automatic defer.

| #   | Question                                | What a good answer contains                                                                                                         |
| --- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Why now?**                            | The time-sensitive reason (filing season, a marketplace window, an unblocked dependency). "It's next on the list" is not an answer. |
| 2   | **Why this engine?**                    | Its [Business Score](ProductScorecard.md) and its portfolio role — why _it_ over its portfolio peers.                               |
| 3   | **What happens if we delay it?**        | The concrete cost of waiting a quarter (a missed season, a competitor, compounding foregone revenue).                               |
| 4   | **What is the opportunity cost?**       | The single highest-scoring position these hours will _not_ fund, named explicitly.                                                  |
| 5   | **Which portfolio does it strengthen?** | Revenue / Acquisition / Authority / Platform / Experimental — and how that fits the stage allocation.                               |
| 6   | **Which business KPI moves?**           | The specific [Business KPI](BusinessKPIs.md) expected to change, and by roughly how much (or "unknown → we will learn X").          |
| 7   | **Which strategic objective moves?**    | How it advances STRATEGY-003 (the computation-layer thesis) or a portfolio-health remediation.                                      |

**The output of roadmap governance** is a ranked, funded list for the quarter whose hours sum to
the [Capital Allocation Policy](CapitalAllocationPolicy.md) split for the declared stage, with
every position's opportunity cost recorded. Anything not funded goes to the Approved backlog.

---

## Engine lifecycle (Part 6)

Every engine travels one path. Each stage has an **entry criterion** (what must be true to
begin) and an **exit criterion** (what must be true to advance). An engine cannot skip stages,
and it cannot enter a stage whose entry criterion is unmet. This lifecycle unifies STRATEGY-005's
selection lifecycle and STRATEGY-004's deprecation policy into one canonical journey.

| Stage                         | Entry criterion                                                                         | Exit criterion                                                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **1. Idea**                   | A one-line proposal exists                                                              | A named owner-document and a target portfolio                                                                                     |
| **2. Research**               | Idea has a portfolio                                                                    | [Product Research Record](ProductResearchTemplate.md) complete — all 17 fields, sourced or "unknown"                              |
| **3. Validation**             | Research complete                                                                       | A revenue path is _Planned_ (or a written loss-leader bridge) **and** a distribution channel named                                |
| **4. Approval**               | Validation passed                                                                       | **All three gates pass:** STRATEGY-004 admission · STRATEGY-005 Business Score ≥ 70 · STRATEGY-006 capital allocated this quarter |
| **5. Implementation**         | Approved + funded                                                                       | Built on the Frozen Tool Framework; the five validation gates green (format/lint/type/test/build)                                 |
| **6. Growth**                 | Live + `forge production verify` PASS                                                   | A measured signal (or, pre-Gate-0, a live surface with instrumentation in place)                                                  |
| **7. Optimization**           | Real usage data exists (Gate 0)                                                         | Data-driven improvements exhausted their marginal return                                                                          |
| **8. Monetization Expansion** | Engine proven on one surface                                                            | A _new_ Revenue Matrix surface moved from Planned → **Live** (e.g. Website → API)                                                 |
| **9. Maintenance**            | Shipped + earning/serving                                                               | Kept correct + forge-verified; drops here from any later stage when growth flattens                                               |
| **10. Retirement**            | STRATEGY-004 deprecation test passes (dead + no strategic value + a cost, after Gate 0) | 301-redirected, SEO preserved, documented in the Deprecations log                                                                 |

**Rules.** Stage 4 (Approval) is the three-gate junction — nothing is built without it. Stage 8
(Monetization Expansion) is the stage the old lifecycle never had and the one this whole
framework exists to reach. Retirement (Stage 10) is governed entirely by STRATEGY-004's
deprecation policy — never a reflex, always after Gate-0 evidence, always with a 301.

---

## The Quarterly CEO Review (Part 7)

Once a quarter, **every live engine is put on trial for its capital.** The review is a fixed
ritual, not a discussion — each engine answers six questions from its
[Investment Profile](EngineInvestmentProfile.md), and receives one of four verdicts.

### The six questions (per engine)

1. **Is it earning?** (Revenue KPI — real ₹, or honestly "not yet".)
2. **Is it growing?** (Primary KPI trend — or "unknown" pre-Gate-0.)
3. **Is it strategic?** (Strategic importance 1–5 — does it still advance STRATEGY-003?)
4. **Is it reusable?** (Does its engine feed other surfaces / the Revenue Matrix?)
5. **Should we invest more, freeze, or retire?** (The verdict.)
6. **What is the evidence?** (Every answer cites the profile field or the data — never a feeling.)

### The four verdicts

| Verdict         | Meaning                                                       | Consequence                                                   |
| --------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| **Invest more** | Earning or on a credible near-term path; high strategic value | Gets funded hours next quarter, ranked by Business Score      |
| **Maintain**    | Serving its role; no upside to more investment                | Draws only maintenance hours (the first charge)               |
| **Freeze**      | Unproven and not this quarter's priority                      | Zero new hours; re-evaluated next review                      |
| **Retire**      | Meets the STRATEGY-004 deprecation test                       | Enters Retirement (Stage 10) with a 301 + Deprecations record |

### What the review produces

1. An updated [Portfolio Health](PortfolioHealth.md) dashboard (all twelve indicators).
2. A verdict on every engine (field 16 of each Investment Profile).
3. The **declared stage** for the coming quarter (A / B / C) and its exit criterion.
4. The next quarter's [Capital Allocation](CapitalAllocationPolicy.md) split and ranked funded roadmap.

### Cadence and authority

- **Weekly** (`Execution/WeeklyCEOReport.md`): engineering floor green + any revenue signal.
- **Monthly:** re-rank the funded roadmap on new evidence; roadmap changes happen here.
- **Quarterly (this review):** re-grade the whole portfolio, re-declare the stage, re-set the
  allocation. This is the only place the stage and the allocation split may change.

> The Quarterly CEO Review is the moment the company looks at itself as a portfolio of capital
> positions and decides, on evidence, where the next quarter's hours are worth the most. It is
> the mechanism that keeps every subsequent execution sprint honest about opportunity cost.
