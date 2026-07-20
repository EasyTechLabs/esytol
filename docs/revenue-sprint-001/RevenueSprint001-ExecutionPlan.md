# Revenue Sprint 001 — Execution Plan

> **Objective:** grow Esytol (not expand AIOS). A complete, evidence-grounded execution plan assembled **entirely from what already exists** in the Esytol repos, ProductFactory, deployment config, and AIOS artifacts — **no Founder input was requested**.
> **Prepared:** 2026-07-20 · **Site:** https://esytol.com · **Method:** automated 7-phase discovery → inventory → audit → gap → competitor → opportunity → backlog.
> **Machine-readable artifacts (this folder):** [ToolInventory.json](ToolInventory.json) · [SEOAudit.json](SEOAudit.json) · [ContentGap.json](ContentGap.json) · [CompetitorGap.json](CompetitorGap.json) · [RevenueOpportunities.json](RevenueOpportunities.json) · [GrowthBacklog.json](GrowthBacklog.json)

---

## The one-paragraph summary

Esytol is **37 tools (36 live)** — 18 finance calculators, 16 developer/encoder/security utilities, plus text/everyday tools — on a well-built Next.js 15 platform with **strong, uniform on-page SEO**, a live **public Income-Tax API**, and **31 supporting articles**. It also has **₹0 validated revenue** (STRATEGY-005). The single biggest constraint is **not** the product — it is that **we cannot see**: GA4 + Clarity are live in production but **read access is Gate-0 pending**, so every "measured" number is genuinely unknown. Therefore the plan's #1 action is to **open the analytics eyes**, then run the **already-decided Income-Tax-API-on-RapidAPI** revenue play as the near-term direct-revenue spearhead, harvest the large **content + video + competitor-coverage gaps** for organic growth, and put the Founder-note bets (sell AI-agent packages, automated YouTube, rent AI employees) through the capital-allocation gate as parallel, higher-variance options.

---

## Phase 1 — Discovery (what exists)

| Area           | Finding                                                                                                                     | Evidence                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Apps / repos   | 1 product (`esytol`, Next.js 15 / React 19) + AIOS platform + ProductFactory + GrowthFactory                                | repo roots                        |
| Tools          | **37** in `registry/index.ts` (36 live, `lorem-ipsum` coming-soon)                                                          | `registry/index.ts`               |
| Routes         | 26 concrete tool pages + `[slug]` dynamic; learn/blog/categories; admin (Basic-auth, noindex); `/developers/income-tax-api` | `app/**`                          |
| APIs           | Public Income-Tax API v1: `POST /calculate` + `GET health/ready/version/openapi.json`; auth = **public seam, no keys yet**  | `app/api/v1/*`, `lib/api/auth.ts` |
| Config         | Next 15.5, full CSP + security headers, admin middleware fail-closed                                                        | `next.config.ts`, `middleware.ts` |
| Deployment     | Vercel `esytol.com`; **P0-1 incident**: deploy silently stopped ~10 days — green build ≠ deployed                           | `DEPLOYMENT.md`                   |
| Analytics      | GA4 (`G-XD3FF23LGR`) + Clarity live in prod, **read access Gate-0 pending → blind**                                         | `OBSERVATION.md`, `analytics/`    |
| Monetization   | **None live** — AdSense stub disabled, affiliate fields empty (guard-tested), API unpriced                                  | `ads/`, `content/comparisons.ts`  |
| ProductFactory | ~100 sprints; **REVENUE-SPRINT-001 already "Decided"** (API-on-RapidAPI)                                                    | `.../Sprints/REVENUE-SPRINT-001/` |
| Mission Packs  | one: `grow-esytol` (AIOS-046) — the execution engine; `ToolProfile` is its input schema                                     | `packages/missions/grow-esytol`   |
| Tool Profiles  | **none real** — only placeholder test fixtures (no generated profiles/competitor URLs)                                      | `*/tests/fixtures.ts`             |

**Discrepancies found (not escalated to the Founder — reported here):**

1. **`lorem-ipsum`** is in the registry as `coming-soon` with **no route page** (the only such gap). Intentional; noindexed + sitemap-excluded.
2. **Live deploy is unverifiable from source** — `DEPLOYMENT.md` documents the P0-1 silent-deploy failure; "published" in the inventory means _present in build + sitemap_, not _confirmed live_.
3. **Strategy gap:** the recorded revenue decision is **API-first**, but the Founder note adds **sell AI-agent packages / rent AI employees / automated YouTube** — these are **not reconciled** with the recorded decision and have not passed STRATEGY-005/006. (Full reconciliation in `RevenueOpportunities.json`.)
4. **A capital-gains article exists but there is no capital-gains tool** (content→tool mismatch).

---

## Phases 2–5 — the state, in brief

- **Inventory (Phase 2 → `ToolInventory.json`):** 37 tools with category/domain/keywords/icon/related + status fields. Universal: FAQ (all 37) + dynamic OG image (all 37). Screenshots: **none** exist. Campaigns: **none** (only test fixtures).
- **SEO (Phase 3 → `SEOAudit.json`):** on-page is **strong and uniform** (title, meta, absolute canonical, `SoftwareApplication`+`BreadcrumbList`+`FAQPage` JSON-LD, OG, Twitter, single H1, related-tool internal links, correct indexability). Seven real defects — top one: **FAQ answers are not in server HTML** (only in JSON-LD), thinning every page. Live index status / CWV / duplicate-content outcome are **unknown** (Gate-0 blind).
- **Content gap (Phase 4 → `ContentGap.json`):** 31 articles cover finance/retirement/everyday only — **10 tools have a dedicated article, 5 secondary-only, 22 have none** (all 16 developer tools + gst + others). **Videos, Shorts, Tutorials, standalone Comparison pages, and static screenshots do not exist anywhere.**
- **Competitors (Phase 5 → `CompetitorGap.json`):** named only where the repo cites them — **Groww, ClearTax, ET Money, BankBazaar, Paisabazaar, Scripbox** (finance) and **Sandbox by Quicko** (Income-Tax API). Esytol's edge is privacy-first, no-login, transparent methodology; the gaps are domain authority, brand-variant pages, video content, and monetization. **All competitor measured metrics are `null` — not fetched, never invented** (verifying them is a backlog task).

---

## Phase 6 — Revenue opportunities (ranked)

Priority = `impact² × confidence ÷ difficulty` (deterministic; see `RevenueOpportunities.json`). All estimates, **not measured**.

| Priority | Opportunity                                                 | Lever                   | Status                                    |
| -------- | ----------------------------------------------------------- | ----------------------- | ----------------------------------------- |
| ★★★      | **Income-Tax API on RapidAPI** (free + paid tiers)          | direct API subscription | **Decided** — infra ready                 |
| ★★       | Additional calculation APIs (EMI/SIP/GST)                   | direct API              | candidate                                 |
| ★★       | Comparison-surface **affiliate/sponsored** partnerships     | affiliate               | infra-ready, blocked by guard test        |
| ★★       | **AdSense** on high-traffic pages                           | ads                     | stub-ready, gate on traffic               |
| ★★       | **Premium** features (PDF reports, saved profiles, ad-free) | premium/SaaS            | candidate                                 |
| ★★       | **Downloadable AI-agent packages** (Founder note)           | new product             | ungated — biggest upside, least validated |
| ★        | **Rent an AI employee** (Founder note)                      | new product             | open question                             |
| ★★       | **Automated YouTube Shorts** channel (Founder note)         | distribution            | missing top-of-funnel                     |
| ▫        | White-label / enterprise embeds                             | enterprise              | previously rejected — parked              |

---

## Phase 7 — Growth Backlog (top 100, ranked by expected business impact)

Full list in **[GrowthBacklog.json](GrowthBacklog.json)** (117 generated, top 100 returned). The top 25:

| #   | Score | Theme             | Task                                                                           |
| --- | ----- | ----------------- | ------------------------------------------------------------------------------ |
| 1   | 25    | Enabler/Analytics | Grant GA4 + Search Console + Clarity **READ access** (close Gate 0)            |
| 2   | 12.8  | Enabler/SEO       | Add site-verification + submit sitemap; confirm indexation of all 58 URLs      |
| 3   | 11.3  | Enabler/Deploy    | Automated **live-deploy verification** (defeat the P0-1 silent-deploy failure) |
| 4   | 6.4   | Enabler/Analytics | Instrument per-tool usage events (`tool_used`) for attribution                 |
| 5   | 6.4   | SEO/Technical     | **Render FAQ answers in server HTML** (fix SEO-D1)                             |
| 6   | 6.3   | Revenue/API       | Add **API key auth + metering** on the public seam                             |
| 7   | 5.8   | Revenue/API       | **Publish the Income-Tax API on RapidAPI** (free + paid)                       |
| 8   | 5.6   | Revenue/API       | Finalise API pricing tiers                                                     |
| 9   | 5.2   | Content           | Dedicated article: **gst-calculator**                                          |
| 10  | 5.2   | Content           | Dedicated article: **json-formatter**                                          |
| 11  | 5.2   | Content           | Dedicated article: **password-generator**                                      |
| 12  | 5.2   | Content           | Dedicated article: **personal-loan-calculator** (upgrade)                      |
| 13  | 5.2   | Content           | Dedicated article: **ppf-calculator** (upgrade)                                |
| 14  | 5.2   | Content           | GST guide article                                                              |
| 15  | 5.0   | Conversion        | **"Use this as an API" CTA** on the income-tax tool page                       |
| 16  | 4.8   | Distribution      | Developer-community distribution for the API (filing season)                   |
| 17  | 4.1   | Revenue/Ads       | Enable AdSense once Gate-0 traffic validates                                   |
| 18  | 4.0   | New product       | Gate the **AI-agent packages** bet through STRATEGY-005/006                    |
| 19  | 3.2   | New tool          | Build **Capital Gains Tax calculator** (article exists, no tool)               |
| 20  | 3.2   | SEO/Content       | De-duplicate boilerplate FAQ answers (SEO-D2)                                  |
| 21  | 2.9   | Revenue/API       | Productise EMI/SIP/GST as APIs                                                 |
| 22  | 2.9   | Content           | Dedicated article: base64-encoder                                              |
| 23  | 2.9   | Content           | Dedicated article: cagr-calculator (upgrade)                                   |
| 24  | 2.9   | Content           | Dedicated article: csv-json-converter                                          |
| 25  | 2.9   | Content           | Dedicated article: hash-generator                                              |

---

## Recommended 30-day sequence

1. **Week 0 (unblock sight):** #1 analytics read access, #2 GSC verification, #3 deploy verification, #4 usage events. _Without these, every later decision is blind and the AIOS `grow-esytol` mission cannot measure anything._
2. **Week 1–2 (direct revenue):** #6–#8 + #15 — ship API keys/metering, list on RapidAPI, price it, funnel calculator users to it. This is the recorded first-paying-customer path and the fastest ethical route to ₹1.
3. **Week 2–3 (cheap SEO leverage):** #5 FAQ-SSR, #9/#14 GST article, #20 de-dupe — sitewide wins that compound.
4. **Week 3–4 (content engine via `grow-esytol`):** run the Mission Pack over the highest-intent tools missing content (gst, json-formatter, password-generator, ppf, personal-loan), Founder-approving each publish.
5. **Parallel bets (gated):** put AI-agent packages + automated YouTube through STRATEGY-006 capital allocation; start the SEO-agent training the Founder note asks for.

---

## Rules honored

- **No Founder questions.** Everything above was discovered from the repos/config/records.
- **Search first; infer only deterministically.** Rankings use an explicit, reproducible formula.
- **Unknown stays unknown.** All live traffic/SEO/competitor/revenue metrics are `null` — Gate-0 blind, never invented.
- **Every recommendation carries evidence** (file/path/record) in the JSON artifacts.

**Success:** the Founder receives a complete Revenue Sprint 001 execution plan without manually gathering any information.
