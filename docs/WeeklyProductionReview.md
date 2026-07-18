# Weekly Production Review — Income Tax API

> **Purpose:** A repeatable 15-minute weekly review of the API in production. Copy the template
> block into a new dated entry each week, fill every field from real sources, and record the one
> decision the week produced.
> **Status:** Template ready · **first real review runs the week after publication** (no weeks logged
> as of 2026-07-18).
> **Cadence:** Weekly, same day each week. **Related:** [Observation Framework](Observation001Production.md) · [Evidence Register](ProductionEvidenceRegister.md) · [Monthly Review](MonthlyBusinessReview.md)

---

## Rules for filling this in

- Pull every number from a **named source** (RapidAPI analytics / Vercel logs / inbox / GitHub).
- **Unknown values are written "unknown"** — never estimated. A blank is a bug in the review.
- The review's job is to spot **trends and triggers**, then apply the
  [decision rules](Observation001Production.md#part-3--decision-rules-what-an-observation-triggers).
  Most weeks the correct output is "keep observing" — that is a real result, not a failure.
- Anything actionable becomes an [Evidence Register](ProductionEvidenceRegister.md) row before the
  review ends.

---

## Weekly template (copy per week)

```
### Week of YYYY-MM-DD  (Week N since launch)

Reviewer: __________      Source snapshot time: __________

— Metrics (source in parentheses) —
| Metric                      | This week | Last week | Trend | Source          |
| Total requests              |           |           |       | RapidAPI/Vercel |
| Successful requests (2xx)   |           |           |       | RapidAPI        |
| Validation failures (4xx)   |           |           |       | Vercel logs     |
| Server errors (5xx)         |           |           |       | Vercel logs     |
| Most-used endpoint          |           |           |       | Vercel logs     |
| New subscribers (free)      |           |           |       | RapidAPI        |
| New subscribers (paid)      |           |           |       | RapidAPI        |
| Revenue (this week)         |           |           |       | RapidAPI billing|
| Support questions           |           |           |       | /contact + email|
| Documentation issues raised |           |           |       | inbox + GitHub  |
| Developer feedback (qual.)  |           |           |       | reviews/GitHub  |

— Narrative (one line each; "none" is a valid answer) —
- New first-events this week:            (e.g. first subscriber → OBS-00N)
- Top validation-failure reason:          (which field/code dominates 4xx → a DX/docs signal)
- Most common support/doc question:        (→ candidate doc fix)
- Any correctness concern?:                (ANY = P0, stop and fix)
- Notable developer feedback:

— Triggers fired (apply the decision rules) —
- Ignore:
- Monitor (watch-list):
- Fix (→ issue #):
- Prioritize (→ Monthly Review candidate):
- Deprecate:

— Learning Log touches —
- Assumption(s) affected this week:        (→ update LearningLog.md, or "none")

— The one decision this week —
>  (e.g. "Keep observing — traffic too low to conclude anything." / "Open issue #N to clarify the
>   assessmentYear format in the docs — 60% of 4xx were AY-format errors.")
```

---

## Reading the signals (guide, not a script)

| If you see…                                  | It usually means…                              | Likely action                                                   |
| -------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------- |
| 4xx dominated by one field                   | the docs/example for that field are unclear    | Fix docs (cheap, high-leverage)                                 |
| High traffic, near-zero subscribers          | listing converts poorly (price/value/copy)     | Monthly-Review: marketplace optimization                        |
| Near-zero traffic                            | a **discovery** problem, not a product problem | reach work (listing/SEO) — do **not** cut price or add features |
| Subscribers but no repeat calls              | onboarding/DX drop-off                         | Prioritize DX only if it recurs                                 |
| Any 5xx spike                                | availability incident                          | Runbook incident response                                       |
| A wrong number reported                      | correctness incident                           | **P0 Fix**, always                                              |
| Repeated same feature ask (≥2–3 independent) | real demand pull                               | Prioritize → Monthly Review                                     |

## Log of completed weekly reviews

| Week | Date run | One-line outcome                                                                               |
| ---- | -------- | ---------------------------------------------------------------------------------------------- |
| —    | —        | _No weekly reviews run yet. First review is the week after the marketplace listing goes live._ |
