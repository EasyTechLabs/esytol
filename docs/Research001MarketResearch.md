# RESEARCH-001 — Market Research Operating System

```
── Sprint Declaration (STRATEGY-004/006) ─────────────
Platform:             Esytol / EasyTechLabs
Domain:               Platform-wide (research methodology)
Category:             n/a (methodology)
Tool(s):              n/a
Priority Score:       n/a
Admission Result:     n/a
Capital Allocation:   Platform portfolio · funded as governance · n/a
Dependencies:         STRATEGY-004, STRATEGY-005, STRATEGY-006, OBSERVATION.md
Expected Maintenance: reviewed quarterly
Platform Impact:      Standardises how research is performed *before* the gates evaluate it.
                      No code, architecture, governance, scoring, or engine changes.
──────────────────────────────────────────────────────
```

> **Status:** Operating manual · proposed, awaiting founder ratification.
> **Authority:** Subordinate to STRATEGY-003. **Upstream of** the governance gates — it defines how the research that STRATEGY-005's [ProductResearchTemplate](ProductResearchTemplate.md) records and STRATEGY-006 funds is actually _performed_. It changes no gate, score, or engine.
> **Scope:** The mandatory research methodology every product proposal follows before it enters Gate 1.
> **Last Updated:** 2026-07-18
> **Owner (document):** Head of Research
> **Related:** [ResearchTemplate](ResearchTemplate.md) · [EvidenceStandards](EvidenceStandards.md) · [CompetitorAnalysisTemplate](CompetitorAnalysisTemplate.md) · [DistributionResearchTemplate](DistributionResearchTemplate.md) · [RevenueResearchTemplate](RevenueResearchTemplate.md) · [ResearchConfidenceFramework](ResearchConfidenceFramework.md)

---

## Why this exists

The constitution decides _whether_ to build (STRATEGY-004), _whether it is worth it_
(STRATEGY-005), and _whether to fund it now_ (STRATEGY-006). All three consume a research
record — and until now, the **quality of that record depended entirely on who wrote it.** A
gate is only as good as its input; a rigorous scorecard fed by a hunch produces a rigorous-
looking hunch. This document makes research itself repeatable, so the gates can be trusted.

**The success test is reproducibility:** two researchers investigating the same opportunity,
following this manual, must reach _substantially the same conclusion and the same confidence
level._ If they don't, the methodology has failed, not the researchers.

## Where research sits in the lifecycle

```
Idea → [ RESEARCH-001: this methodology produces the Research Record ] → Gate 1 (004) →
         Gate 2 (005 score) → Gate 3 (006 capital) → build
```

Research is STRATEGY-006 lifecycle **Stage 2**. Its entry criterion is "an idea with a target
portfolio"; its exit criterion is "a complete, evidence-graded [Research Record](ResearchTemplate.md)
whose fields map 1:1 to STRATEGY-005's ProductResearchTemplate." RESEARCH-001 defines _how that
stage is executed_ — it does not replace the record the gates already consume; it standardises
how the record is filled.

## Compatibility (no governance/scoring changes)

- The **Research Record** ([ResearchTemplate.md](ResearchTemplate.md)) maps field-for-field to
  STRATEGY-005's [ProductResearchTemplate](ProductResearchTemplate.md). It is the _same record_,
  produced to a standard — not a competing template.
- Scoring is untouched: STRATEGY-005's [ProductScorecard](ProductScorecard.md) and STRATEGY-006's
  allocation read the record exactly as before. RESEARCH-001 only raises and standardises the
  _quality_ of what they read.
- The **confidence** of each researched field ([ResearchConfidenceFramework](ResearchConfidenceFramework.md))
  feeds STRATEGY-005's existing rule that unsourced/low-confidence fields score conservatively.

---

## PART 1 — Research principles

These are non-negotiable. A record that violates any of them is rejected before scoring.

1. **Reproducibility over cleverness.** The goal is a conclusion another researcher can
   reproduce from the same sources, not a brilliant individual insight. Method beats talent.
2. **Evidence over opinion.** Every material claim is backed by a citation with a date. "I think"
   is not evidence; "per <source, dated>" is.
3. **Primary sources before secondary.** Prefer the regulator's text, the marketplace's own
   statistics, the competitor's own pricing page — over a blog _about_ them.
4. **Current data over historical assumption.** Cite recent data (note the date). A 2022 figure
   presented as "today" is a fabrication by omission. (Our own analytics are blind until Gate 0,
   so current demand evidence comes from _external_ current sources.)
5. **Unknown is an acceptable, first-class answer** — and it must _stay_ unknown. Writing
   "unknown" honestly is always correct; converting an unknown into an assumption to fill a cell
   is the cardinal sin (see [Confidence Framework](ResearchConfidenceFramework.md)).
6. **Assumptions are labelled, dated, and testable.** Where the research must reason beyond
   evidence, the leap is marked **[ASSUMPTION]** with what would confirm or refute it. Assumptions
   are never laundered into facts.
7. **No fabricated numbers, ever.** Not a demand figure, not a price, not a market size. A missing
   number is "unknown"; an invented one is disqualifying and voids the whole record.
8. **Research before engineering.** No engine is scoped, prototyped, or "quickly tried" before its
   Research Record exists. Building to discover demand is the failure this whole system prevents.
9. **Steelman the reasons _not_ to build.** The researcher's job is not to justify the idea but to
   try to kill it. A record that lists no serious risk or no viable competitor has not been done.
10. **Auditable by a stranger.** Every claim traces to a source another person can open and check.
    A record whose conclusions cannot be re-derived from its citations is not finished.

## PART 2 — The research workflow (overview)

The eleven ordered stages; each has its own questions, evidence sources, and exit criterion,
detailed in the templates. **No stage is skipped**, and a stage cannot pass until its exit
criterion is met.

| #   | Stage                          | Question it answers                              | Exit criterion                                                                |
| --- | ------------------------------ | ------------------------------------------------ | ----------------------------------------------------------------------------- |
| 1   | **Problem Discovery**          | Is there a real, specific, stated problem?       | One-sentence problem + who has it                                             |
| 2   | **Market Discovery**           | Who and how many have it? Is it growing?         | Sized (or honestly "unknown") with a source                                   |
| 3   | **Competitor Analysis**        | Who solves it today, how well?                   | [Competitor records](CompetitorAnalysisTemplate.md) for the real incumbents   |
| 4   | **Search Intent Analysis**     | What do people search / want?                    | Representative queries + intent type, sourced                                 |
| 5   | **Commercial Intent Analysis** | Is there money-adjacent intent / a paying buyer? | Buyer intent graded with evidence                                             |
| 6   | **Buyer Analysis**             | Who exactly pays, and are they reachable?        | A named buyer persona + reachability                                          |
| 7   | **Revenue Analysis**           | Who pays, why, when, recurring?                  | [Revenue record](RevenueResearchTemplate.md) with WTP evidence                |
| 8   | **Distribution Analysis**      | How is it discovered without SEO/audience?       | [Distribution record](DistributionResearchTemplate.md); **no channel → stop** |
| 9   | **Technical Feasibility**      | Can we build it, at what cost/complexity/reuse?  | Complexity + engine-reuse estimate                                            |
| 10  | **Risk Assessment**            | What kills it?                                   | Honest primary failure modes                                                  |
| 11  | **Research Summary**           | What does the evidence conclude?                 | Confidence-graded [Research Record](ResearchTemplate.md) + recommendation     |

## The mandate

From ratification, **no product proposal reaches Gate 1 without a complete Research Record
produced under this methodology**, with every field evidence-graded per the
[Confidence Framework](ResearchConfidenceFramework.md). A record that fabricates a number, hides
an assumption, or leaves distribution unknown is rejected — not scored low, _rejected_ — because
a poisoned input makes every downstream gate meaningless.
