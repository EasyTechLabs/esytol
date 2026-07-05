# SEO Report — Gratuity Calculator

Strategy for `/tools/gratuity-calculator` and its supporting article cluster.
Gratuity is a high-volume salaried-finance query and the next spoke in Esytol's
salary → retirement cluster (Income Tax → HRA → EPF → Gratuity).

## 1. Target keywords

**Primary**

- gratuity calculator
- gratuity calculation
- gratuity calculator india
- gratuity formula
- how gratuity is calculated

**Secondary (high intent)**

- gratuity eligibility / gratuity after 5 years
- payment of gratuity act calculator
- gratuity amount calculator
- gratuity tax exemption / section 10(10)
- gratuity for private employees
- gratuity calculator online

**Long-tail (rank fast, convert well)**

- gratuity calculation for 5 years / 10 years
- is gratuity taxable
- gratuity limit 20 lakh
- gratuity for covered vs not covered
- 4 years 240 days gratuity

## 2. Keyword clusters

| Cluster                       | Representative queries                                   | Esytol asset                           |
| ----------------------------- | -------------------------------------------------------- | -------------------------------------- |
| **Tool / transactional**      | gratuity calculator, gratuity calculator india           | The calculator (above the fold)        |
| **Formula / how-to**          | gratuity formula, how gratuity is calculated             | Article 2 (How Gratuity is Calculated) |
| **Concept / definition**      | what is gratuity, gratuity meaning                       | Article 1 (What is Gratuity?)          |
| **Eligibility / rules / tax** | gratuity eligibility, is gratuity taxable, 20 lakh limit | Article 3 (Gratuity Rules)             |
| **Coverage**                  | covered vs not covered, ÷26 vs ÷30                       | Calculator toggle + FAQ                |

## 3. Search intent

The dominant intent is **transactional/tool** — users want their gratuity number
now. A strong secondary segment is **informational**: eligibility (the 5-year
rule), taxability, the ₹20 lakh cap, and the covered-vs-not-covered difference.
The tool answers the first; the three articles and FAQ own the second, targeting
featured snippets and People-Also-Ask.

## 4. Competitors (and our edge)

| Competitor                | Strength             | Our edge                                                                    |
| ------------------------- | -------------------- | --------------------------------------------------------------------------- |
| Groww, ClearTax, ET Money | Authority, backlinks | Cleaner UX, no signup/ads, private (in-browser), covered/not-covered toggle |
| BankBazaar, Paisabazaar   | Coverage             | Step-by-step breakdown, eligibility flag, cap line on the chart, CSV/share  |
| HR/payroll blogs          | Content              | Tool + 3 interlinked production articles feeding the retirement hub         |
| Govt/Labour resources     | Authority            | Far better UX, instant recompute, shareable URL, visible official sources   |

Differentiators to emphasise: **covered vs not-covered toggle (÷26 vs ÷30)**,
**explicit 6-month rounding rule**, **eligibility (5-year) flag**, **₹20 lakh cap
visualised**, **taxability explained**, **visible official sources (Gratuity Act,
Ministry of Labour, Section 10(10))**.

## 5. Internal linking plan

- **Cluster wiring:** Gratuity `relatedTools` → epf, income-tax, hra, ppf, sip, fd;
  EPF/Income Tax/HRA already interlink, so Gratuity slots into the established
  salary/retirement hub and routes onward to PPF/SIP.
- **Articles → tools:** all three articles link the Gratuity Calculator (primary
  CTA), plus EPF, PPF, SIP, Income Tax, and HRA where relevant.
- **Article ↔ article:** definition → calculation → rules interlink tightly.
- **Bridge to retirement cluster:** each article ties gratuity to EPF/PPF/SIP,
  reinforcing the retirement theme and seeding future NPS/retirement tooling.
- **Auto-surfacing:** `featured` + `popular` + `isNew` → homepage, /popular, /new,
  sitemap.

## 6. SERP opportunities

- **Featured snippet** for "how gratuity is calculated" / "gratuity formula" — the
  formula and ordered steps in Article 2 and the FAQ are snippet-shaped.
- **People Also Ask** for "how many years for gratuity", "is gratuity taxable",
  "gratuity maximum limit", "gratuity for private employees" — each has a direct
  FAQ/article answer.
- **FAQ rich result** via FAQPage JSON-LD on the tool page (6 Q&A).
- **Table snippet** potential from the covered-vs-not-covered comparison.
- **OG image** — dynamic branded image at `/og/gratuity-calculator` for social CTR.

## 7. CTR opportunities

- **Title/description**: lead with "Gratuity Calculator" + outcome hook ("your
  gratuity amount, eligibility & tax in seconds"); front-load "gratuity formula".
- **FAQ rich snippet** expands SERP footprint and lifts CTR.
- **Specific numbers** in meta ("₹20 lakh cap", "5-year rule", "covered/not covered")
  signal completeness.
- **Seasonality**: gratuity searches rise around job changes and appraisal cycles
  (Mar–Jun) and at retirement — steady year-round with mild peaks.
- **Snippet-friendly caveats**: "needs 5 years", "salary = Basic + DA not CTC", and
  "₹20 lakh maximum" are common surprises → high-CTR PAA answers.

## 8. Meta strategy

- **Title:** "Gratuity Calculator" → renders `Gratuity Calculator — Esytol`.
- **Description:** registry description front-loads the Act, last drawn Basic + DA,
  eligibility, the ₹20 lakh cap, tax exemption, and the step-by-step.
- **Canonical:** `https://www.esytol.com/tools/gratuity-calculator`.
- **JSON-LD:** SoftwareApplication (INR, free) + FAQPage + BreadcrumbList (auto).
- **OG/Twitter:** dynamic image at `/og/gratuity-calculator`.
