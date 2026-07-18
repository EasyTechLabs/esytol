# Evidence Standards

> **Purpose:** Define what counts as evidence, rank it, and explicitly reject what does not — so two researchers weigh the same source the same way. Governed by [RESEARCH-001](Research001MarketResearch.md).
> **Status:** Mandatory research artifact
> **Last Updated:** 2026-07-18

Every claim in a Research Record cites a source, and every source is rated by tier. The tier
caps the [confidence](ResearchConfidenceFramework.md) a claim can carry: a Tier-4 source can
never support a "High" confidence claim, no matter how confident the researcher feels.

## The evidence hierarchy

| Tier                             | Evidence                                  | Good for                                           | Example sources                                                                                                                                                                                                               |
| -------------------------------- | ----------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T1 — Primary / authoritative** | The source _is_ the fact                  | Rules, specs, official statistics                  | Government/regulator publications (RBI, Income Tax Dept, EPFO), RFCs/ECMA/W3C, official API/marketplace docs, a company's own pricing page, audited financial reports                                                         |
| **T2 — Structured secondary**    | Aggregated, methodologically sound        | Market size, demand, trends                        | Keyword tools (Keyword Planner, Ahrefs/SEMrush), marketplace statistics (RapidAPI listing/subscriber counts, VS Code installs), Google Trends, reputable industry reports with stated methodology, credible academic research |
| **T3 — Practitioner signal**     | Real people, real behaviour, unaggregated | Pain points, willingness-to-pay signals, sentiment | Reddit/forum threads, GitHub issues/stars, developer surveys (e.g. Stack Overflow), Upwork/Fiverr job volume, competitor reviews                                                                                              |
| **T4 — Anecdotal / weak**        | A single voice or an interested party     | Hypotheses only — never a conclusion               | One tweet/comment, a vendor's marketing copy, a single customer quote, an unsourced "everyone knows"                                                                                                                          |

**Rule:** a claim's confidence is capped by its best supporting tier. T1 → up to High.
T2 → up to High for what it measures, Medium beyond. T3 → up to Medium (a _pattern_ across many
T3 signals can reach Medium-High; a single T3 signal is Low). T4 → Low at most, and only as a
hypothesis to be tested, never as a supporting fact for a build decision.

## Corroboration rules

- **Demand and revenue claims require ≥ 2 independent sources**, at least one T1 or T2. One
  keyword figure alone is Medium; a keyword figure + a competitor's paying-customer count +
  active marketplace listings is High.
- **A competitor's own claims are T1 for their pricing/features, T4 for their market impact.** Read
  a pricing page as fact; read "the #1 tool" as marketing.
- **Recency is part of the source.** Every citation records a date. Evidence older than ~18 months
  for a fast-moving market (AI, marketplaces) is downgraded one tier unless re-confirmed.

## Explicitly rejected evidence (voids the claim)

The following are **not evidence** and may not support any field:

- **An unsourced number.** No citation → the field is "unknown," full stop.
- **LLM-generated "facts" without a verifiable primary/secondary source.** A model (including the
  one writing this) may _locate_ and _summarise_ evidence, but its unaided assertion is not a
  source. Every number must trace to something a human can open.
- **Marketing copy treated as market fact** ("trusted by millions", "the best").
- **A single anecdote treated as demand** ("someone on Reddit asked for this").
- **Our own analytics while blind** (Gate 0 pending) — internal traffic/behaviour numbers do not
  exist yet and may not be estimated.
- **Vanity metrics as demand** (GitHub stars ≠ paying users; page views ≠ buyers).
- **Stale data presented as current** (a figure without a date, or an old figure implied to be now).
- **Circular sources** (a blog citing another blog citing the original claim — trace to the origin).

## Citation format (auditability)

Every claim in a Research Record ends with a bracketed citation:

```
<claim>  [T<tier> · <source name/URL> · <date accessed> · <confidence>]
```

Example:

> Indian income-tax API demand exists among payroll developers.
> [T2 · RapidAPI "Finance" category, 40+ India-tax listings · 2026-07-18 · Medium]
> [T3 · r/developersIndia threads requesting tax APIs · 2026-07-18 · Low]

Two T-tagged, dated sources → this claim carries **Medium** confidence. A stranger can open both
and re-derive it. That is the standard.
