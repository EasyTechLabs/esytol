# SEO Strategy — Income Tax Calculator

Supporting strategy for `/tools/income-tax-calculator` (FY 2025-26 / AY 2026-27).
This is one of the highest-volume, highest-intent finance queries in India and
should anchor Esytol's tax cluster.

## 1. Target keywords

**Primary (head)**

- income tax calculator
- income tax calculator india
- income tax calculator FY 2025-26 / AY 2026-27

**Secondary (high intent)**

- new tax regime calculator
- old vs new tax regime calculator
- income tax slab calculator
- salary tax calculator / take-home salary tax calculator
- 80C tax calculator
- income tax rebate 87A calculator

**Long-tail (rank fast, high conversion)**

- how much tax on ₹12 lakh / ₹15 lakh / ₹20 lakh salary
- is income up to 12 lakh tax free
- tax on 13 lakh new regime (marginal relief)
- income tax for salaried person new regime

## 2. Search intent

| Intent                 | Query shape                                         | Our answer                                                        |
| ---------------------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| **Transactional/tool** | "income tax calculator"                             | The calculator itself — instant, both regimes, no signup          |
| **Comparison**         | "old vs new regime"                                 | Built-in Old-vs-New comparison + "Best" recommendation            |
| **Informational**      | "income tax slabs 2025-26", "how tax is calculated" | Supporting articles (see Content Plan) linking to the tool        |
| **Verification**       | "is 12 lakh tax free"                               | FAQ + methodology answer this directly (rebate + marginal relief) |

Most searchers want the **number now** → the tool must be above the fold, fast,
and default to the New Regime (the common case).

## 3. Competitors (and how we win)

| Competitor                    | Strength          | Our edge                                                          |
| ----------------------------- | ----------------- | ----------------------------------------------------------------- |
| ClearTax, Groww, ET Money     | Brand + backlinks | Cleaner UX, no signup/upsell, no ads, private (in-browser)        |
| BankBazaar, Paisabazaar       | Coverage          | Accurate **marginal relief** (rebate + surcharge) many tools skip |
| Income Tax Dept e-filing calc | Authority         | Far better UX, instant Old-vs-New comparison, shareable URL       |

Differentiators to emphasise in copy/schema: **both regimes side by side**,
**marginal relief handled**, **methodology + official sources visible (E-E-A-T)**,
**private / no signup**.

## 4. Internal linking plan

- **Hub → spoke:** the three supporting articles (Content Plan) each link to the
  calculator with descriptive anchors ("calculate your tax for FY 2025-26").
- **Spoke → spoke:** cross-link articles (slabs ↔ old-vs-new ↔ how-tax-is-calculated).
- **Tool → related tools:** the calculator's `relatedTools` already point to
  EMI, Home Loan, SIP, PPF, GST, FD — capturing "what to do with the tax I save"
  (invest via SIP/PPF, home-loan interest deduction ties to the Home Loan tool).
- **Home/Popular/New:** the tool is `featured` + `popular` + `isNew`, so it
  surfaces on the homepage, /popular, and /new automatically.
- Add the calculator link from the PPF, home-loan, and SIP tool FAQs/methodology
  where "tax benefit" is mentioned (future copy pass — do not force).

## 5. Meta strategy

- **Title:** "Income Tax Calculator" → renders `Income Tax Calculator — Esytol`.
- **Description:** front-load FY, both regimes, and the ₹12L rebate hook (already
  in the registry description).
- **Canonical:** `https://www.esytol.com/tools/income-tax-calculator`.
- **OG/Twitter:** dynamic branded image at `/og/income-tax-calculator` (auto).
- **JSON-LD:** SoftwareApplication (INR) + Breadcrumb + FAQPage (6 Q&A incl. the
  "is 12 lakh tax free" question that targets a featured-snippet).
- **Freshness:** keep `lastUpdated` current and update slabs when the next
  Finance Act changes them — freshness matters for tax queries every Budget.
- **Featured-snippet plays:** FAQ answers are written as direct, self-contained
  responses ("Under the New Regime for FY 2025-26, income up to ₹12,00,000 …").
