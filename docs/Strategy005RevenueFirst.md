# STRATEGY-005 — Revenue-First Product Selection Framework

```
── Sprint Declaration (STRATEGY-004) ─────────────────
Platform:             Esytol / EasyTechLabs
Domain:               Platform-wide (governance)
Category:             n/a (strategy / governance)
Tool(s):              n/a
Priority Score:       n/a (governance sprint)
Admission Result:     n/a
Dependencies:         STRATEGY-003 (constitution), STRATEGY-004 (expansion framework),
                      OBSERVATION.md (measurement), GROWTH-003, REVENUE-001
Expected Maintenance: ongoing (amended by governance as evidence accrues)
Platform Impact:      Makes product selection evidence- and revenue-driven. No code,
                      no architecture, no domain, no engine changes. Finance-safe: yes.
──────────────────────────────────────────────────────
```

> **Status:** Governing policy · proposed, awaiting founder ratification
> **Authority:** Subordinate to [STRATEGY-003](../../easytech-workspace/Governance/STRATEGY-003.md). **Operationalises** [STRATEGY-004](../../easytech-workspace/Governance/STRATEGY-004-PlatformExpansionFramework.md) — it does not replace it. Where a roadmap conflicts with this framework, this wins and the roadmap is corrected.
> **Scope:** How Esytol decides **what to build next** — the evidence, commercial value, and revenue path a proposal must demonstrate before it enters the roadmap.
> **Last Updated:** 2026-07-18
> **Owner:** Chief Product Officer
> **Related:** [ProductResearchTemplate](ProductResearchTemplate.md) · [ProductScorecard](ProductScorecard.md) · [RevenueMatrix](RevenueMatrix.md) · [ProductDecisionChecklist](ProductDecisionChecklist.md) · [BusinessKPIs](BusinessKPIs.md)

---

## Why this exists

Esytol has 23 excellent, tested, deployed tools and **₹0 of validated revenue**. That is
not an engineering failure — the engineering is the best thing about the company. It is a
**selection** failure: tools were chosen because they were satisfying to build, not
because evidence said someone would pay. STRATEGY-004 fixed _what deserves to exist_
(fit, quality, trust). This document fixes the harder question it left open: **what is
worth building next, given that our only unmet KPI is revenue.**

Two hard lessons, learned the expensive way, are baked in:

1. **Distribution — not building — is the binding constraint.** (REVENUE-001 / MONEY-001.)
   A tool with no path to a _paying buyer who does not need to be manufactured_ is worth
   less than a worse tool that plugs into demand that already exists. Engineering merit is
   a discount on cost, never a reason to build.
2. **Evidence over enthusiasm, and "unknown" over invented.** (OBSERVATION.md, Gate 0.)
   Our own analytics are blind until the three data grants land, so demand evidence must
   come from **external** sources (keyword tools, marketplace listing counts, competitor
   pricing, freelance-job volume). A number we cannot source is written **"unknown"** and
   scored conservatively — never optimistically.

## How STRATEGY-005 relates to STRATEGY-004 (no conflict)

They are two gates in series. A proposal must clear **both**.

|           | STRATEGY-004 (Expansion Framework)                  | STRATEGY-005 (Revenue-First Selection)                       |
| --------- | --------------------------------------------------- | ------------------------------------------------------------ |
| Question  | _Does this deserve to exist?_ (fit, quality, trust) | _Is it worth building **now**?_ (evidence, commercial value) |
| Mechanism | Hard gates + category/tool admission                | Research record → weighted **Business Score**                |
| Output    | ADMIT / REVISE / REJECT                             | Build / Backlog / Hold / Reject + Priority                   |
| Owner     | Principal Product Architect                         | Chief Product Officer                                        |

STRATEGY-004's hard gates (determinism, privacy, brand, trust-model-exists, no accounts,
no backend-for-core) remain **absolute prerequisites** — a proposal that fails any of them
is rejected before it is ever scored here. STRATEGY-005 adds the commercial layer on top.

## The seven instruments (this sprint's deliverables)

| Document                                                | What it governs                                                                         |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **STRATEGY-005** (this)                                 | The umbrella policy, rationale, and the mandate                                         |
| [ProductResearchTemplate](ProductResearchTemplate.md)   | The 17-field, evidence-required research record every proposal fills                    |
| [ProductScorecard](ProductScorecard.md)                 | The weighted 0–100 Business Score, its weights, and scoring rules                       |
| [RevenueMatrix](RevenueMatrix.md)                       | The 12-path monetisation grid every engine is mapped against                            |
| [ProductDecisionChecklist](ProductDecisionChecklist.md) | The one-page go/no-go gate a proposal must pass                                         |
| [BusinessKPIs](BusinessKPIs.md)                         | Business-aware metrics that replace tool-count vanity, engineering excellence preserved |
| ProductFactory `Workflows/ProductLifecycle.md`          | The redesigned 10-stage lifecycle (updated in easytech-workspace)                       |

## The redesigned product lifecycle

STRATEGY-004's lifecycle (Idea → … → Maintenance) is extended with the commercial stages
it was missing. The new canonical order:

```
1. Research            → fill ProductResearchTemplate (evidence, not opinion)
2. Business Validation → is there a paying buyer + a distribution channel? (RevenueMatrix)
3. Scoring             → ProductScorecard → Business Score (0–100)
4. Approval            → ProductDecisionChecklist (STRATEGY-004 gates + threshold)
5. Architecture        → platform review; reuse; trust model assigned
6. Implementation      → Frozen Tool Framework; the five validation gates
7. Launch              → deploy + `forge execution production verify` (the only "shipped")
8. Measurement         → OBSERVATION.md; real data or "unknown"
9. Business Review     → did it earn / convert / retain? (BusinessKPIs) — NEW
10. Expansion          → if it earns, extend it across the Revenue Matrix — NEW
```

Stages 1–4 are **new gates before any code is written.** Stages 9–10 are **new gates
after launch** that ask the question the old lifecycle never did: _did it make money, and
should we double down?_ No sprint reaches Implementation without a completed research
record, a Business Score, and a passed checklist.

## Core principles of revenue-first selection

1. **A revenue path is mandatory — or a named strategic loss-leader reason.** Every
   proposal must show at least one credible path from the [Revenue Matrix](RevenueMatrix.md)
   (API, SDK, widget, white-label, subscription, affiliate, licensing, enterprise, AI-tool),
   **or** an explicit, written justification that it is a distribution loss-leader feeding
   a _monetisable_ engine (e.g. a free Everyday tool that bridges to a paid Finance API).
   "It's cool" is not a reason. "It has no buyer and feeds nothing that does" is a reject.
2. **Distribution is scored as heavily as demand.** A proposal must name a channel that
   reaches buyers **without** requiring SEO, an owned audience, ads, or cold outreach —
   or accept a low distribution score. Marketplaces with their own buyers (RapidAPI,
   Apify/MCP, Fiverr/Upwork for services, VS Code) score high; "we'll post it on our site"
   scores low until Gate 0 proves we have traffic.
3. **Reuse compounds; it is a first-class score, not an afterthought.** Esytol's structural
   advantage is a library of tested, deterministic engines. A proposal that monetises an
   _existing_ engine through a _new surface_ (e.g. the income-tax engine as an API) is
   worth far more than a new engine from scratch.
4. **Honesty is non-negotiable, revenue-first or not.** Evidence is cited; unknowns are
   "unknown"; no demand or revenue number is invented to justify a build. A revenue-first
   framework that fabricates demand is worse than an enthusiasm-first one.
5. **Engineering excellence is preserved, not traded away.** Determinism, privacy,
   honesty-by-construction, test coverage, and forge-verified deploys remain mandatory.
   Revenue-first changes _what we choose to build_, never _how well we build it_.

## The mandate

From ratification, **no tool or category enters the roadmap without a completed
[ProductResearchTemplate](ProductResearchTemplate.md), a [Business Score](ProductScorecard.md),
and a passed [ProductDecisionChecklist](ProductDecisionChecklist.md).** Every sprint that
proposes a build records these in ProductFactory alongside its Sprint Declaration. This is
mandatory governance for every future roadmap decision, subordinate only to STRATEGY-003
and STRATEGY-004.
