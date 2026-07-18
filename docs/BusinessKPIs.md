# Business KPIs

> **Purpose:** Replace tool-count vanity metrics with business-aware KPIs, **while preserving engineering excellence as a hard floor.** Governed by [STRATEGY-005](Strategy005RevenueFirst.md); extends [GROWTH-003 success metrics](Growth003FirstThousandUsers.md) and the [OBSERVATION protocol](../OBSERVATION.md).
> **Status:** Mandatory governance artifact
> **Last Updated:** 2026-07-18

## The reframe

For 34 sprints the scoreboard read _tools shipped · tests passing · pages built._ Those are
**inputs**, and inputs are vanity when the output — revenue and retained users — is ₹0 and
unknown. This document keeps the engineering floor (it is non-negotiable) and adds the
**business ceiling** the company is actually measured against.

**The honesty rule holds:** every user/revenue metric is **"unknown," never estimated,**
until it is genuinely measurable (Gate 0 for behaviour; a live revenue path for money).

## Tier 1 — Business KPIs (the real scoreboard)

| KPI                          | Definition                                                        | Source                         | Today                               |
| ---------------------------- | ----------------------------------------------------------------- | ------------------------------ | ----------------------------------- |
| **First payment**            | Date of the first real ₹ received                                 | Payment provider / marketplace | **not yet**                         |
| **Revenue (MRR + one-time)** | Recurring + one-time earned                                       | Provider dashboards            | **₹0**                              |
| **Revenue paths Live**       | Non-website surfaces earning ([Revenue Matrix](RevenueMatrix.md)) | Matrix                         | **0**                               |
| **Paying customers**         | Distinct payers                                                   | Provider                       | **0**                               |
| **Conversion signals**       | `comparison_cta_click`, affiliate clicks, API sign-ups            | GA4 + partner/marketplace      | **unknown** (Gate 0 / no path live) |
| **Cost to serve**            | Infra + marketplace fees per customer                             | Vercel + provider              | negligible (static site)            |

## Tier 2 — Leading indicators (predict Tier 1)

| KPI                                   | Definition                                                   | Source                 | Today                |
| ------------------------------------- | ------------------------------------------------------------ | ---------------------- | -------------------- |
| **Returning visitors** _(north star)_ | Share who return — proof of trust-based value                | GA4                    | **unknown** (Gate 0) |
| **Tool completion rate**              | Sessions completing ≥1 computation                           | GA4 event              | **unknown**          |
| **Cross-domain navigation**           | Sessions touching >1 domain (funnel health)                  | GA4 paths              | **unknown**          |
| **Engine-reuse ratio**                | New surfaces monetising existing engines ÷ new engines built | Revenue Matrix         | track from now       |
| **Research-to-build ratio**           | Proposals scored ÷ proposals built (should reject ~99%)      | ProductFactory records | track from now       |

## Tier 3 — Engineering excellence (the preserved floor, not the goal)

These remain **mandatory**; revenue-first never lowers the engineering bar. They are pass/fail
gates, not growth targets.

| KPI                              | Standard                                           | Today               |
| -------------------------------- | -------------------------------------------------- | ------------------- |
| Tests green                      | 100% before any deploy                             | ✅ 1,496 / 77 files |
| Forge-verified deploys           | Every ship proven live (`forge production verify`) | ✅ every sprint     |
| Determinism & honesty invariants | Tests assert no fabrication / no product claims    | ✅ enforced         |
| Build health                     | Production build clean                             | ✅ 109 pages        |
| Trust surface coverage           | Every tool carries its domain trust surface        | ✅ 3 domains        |

## What we STOP celebrating as a KPI

- **Tool count** — an input, not an outcome. 23 tools earning ₹0 is not 23 wins.
- **Test count / page count** — quality floors, not scoreboard numbers.
- **"Shipped ✅"** without `forge production verify` — the STRATEGY-003 "existence problem."

## Cadence (extends OPERATION-001)

- **Weekly (Monday):** engineering floor green (tests/forge/build); log any revenue signal;
  update the research-to-build and engine-reuse ratios.
- **Per sprint (Business Review, lifecycle stage 9):** did the last build earn / convert /
  retain? Update the Revenue Matrix (Planned→Live or →Rejected with evidence).
- **Monthly:** re-rank the roadmap on Business Score + any new Gate-0 evidence. Roadmap
  changes happen here.

## The one number that matters most right now

**First payment.** Until it exists, every Tier-1 business KPI is ₹0 and every Tier-2 metric is
"unknown." The entire purpose of this framework is to move that one number off zero — honestly.
