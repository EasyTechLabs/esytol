# Income Tax Engine — Business Case, API & AI Readiness

> **Purpose:** The evidenced revenue case for the Income Tax API, the API-ready architecture (Part 5), and the AI readiness design (Part 7). Part of [EXECUTION-001](Execution001IncomeTax.md).
> **Status:** Execution plan · readiness design only — **no implementation.**
> **Last Updated:** 2026-07-18

Every market claim below is cited per the [Evidence Standards](EvidenceStandards.md) tier and
graded by the [Confidence Framework](ResearchConfidenceFramework.md). Unknowns are marked
"unknown" and price points are labelled `[ASSUMPTION]` — no number is invented.

## The revenue case (evidence, not assertion)

**The gap (Medium confidence).** The income-tax-India API that used to sit on RapidAPI is
**deprecated / no longer listed** [T1 · RapidAPI directory, income-tax-india-e-filing · 2026-07-18].
The remaining players — **Sandbox by Quicko** and **ClearTax** — sell _full compliance/filing_
suites (return prep, e-filing, data extraction), not a lightweight developer calculation API
[T1 · sandbox.co.in/income-tax · 2026-07-18]. The Income Tax Department's own APIs are for
_filing_, not calculation-as-a-service [T1 · incometax.gov.in/iec/foportal/api-specifications].
→ There is a **current, evidenced gap for a cheap, self-serve, developer-friendly Indian
income-tax _calculation_ API** — precisely the shape of Esytol's pure, tested engine.

**Willingness-to-pay anchor (Medium confidence).** Indian payroll SaaS charges **₹40–120 per
employee per month** (or ~$8–18 PEPM), with $200–800 setup [T2 · bharatpayroll.com; topsourceworldwide.com · 2026-07-18].
Payroll and HR-tech vendors must compute salary tax correctly for India and either build it or
embed it — evidence that the computation itself carries real, recurring value.

**The buyer (Medium confidence).** A developer at a payroll / HR-tech / lending / fintech company,
or a CA-software vendor, who needs correct Indian tax/take-home computation and a deadline. Timing:
**it is filing season (July)** — the demand is live now.

**Willingness-to-pay _price point_ (Unknown).** Neither Sandbox nor ClearTax publishes calc-API
pricing [Unknown · not public · 2026-07-18], so there is no external anchor for a _calculation-API_
price. **[ASSUMPTION]** a free tier (100 calls/mo) + a $19–29/mo Pro tier is a plausible entry
band; **test:** list on RapidAPI and observe conversion. Confidence: **Low** — this is the bet, not a fact.

**Honest overall read.** The _gap_ and the _value of the computation_ are Medium-confidence and
evidenced. The _price point_ and the _timing of the first buyer_ are **Unknown** — so per
STRATEGY-006 this is funded as the **Stage-A Revenue bet**, explicitly labelled, not on a
fabricated forecast. It is the highest-return bet available because it monetises the crown-jewel
engine through a marketplace with its own buyers, during peak season, into an evidenced gap.

**Differentiation (the one sentence).** _The only lightweight, developer-priced, self-serve
Indian income-tax **calculation** API that is provably correct (verified against ITD examples),
multi-year, and fully explainable — where the incumbents sell heavy compliance suites._

## PART 5 — API-ready architecture (design, not implementation)

The architecture the engine must reach to be listable. **Readiness, not code.**

### Layering (build only the thin adapter; the marketplace supplies the rest)

```
[ RapidAPI ]  ── auth · billing · metering · rate-limit · discovery (we build none of this)
     │  proxies to
[ API adapter ]  ── a stateless Vercel route: validate → call engine → envelope  (the only new surface)
     │  calls
[ Domain contract ]  ── versioned request/response schema, UI-decoupled  (T2)
     │  wraps
[ Pure engine ]  ── lib/incomeTax, year-versioned  (T1) — unchanged math, more years
```

The marketplace (RapidAPI) provides authentication, billing, metering, and discovery, so the only
new build is a thin, stateless adapter over the existing pure engine.

### Readiness requirements

- **Stateless + idempotent:** the engine is a pure function; identical requests return identical
  results with no stored state. No session, no database, **no PII retained** (privacy by
  architecture — a tax API that stores incomes is a liability we refuse to create).
- **Versioned contract:** an explicit `assessmentYear` in the request (T1) and an API version in
  the path/header, so a past year's answer never silently changes for an integrator.
- **Strict input validation:** untrusted external input is schema-validated before the engine sees
  it; malformed input returns a typed error, never an exception.
- **Error envelope:** a consistent `{ ok, result | error }` shape with machine-readable error codes.
- **OpenAPI spec:** the contract published so RapidAPI (and integrators) can generate clients.
- **Rate-limit-friendly:** stateless + fast (O(slabs)) → cheap to serve; the marketplace meters it.

## PART 7 — AI readiness (design)

The same trace that serves enterprises serves AI — build it once.

- **Structured outputs:** a typed JSON result (regimes, slab rows, surcharge, cess, recommendation)
  — already largely present; formalise it in the contract.
- **Explainability:** the **cited computation trace** (T5) — every step as `{step, statute, input,
amount}` — so both an auditor and an AI can follow the working.
- **Citation support:** section-level provenance (§115BAC, §87A, §288B, First Schedule) attached to
  each step, so an AI answer can cite _"per §87A, rebate ₹…"_ rather than assert a number.
- **Transparent calculation:** no black box — the trace reconstructs the total from its parts, and
  the parts cite the law. This is what makes an AI system willing to _use and cite_ the engine.
- **Agent-callable (MCP):** a tool definition (T8) so an AI agent can invoke the engine directly —
  the 2025–26 AI-tool revenue path.

## Why this beats the alternatives (for this engine)

- **vs. building more calculators (Authority):** those add no revenue at Stage A; this monetises an
  asset that already exists and is already the highest-scored.
- **vs. the incumbents:** they sell heavy compliance suites; the evidenced gap is the _light_ calc
  API — the exact shape of our engine, at a fraction of their integration cost.
- **vs. our own website (Affiliate/Ads):** those need traffic we do not yet have (Gate 0). The API
  needs a marketplace's buyers, not ours — the only distribution that works pre-audience.

The first payment does not require the enterprise machinery. It requires a **Level-2-trusted,
year-versioned engine behind a thin, well-specified API, listed during filing season.** That is
the whole plan.

Sources: [RapidAPI income-tax-India directory (deprecated)](https://rapidapi.com/blog/directory/income-tax-india-e-filing/) · [Sandbox by Quicko — Income Tax API](https://sandbox.co.in/income-tax) · [ITD API specifications](https://www.incometax.gov.in/iec/foportal/api-specifications) · [India payroll software pricing 2026](https://bharatpayroll.com/blog/payroll-software-pricing-in-india/) · [India payroll cost guide 2026](https://topsourceworldwide.com/insights/india-payroll-outsourcing-costs-and-services-the-complete-2026-guide/)
