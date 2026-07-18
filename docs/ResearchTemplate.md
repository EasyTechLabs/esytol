# Research Record Template

> **Purpose:** The standard, evidence-graded record produced by the [RESEARCH-001](Research001MarketResearch.md) methodology. It is the **same record** STRATEGY-005 scores — this template standardises how it is filled. Governed by [RESEARCH-001](Research001MarketResearch.md).
> **Status:** Mandatory research artifact
> **Last Updated:** 2026-07-18

Every field carries **evidence** (cited per [EvidenceStandards](EvidenceStandards.md)) and a
**confidence** (per [ResearchConfidenceFramework](ResearchConfidenceFramework.md)). A field with
no source is **"unknown"** — never a guess. Fields 5–11 draw on the specialised sub-templates.

## Compatibility mapping (to STRATEGY-005)

This record maps field-for-field to STRATEGY-005's [ProductResearchTemplate](ProductResearchTemplate.md);
the scorecard reads it unchanged. RESEARCH-001 adds only the evidence/confidence/unknowns
discipline around the same fields.

| This record                                                   | STRATEGY-005 ProductResearchTemplate field                |
| ------------------------------------------------------------- | --------------------------------------------------------- |
| 1 Problem · 2 Target audience · 3 Existing solutions          | 1 Problem · 2 Target audience · 3 Existing alternatives   |
| 4 Competitors                                                 | 8 Competitor landscape (+9 Marketplace)                   |
| 5 Search demand                                               | 4 Search intent · 6 Search demand · 7 AI search potential |
| 6 Commercial intent                                           | 5 Commercial intent                                       |
| 7 Distribution                                                | 11 Distribution channels                                  |
| 8 Revenue opportunities                                       | 10 Revenue paths                                          |
| 9 Technical complexity                                        | 12 Engineering effort · 14 Engine reuse                   |
| 10 Maintenance cost                                           | 13 Maintenance effort                                     |
| 11 Market risks                                               | 16 Risks                                                  |
| 12 Strategic fit                                              | 15 Strategic value                                        |
| 13 Evidence · 14 Confidence · 15 Unknowns · 16 Recommendation | (research discipline feeding 17 Business Score)           |

---

## Research Record: `<tool-or-category-name>`

**Date:** `<YYYY-MM-DD>` · **Researcher:** `<name>` · **Target portfolio:** `<Revenue | Acquisition | Authority | Platform | Experimental>` · **Overall confidence:** `<High | Medium | Low>`

### 1. Problem

The specific, real problem in one sentence. `[evidence · confidence]`

### 2. Target audience

The named person who has it (not "everyone"). `[evidence · confidence]`

### 3. Existing solutions

What they use today (substitutes, workarounds, "nothing"). `[evidence · confidence]`

### 4. Competitors

The real incumbents, each recorded via the [Competitor Analysis Template](CompetitorAnalysisTemplate.md).
Summarise the gap here. `[evidence · confidence]`

### 5. Search demand

Representative queries, intent type, and volume with the tool used; plus AI-search/citation fit.
"Unknown" if unmeasurable. `[T1/T2 evidence · confidence]`

### 6. Commercial intent

Do users/searchers intend to spend, or is a paying buyer adjacent? Graded, sourced. `[evidence · confidence]`

### 7. Distribution

The [Distribution Research](DistributionResearchTemplate.md) result. **If no viable channel is
found, the record stops here and the proposal cannot proceed.** `[evidence · confidence]`

### 8. Revenue opportunities

The [Revenue Research](RevenueResearchTemplate.md) result: who pays, why, when, recurring vs
one-time, WTP evidence, alternative paths. `[evidence · confidence]`

### 9. Technical complexity

Build estimate (half-days), net-new vs reused engines/components. `[evidence · confidence]`

### 10. Maintenance cost

Static / yearly (name the rule) / ongoing (name the source of change). `[evidence · confidence]`

### 11. Market risks

The honest primary failure modes (no buyer discovers it, commodity, correctness liability,
churn, marketplace approval, legal/ToS). Steelman the reasons _not_ to build. `[evidence · confidence]`

### 12. Strategic fit

How it advances STRATEGY-003 / the moat / cross-domain leverage; loss-leaders declare their role. `[confidence]`

### 13. Evidence

The consolidated source list — every citation from the fields above, each `[T-tier · source · date]`,
so the record is auditable end-to-end.

### 14. Confidence score

Overall confidence (High / Medium / Low) with the rule from the
[Confidence Framework](ResearchConfidenceFramework.md): the overall score cannot exceed the
confidence of the _weakest field that the build decision depends on_.

### 15. Unknowns

The explicit list of what is not known, and — for each — what evidence _would_ resolve it. Unknowns
are carried forward, never silently converted into assumptions.

### 16. Recommendation

`PROCEED to Gate 1` | `PROCEED with named unknowns to resolve` | `PARK (revisit when <trigger>)` |
`REJECT (reason)`. The recommendation must follow from the evidence, not lead it.

---

### Completion gate (all must be true)

- [ ] Every quantitative field is sourced (≥2 sources for demand/revenue) or marked "unknown."
- [ ] No number is fabricated; every assumption is labelled `[ASSUMPTION]` with a test.
- [ ] Distribution has a viable channel, or the record stops.
- [ ] Overall confidence is set honestly and does not exceed the weakest decision-critical field.
- [ ] A second researcher, given these sources, would reach substantially the same conclusion.
