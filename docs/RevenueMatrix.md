# Revenue Matrix

> **Purpose:** A reusable grid that forces every **engine** to be evaluated against **every** monetisation surface — so an asset's earning potential is a deliberate decision, not an accident. Governed by [STRATEGY-005](Strategy005RevenueFirst.md).
> **Status:** Mandatory governance artifact · living
> **Last Updated:** 2026-07-18

Esytol's durable asset is not the website — it is the library of **pure, tested,
deterministic engines**. Each engine can be sold through many surfaces. The old model
saw only one (a free web tool). This matrix makes the other eleven visible for every engine.

## The twelve surfaces

| Surface               | What it is                                 | Notes                                            |
| --------------------- | ------------------------------------------ | ------------------------------------------------ |
| **Website**           | The free/paid tool on esytol.com           | Distribution-limited until Gate 0 proves traffic |
| **API**               | Metered HTTP endpoint (RapidAPI, own)      | Best reuse-to-revenue path for compute engines   |
| **SDK**               | Installable library (npm, PyPI)            | Monetise via licensed pro tiers / support        |
| **Widget**            | Embeddable calculator/tool for other sites | White-label adjacent; B2B                        |
| **White-label**       | Rebrandable tool for partners              | Advisors, brokers, fintechs                      |
| **Enterprise**        | Bespoke deployment / SLA / on-prem         | Long cycle; high value                           |
| **Browser Extension** | Chrome/VS Code utility                     | Traffic yes; native paid weak                    |
| **AI Tool**           | MCP server / agent-callable tool           | 2025–26 emerging; agent pays per call            |
| **Affiliate**         | Decision layer → partner links             | REVENUE-001 plumbing ready; needs traffic        |
| **Advertising**       | Display ads                                | **Rejected platform-wide** (STRATEGY-001/003)    |
| **Subscription**      | Recurring access to premium features       | Needs a durable premium value                    |
| **Licensing**         | Sell the code/engine itself                | Boilerplate/source or engine license             |

## Status legend

- **Live** — shipped and (capable of) earning today.
- **Planned** — a credible, admitted path on the roadmap.
- **Rejected** — evaluated and deliberately declined (record why).
- **N/A** — not applicable to this engine.

Every engine's row must justify a **Rejected** with a reason, so "we never thought about
it" can never masquerade as "we decided against it."

## Platform-wide rule

**Advertising is Rejected for every engine** — monetisation is decision-layer/affiliate,
API/B2B, and licensing, never display ads (STRATEGY-001, ratified in STRATEGY-003). This
row is pre-filled Rejected across the matrix.

## The matrix (representative engines today)

Legend: L=Live · P=Planned · R=Rejected · –=N/A

| Engine                                               | Website | API   | SDK | Widget | White-label | Enterprise | Extension       | AI Tool | Affiliate | Advertising | Subscription | Licensing |
| ---------------------------------------------------- | ------- | ----- | --- | ------ | ----------- | ---------- | --------------- | ------- | --------- | ----------- | ------------ | --------- |
| **Income Tax** (`lib/incomeTax`)                     | L       | **P** | P   | P      | P           | P          | –               | P       | P         | R           | P            | P         |
| **Loan/EMI** (`lib/emi`, homeLoan, personalLoan)     | L       | **P** | P   | P      | P           | P          | –               | P       | P         | R           | P            | P         |
| **Investment** (`sip,fd,rd,ppf,cagr,lumpsum`)        | L       | P     | P   | P      | P           | –          | –               | P       | P         | R           | P            | P         |
| **Salary/Retirement** (`hra,epf,gratuity,nps`)       | L       | **P** | P   | P      | P           | P          | –               | P       | P         | R           | P            | P         |
| **GST** (`lib/gst`)                                  | L       | P     | P   | P      | P           | P          | –               | P       | –         | R           | –            | P         |
| **Financial Roadmap/Dashboard** (`financialRoadmap`) | L       | P     | –   | P      | P           | P          | –               | P       | P         | R           | **P**        | P         |
| **Dev utilities** (`lib/dev/*`)                      | L       | P     | P   | –      | –           | –          | **P** (VS Code) | P (MCP) | –         | R           | –            | P         |
| **Text/Everyday** (`textStats,textCase,age`)         | L       | –     | –   | –      | –           | –          | P               | –       | –         | R           | –            | –         |

### What the matrix reveals (this is the point)

- The **Finance engines are radically under-monetised**: every one is Website-only today,
  yet each has a **Planned API, white-label, and licensing** path. The income-tax and
  salary/retirement engines (Finance Act correctness, hard to maintain) are the highest-value
  API/white-label candidates — the STRATEGY-003 "computation layer" thesis made concrete.
- **Dev utilities'** best non-website surfaces are a **VS Code extension** and an **MCP
  server** (agent-callable), not an API (the primitives are free elsewhere).
- **Everyday engines** monetise mostly as **distribution loss-leaders** (top-of-funnel),
  which is why they score low on the [Scorecard](ProductScorecard.md) unless a bridge to a
  paid engine is declared.
- **Affiliate** is Planned where a decision surface exists (loans, tax filing, investing,
  credit) — the REVENUE-001 plumbing is built; it converts only once Gate 0 confirms traffic.

## How to use the matrix

1. When a new engine is proposed, add its row and mark all twelve surfaces (L/P/R/– with
   reasons for R).
2. The **[Scorecard](ProductScorecard.md)** "Revenue path clarity" dimension reads directly
   from this row: ≥1 Planned/Live non-website path scores high; website-only + no bridge
   scores low.
3. In **Business Review** (lifecycle stage 9), revisit the row: a Planned path that earned
   becomes Live; one that failed becomes Rejected with the evidence.
4. **Expansion** (stage 10) is literally "move a Planned to Live on a proven engine" — e.g.
   the income-tax engine's `Website → API` transition.

## Blank template (copy per new engine)

```
Engine: <name>  (lib/<file>)
Website:      <L|P|R|–>  <reason if R>
API:          <L|P|R|–>  <reason if R>
SDK:          <L|P|R|–>
Widget:       <L|P|R|–>
White-label:  <L|P|R|–>
Enterprise:   <L|P|R|–>
Extension:    <L|P|R|–>
AI Tool:      <L|P|R|–>
Affiliate:    <L|P|R|–>
Advertising:  R  (platform-wide — STRATEGY-001/003)
Subscription: <L|P|R|–>
Licensing:    <L|P|R|–>
```
