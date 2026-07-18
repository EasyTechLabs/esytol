# Monthly Business Review — Income Tax API

> **Purpose:** Once a month, decide **what the next sprint should focus on** — using only the
> month's production evidence (the weekly reviews + the Evidence Register + the Learning Log).
> The output is a single, evidence-backed direction, or an honest "not enough evidence yet."
> **Status:** Template ready · **first monthly review runs ~30 days after publication** (none run as
> of 2026-07-18).
> **Cadence:** Monthly. **Related:** [Observation Framework](Observation001Production.md) · [Weekly Review](WeeklyProductionReview.md) · [Learning Log](LearningLog.md) · [Capital Allocation (STRATEGY-006)] — governs the final call.

---

## The question this review answers

> Given a month of real production evidence, where do the **next** engineering hours go?

The candidate directions (choose **one**, or "keep observing"):

| Direction                    | Chosen when the evidence shows…                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Engine improvements**      | wrong/missing tax cases, or a repeated demand for a computation we don't do (e.g. a regime/year/head of income real integrators need) |
| **API improvements**         | integrators blocked by the contract/shape (batching, fields, error detail) — repeated, not hypothetical                               |
| **Developer experience**     | subscribers arrive but drop off; onboarding friction shows up as 4xx clusters + support questions                                     |
| **Marketplace optimization** | decent traffic, poor conversion — listing copy / tags / discoverability                                                               |
| **Pricing**                  | conversion data contradicts the pricing _hypothesis_ (see the [pricing doc](IncomeTaxApiPricing.md))                                  |
| **Documentation**            | most support/questions are "how do I…", answerable by better docs                                                                     |
| **A new engine**             | this engine has found its ceiling (or is validated & self-sustaining) and the portfolio's next-best bet outranks further work here    |
| **Keep observing**           | traffic/data too thin to conclude — the honest default early on                                                                       |

## Monthly template (copy per month)

```
## Month N — YYYY-MM  (review date YYYY-MM-DD)

Reviewer: __________

— The KPI —
- Paying customers to date:            (target-free; the fact is the fact)
- First payment achieved?:             (yes + date / not yet)
- Revenue this month:                  (₹/$ or "0")

— Month in numbers (from the 4 weekly reviews) —
| Metric                     | M-total | vs last month |
| Total requests             |         |               |
| Successful requests        |         |               |
| Validation-failure rate    |         |               |
| Unique subscribers         |         |               |
| Free → paid conversions    |         |               |
| Support/doc questions      |         |               |
| Correctness incidents      |         |               |

— Evidence summary —
- Strongest signal this month (highest impact × confidence, recurring):
- Biggest surprise vs expectations:
- What the validation failures are teaching us:
- What developers actually asked for (evidenced, with counts):

— Assumptions moved this month (Learning Log) —
- Validated:
- Invalidated:
- Still Unknown (and why still untested):

— THE DECISION —
> Next sprint focus: [ Engine | API | DX | Marketplace | Pricing | Docs | New engine | Keep observing ]
> Because (evidence, not opinion):
> Explicitly declined this month (and why):

— Governance check —
- Passes STRATEGY-005 (evidence + revenue path)?:  yes/no
- Consistent with STRATEGY-006 stage (Stage-A → Revenue priority until first payment)?:  yes/no
```

## Decision discipline (so this stays honest)

- **Evidence over enthusiasm.** A direction is chosen because the month's data pointed there, not
  because it's the fun thing to build. Record the evidence inline.
- **One focus.** Splitting hours across three directions at Stage A is how nothing ships. Pick one.
- **"Keep observing" is allowed — and is the likely early answer.** With thin traffic, the correct
  move is often to keep the instrument running, not to invent work.
- **Discovery ≠ product.** If traffic is the bottleneck, the fix is reach, not more features. Do not
  respond to "no one came" by rebuilding the thing no one has seen yet.
- **The KPI anchors everything.** Until first payment, Stage-A capital allocation keeps this in the
  Revenue lane; a direction that doesn't move toward first payment needs an explicit reason.

## Log of completed monthly reviews

| Month | Date run | Decision                                                                         |
| ----- | -------- | -------------------------------------------------------------------------------- |
| —     | —        | _No monthly reviews run yet. First review ~30 days after the listing goes live._ |
