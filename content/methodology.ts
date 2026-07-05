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
