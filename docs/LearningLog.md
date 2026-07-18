# Learning Log — Assumptions Under Test

> **Purpose:** Every assumption behind the Income Tax API bet, tracked from claim → verdict.
> Each one must eventually become **Validated**, **Invalidated**, or stay explicitly **Still Unknown
> (with a reason and a test)** — **no assumption may remain permanently untested.**
> **Status:** 🟢 Open · **as of 2026-07-18 nothing is production-validated** — the API is
> publish-ready but has no real usage, so most assumptions are honestly _Still Unknown_.
> **Related:** [Observation Framework](Observation001Production.md) · [Evidence Register](ProductionEvidenceRegister.md) · [Business Case](IncomeTaxBusinessCase.md) · [Pricing](IncomeTaxApiPricing.md) · [Monthly Review](MonthlyBusinessReview.md)

---

## Legend

- **✅ Validated** — production evidence confirms it (cite the OBS-id).
- **❌ Invalidated** — production evidence contradicts it (cite the OBS-id).
- **❓ Still Unknown** — not yet tested in production; the _test_ and _why still untested_ are stated.
- **🔬 Research-validated (not market-validated)** — confirmed by RESEARCH-001 desk evidence, but the
  _real-world consequence_ (someone paying, someone integrating) is not yet observed.

Every ❓ must name **how it will be tested** — an untestable assumption is a design flaw, not a note.

## The assumptions (from RESEARCH-001 / the Business Case)

| #            | Assumption                                                                                                                                                     | Origin (grade)                    | Status (2026-07-18)                          | The test that resolves it                                                                                            | Evidence         |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------- |
| A-Gap        | There is a current gap for a lightweight, developer-priced Indian tax **calculation** API (RapidAPI incumbent deprecated; others sell heavy compliance suites) | Business Case · Medium/T1         | 🔬 Research-validated                        | Real subscribers who chose us _because_ the alternatives are too heavy (ask them / see usage)                        | none in prod yet |
| A-Value      | The tax **computation** carries real, recurring value (payroll/HR must compute it)                                                                             | Business Case · Medium/T2         | 🔬 Research-validated                        | A payroll/HR/fintech integrator actually embeds and keeps calling the API                                            | none in prod yet |
| A-WTP        | Payroll SaaS WTP is ₹40–120 PEPM — a proxy that computation is monetizable                                                                                     | Business Case · Medium/T2         | ❓ Still Unknown                             | Any paid conversion at all (proves _someone_ pays for the computation) — **untested: no traffic yet**                | none             |
| A-Buyer      | The buyer is a dev at a payroll/HR-tech/lending/fintech/CA-software firm, with a deadline                                                                      | Business Case · Medium            | ❓ Still Unknown                             | Who the first subscribers actually are (RapidAPI + support convos) — **untested: no subscribers yet**                | none             |
| A-Season     | Filing season (July) means demand is live _now_                                                                                                                | Business Case · Medium            | ❓ Still Unknown                             | Whether traffic/subscriptions arrive during the season window — **untested: just launching**                         | none             |
| A-Price      | **[ASSUMPTION]** free tier + a low paid tier converts (DISTRIBUTE-001: Basic free 500 / Pro $10 / Ultra $29 / Mega $99)                                        | Business Case + Pricing · **Low** | ❓ Still Unknown                             | RapidAPI conversion data over ≥2 weeks; which tier (if any) the first payment lands on — **the core bet, untested**  | none             |
| A-FirstBuyer | The _timing_ of the first buyer is unknowable up front                                                                                                         | Business Case · Unknown (honest)  | ❓ Still Unknown                             | The date first payment actually occurs (Evidence Register KPI row)                                                   | none             |
| A-DX         | A developer with no prior knowledge gets a correct response in minutes, no SDK                                                                                 | EXPOSE-001/DISTRIBUTE-001         | 🔬 Research-validated (by _us_, in prod E2E) | A **real, external** developer succeeding fast — or failing (first-failed-onboarding is the sharp test)              | our own E2E only |
| A-Diff       | "Provably-correct, multi-year, explainable calc API" is a differentiator buyers value                                                                          | Business Case                     | ❓ Still Unknown                             | Do developers cite correctness/the trace as the reason they chose/kept it? (reviews, feedback)                       | none             |
| A-Discovery  | A marketplace supplies buyers we don't have ourselves (pre-audience, Gate 0)                                                                                   | Business Case                     | ❓ Still Unknown                             | Whether _any_ external request arrives via the listing without our promotion — **untested: not listed/observed yet** | none             |
| A-AI         | An MCP/agent-callable, cited-trace design opens a 2025–26 AI-tool revenue path                                                                                 | Business Case Part 7              | ❓ Still Unknown                             | An AI/agent actually calling the API (no MCP surface shipped yet — deferred, evidence-gated)                         | none             |

## Roll-up (be honest about the shape)

| Verdict                                      | Count | Note                                                       |
| -------------------------------------------- | ----- | ---------------------------------------------------------- |
| ✅ Validated (production)                    | **0** | nothing is market-proven yet — correct for Day 0           |
| ❌ Invalidated                               | 0     | —                                                          |
| 🔬 Research-validated (not market-validated) | 3     | A-Gap, A-Value, A-DX — desk-evidenced, awaiting real usage |
| ❓ Still Unknown                             | 8     | each has a named test above                                |

> This distribution is the _expected_ Day-0 state, not a gap in the work. The whole point of
> OBSERVE-001 is to move rows from ❓/🔬 to ✅/❌ using production evidence over the coming weeks.

## Update protocol

1. When a production observation touches an assumption, **update its row here** and cite the
   [Evidence Register](ProductionEvidenceRegister.md) `OBS-id`.
2. Never flip to ✅/❌ on **n=1** unless it's binary-by-nature (e.g. "first payment happened" _is_
   validation of A-FirstBuyer). Behavioural/quantitative claims (A-Price, A-DX) need a repeated,
   evidenced pattern.
3. The [Monthly Review](MonthlyBusinessReview.md) reports which assumptions moved that month.
4. **No permanent ❓.** If an assumption can't be tested with current traffic, say so and state what
   _would_ let us test it — don't let it sit silently forever.

## What "done" looks like for this log

Not "all validated" — reality may invalidate some. **Done = no assumption is silently untested.**
Every row is either resolved by evidence or carries a live, stated test and a reason it hasn't fired
yet. An invalidated assumption is a _win_ — it saved us from building on a false premise.
