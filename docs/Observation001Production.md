# OBSERVE-001 — First 30 Days in Production (Observation Framework)

```
── Sprint Declaration (STRATEGY-004/005/006) ─────────
Platform:             Esytol / EasyTechLabs
Domain:               Finance
Category:             Operations / learning process (no new code)
Tool(s):              income-tax API (live from EXPOSE-001, listed via DISTRIBUTE-001)
Priority Score:       ~86 / 100 (the flagship Revenue engine)
Admission Result:     ADMIT
Capital Allocation:   Revenue portfolio · Stage-A #1 position · this sprint spends hours on
                      LEARNING from the bet, not extending it — the input to the next decision
Dependencies:         DISTRIBUTE-001 (listing artifacts), RESEARCH-001 (the assumptions under test)
Expected Maintenance: this IS the maintenance loop — run weekly + monthly, forever
Platform Impact:      Establishes the production learning process. Artifacts only — no feature
                      work, no new API, no redesign.
──────────────────────────────────────────────────────
```

> **Purpose:** The framework for learning from the Income Tax API in production. Defines what to
> observe, how to review it, which signals trigger engineering, and how RESEARCH-001's assumptions
> get validated or disproved — **by evidence, not by guessing.**
> **Status:** Active from Day 0 (= the marketplace publication date). **As of 2026-07-18, zero
> production observations exist** — this sprint builds the empty apparatus, honestly.
> **Last Updated:** 2026-07-18
> **Related:** [Evidence Register](ProductionEvidenceRegister.md) · [Weekly Review](WeeklyProductionReview.md) · [Monthly Review](MonthlyBusinessReview.md) · [Learning Log](LearningLog.md) · [Marketplace Launch](IncomeTaxApiMarketplaceLaunch.md) · [Business Case](IncomeTaxBusinessCase.md)

---

## The one rule

> **Observe before building. No feature, API, or redesign ships until production evidence justifies
> it.** This sprint deliberately builds _nothing_ except the instrument that tells us what to build
> next. Enthusiasm is not evidence.

## Where the data comes from (and the blind spots — stated honestly)

| Source                                     | What it gives                                                                  | Live now?                               |
| ------------------------------------------ | ------------------------------------------------------------------------------ | --------------------------------------- |
| **RapidAPI analytics**                     | subscriptions, calls, error rate, top endpoint, revenue                        | 🟡 only once published + traffic exists |
| **Vercel logs** (structured, privacy-safe) | request metadata: method/path/status/timing/`X-Request-Id` — **never incomes** | ✅ live, but empty until real calls     |
| **`/contact` inbox + email**               | support questions, feature requests, bug reports                               | ✅ live                                 |
| **GitHub issues**                          | developer-reported bugs / requests                                             | ✅ live                                 |
| **RapidAPI reviews/discussion**            | qualitative developer feedback                                                 | 🟡 once listed                          |

> **Blind spots we will not paper over:** Gate 0 (the 3 founder analytics grants) is still pending,
> so _website_ funnel data stays "unknown." The rate limiter is best-effort per-serverless-instance,
> so its counters are indicative, not exact. Where a number is unknown, it is written **"unknown"** —
> never estimated. (Consistent with the [launch metrics](IncomeTaxApiMarketplaceLaunch.md#part-7--launch-success-metrics-no-invented-targets).)

## PART 1 — The observation record (first-events log)

Every notable production first is logged the day it happens, in the
[Evidence Register](ProductionEvidenceRegister.md). The milestones we are watching for — **none
have occurred as of 2026-07-18:**

| #   | First…                                   | Status     | Why it matters                                  |
| --- | ---------------------------------------- | ---------- | ----------------------------------------------- |
| 1   | External request (not us)                | ⬜ not yet | proves discovery works at all                   |
| 2   | Subscriber (free tier)                   | ⬜ not yet | proves the listing converts a browse → a signup |
| 3   | Successful integration (repeat caller)   | ⬜ not yet | proves the DX is good enough to keep            |
| 4   | Failed onboarding (dropped after errors) | ⬜ not yet | the sharpest DX signal we can get               |
| 5   | Support request                          | ⬜ not yet | shows where the docs fail                       |
| 6   | GitHub issue                             | ⬜ not yet | a concrete, reproducible defect or ask          |
| 7   | Feature request                          | ⬜ not yet | demand pull — the only honest feature input     |
| 8   | Production bug                           | ⬜ not yet | correctness/availability incident → runbook     |
| 9   | **Paying customer**                      | ⬜ not yet | **the KPI** — the whole arc exists for this     |

The first event of each kind gets a full Evidence Register row **and** a Learning Log update if it
touches a RESEARCH-001 assumption.

## PART 3 — Decision rules (what an observation triggers)

Actions are driven **only by production evidence**, never by opinion. Given an observation's
**Impact** (how much it hurts/helps the KPI or correctness) and **Confidence** (how sure we are it's
real, per the [Confidence Framework](ResearchConfidenceFramework.md)):

| Rule           | Trigger (evidence)                                                                                                                       | Action                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **IGNORE**     | Low impact **and** low confidence (one-off, unreproducible, not KPI-linked)                                                              | Log it, do nothing. Revisit only if it recurs.                                                   |
| **MONITOR**    | Plausible impact but low confidence / n=1                                                                                                | Log + add to the weekly watch-list. Act only if it repeats or the trend grows.                   |
| **FIX**        | A **correctness** error (wrong tax number), or a reproducible bug, at _any_ confidence                                                   | Enter as P0/P1 per the [Runbook](IncomeTaxApiRunbook.md). A wrong number always beats "monitor." |
| **PRIORITIZE** | High impact + high confidence, and it recurs (≥ 2–3 independent signals) — e.g. the same missing capability blocks multiple integrations | Feed into the [Monthly Review](MonthlyBusinessReview.md) as a candidate next sprint.             |
| **DEPRECATE**  | Evidence a feature/endpoint/tier is unused or actively harmful                                                                           | Follow the Runbook deprecation policy (announce + window). Never silently remove.                |

### Hard overrides (these skip the matrix)

- **Correctness always wins.** A silently wrong tax figure is P0 regardless of volume — it is worse
  than a clean 5xx. Fix, add a regression test, changelog the correction.
- **Security/privacy incident** (any sign incomes are being logged/leaked) → immediate P0.
- **n=1 is not a mandate.** A single feature request is `MONITOR`, not `PRIORITIZE`. One loud voice
  does not reorder the roadmap; a _repeated, evidenced_ pattern does.

### What is explicitly NOT a trigger

- A feature idea _we_ find exciting (no external pull) → not a trigger.
- A competitor shipping something → context, not a production signal.
- Zero traffic → a **discovery** problem (listing/SEO/reach), _not_ a signal to cut price or add
  features. Diagnose reach before touching the product.

## How the pieces fit

```
 production  ──▶  Evidence Register  ──▶  Weekly Review  ──▶  Monthly Review  ──▶  next sprint decision
 (real events)     (Part 2, per-event)    (Part 4, trend)     (Part 5, focus)     (or: keep observing)
      └───────────────────────────────────▶  Learning Log  (Part 6, assumption status)
```

- **Daily/as-it-happens:** log first-events and notable signals to the Evidence Register.
- **Weekly:** run the [Weekly Review](WeeklyProductionReview.md) — the numbers + the watch-list.
- **Monthly:** run the [Monthly Review](MonthlyBusinessReview.md) — decide the next sprint's focus,
  or decide there is not yet enough evidence to act (a valid outcome).
- **Continuously:** move each RESEARCH-001 assumption toward Validated / Invalidated in the
  [Learning Log](LearningLog.md). No assumption stays permanently untested.

## STOP

This sprint establishes the process and stops. **No feature work, no new API, no redesign.** The
next build is chosen by the Monthly Review from real evidence — or deferred if the evidence isn't
there yet.
