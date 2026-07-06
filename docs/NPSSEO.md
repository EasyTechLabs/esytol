# SEO Report — NPS Calculator

Strategy for `/tools/nps-calculator` and its supporting article cluster. NPS is a
high-volume retirement query and the **capstone** of Esytol's salary → retirement
cluster (Income Tax → HRA → EPF → Gratuity → PPF/SIP → NPS).

## 1. Target keywords

**Primary**

- nps calculator
- nps maturity calculator
- national pension system calculator
- nps corpus calculator
- nps retirement calculator

**Secondary (high intent)**

- nps pension calculator / nps monthly pension calculator
- nps return calculator
- nps tax benefit calculator / nps 80ccd calculator
- nps lump sum calculator
- nps calculator india

**Long-tail (rank fast, convert well)**

- how much pension will i get from nps
- nps calculation for 5000 per month
- nps 80ccd(1b) 50000 benefit
- nps withdrawal rules at 60
- nps vs ppf vs epf

## 2. Keyword clusters

| Cluster                  | Representative queries                        | Esytol asset                               |
| ------------------------ | --------------------------------------------- | ------------------------------------------ |
| **Tool / transactional** | nps calculator, nps maturity calculator       | The calculator (above the fold)            |
| **Concept / definition** | what is nps, national pension system          | Article 1 (What is NPS?)                   |
| **Tax**                  | nps tax benefit, 80ccd(1b), nps deduction     | Article 2 (NPS Tax Benefits)               |
| **Withdrawal / pension** | nps withdrawal rules, nps pension, 60/40 rule | Article 3 (NPS Withdrawal & Pension)       |
| **Comparison**           | nps vs ppf vs epf                             | Existing EPF-cluster article + cross-links |

## 3. Search intent

The dominant intent is **transactional/tool** — users want their projected corpus
and pension now. Strong secondary intent is **informational**: the tax benefits
(especially the exclusive ₹50,000 under 80CCD(1B)), the mandatory 40% annuity, and
withdrawal rules. The tool answers the first; the three articles and FAQ own the
second, targeting featured snippets and People-Also-Ask.

## 4. Competitors (and our edge)

| Competitor                   | Strength             | Our edge                                                                   |
| ---------------------------- | -------------------- | -------------------------------------------------------------------------- |
| Groww, ClearTax, ET Money    | Authority, backlinks | Cleaner UX, no signup/ads, private (in-browser), adjustable lump-sum split |
| NPS Trust / PFRDA calculator | Authority            | Far better UX, year-wise projection + charts, shareable URL                |
| BankBazaar, Paisabazaar      | Coverage             | Corpus + lump sum + pension + tax benefits in one view, CSV/share          |
| Scripbox, Cleartax blogs     | Content depth        | Tool + 3 interlinked production articles feeding the retirement hub        |

Differentiators to emphasise: **adjustable lump-sum/annuity split (0–60%)**,
**monthly pension estimate**, **year-wise corpus growth chart**, **explicit tax
benefits (80CCD(1)/(1B)/(2))**, **visible official sources (PFRDA, NPS Trust)**.

## 5. Internal linking plan

- **Cluster wiring:** NPS `relatedTools` → epf, ppf, gratuity, income-tax, sip, hra —
  completing the retirement cluster; all of these already interlink, so NPS slots
  into a dense, established hub.
- **Articles → tools:** all three articles link the NPS Calculator (primary CTA),
  plus EPF, PPF, SIP, Income Tax, and Gratuity where relevant.
- **Article ↔ article:** definition → tax → withdrawal interlink tightly; they also
  connect to the existing "EPF vs PPF vs NPS" comparison article.
- **Capstone role:** as the last retirement spoke, NPS consolidates the cluster's
  topical authority and closes the salary → retirement journey.
- **Auto-surfacing:** `featured` + `popular` + `isNew` → homepage, /popular, /new,
  sitemap.

## 6. SERP opportunities

- **Featured snippet** for "how is nps corpus calculated" / "how much pension from
  nps" — the formula and ordered explanation in Articles 1 & 3 and the FAQ are
  snippet-shaped.
- **People Also Ask** for "nps 80ccd(1b)", "nps withdrawal at 60", "is nps lump sum
  taxable", "nps vs ppf" — each has a direct FAQ/article answer.
- **FAQ rich result** via FAQPage JSON-LD on the tool page (6 Q&A).
- **Table snippet** potential from the 80CCD deduction table and the 60/40 split.
- **OG image** — dynamic branded image at `/og/nps-calculator` for social CTR.

## 7. CTR opportunities

- **Title/description**: lead with "NPS Calculator" + outcome hook ("corpus, lump
  sum & monthly pension"); front-load "national pension system" and "maturity".
- **FAQ rich snippet** expands SERP footprint and lifts CTR.
- **Specific numbers** in meta ("60/40 rule", "₹50,000 extra deduction", "monthly
  pension") signal completeness.
- **Seasonality**: NPS interest peaks around investment-declaration season (Dec–Feb)
  and ITR filing (Jun–Jul) — refresh `lastUpdated` before both.
- **Snippet-friendly hooks**: the "extra ₹50,000 under 80CCD(1B)" and "40% must buy
  an annuity" points are common surprises → high-CTR PAA answers.

## 8. Meta strategy

- **Title:** "NPS Calculator" → renders `NPS Calculator — Esytol`.
- **Description:** registry description front-loads corpus, tax-free lump sum,
  monthly pension, contributions, returns, and the year-wise projection.
- **Canonical:** `https://www.esytol.com/tools/nps-calculator`.
- **JSON-LD:** SoftwareApplication (INR, free) + FAQPage + BreadcrumbList (auto).
- **OG/Twitter:** dynamic image at `/og/nps-calculator`.
