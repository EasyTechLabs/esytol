# REVENUE SPRINT-001 — First Paying Customer

```
── Sprint Declaration (STRATEGY-004/005/006) ─────────
Platform:             Esytol / EasyTechLabs
Domain:               Cross-platform (revenue operations)
Category:             Revenue / go-to-market (no new code)
Tool(s):              existing assets only — no new product invented
Priority Score:       n/a (this sprint CHOOSES what to prioritise, on evidence)
Admission Result:     ADMIT (Stage-A Revenue; the KPI is first payment)
Capital Allocation:   Revenue portfolio · Stage-A · the entire discretionary budget points here
Dependencies:         RESEARCH-001, STRATEGY-004/005/006 (frozen), OBSERVE-001 (the learning loop)
Expected Maintenance: superseded by the 30-day plan's weekly reviews
Platform Impact:      Names the single fastest ethical path to first revenue from EXISTING assets.
                      Analysis + plan only — no feature work, no new API, no redesign.
──────────────────────────────────────────────────────
```

> **Purpose:** As CEO/CRO: find the fastest **ethical** path from assets that already exist to the
> **first paying customer**, and commit to exactly one. No new products unless the analysis proves
> existing assets cannot reasonably produce the first payment.
> **Status:** Decided · one recommendation, defended by evidence.
> **Last Updated:** 2026-07-18
> **Related:** [Opportunity Ranking](RevenueOpportunityRanking.md) · [30-Day Execution](RevenueExecution30Day.md) · [First-Customer Playbook](FirstCustomerPlaybook.md) · [Business Case](IncomeTaxBusinessCase.md) · [Learning Log](LearningLog.md) · [Pricing](IncomeTaxApiPricing.md)

---

## The founder's reality (the constraints this plan respects)

One engineer. Limited capital (no meaningful paid-ads budget). **Zero revenue, zero customers.**
**Zero measurable audience** — Gate 0 (the 3 analytics grants) is still pending, so we cannot see
or count website traffic. Therefore any plan that _depends on traffic we already have_ is a plan
built on a number we do not possess. The winning path must **either bring its own buyers** or
**ride demand that already exists** — and must be **self-serve** (we have no sales team and the
mission forbids outbound-sales-dependent models).

> **On sunk cost (stated up front):** the Income Tax Engine got the most engineering, but that is
> _not_ why it may win. Below it is judged on the same axes as everything else. If it wins, it wins
> because it is the only asset that is **already a packaged product sitting on an external billing
> rail that supplies its own buyers** — not because we spent money on it.

## PART 1 — Asset inventory

Traffic potential is written **"unknown (Gate 0)"** wherever it depends on unmeasured website
traffic — we do not invent numbers.

### A. The packaged product (sellable as-is today)

| Asset                                                        | Problem solved                                                                         | Target user                                              | Maturity                                                             | Traffic potential                                      | Revenue potential                                                    | Distribution                                  | Time-to-money                                                           | Eng effort to monetize |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------- | ---------------------- |
| **Income Tax HTTP API** (`/api/v1`, OpenAPI 3.1, playground) | Correct Indian income-tax calc (both regimes, multi-year, cited) as a callable service | Developer at payroll/HR-tech/fintech/lending/CA-software | **Production + listing artifacts ready** (EXPOSE-001/DISTRIBUTE-001) | Rides RapidAPI's own buyer base + filing-season search | **Direct** — subscription via marketplace; billing/metering supplied | Days to publish; first-payment timing unknown | **~zero** (publish + monitor; auth/billing already handled by RapidAPI) |

### B. Web calculators — live, correct, SEO-built, but monetized only via traffic

| Group            | Tools                                  | Problem solved                     | Target user              | Maturity  | Traffic potential           | Revenue model that could fit                  | Time-to-money | Eng effort             |
| ---------------- | -------------------------------------- | ---------------------------------- | ------------------------ | --------- | --------------------------- | --------------------------------------------- | ------------- | ---------------------- |
| **Tax & Salary** | Income Tax (web), HRA                  | tax/take-home planning             | salaried Indians, filers | live, SEO | unknown (Gate 0); seasonal  | ads / affiliate (needs traffic + approvals)   | slow          | low tool / high funnel |
| **Loans**        | EMI, Home Loan, Personal Loan          | repayment planning                 | borrowers                | live, SEO | unknown (Gate 0)            | lender affiliate (needs traffic + deals)      | slow          | medium                 |
| **Investments**  | SIP, Lumpsum, FD, RD, PPF, CAGR, GST   | returns/tax planning               | investors, SMBs          | live, SEO | unknown (Gate 0)            | ads / affiliate                               | slow          | low                    |
| **Retirement**   | EPF, Gratuity, NPS                     | corpus/benefit planning            | employees                | live, SEO | ads / affiliate; API bundle | slow (web) / medium (API)                     | low           |
| **Planning**     | Financial Roadmap, Financial Dashboard | action plan + local net-worth view | DIY planners             | live      | unknown (Gate 0)            | freemium SaaS (needs billing build + traffic) | slow          | high                   |

### C. Developer & Everyday tools — commodity utilities

| Group         | Tools                               | Reality                                              | Revenue potential                          |
| ------------- | ----------------------------------- | ---------------------------------------------------- | ------------------------------------------ |
| **Developer** | JSON Formatter, Base64, URL Encoder | commodity; hundreds of free equivalents; client-side | **near-zero WTP**; ads only, needs traffic |
| **Everyday**  | Age, Word Counter, Case Converter   | commodity                                            | **near-zero WTP**; ads only, needs traffic |

### D. Internal leverage (not products, but multipliers)

| Asset                                        | Use                                                              |
| -------------------------------------------- | ---------------------------------------------------------------- |
| Marketing Agent V1 · SEO Intelligence Engine | prioritise content/SEO cheaply (one-engineer force multiplier)   |
| Learn Center (15 articles)                   | organic-search surface + credibility for the tax/salary cluster  |
| Growth Dashboard                             | will measure everything **once Gate 0 opens** (blind until then) |

**Inventory verdict:** exactly **one** asset (the Income Tax API) is already a product on a billing
rail that supplies buyers. Every calculator is a _traffic-dependent_ revenue play — and we cannot
see our traffic. Every developer/everyday tool is a commodity with no willingness-to-pay. Nothing
else is packaged to take a payment without either (a) traffic we can't measure, (b) a billing/SaaS
build, or (c) outbound sales.

## PART 2 — Customer discovery (shortlisted assets)

Shortlist = assets that can plausibly take a payment in 30 days: **the Income Tax API**, and — as
the honest challenger — **white-label/embeddable calculators**.

### Income Tax API

- **First realistic customer:** a developer building or maintaining an Indian **payroll / HR-tech /
  fintech / lending / CA-software** product who needs correct salary-tax / take-home computation and
  does not want to build and maintain the tax logic (which changes every Finance Act).
- **Why they pay:** building it in-house is recurring cost and audit risk; a cheap, correct,
  cited, multi-year API is far less than an engineer's time. Payroll SaaS already pays ₹40–120 PEPM
  to get tax right [RESEARCH-001 T2] — the computation carries recurring value.
- **The job hired for:** _"Give me the correct Indian tax number (and the working) for this salary,
  this year, without me owning the tax code."_
- **Urgency:** high **now** — it is filing/payroll season (July); tax logic is deadline-bound and
  compliance-sensitive.

### White-label calculators (the challenger)

- **First customer:** an Indian financial advisor / insurance agent / loan DSA / small CA firm who
  wants branded calculators on their own site to capture leads.
- **Why they pay:** lead capture + credibility during filing season.
- **The job:** _"Put a trustworthy calculator on my site with my logo."_
- **Urgency:** high seasonally — **but** reaching them requires _outbound_ (they will not discover a
  self-serve embed we have not marketed, and we have no audience). → fails the mission's constraints.

## PART 3 — Monetization options (only realistic models)

| Model                                  | Fit for EasyTechLabs?                                        | Verdict                                                                         |
| -------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| **API subscription (via marketplace)** | Self-serve; billing/metering supplied; buyers supplied       | ✅ **Best fit** — the only model needing neither our traffic nor outbound sales |
| Usage-based pricing                    | Natural for an API; RapidAPI meters it                       | ✅ pairs with the above (overage tiers)                                         |
| Premium features (freemium)            | Needs our own billing + auth build + traffic                 | ⚠️ later, not for first payment                                                 |
| SaaS subscription                      | Needs billing build + audience                               | ⚠️ later                                                                        |
| One-time purchase                      | Fast to convert, but needs our own billing/auth (EXPOSE-002) | ⚠️ possible Phase-2 launch tactic, adds engineering                             |
| Enterprise licence                     | Requires **outbound sales**                                  | ❌ rejected (constraint)                                                        |
| White-label                            | Requires outbound sales / a new embed product                | ❌ rejected for _first_ payment; strong Phase-2                                 |
| Affiliate                              | Requires traffic we can't measure + partner approvals        | ❌ rejected pre-audience                                                        |

**Chosen model:** **API subscription + usage-based tiers on RapidAPI** — the pricing _hypothesis_
already exists (Basic free / Pro $10 / Ultra $29 / Mega $99, every number a labelled assumption; see
[Pricing](IncomeTaxApiPricing.md)). It is the only model that fits a founder with no audience, no
sales team, and one engineer.

## PART 4 — Distribution (ranked: effort vs. return)

The scarce resource is **discovery**, not the product. Ranked for driving a developer to the
marketplace listing during filing season:

| Rank | Channel                                                                                  | Effort       | Expected return | Why                                                                                          |
| ---- | ---------------------------------------------------------------------------------------- | ------------ | --------------- | -------------------------------------------------------------------------------------------- |
| 1    | **RapidAPI marketplace search**                                                          | ~0 (publish) | Medium          | The buyers are _already there_ looking for APIs; the incumbent is deprecated (evidenced gap) |
| 2    | **Filing-season SEO / content** (Learn Center + "free India tax API" article)            | Low–Med      | Medium          | Rides existing search demand; durable long-term value; uses our SEO engine                   |
| 3    | **Developer communities** (r/india, r/developersIndia, r/IndiaTax, IndieHackers, dev.to) | Low          | Medium          | Free, targeted, honest "I built a free India tax calc API" post                              |
| 4    | **Product Hunt / Show HN launch**                                                        | Med          | Med (spiky)     | One-day discovery burst to indie devs; good for first signups                                |
| 5    | **GitHub** (a public example client / SDK snippet repo)                                  | Low          | Low–Med         | Devs search GitHub; example code lowers integration friction                                 |
| 6    | **Payroll/HR-tech & fintech founder communities** (LinkedIn posts, niche Slacks)         | Med          | Med             | Exactly the buyer; **content, not cold outreach** (stays inbound)                            |
| 7    | Newsletter / X (build-in-public)                                                         | Low          | Low             | Compounding but slow; we have no list yet                                                    |
| 8    | Browser extension / VS Code                                                              | High         | Low             | Wrong surface for a server-side tax API; skip                                                |
| 9    | Paid ads                                                                                 | Med-$        | Unknown         | Limited capital → not for first payment                                                      |

**Distribution decision:** **publish (1) + ride season with content/SEO (2) + honest developer-
community distribution (3,4,5,6).** All organic, all self-serve, all within a one-engineer budget.
The listing is passive discovery; the community/content is the _active_ wedge that stops this being
"list and pray."

## PART 6 — Recommendation (exactly one)

> ## ▶ Publish the Income Tax API on RapidAPI and drive filing-season developer demand to it through free-tier + organic developer-community distribution — to convert the first paying subscriber.

**Why this, on merit (not sunk cost):** it is the **only** asset that is simultaneously
(a) already a finished, sellable product; (b) sitting on a marketplace that supplies **billing,
metering, and buyers we otherwise do not have**; (c) monetizable **without our own traffic** (which
we cannot even measure); (d) sellable **self-serve, with zero outbound**; (e) backed by **evidenced
demand** (deprecated incumbent + heavy-only competitors [T1]; recurring computation value [T2]);
(f) **in-season now**; and (g) requiring **~zero new engineering**. No other asset clears all seven.

### Why every alternative was rejected

- **White-label calculators** — plausibly higher revenue per customer, but reaching non-technical
  advisors needs **outbound sales** or a **new self-serve embed product + billing** (weeks of eng).
  Higher investment, lower probability of a payment in 30 days. → **Phase-2**, after the engine's
  value is validated.
- **Calculator ads / affiliate** — depend on **traffic we cannot measure (Gate 0)** and on
  third-party approvals (AdSense, lender/insurer programs). Revenue-per-visit is tiny; you need a
  large, _known_ audience first. → deferred until Gate 0 opens.
- **Freemium SaaS on Roadmap/Dashboard** — requires building our **own billing + auth** and an
  audience to convert. Highest investment, slowest to first payment. → later.
- **Developer / Everyday tools** — commodity utilities with **near-zero willingness-to-pay**; no
  honest paid model exists. → keep as free SEO/top-of-funnel, never as the revenue bet.
- **Direct API sale / one-time lifetime deal** — faster conversion psychology, but needs our own
  key-auth + billing (EXPOSE-002). Adds engineering the marketplace already gives us for free. →
  a _tactic to revisit_ only if marketplace discovery underperforms.
- **Inventing a new product** — explicitly disallowed unless existing assets can't produce the first
  payment. They can. → rejected.

### The honest risk (named, not hidden)

The buyer pool (Indian payroll/fintech devs) is **narrow**, and marketplace discovery can be slow, so
**30 days may not be enough for a payment**. This is the #1 risk. It is mitigated by _active_
community distribution (not passive listing) and by a fallback that still creates value: if no
payment lands, the sprint returns a **validated or invalidated verdict on API demand** (via the
[Learning Log](LearningLog.md)) so the next sprint pivots to white-label or another asset **on
evidence, not on a guess.** Either outcome advances the company.

## PART 8 — Success criteria (no invented targets)

Per STRATEGY-005/006 and OBSERVE-001, **no numeric target is fabricated.** Success is defined by
_events and verdicts_, measured from RapidAPI analytics + the [Evidence Register](ProductionEvidenceRegister.md):

| Metric                            | Definition                                              | How measured                   | Baseline |
| --------------------------------- | ------------------------------------------------------- | ------------------------------ | -------- |
| **First payment** _(primary KPI)_ | Date the first paid subscription occurs                 | RapidAPI billing               | not yet  |
| External signups                  | Non-team subscribers (free or paid)                     | RapidAPI                       | 0        |
| Trial/active integration          | A subscriber making repeat real calls                   | Vercel logs / RapidAPI         | 0        |
| Free → paid conversion            | Paid ÷ total subscribers                                | RapidAPI                       | unknown  |
| Pricing-validation conversations  | Developer interviews touching willingness-to-pay        | interview notes                | 0        |
| Retention                         | Subscribers still calling after 2 weeks                 | RapidAPI                       | unknown  |
| Support requests                  | Questions via /contact + GitHub                         | inbox                          | 0        |
| **Assumptions resolved**          | RESEARCH-001 assumptions moved to Validated/Invalidated | [Learning Log](LearningLog.md) | 0 of 11  |

**Definition of success for this sprint:** **first payment** — _or_, if that does not land in 30
days, a **decisive evidence verdict** (validated/invalidated demand + pricing signal) that redirects
the next revenue sprint. Failure is only _learning nothing_ — running 30 days and still guessing.

## Long-term value check

This path **preserves** company value: publishing the API burns nothing, the content/SEO built is a
durable compounding asset, and the customer-discovery interviews feed the Learning Log regardless of
outcome. It does not foreclose white-label or SaaS — it **de-risks** them by validating the engine's
commercial value with real buyers first.
