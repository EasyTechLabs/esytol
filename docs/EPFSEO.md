# SEO Report — EPF Calculator

Strategy for `/tools/epf-calculator` and its supporting article cluster. EPF is a
very high-volume salaried-finance query and the anchor for Esytol's expansion from
the tax cluster into the **retirement** cluster (EPF → PPF → NPS → retirement).

## 1. Target keywords

**Primary**

- epf calculator
- pf calculator
- provident fund calculator
- epf interest calculator
- employee provident fund calculator

**Secondary (high intent)**

- epf calculator india
- epf maturity calculator
- pf balance calculator
- eps pension calculator
- epf contribution calculator
- epf calculator with interest

**Long-tail (rank fast, convert well)**

- how is epf interest calculated
- epf calculation on 15000 / 25000 basic
- how much pf will i get at retirement
- epf vs ppf vs nps
- employer contribution to pf breakup

## 2. Keyword clusters

| Cluster                   | Representative queries                                  | Esytol asset                               |
| ------------------------- | ------------------------------------------------------- | ------------------------------------------ |
| **Tool / transactional**  | epf calculator, pf calculator                           | The calculator (above the fold)            |
| **Interest / how-to**     | how is epf interest calculated, epf interest calculator | Article 2 (How EPF Interest is Calculated) |
| **Concept / definition**  | what is epf, epf meaning, eps vs epf                    | Article 1 (What is EPF?)                   |
| **Comparison / decision** | epf vs ppf vs nps, best retirement scheme               | Article 3 (EPF vs PPF vs NPS)              |
| **Contribution split**    | employer contribution breakup, eps ₹1250                | Calculator monthly-split chart + FAQ       |
| **Tax**                   | is epf tax free, epf 80c, epf 2.5 lakh rule             | FAQ + cross-links to Income Tax Calculator |

## 3. Search intent

The dominant intent is **transactional/tool** ("epf calculator", "pf calculator") —
users want their projected corpus now. A strong secondary intent is
**informational** around the confusing parts: the EPS split, the ₹15,000 ceiling,
how interest is credited, and tax treatment. The tool answers the first; the three
articles and FAQ own the second, targeting featured snippets and PAA.

## 4. Competitors (and our edge)

| Competitor                | Strength             | Our edge                                                               |
| ------------------------- | -------------------- | ---------------------------------------------------------------------- |
| Groww, ClearTax, ET Money | Authority, backlinks | Cleaner UX, no signup/ads, private (in-browser), transparent EPS split |
| BankBazaar, Paisabazaar   | Coverage             | Year-wise projection + growth chart + CSV, editable rate/increment     |
| EPFO passbook/portal      | Authority            | Forward projection (portal only shows history), shareable URL          |
| Scripbox, Cleartax blogs  | Content depth        | Tool + 3 interlinked production articles feeding the retirement hub    |

Differentiators to emphasise: **EPS split shown explicitly (8.33% capped at
₹15,000)**, **EPFO monthly running-balance interest method**, **year-wise
projection with a growth chart**, **editable rate & increment**, **visible official
sources (EPFO, EPF Act, Ministry of Labour)**.

## 5. Internal linking plan

- **Cluster wiring:** EPF `relatedTools` → income-tax, hra, ppf, sip, fd, home-loan;
  HRA and Income Tax already cross-link, so EPF joins an established salary/tax hub
  and extends it toward retirement (PPF/SIP).
- **Articles → tools:** all three articles link the EPF Calculator (primary CTA),
  plus PPF, SIP, Income Tax, and HRA where relevant.
- **Article ↔ article:** definition → interest → comparison interlink tightly.
- **Bridge to retirement cluster:** Article 3 (EPF vs PPF vs NPS) links PPF and SIP,
  seeding future NPS/gratuity/retirement calculators with an interlinked anchor.
- **Auto-surfacing:** `featured` + `popular` + `isNew` → homepage, /popular, /new,
  sitemap.

## 6. SERP opportunities

- **Featured snippet** for "how is epf interest calculated" — the ordered
  running-balance steps in Article 2 and the FAQ are snippet-shaped.
- **People Also Ask** for "difference between epf and eps", "is epf tax free",
  "employer contribution breakup", "epf vs ppf" — each has a direct FAQ/article answer.
- **FAQ rich result** via FAQPage JSON-LD on the tool page (6 Q&A).
- **Table snippet** potential from the contribution-split and comparison tables.
- **OG image** — dynamic branded image at `/og/epf-calculator` for social CTR.

## 7. CTR opportunities

- **Title/description**: lead with "EPF Calculator" + the outcome hook ("project
  your PF corpus at retirement"); front-load "provident fund" and "interest".
- **FAQ rich snippet** expands SERP footprint and lifts CTR.
- **Specific numbers** in meta ("12% + 12%", "EPS split", "year-wise") signal depth.
- **Seasonality**: interest in EPF spikes when the annual EPFO rate is announced and
  around appraisal/ITR season — refresh `lastUpdated` and the rate then.
- **Snippet-friendly caveats**: the "EPS is capped at ₹1,250" and "wages = Basic +
  DA, not CTC" points are common surprises → high-CTR PAA answers.

## 8. Meta strategy

- **Title:** "EPF Calculator" → renders `EPF Calculator — Esytol`.
- **Description:** registry description front-loads contributions, EPS split, EPFO
  interest, and the year-wise projection.
- **Canonical:** `https://www.esytol.com/tools/epf-calculator`.
- **JSON-LD:** SoftwareApplication (INR, free) + FAQPage + BreadcrumbList (auto).
- **OG/Twitter:** dynamic image at `/og/epf-calculator`.
