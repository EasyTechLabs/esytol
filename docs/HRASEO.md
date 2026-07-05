# SEO Report — HRA Calculator

Strategy for `/tools/hra-calculator` and its supporting article cluster. HRA is a
high-volume, high-intent salaried-taxpayer query and a natural spoke off the
Income Tax hub, extending Esytol's tax topical authority into the salary/benefits
ecosystem.

## 1. Target keywords

**Primary**

- hra calculator
- hra exemption calculator
- hra exemption calculation
- house rent allowance calculator

**Secondary (high intent)**

- hra calculator india
- hra tax exemption calculator
- how to calculate hra exemption
- section 10(13a) calculator / rule 2a hra
- hra exemption for metro cities
- hra calculator for salaried

**Long-tail (rank fast, convert well)**

- how much hra is tax free
- hra exemption for 40000 / 50000 rent
- can i claim hra and home loan both
- is hra allowed in new tax regime
- hra for bangalore / pune (non-metro) vs delhi (metro)

## 2. Keyword clusters

| Cluster                    | Representative queries                          | Esytol asset                                |
| -------------------------- | ----------------------------------------------- | ------------------------------------------- |
| **Tool / transactional**   | hra calculator, hra exemption calculator        | The calculator (above the fold)             |
| **How-to / informational** | how is hra calculated, rule 2a, section 10(13a) | Article 2 (How HRA Exemption is Calculated) |
| **Concept / definition**   | what is hra, hra meaning in salary              | Article 1 (What is HRA?)                    |
| **Comparison / decision**  | hra vs home loan, rent vs buy tax               | Article 3 (HRA vs Home Loan)                |
| **Regime**                 | hra new regime, hra old regime                  | Cross-links to Income Tax Calculator + FAQ  |
| **City**                   | metro cities for hra, 40% vs 50%                | Calculator toggle + FAQ + Article 2         |

## 3. Search intent

Most searchers want the **exemption number now**, so the calculator must load fast
and show all three rules with the winner highlighted (reduces bounce, increases
dwell). A large secondary segment is confused about eligibility ("can I claim in
the new regime", "can I claim with a home loan") — these are answered directly in
the FAQ and the three articles, targeting featured snippets and People-Also-Ask.

## 4. Competitors (and our edge)

| Competitor                | Strength                    | Our edge                                                                     |
| ------------------------- | --------------------------- | ---------------------------------------------------------------------------- |
| ClearTax, Groww, ET Money | Domain authority, backlinks | Cleaner UX, no signup/ads, private (in-browser), shows all 3 rules + why     |
| BankBazaar, Paisabazaar   | Broad coverage              | Metro/non-metro toggle, monthly + annual, CSV/share, transparent methodology |
| Income Tax Dept utility   | Authority                   | Far better UX, instant recompute, shareable URL, E-E-A-T sources shown       |
| Scripbox, Tax2win         | Content depth               | Tool + 3 production articles tightly interlinked into the tax hub            |

Differentiators to emphasise in copy/schema: **all three rules shown side by
side**, **explains why the least wins**, **metro toggle**, **New-Regime caveat
surfaced**, **official sources visible (Rule 2A / Section 10(13A))**.

## 5. Internal linking plan

- **Hub ↔ spoke:** Income Tax Calculator ↔ HRA Calculator are cross-listed in
  `relatedTools` (HRA lists income-tax first; income-tax already surfaces on the
  homepage). This wires HRA directly into the strongest tax page.
- **Salary ecosystem:** HRA `relatedTools` → income-tax, home-loan, ppf, sip, emi,
  fd — matching the "salary → EPF → NPS → retirement" journey in the brief.
- **Articles → tools:** all three articles link to the HRA Calculator (primary
  CTA), the Income Tax Calculator (regime comparison), the Home Loan Calculator
  (Article 3), and PPF/SIP (where to invest the tax saved).
- **Article ↔ article:** the three articles cross-link (definition → calculation →
  comparison), forming a tight cluster that concentrates topical authority.
- **Auto-surfacing:** `featured` + `popular` + `isNew` place the tool on the
  homepage, /popular, and /new; it is auto-added to the sitemap.

## 6. SERP opportunities

- **Featured snippet** for "how is hra exemption calculated" — the three-rule list
  in Article 2 and the FAQ answer are written as a self-contained ordered list.
- **People Also Ask** for "can I claim hra and home loan", "is hra in new regime",
  "which cities are metro for hra" — each has a direct FAQ/article answer.
- **Rich result (FAQ)** via FAQPage JSON-LD on the tool page (6 Q&A).
- **Sitelinks** potential as the tax cluster grows (calculator + 3 articles).
- **Image/OG** — dynamic branded OG image at `/og/hra-calculator` for social CTR.

## 7. CTR opportunities

- **Title/description**: lead with "HRA Exemption Calculator" + the benefit hook
  ("see how much of your HRA is tax-free"). Front-load "exemption" — the highest-
  intent modifier.
- **FAQ rich snippet** expands SERP real estate and raises CTR.
- **Numbers in meta** ("all three rules", "metro & non-metro") signal completeness.
- **Freshness**: keep `lastUpdated` current; HRA queries spike at ITR-filing season
  (Jun–Jul) and investment-declaration season (Dec–Feb) — refresh before both.
- **Snippet-friendly answers**: the "New Regime does not allow HRA" caveat is a
  common surprise → strong candidate for a high-CTR PAA answer.

## 8. Meta strategy

- **Title:** "HRA Calculator" → renders `HRA Calculator — Esytol`.
- **Description:** registry description front-loads Section 10(13A)/Rule 2A, the
  three rules, and metro/non-metro.
- **Canonical:** `https://www.esytol.com/tools/hra-calculator`.
- **JSON-LD:** SoftwareApplication (INR, free) + FAQPage + BreadcrumbList (auto).
- **OG/Twitter:** dynamic image at `/og/hra-calculator`.
