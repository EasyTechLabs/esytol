/**
 * Per-calculator methodology, sources, assumptions, and limitations.
 *
 * This is a standalone content dataset keyed by tool slug. It does NOT modify
 * the calculator engines, the registry, or the Tool Framework — it is rendered
 * by the shared trust/methodology components beneath each calculator's results
 * to strengthen transparency and E-E-A-T. Every fact mirrors the sourced JSDoc
 * in the corresponding `lib/*.ts` engine.
 */

export interface MethodologySource {
  label: string;
  url?: string;
}

export interface Methodology {
  /** Human-readable formula. */
  formula: string;
  /** One-line description of the calculation method. */
  method: string;
  /** Official / regulator references. */
  sources: MethodologySource[];
  assumptions: string[];
  limitations: string[];
  /** Who reviewed the methodology. */
  reviewedBy: string;
}

const REVIEWER = "EasyTechLabs Finance Team";

const RBI: MethodologySource = { label: "RBI", url: "https://www.rbi.org.in" };
const AMFI: MethodologySource = { label: "AMFI", url: "https://www.amfiindia.com" };
const SEBI: MethodologySource = { label: "SEBI", url: "https://www.sebi.gov.in" };
const NHB: MethodologySource = { label: "NHB", url: "https://nhb.org.in" };
const CBIC: MethodologySource = { label: "CBIC / GST Council", url: "https://cbic-gst.gov.in" };
const MOF: MethodologySource = { label: "Ministry of Finance", url: "https://finmin.nic.in" };
const NSI: MethodologySource = {
  label: "National Savings Institute",
  url: "https://www.nsiindia.gov.in",
};
const INDIA_POST: MethodologySource = { label: "India Post", url: "https://www.indiapost.gov.in" };
const CFA: MethodologySource = { label: "CFA Institute", url: "https://www.cfainstitute.org" };
const NSE: MethodologySource = { label: "NSE India", url: "https://www.nseindia.com" };
const ITD: MethodologySource = {
  label: "Income Tax Department",
  url: "https://www.incometax.gov.in",
};
const CBDT: MethodologySource = { label: "CBDT" };
const FINANCE_ACT: MethodologySource = { label: "Finance Act, 2025" };
const IT_ACT: MethodologySource = { label: "Income-tax Act, 1961 — Section 10(13A)" };
const IT_RULES: MethodologySource = { label: "Income-tax Rules, 1962 — Rule 2A" };
const EPFO: MethodologySource = { label: "EPFO", url: "https://www.epfindia.gov.in" };
const EPF_ACT: MethodologySource = {
  label: "Employees' Provident Funds & Misc. Provisions Act, 1952",
};
const MOL: MethodologySource = {
  label: "Ministry of Labour & Employment",
  url: "https://labour.gov.in",
};
const GRATUITY_ACT: MethodologySource = { label: "Payment of Gratuity Act, 1972" };
const IT_SEC_10_10: MethodologySource = { label: "Income-tax Act, 1961 — Section 10(10)" };
const PFRDA: MethodologySource = { label: "PFRDA", url: "https://www.pfrda.org.in" };
const NPS_TRUST: MethodologySource = {
  label: "National Pension System Trust",
  url: "https://npstrust.org.in",
};

export const methodology: Record<string, Methodology> = {
  "emi-calculator": {
    formula: "EMI = P × r × (1 + r)ⁿ / ((1 + r)ⁿ − 1)",
    method:
      "Monthly reducing-balance method. Each month, interest accrues on the outstanding balance and the EMI repays that interest plus a portion of the principal, so the interest share falls over time.",
    sources: [RBI, { label: "SBI / HDFC / ICICI loan documentation" }],
    assumptions: [
      "Fixed interest rate for the full tenure",
      "Equal monthly instalments (r = annual rate ÷ 12 ÷ 100, n = months)",
      "No prepayment or part-payment",
    ],
    limitations: [
      "Excludes processing fees, insurance, and taxes",
      "Floating-rate loans re-price when the benchmark changes",
    ],
    reviewedBy: REVIEWER,
  },
  "home-loan-calculator": {
    formula:
      "EMI = P × r × (1 + r)ⁿ / ((1 + r)ⁿ − 1)   ·   LTV = Loan ÷ (Loan + Down Payment) × 100",
    method:
      "Monthly reducing-balance EMI (RBI/NHB convention) with a full amortization schedule. Loan-to-Value and a one-time processing fee are computed alongside.",
    sources: [RBI, NHB, { label: "SBI / HDFC / ICICI / BoB / PNB Housing" }],
    assumptions: [
      "Fixed interest rate for the full tenure",
      "Down payment is separate upfront cash; processing fee is a % of the loan",
      "Property value = loan amount + down payment",
    ],
    limitations: [
      "Excludes insurance, stamp duty, taxes, and prepayment",
      "RBI LTV caps are shown, not enforced",
      "‘Effective cost’ is a total-cost premium, not an annualised APR",
    ],
    reviewedBy: REVIEWER,
  },
  "personal-loan-calculator": {
    formula: "EMI = P × r × (1 + r)ⁿ / ((1 + r)ⁿ − 1)",
    method:
      "Monthly reducing-balance EMI for an unsecured loan (RBI convention), with a full amortization schedule and one-time processing fee.",
    sources: [RBI, { label: "SBI / HDFC / ICICI / Axis / BoB / PNB" }],
    assumptions: [
      "Fixed interest rate for the full tenure",
      "Unsecured — no collateral or LTV",
      "Processing fee is a one-time % of the loan amount",
    ],
    limitations: [
      "Excludes GST on the fee, insurance, and prepayment",
      "‘Effective cost’ is a total-cost premium, not an annualised APR",
    ],
    reviewedBy: REVIEWER,
  },
  "sip-calculator": {
    formula: "FV = P × [((1 + i)ⁿ − 1) ÷ i] × (1 + i)",
    method:
      "Future value of an annuity due — each monthly instalment is invested at the start of the month (the AMFI convention), earning returns for the full month.",
    sources: [AMFI, SEBI],
    assumptions: [
      "Constant monthly investment and expected return",
      "Instalment invested at the start of each month (i = annual rate ÷ 12 ÷ 100)",
    ],
    limitations: [
      "Market returns vary; the figure is an estimate, not a guarantee",
      "CAGR is not XIRR; excludes exit load, expense ratio, and tax",
    ],
    reviewedBy: REVIEWER,
  },
  "lumpsum-calculator": {
    formula: "FV = P × (1 + r)ᵗ",
    method:
      "Future value of a one-time (lump-sum) investment compounded annually at the expected rate of return.",
    sources: [AMFI, SEBI, CFA],
    assumptions: ["Single one-time investment", "Constant annual rate of return over the period"],
    limitations: [
      "Actual market returns are variable and not guaranteed",
      "Excludes expense ratio, exit load, and taxes",
    ],
    reviewedBy: REVIEWER,
  },
  "fd-calculator": {
    formula: "A = P × (1 + r/n)^(n·t)",
    method:
      "Compound interest with a selectable compounding frequency. Indian banks compound term deposits at quarterly rests by default (RBI).",
    sources: [RBI, { label: "SBI / HDFC / ICICI deposit documentation" }],
    assumptions: [
      "Fixed interest rate for the full tenure",
      "Interest compounded at the selected frequency (n per year)",
      "Broken periods use a smooth compound extension",
    ],
    limitations: ["Excludes TDS on interest", "Excludes premature-withdrawal penalties"],
    reviewedBy: REVIEWER,
  },
  "rd-calculator": {
    formula: "M = Σ P × (1 + r/4)^((months remaining) ÷ 3)",
    method:
      "Quarterly compounding (RBI). Each monthly instalment earns interest for its residual tenure until maturity.",
    sources: [RBI, INDIA_POST, { label: "SBI / HDFC / ICICI" }],
    assumptions: [
      "Fixed monthly deposit and interest rate",
      "Quarterly compounding; deposit at the start of each month",
    ],
    limitations: [
      "Excludes TDS and premature-withdrawal penalties",
      "Some institutions use slightly different broken-period conventions",
    ],
    reviewedBy: REVIEWER,
  },
  "ppf-calculator": {
    formula: "closing = (opening + contribution) × (1 + r)   ·   compounded annually",
    method:
      "Interest is compounded annually and credited on 31 March. The yearly contribution is assumed to be deposited at the start of the financial year, earning interest for the full year.",
    sources: [MOF, NSI, INDIA_POST, { label: "SBI PPF documentation" }],
    assumptions: [
      "Contribution at the start of the financial year",
      "₹500 minimum to ₹1,50,000 maximum per year",
      "15-year maturity, extendable in 5-year blocks",
    ],
    limitations: [
      "The rate is notified quarterly by the Ministry of Finance and assumed constant here",
      "Actual passbooks round yearly interest to the nearest rupee",
    ],
    reviewedBy: REVIEWER,
  },
  "cagr-calculator": {
    formula: "CAGR = (Ending Value ÷ Beginning Value)^(1 ÷ Years) − 1",
    method:
      "The geometric mean annual growth rate between two points in time — the steady annual rate that would take the beginning value to the ending value.",
    sources: [CFA, NSE, SEBI],
    assumptions: [
      "A single lump investment measured between two endpoints",
      "Smooth, steady compounding",
    ],
    limitations: [
      "Ignores volatility and any interim cash flows",
      "For periodic investments (SIP), XIRR is more accurate",
    ],
    reviewedBy: REVIEWER,
  },
  "income-tax-calculator": {
    formula:
      "Tax = slab tax − §87A rebate + surcharge + 4% cess   ·   Taxable = Gross income − deductions",
    method:
      "Computes tax under both the Old and New regimes for FY 2025-26 (AY 2026-27). Slab tax is applied to taxable income, the Section 87A rebate and marginal relief are applied, then surcharge (with marginal relief) and a 4% Health & Education Cess. Both regimes are compared to recommend the cheaper one.",
    sources: [ITD, CBDT, FINANCE_ACT, MOF],
    assumptions: [
      "Resident individual below 60; FY 2025-26 (AY 2026-27), Finance Act 2025",
      "New Regime: only the ₹75,000 standard deduction (no 80C/80D/HRA/24b)",
      "Old Regime: standard deduction ₹50,000 plus the deductions you enter (capped per section)",
      "§87A rebate makes tax nil up to ₹12,00,000 (New) / ₹5,00,000 (Old) taxable income",
    ],
    limitations: [
      "Does not cover senior/super-senior slabs, capital-gains special rates, or firms/companies",
      "Surcharge marginal relief is applied; verify complex high-income or multiple-source cases with a tax professional",
      "Update when the next Finance Act changes slabs, rebate, or deductions",
    ],
    reviewedBy: REVIEWER,
  },
  "hra-calculator": {
    formula:
      "HRA Exemption = least of { Actual HRA · Rent − 10% × Basic · 50%/40% × Basic }   ·   Taxable HRA = HRA received − Exemption",
    method:
      "Applies Rule 2A of the Income-tax Rules, 1962 (read with Section 10(13A)). The exemption is the least of three amounts: the actual HRA received, rent paid in excess of 10% of salary, and 50% of salary for metro cities (Delhi, Mumbai, Kolkata, Chennai) or 40% for non-metro. The balance of the HRA is taxable. 'Salary' means Basic + DA (forming part of retirement benefits) + fixed-percentage commission.",
    sources: [ITD, IT_ACT, IT_RULES, CBDT],
    assumptions: [
      "Salary for Rule 2A = Basic Salary (+ DA forming part of retirement benefits)",
      "All amounts are annual and constant through the year",
      "Metro = Delhi, Mumbai, Kolkata, Chennai (50%); everywhere else is 40%",
      "HRA exemption is available under the Old Tax Regime only",
    ],
    limitations: [
      "Mid-year changes in salary, rent, or city require a month-wise computation",
      "Rent above ₹1,00,000 per year requires the landlord's PAN to claim the exemption",
      "Does not itself compute your final income tax — use the Income Tax Calculator for that",
    ],
    reviewedBy: REVIEWER,
  },
  "epf-calculator": {
    formula:
      "Employee 12% + Employer (12% − EPS) → EPF corpus · EPS = 8.33% × min(wages, ₹15,000) · interest on monthly running balance, credited yearly",
    method:
      "Projects the EPF corpus to retirement. The employee contributes 12% of wages (Basic + DA) and the employer 12%, of which 8.33% (capped at the ₹15,000 wage ceiling) goes to the EPS pension pool and the rest to EPF. Interest is calculated on the monthly running balance at the EPFO rate ÷ 12 and credited at the end of each financial year (no intra-year compounding). Wages grow by an assumed annual increment.",
    sources: [EPFO, EPF_ACT, MOL, ITD],
    assumptions: [
      "Wages = Basic Salary + Dearness Allowance (not full CTC)",
      "Employee and employer each contribute 12%; EPS is 8.33% capped at ₹15,000",
      "Interest credited annually on the monthly running balance (EPFO method)",
      "Interest rate and salary increment stay constant over the projection",
    ],
    limitations: [
      "EPS eligibility rules for members joining after 1 Sep 2014 above ₹15,000 wages are not modelled",
      "The EPFO interest rate is notified yearly and may change; EPS is a pension, not part of the lump sum",
      "Interest on employee contributions above ₹2.5 lakh/year can be taxable — verify with a professional",
    ],
    reviewedBy: REVIEWER,
  },
  "gratuity-calculator": {
    formula:
      "Covered: Gratuity = 15 × salary × years ÷ 26  ·  Not covered: ÷ 30  ·  salary = last drawn Basic + DA  ·  capped at ₹20,00,000",
    method:
      "Applies the Payment of Gratuity Act, 1972. For employees covered by the Act, gratuity is 15 days' wages for each completed year of service based on the last drawn Basic + DA, using a 26-working-day month; trailing months over 6 round up to a full year. For those not covered, the divisor is 30 and only completed years count. A minimum of 5 years of continuous service is required, and the amount is capped at ₹20 lakh.",
    sources: [GRATUITY_ACT, MOL, IT_SEC_10_10, ITD],
    assumptions: [
      "Salary = last drawn monthly Basic + Dearness Allowance",
      "Covered under the Act: ÷26 and months over 6 round up; not covered: ÷30, whole years only",
      "Minimum 5 years of continuous service (waived only on death/disablement, not modelled)",
      "Maximum gratuity and lifetime tax exemption are both ₹20,00,000",
    ],
    limitations: [
      "The 4-years-240-days interpretation for the 5th year is not applied; whole-year eligibility is used",
      "Death/disablement cases (where the 5-year rule is waived) are not modelled",
      "Taxability is informational; the exact exempt portion depends on prior exemptions used — verify with a professional",
    ],
    reviewedBy: REVIEWER,
  },
  "nps-calculator": {
    formula:
      "Corpus = P × [((1+i)^m − 1) ÷ i] × (1+i)  ·  Pension = annuity corpus × annuity rate ÷ 12  ·  Lump sum ≤ 60%, annuity ≥ 40%",
    method:
      "Projects the NPS corpus as the future value of monthly contributions (annuity due, compounded monthly at the expected return) from the current age to retirement. At retirement, up to 60% may be taken as a tax-free lump sum and at least 40% buys an annuity; the monthly pension is the annuity corpus times the annuity rate divided by 12.",
    sources: [PFRDA, NPS_TRUST, ITD, MOF],
    assumptions: [
      "Contributions are made at the start of each month and grow at a constant expected return",
      "The expected return and annuity rate stay constant over the projection",
      "Up to 60% of the corpus is withdrawn as a tax-free lump sum; the rest is annuitised",
      "Monthly pension uses a simple annuity rate; actual annuity plans vary by provider",
    ],
    limitations: [
      "NPS returns are market-linked and not guaranteed; the figure is an estimate",
      "Actual annuity rates and options are set by the annuity provider at retirement",
      "Annuity/pension income is taxable as per slab; tax rules may change via the Finance Act",
    ],
    reviewedBy: REVIEWER,
  },
  "financial-dashboard": {
    formula:
      "Every figure derives from the saved roadmap profile through the roadmap engine · Tracked net worth = emergency fund + retirement corpus − high-interest debt · Review due when 90 days have passed since the last review (or none was ever done)",
    method:
      "The dashboard reads the financial profile the Financial Roadmap saves in your browser's localStorage and passes it through the exact same engine that builds the roadmap — one engine, so the dashboard can never disagree with the roadmap. Health score, pillar states, milestone progress and every insight are that engine's outputs re-worded; nothing is computed twice and nothing is estimated. Recent tools are recorded locally when you open a tool (newest first, deduped, capped at eight). All data lives on this device only: there is no account, no server copy and no tracking of any kind.",
    sources: [
      { label: "RBI — household finance guidance", url: "https://www.rbi.org.in" },
      { label: "IRDAI — insurance basics", url: "https://www.irdai.gov.in" },
      { label: "Income Tax Department (regime comparison)", url: "https://www.incometax.gov.in" },
    ],
    assumptions: [
      "Tracked net worth deliberately excludes assets the roadmap does not collect (property, gold, vehicles, other investments) — it understates rather than guesses",
      "The 90-day review interval is a planning cadence, not a regulation; marking a review done only resets the timer",
      "The profile shown is the one last saved by the Financial Roadmap on this device; editing the roadmap updates the dashboard",
    ],
    limitations: [
      "Data exists in one browser on one device — clearing browser data erases it, and by design there is no cloud backup or recovery",
      "Insights are deterministic statements of the roadmap engine's arithmetic on your own numbers — never product recommendations or advice",
      "If you never build a Financial Roadmap, the dashboard has nothing to show and says so",
    ],
    reviewedBy: REVIEWER,
  },
  "financial-roadmap": {
    formula:
      "Health Score = Σ(pillar score × weight) — Emergency 25 · Protection 25 · Debt 20 · Savings 15 · Retirement 15 · Actions follow the fixed sequence: emergency fund → health cover → term life → high-interest debt → tax → investing → retirement → wealth",
    method:
      "Each pillar is scored 0–1 from your inputs and weighted to a 0–100 score. Emergency: months of expenses saved vs a 6-month target. Protection: health cover vs a ₹5-lakh floor, and (only when someone depends on your income) term cover vs ≈10× annual income. Debt: EMIs vs a 40%-of-income ceiling, and any high-interest balance zeroes half the pillar. Savings: monthly investing vs a 20%-of-income benchmark. Retirement: corpus vs an age-band ladder (≈1× annual income by 30, 3× by 40, 6× by 50, 8× by 60). Each roadmap step is marked done, pending, or not-applicable from the same inputs; the first pending step is where you start, and every gap amount is arithmetic on your own numbers.",
    sources: [
      { label: "RBI — household finance guidance", url: "https://www.rbi.org.in" },
      { label: "IRDAI — insurance basics", url: "https://www.irdai.gov.in" },
      { label: "Income Tax Department (regime comparison)", url: "https://www.incometax.gov.in" },
    ],
    assumptions: [
      "Emergency-fund target: 6 months of stated monthly expenses (3 months treated as the working minimum)",
      "Term-cover heuristic: ≈10× annual income, applicable only when a partner or dependants rely on the income",
      "Health-cover floor: ₹5 lakh per household",
      "Healthy savings-rate benchmark: 20% of take-home income",
      "EMI ceiling: 40% of take-home income",
      "Retirement ladder (corpus vs annual income): 1× by 30 · 3× by 40 · 6× by 50 · 8× by 60 — a widely used planning heuristic, not a regulation",
      "Timelines estimate the effort of completing each step, never market outcomes",
    ],
    limitations: [
      "A planning aid, not financial advice — it cannot see income stability, health history, family obligations or local costs",
      "Heuristics are population-level rules of thumb; a fee-only SEBI-registered adviser can calibrate them to you",
      "No return projections are made anywhere; growth outcomes belong to the individual calculators where you set the assumptions",
      "Recommends categories of action only — never products, funds, insurers or platforms",
    ],
    reviewedBy: REVIEWER,
  },
  "age-calculator": {
    formula:
      "Age = whole months between the dates (month-end clamped) → years & months, then residual days · Totals derive from the exact calendar day count (leap-aware)",
    method:
      "Computes the exact calendar age from a date of birth to a chosen date (today by default). It finds the largest whole number of months between the two dates — clamping month ends, so 31 Jan + 1 month = 28/29 Feb — then the residual days to the target date. Total months, weeks, days, hours, minutes and seconds derive from the exact number of calendar days (UTC midnight difference), so leap days are counted precisely with no daylight-saving drift. The next birthday, the weekday of birth, and the optional two-date age difference use the same calendar arithmetic.",
    sources: [
      {
        label: "ISO 8601 — date and time format",
        url: "https://www.iso.org/iso-8601-date-and-time-format.html",
      },
      { label: "Gregorian calendar (leap-year rule)" },
    ],
    assumptions: [
      "Dates follow the proleptic Gregorian calendar (ISO 8601)",
      "Age is measured to whole-day precision; time of day is not considered",
      "A 29 February birthday is observed on 1 March in common (non-leap) years",
      "‘Age as of’ defaults to today in your local time zone",
    ],
    limitations: [
      "Does not model time-of-birth or time-zone-specific precision",
      "Total hours/minutes/seconds are derived from whole days, not the live clock",
      "Historical dates before the Gregorian reform are treated proleptically",
    ],
    reviewedBy: "EasyTechLabs Team",
  },
  "gst-calculator": {
    formula:
      "GST = Base × Rate ÷ 100 (add GST)   ·   Base = Total × 100 ÷ (100 + Rate) (remove GST)",
    method:
      "For intra-state supply, GST splits equally into CGST and SGST; for inter-state supply, a single IGST applies at the full rate.",
    sources: [
      CBIC,
      { label: "CGST Act, 2017 & CGST Rules (Rule 35)" },
      { label: "IGST Act, 2017" },
    ],
    assumptions: [
      "A single GST rate is applied to the amount",
      "Values rounded to two decimal places (paise) per invoice practice",
    ],
    limitations: [
      "Excludes cess, input tax credit, and the composition scheme",
      "Rate slabs are as notified by the GST Council",
    ],
    reviewedBy: REVIEWER,
  },
};

export function getMethodology(slug: string): Methodology | undefined {
  return methodology[slug];
}
