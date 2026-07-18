# Engine Portfolio

> **Purpose:** Classify every engine into exactly one primary portfolio, so capital is allocated by role, not by enthusiasm. Governed by [STRATEGY-006](Strategy006CapitalAllocation.md).
> **Status:** Mandatory governance artifact · living
> **Last Updated:** 2026-07-18

An **engine** is a reusable unit of value — usually a pure function in `lib/` plus the
surfaces it powers. Every engine belongs to **exactly one primary portfolio**, chosen by its
dominant _go-forward_ role (where the next hour of investment should return value), not by
its current only-surface. Secondary roles are noted but do not change the classification.

## The five portfolios

### 1. Revenue Engines

- **Purpose:** Convert engineering into money directly. These are the positions that must
  produce the first payment and then recurring revenue.
- **Primary KPI:** Revenue (first payment → MRR). Secondary: paying customers, conversion.
- **Expected lifespan:** Long (years) — a monetised correctness engine compounds.
- **Investment philosophy:** Over-index here while pre-revenue. Fund the _shortest path to a
  paying buyer through a marketplace that already has buyers_ (STRATEGY-005 distribution rule).
- **Success criteria:** A live revenue path (Revenue Matrix "Live"), a paying customer, MRR growth.
- **Failure criteria:** 90 days funded with no path to Live and no paying interest → freeze or reclassify.
- **Review cadence:** Monthly (and every Quarterly CEO Review).

### 2. Acquisition Engines

- **Purpose:** Bring users to the platform cheaply and at volume; feed the Revenue engines.
- **Primary KPI:** New + returning visitors; funnel entry; cross-domain navigation into paid surfaces.
- **Expected lifespan:** Medium–long; individual tools may be commoditised and retired.
- **Investment philosophy:** Cheap, high-volume, evergreen tools that are **loss-leaders with a
  named bridge** to a Revenue engine. Never funded for traffic alone (STRATEGY-005).
- **Success criteria:** Measurable inbound + a demonstrated hand-off to a Revenue/Authority engine.
- **Failure criteria:** Traffic that never converts or bridges anywhere → retire (deprecation policy).
- **Review cadence:** Quarterly (data-gated on Gate 0).

### 3. Authority Engines

- **Purpose:** Build the moat — correctness, trust, E-E-A-T, and AI-citation — that makes the
  platform _the_ place a number is trusted (STRATEGY-003's computation-layer thesis).
- **Primary KPI:** Citations / rankings / AI references; trust-signal engagement (methodology
  views, source clicks); returning-visitor retention.
- **Expected lifespan:** Very long — authority is the compounding asset.
- **Investment philosophy:** Depth over breadth. Fund correctness, sourcing, and completeness of
  the domains we intend to own (Indian finance first). Retention surfaces (Roadmap, Dashboard) live here.
- **Success criteria:** Cited by AI systems; ranked; low quick-back; returning visitors rising.
- **Failure criteria:** Effort with no measurable trust/citation/retention lift over a full review window.
- **Review cadence:** Quarterly (data-gated on Gate 0).

### 4. Platform Engines

- **Purpose:** Make every other engine cheaper and safer to build (shared infrastructure).
- **Primary KPI:** Reuse ratio; cost-to-add-a-tool (hours to ship the Nth tool); regression rate.
- **Expected lifespan:** Very long; the substrate.
- **Investment philosophy:** Invest **only** to unblock or cheapen funded Revenue/Acquisition/
  Authority work — never to gold-plate. Platform is a _tax on the portfolio_, capped (see policy).
- **Success criteria:** A new tool ships in materially fewer hours because the platform exists.
- **Failure criteria:** Platform work that no funded engine needs = speculative gold-plating → stop.
- **Review cadence:** Quarterly; and whenever a funded engine is blocked by missing platform.

### 5. Experimental Engines

- **Purpose:** Buy optionality — cheap bets on uncertain but potentially large returns (a new
  domain probe, an MCP server, a novel monetisation test).
- **Primary KPI:** Validated learning — a clear earn/retain signal within a fixed budget.
- **Expected lifespan:** Short by design — each is a time-boxed probe that graduates or dies.
- **Investment philosophy:** Small, hard-capped budget; every experiment has a **kill date** and a
  pre-declared success threshold. No experiment is allowed to become a zombie.
- **Success criteria:** Hits its pre-declared threshold → graduates to Revenue/Acquisition/Authority.
- **Failure criteria:** Misses the threshold by the kill date → retired, learning recorded, done.
- **Review cadence:** At the kill date, and every Quarterly CEO Review.

## Classification of the current portfolio (23 live engines)

Classified by **primary go-forward role.** Secondary roles noted.

| Portfolio        | Engines (today)                                                                                                                                                                                                                             | Note                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Revenue**      | Income Tax · Salary/Retirement (HRA, EPF, Gratuity, NPS) · Loan (EMI, Home Loan, Personal Loan) · Comparison/Affiliate layer                                                                                                                | Highest-value API / white-label / affiliate paths — all currently **Planned, none Live** |
| **Authority**    | GST · Investment (SIP, FD, RD, PPF, CAGR, Lumpsum) · Financial Roadmap · Financial Dashboard · Learn Center (31 articles)                                                                                                                   | Moat + retention; secondary Revenue (subscription/API)                                   |
| **Acquisition**  | JSON Formatter · Base64 · URL Encoder · Age · Word Counter · Case Converter                                                                                                                                                                 | Top-of-funnel; must declare a bridge to a Revenue/Authority engine                       |
| **Platform**     | Tool Framework (ToolLayout, registry) · Trust surfaces (Calculator/Developer/Everyday) · Developer Experience layer (CodeEditor, lib/dev/*) · localFinance store · methodology/standards system · Marketing Agent · SEO Intelligence Engine | The substrate; internal tooling                                                          |
| **Experimental** | — (none currently)                                                                                                                                                                                                                          | **A gap** — see the innovation-ratio finding below                                       |

## The honest read this classification produces

Two findings fall straight out of the table, and both drive the [Capital Allocation Policy](CapitalAllocationPolicy.md):

1. **Zero Revenue engines are actually earning.** Every Revenue-classified engine's monetisation
   path is _Planned_, not _Live_. The company's most valuable positions are unrealised. This is
   the single largest portfolio risk and the reason the current stage over-indexes on Revenue.
2. **The portfolio is concentrated in non-earning Authority + Platform work, with no
   Experimental optionality.** That is exactly the shape of an engineering-first company that
   has not yet allocated toward returns — which is the shape STRATEGY-006 exists to correct.

Each engine's full profile (mission, KPIs, revenue matrix, risk, lifecycle stage) is recorded
using the [Engine Investment Profile](EngineInvestmentProfile.md) and reviewed each quarter.
