# Product Scorecard — the Weighted Business Score (0–100)

> **Purpose:** Convert a completed [Product Research Record](ProductResearchTemplate.md) into a single, defensible **Business Score (0–100)** that drives the build decision. Governed by [STRATEGY-005](Strategy005RevenueFirst.md).
> **Status:** Mandatory governance artifact
> **Last Updated:** 2026-07-18

## How it works

Ten dimensions, each scored **0–5** against the rubric below. Each dimension's
contribution is `(sub-score ÷ 5) × weight`. The weights sum to 100, so the total is a
**0–100 Business Score**. Hard gates (below) are checked **first** — a gate failure is an
automatic reject and the score is not computed.

## The ten dimensions and their weights

| #   | Dimension                          | Weight | What a 5 looks like                                                     | What a 0 looks like                     |
| --- | ---------------------------------- | ------ | ----------------------------------------------------------------------- | --------------------------------------- |
| 1   | **Commercial intent**              | **16** | A buyer with a budget and a deadline (a fintech dev needs tax math now) | A student wanting a free one-off answer |
| 2   | **Revenue path clarity**           | **14** | A concrete, near-term path (API on RapidAPI, licensing) is Planned      | No path and no strategic reason         |
| 3   | **Search / market demand**         | **12** | Large, sourced, durable demand                                          | Negligible or unmeasurable and unknown  |
| 4   | **Distribution channel**           | **12** | A marketplace with its own buyers, no audience needed                   | "We'll put it on our site" (pre-Gate-0) |
| 5   | **Engine reuse**                   | **10** | Monetises an existing tested engine via a new surface                   | A from-scratch engine, no reuse         |
| 6   | **Evergreen × low maintenance**    | **8**  | Needed for years; rules never change                                    | Fad; or churns constantly               |
| 7   | **AI-search / citation potential** | **8**  | Agent-callable / FAQ-shaped / MCP-ready                                 | Opaque, uncitable                       |
| 8   | **Strategic value**                | **8**  | Deepens the correctness-layer moat or cross-domain leverage             | Tangential to the thesis                |
| 9   | **Competitor gap (defensibility)** | **6**  | Underserved, or incumbents are wrong/abandoned                          | Saturated by excellent free tools       |
| 10  | **Engineering effort (inverse)**   | **6**  | Hours, mostly reused                                                    | Weeks of net-new, risky work            |

**Total = 100.**

## Why each weight exists (the rationale is the policy)

- **Commercial intent (16) + Revenue path (14) = 30, the plurality.** This is a
  _revenue-first_ framework; the two dimensions that most directly predict a payment carry
  the most weight. A brilliant tool nobody will pay for scores low here on purpose.
- **Distribution (12), weighted equal to demand (12).** REVENUE-001/MONEY-001 proved
  distribution — not building — is the binding constraint. Demand you cannot reach is
  worth nothing, so reaching it is scored as heavily as the demand itself.
- **Engine reuse (10) is high** because compounding leverage over a library of tested
  engines is Esytol's structural, hard-to-copy advantage; monetising what already exists
  beats building anew nearly every time.
- **Evergreen/maintenance (8) and AI-citation (8)** protect long-term value: durable
  demand and being callable by AI systems are where the moat compounds (STRATEGY-003).
- **Strategic value (8)** keeps loss-leaders and moat-plays fundable even when their direct
  revenue is low — but they must _declare_ the strategy, not hide behind it.
- **Competitor gap (6)** matters but is deliberately lower than demand — a gap in a market
  with no buyers is not an opportunity.
- **Engineering effort (6) is the lowest weight and is a _discount_, not a driver.** The
  old failure was letting "this is fun/easy to build" decide the roadmap. Effort now only
  breaks ties between commercially comparable options.

## Hard gates (checked before scoring; any failure = auto-reject)

Inherited from STRATEGY-004, plus one revenue-first gate:

- Determinism · Privacy (client-side core) · Brand fit · Trust model exists · No accounts
  required · No backend required for core value.
- **Revenue-first gate:** at least one credible Revenue Matrix path is Planned, **or** a
  written strategic loss-leader justification. Zero path + zero strategy = reject.

## Scoring rules

1. **Cite or "unknown."** Unsourced quantitative claims score at the **conservative** end
   (0–2), never optimistically. Honesty beats a flattering number.
2. **Gate 0 reality.** Because our analytics are blind, "Search/market demand" and
   "Commercial intent" are scored from _external_ evidence (keyword tools, marketplace
   listing counts, competitor pricing, freelance-job volume), not our own traffic.
3. **No single dimension can rescue a dead path.** A proposal with Revenue path = 0 and
   Strategic value < 3 is rejected regardless of total (it failed the revenue-first gate).
4. **Round half-down.** When unsure between two sub-scores, pick the lower. Optimism is the
   bias this framework exists to correct.

## Decision tiers

| Business Score | Tier        | Action                                                                       |
| -------------- | ----------- | ---------------------------------------------------------------------------- |
| **≥ 70**       | **Build**   | Enters the roadmap with priority; sequence via STRATEGY-004's Priority Score |
| **55–69**      | **Backlog** | Admitted, but must sharpen a revenue path or gather demand evidence first    |
| **40–54**      | **Hold**    | Plausible; revisit when Gate 0 data or a distribution channel appears        |
| **< 40**       | **Reject**  | Does not earn a build slot                                                   |

## Worked examples (grounded in real Esytol engines)

**A. India Income-Tax API (existing `lib/incomeTax` engine, new API surface)**
Commercial intent 5·16, Revenue path 5·14, Demand 4·12, Distribution 4·12 (RapidAPI),
Reuse 5·10, Evergreen/maint 3·8 (yearly Finance Act churn), AI-citation 5·8, Strategic 5·8,
Competitor gap 4·6, Effort 4·6 → **≈ 86 → Build.** (Monetises the crown-jewel engine
through a marketplace with buyers; the highest-scoring kind of proposal.)

**B. Unit Converter (new Everyday tool)**
Commercial intent 2·16, Revenue path 1·14, Demand 5·12, Distribution 2·12, Reuse 2·10,
Evergreen/maint 5·8, AI-citation 3·8, Strategic 3·8 (top-of-funnel loss-leader), Competitor
gap 1·6, Effort 4·6 → **≈ 48 → Hold**, _unless_ declared a distribution loss-leader for a
monetisable Finance/API funnel, which lifts Strategic value and moves it to Backlog. Huge
demand alone does not earn a build without a revenue or strategic bridge.

**C. "Reverse Text" novelty tool**
Commercial intent 1, Revenue path 0, Distribution 1, Strategic 1 → **fails the revenue-first
gate → Reject** before scoring. (Exactly the enthusiasm-first build this framework stops.)
