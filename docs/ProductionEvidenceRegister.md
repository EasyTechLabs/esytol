# Production Evidence Register

> **Purpose:** The single, append-only log of every production observation for the Income Tax API.
> One row per observation. This is the raw evidence that feeds the weekly/monthly reviews and the
> learning log — **facts only, no interpretation beyond the stated fields.**
> **Status:** 🟢 Open · **empty as of 2026-07-18** (the API's Day 0 is the marketplace publication
> date; nothing has been observed yet — this is honest, not an omission).
> **Related:** [Observation Framework](Observation001Production.md) · [Weekly Review](WeeklyProductionReview.md) · [Learning Log](LearningLog.md)

---

## How to use this register

- **Append only.** Never edit or delete a past row — if something changes, add a new row that
  references the old one. The history is the point.
- **One observation per row.** A concrete thing that actually happened in production.
- **Fill every column.** If a value is unknown, write **"unknown"** — never guess.
- The first occurrence of each milestone (from [Part 1](Observation001Production.md#part-1--the-observation-record-first-events-log))
  gets a row here **and**, if it touches a RESEARCH-001 assumption, an update in the
  [Learning Log](LearningLog.md).

### Column definitions

| Field           | Meaning                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------- |
| **ID**          | `OBS-NNN`, sequential, never reused                                                                |
| **Date**        | ISO date the observation occurred (not the day it was logged, if different)                        |
| **Source**      | where it came from: RapidAPI analytics · Vercel logs · /contact · email · GitHub · RapidAPI review |
| **Observation** | what happened, factually, in one line                                                              |
| **Evidence**    | the artifact proving it: request-id, log line, ticket link, screenshot ref, issue #                |
| **Impact**      | effect on the KPI (first payment) or on correctness: High / Medium / Low                           |
| **Confidence**  | how sure it's real & representative (per the Confidence Framework): High / Medium / Low / n=1      |
| **Action**      | the decision rule applied: Ignore / Monitor / Fix / Prioritize / Deprecate                         |
| **Follow-up**   | link to the issue/sprint/Learning-Log entry it produced, or "none"                                 |

## Register

| ID | Date | Source | Observation | Evidence | Impact | Confidence | Action | Follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | _No production observations recorded yet. First real event opens OBS-001._ | — | — | — | — | — |

<!--
ROW TEMPLATE — copy, fill every field, append above nothing (append at the bottom of the table):
| OBS-001 | 2026-07-?? | RapidAPI analytics | First external subscriber (free tier) | dashboard: subscriber count 0→1 | High | Medium | Monitor | LearningLog: A-Buyer |
Never leave a cell blank — use "unknown" where a value isn't known.
-->

## Milestone tracker (first-of-each — mirror of Part 1)

Update the date + ID when each first actually occurs. **All "not yet" as of 2026-07-18.**

| Milestone                           | First occurrence (date) | Register ID |
| ----------------------------------- | ----------------------- | ----------- |
| First external request              | not yet                 | —           |
| First free subscriber               | not yet                 | —           |
| First repeat/integrated caller      | not yet                 | —           |
| First failed onboarding             | not yet                 | —           |
| First support request               | not yet                 | —           |
| First GitHub issue                  | not yet                 | —           |
| First feature request               | not yet                 | —           |
| First production bug                | not yet                 | —           |
| **First paying customer (the KPI)** | **not yet**             | —           |

## Running tallies (updated at each weekly review)

| Counter                                    | Value as of 2026-07-18 |
| ------------------------------------------ | ---------------------- |
| Total observations logged                  | 0                      |
| Open follow-ups (Fix/Prioritize)           | 0                      |
| Correctness incidents (all-time)           | 0                      |
| Assumptions moved to Validated/Invalidated | 0                      |

> These are genuinely zero — the instrument is live and waiting, not reporting fabricated activity.
