# Portfolio Health

> **Purpose:** Portfolio-level KPIs that grade the _whole_ engine portfolio, not individual engines — the dashboard the Quarterly CEO Review reads. Governed by [STRATEGY-006](Strategy006CapitalAllocation.md).
> **Status:** Mandatory governance artifact · living
> **Last Updated:** 2026-07-18

Individual engines have profiles; the portfolio has health. These twelve indicators catch the
failures a per-engine view misses — concentration, single points of failure, and the slow drift
of a company that builds without earning. Each has a **measure, a healthy range, and today's
honest value.** Where Gate 0 blindness applies, the value is **"unknown," never estimated.**

## The twelve indicators

| #   | Indicator                     | Measure                                                    | Healthy                       | Today                                                                 | Verdict                   |
| --- | ----------------------------- | ---------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------- | ------------------------- |
| 1   | **Revenue-engine coverage**   | Revenue engines with a _Live_ path ÷ total Revenue engines | ≥ 50%                         | **0 / 4 = 0%**                                                        | 🔴 critical               |
| 2   | **Authority coverage**        | Domains with deep, cited authority ÷ live domains          | ≥ 1 deep domain               | Finance deep; Dev/Everyday shallow                                    | 🟡                        |
| 3   | **Platform debt**             | Known shared-infra shortcuts / TODOs blocking funded work  | ~0                            | Low (recently built, tested)                                          | 🟢                        |
| 4   | **Maintenance burden**        | Maintenance hours ÷ 100                                    | ≤ 15% (the first charge)      | ~15% (yearly tax rules the main driver)                               | 🟢                        |
| 5   | **Portfolio balance**         | Actual allocation vs the stage target                      | within ±5% of target          | Historically over-weighted Authority/Platform, under-weighted Revenue | 🔴 correcting             |
| 6   | **Engine concentration risk** | Largest domain's share of engines                          | ≤ 60%                         | **17 / 23 Finance ≈ 74%**                                             | 🟡 (by design, but watch) |
| 7   | **Single-point dependency**   | Count of unmitigated single points of failure              | minimise + document           | One engineer · one host (Vercel) · one repo                           | 🟡 documented             |
| 8   | **Future optionality**        | Live Experimental engines                                  | ≥ 1                           | **0**                                                                 | 🔴                        |
| 9   | **Innovation ratio**          | Experimental hours ÷ total hours                           | 5% (policy floor+cap)         | ~0% historically                                                      | 🔴 correcting             |
| 10  | **Research backlog**          | Proposals with a completed research record, not yet scored | a healthy queue (>0)          | 0 (framework just created)                                            | 🟡 build it               |
| 11  | **Approved backlog**          | Proposals scored Build/Backlog, awaiting capital           | a short, ranked list          | 1 (income-tax/salary API)                                             | 🟢                        |
| 12  | **Rejected backlog**          | Proposals scored Reject, recorded with reason              | growing (proof of discipline) | track from now                                                        | 🟡                        |

## What today's read means (the honest diagnosis)

The portfolio is a textbook **engineering-first, pre-revenue** shape, and the indicators say so
without flattery:

- **Indicator 1 is the emergency.** Zero of the company's Revenue engines actually earn. Every
  monetisation path is _Planned_. This is why the [Capital Allocation Policy](CapitalAllocationPolicy.md)
  puts 55% of discretionary hours on Revenue at the current stage — the framework is not abstract,
  it is responding to this number.
- **Indicators 8 and 9 say the company buys no optionality.** No experiments run, so there is no
  cheap exposure to the next thing (an MCP server, a new monetisation surface). The policy's fixed
  5% Experimental floor exists to fix exactly this.
- **Indicator 6 is high but intentional.** 74% Finance concentration is the STRATEGY-001 "depth
  before breadth" bet, not an accident — but it _is_ a risk, so it is watched, not ignored.
- **Indicator 7 is unfixable but must be documented.** A one-engineer, one-host, one-repo company
  has irreducible single points of failure; the governance response is to _name_ them (so a
  founder decision is informed) rather than pretend they are mitigated.

## Rules

1. **Any indicator that is 🔴 must have a funded remediation in the current quarter's roadmap,**
   or an explicit, recorded decision to accept the risk this quarter.
2. **The Rejected backlog is a health signal, not waste.** A framework that never rejects is a
   framework that is not being used (STRATEGY-005: reject ~99%). A growing, reasoned Rejected
   backlog is evidence the gates work.
3. **Portfolio balance (indicator 5) is measured against the _declared stage_,** not a fixed
   ideal. Being "unbalanced" toward Revenue at Stage A is healthy; the same imbalance at Stage C
   would be a red flag.
4. **Every indicator that reads "unknown" is unblocked only by Gate 0 or a live revenue path** —
   it is never filled with an estimate to make the dashboard look complete.
