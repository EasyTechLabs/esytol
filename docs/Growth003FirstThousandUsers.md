# GROWTH-003 — First 1,000 Users

> **Purpose:** A practical, trust-first plan to take Esytol from launch to its first 1,000 real users, grounded entirely in the platform's current state — no new calculators, no new frameworks, no speculative metrics.
> **Status:** Plan of record
> **Owner:** Head of Growth (EasyTechLabs)
> **Last Updated:** 2026-07-18
> **Related:** [OBSERVATION.md](../OBSERVATION.md) (measurement layer) · [Platform002IntegrationMatrix](Platform002IntegrationMatrix.md) · per-tool `*SEO.md` / `*BusinessImpact.md`

## The one-sentence strategy

Esytol is **feature-complete and under-distributed**. The product already does the
hard thing — correct, deterministic, regulator-cited finance tools that keep every
number in the user's browser. The job now is not to build more; it is to put that
trustworthiness in front of people in the exact places where trustworthiness is what
gets rewarded: Google, AI assistants, and Indian personal-finance communities.

## What is actually true today (baseline — no user data invented)

Established by a full codebase audit on 2026-07-18. Every claim is a code fact, not
an estimate.

| Area                      | State                                                                                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live tools                | 18 (17 finance · 1 everyday), all `category: "calculator"`                                                                                                              |
| Learn articles            | 31 (8 tax · 4 investment · 8 loans · 9 retirement · 3 everyday), 6 comparison-shaped                                                                                    |
| Build / sitemap           | 106 static pages · sitemap lists live tools + all articles + 10 static routes                                                                                           |
| Structured data           | `WebSite`+`Organization` site-wide; `SoftwareApplication`+`BreadcrumbList`+`FAQPage` per tool; `Article`+`BreadcrumbList`+`FAQPage` per article                         |
| FAQ coverage              | **100%** — all 18 tools and all 31 articles carry FAQs, all emitted as `FAQPage` JSON-LD                                                                                |
| Methodology               | On-page for every calculator: formula, method, assumptions, limitations, **clickable regulator sources** (RBI, SEBI, AMFI, CBIC, EPFO, PFRDA, ITD, IRDAI…), reviewed-by |
| Metadata                  | Canonical, OpenGraph, Twitter cards, **dynamic per-tool OG images** (`/og/{slug}`)                                                                                      |
| Comparison layer          | 6 decision datasets (tax filing, broker, MF platform, FD venue, credit report, home-loan source) on 10 articles; category-level, honest, **no affiliate links yet**     |
| Retention surfaces        | Dashboard, 90-day review, recent calculations, journey strip (ToolIntelligence), roadmap engine — all shipped (PROJECT-002/003, PLATFORM-002)                           |
| Growth tooling            | Marketing Agent (GROWTH-012) + SEO Intelligence Engine (GROWTH-013) already generate ranked recommendations from data                                                   |
| Analytics collection      | **Live in production** — GA4 (`G-XD3FF23LGR`) + Clarity tags fire since launch; data is accruing                                                                        |
| Analytics **read access** | **Blind — Gate 0 pending.** The 3 provider grants are not yet made, so no metric can be read yet                                                                        |
| Admin                     | Fail-closed HTTP Basic auth + `noindex` on `/admin/*`                                                                                                                   |

**The single most important fact:** collection is on, reading is off. The moment
Gate 0 opens, GA4 and Clarity history back to launch becomes readable
retroactively. So this plan can define every metric now and read them the day the
grants land — and until then, an unknown metric is written **"unknown," never
estimated** (the OBSERVATION.md rule; it governs this plan too).

---

## PART 1 — Acquisition channels, prioritized

Ranked by a simple product of **impact × (1/effort) × (1/time-to-result)**, then
sanity-checked against Esytol's trust-first constraint (channels that punish
self-promotion are ranked on _value-first_ execution, not volume).

| Rank | Channel                                                                | Effort                                  | Impact                 | Time to results       | Why this rank                                                                                                                                                 |
| ---- | ---------------------------------------------------------------------- | --------------------------------------- | ---------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **Google Search**                                                      | Medium (foundation already built)       | **High** (compounding) | Slow (3–6 mo)         | The schema/FAQ/methodology foundation is already best-in-class; the missing piece is internal-link authority flow and time. Highest long-term ceiling.        |
| 2    | **AI search visibility**                                               | **Low** (mostly already earned)         | High & rising          | Medium (weeks–months) | FAQ + methodology + regulator citations are exactly what LLMs prefer to quote. Cheapest impact-per-hour available.                                            |
| 3    | **Reddit** (r/IndiaInvestments, r/personalfinanceindia)                | High (must be value-first, founder-led) | High                   | **Fast** (days)       | Where our exact audience argues about EMIs and tax regimes. A correct, no-login, no-ads tool is _welcome_ there — but only as a genuine answer, never a drop. |
| 4    | **Quora** (Indian personal finance)                                    | Medium                                  | Medium                 | Medium                | Evergreen: answers rank in Google too. Answer the question fully, cite the calculator as the "check your own numbers" step.                                   |
| 5    | **Personal-finance communities** (Telegram/Discord/WhatsApp/FB groups) | High                                    | Medium                 | Fast                  | High-intent, but fragmented and relationship-gated. Founder-led seeding only.                                                                                 |
| 6    | **Organic sharing**                                                    | Low (ShareButtons + OG already exist)   | Low–Medium             | Ongoing               | Strong OG images already make shared links look credible; needs a light in-product nudge, not a new system.                                                   |
| 7    | **LinkedIn**                                                           | Medium                                  | Low–Medium             | Slow                  | Founder-brand + the B2B/embed angle from STRATEGY-001. A slow-burn credibility channel, not a user-acquisition workhorse.                                     |
| 8    | **Referrals**                                                          | High (would need a new feature)         | Medium                 | Slow                  | **Deprioritized by rule** — a referral system is a new feature with no measured demand. Rely on organic sharing (#6) until data justifies more.               |

**Focus for the first 1,000:** ride #1 and #2 as the compounding foundation while
running #3 and #4 as the founder-led, value-first spearhead that produces users in
_days_, not quarters. Everything else is opportunistic.

---

## PART 2 — User journey and its friction

```
Discovery → Landing → First Calculator → Dashboard → Roadmap → Return → Recommend
```

| Stage                | What exists                                                                        | Friction (verified)                                                                                                                                                         | Fix (ranked in Part 7)                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Discovery**        | 106 indexable pages, full schema, dynamic OG                                       | Homepage `<title>` is "Free Online Tools — Esytol" — generic; "India finance calculators" is only in the description                                                        | #7 sharpen homepage positioning                                                                                   |
| **Landing**          | Hero + category/featured/popular/recent sections                                   | Low friction; dynamic OG makes shared links credible                                                                                                                        | —                                                                                                                 |
| **First calculator** | 18 tools, methodology, trust bar, FAQ, related tools                               | Low friction — the core experience is strong                                                                                                                                | —                                                                                                                 |
| **→ Dashboard**      | ToolIntelligence journey strip now surfaces score + next steps on every calculator | **Highest-value friction:** calculator-only users don't know the dashboard/roadmap exist; the strip is client-rendered and subtle, and gives no _reason_ to build a roadmap | #2 (link flow) + measure the strip once Gate 0 opens                                                              |
| **→ Roadmap**        | Roadmap saves the profile locally; dashboard reads it                              | Chicken-and-egg: dashboard is empty until a roadmap is built; the payoff isn't shown before the effort                                                                      | Measure roadmap-start rate post-Gate 0; refine copy, not structure                                                |
| **Return visit**     | localStorage memory + 90-day review banner + bookmarkable                          | No email/push **by design** (no login). The 90-day review only fires for roadmap-builders; calculator-only users have no return hook beyond memory                          | Organic sharing nudge (#6); the honest return hook is _being worth returning to_, measured by return-visitor rate |
| **Recommend**        | ShareButtons + strong OG on every page                                             | No explicit "share" nudge at the moment of value (after a result)                                                                                                           | #6 light share nudge (no new system)                                                                              |

The journey is architecturally sound end-to-end. The one structural leak is
**discovery of the connected experience** (dashboard/roadmap) by users who arrive on
a single calculator — which is precisely what PLATFORM-002's journey strip was built
to address and what the internal-link fix (#2) reinforces.

---

## PART 3 — Content strategy (existing assets only)

No speculative articles. The content estate is already strong; the wins are
structural.

- **Top landing-page candidates** (by intent + existing depth, to confirm with GSC
  once Gate 0 opens): income-tax-calculator, emi-calculator, home-loan-calculator,
  sip-calculator, hra-calculator, and the comparison articles
  `epf-vs-ppf-vs-nps`, `fd-vs-rd-vs-ppf`, `home-loan-vs-personal-loan`,
  `sip-vs-lumpsum-vs-swp`. These carry the highest commercial + informational intent.
- **Internal-linking improvement (the #1 structural gap):** linking is
  **one-directional** — all 31 articles link to calculators (204 links), but
  calculators do **not** link back to articles. The tool pages carry the traffic and
  pass none of it to the content that builds topical authority and depth of session.
  Adding a curated "Learn more" block to each calculator (from a `relatedArticles`
  field or derived from the reverse of existing article→tool links) is the single
  highest-leverage content change. (Ranked #2 overall.)
- **Pages needing stronger CTAs:** calculator result areas already have the
  ToolIntelligence strip; the gap is a _contextual_ next-read link at the moment of
  result. The comparison articles (commercial intent) should surface their decision
  block prominently — **now fixed** (see Part 4 / #3): the comparison section no
  longer hides when an article lacks methodology sources.
- **Comparison-content opportunity:** the 6 decision datasets are the platform's
  commercial + AI-citation surface. They are currently embedded only inside 10
  articles with no dedicated discoverability. Opportunity (no new framework): expose
  them via the existing Learn index (a filter/section), and add `ItemList` schema so
  they are machine-readable. This is where the eventual single affiliate (REVENUE-001
  runbook) will live.

---

## PART 4 — AI search audit

**What already makes Esytol citation-friendly (strong):**

- 100% `FAQPage` coverage across tools and articles — direct question/answer pairs
  are the format assistants extract most readily.
- On-page methodology with **formula + method + clickable regulator sources** — the
  "show your working, cite the authority" pattern LLMs prefer to quote.
- `SoftwareApplication`, `Article`, `BreadcrumbList` schema; clean canonicals; no
  fabricated data anywhere (honesty-by-construction tests) — low hallucination risk
  for a model summarizing the page.
- Deterministic, explainable results (slab-wise tax breakdown, HRA three-rule
  breakdown, roadmap "why it matters") — quotable, verifiable statements.

**Gaps that reduce AI referenceability (ranked in Part 7):**

- **No AI-crawler directives** in `robots.ts` — no explicit allow for GPTBot,
  OAI-SearchBot, PerplexityBot, ClaudeBot, CCBot. Add explicit allows so assistants
  may crawl and cite (#4).
- **No `HowTo` schema** on the "how X is calculated" articles/tools — these are
  textbook HowTo candidates and a high-value citation format (#5).
- **No `ItemList` schema** on comparison content — comparisons are the most
  citation-worthy "which option should I pick" surface and are currently invisible to
  structured extraction (#6).
- **Comparison rendering bug — FIXED this sprint (#3):** comparison blocks were
  nested inside the sources `<ul>` and gated on `sources.length > 0`, so a comparison
  could be hidden entirely if the article lacked methodology-bearing tools. Now their
  own unconditional section — the decision content is always present for users and
  crawlers.

**Recommendation:** AI visibility is Esytol's most under-exploited, lowest-effort
channel. The content is already in the right shape; the work is a handful of schema
and robots additions, not new writing.

---

## PART 5 — Trust audit

Esytol's differentiation _is_ trust, so this is audited strictly.

**Strong, keep:**

- Every calculator shows methodology (formula/method/assumptions/limitations) with
  clickable official-source links.
- Per-calculator disclaimer ("estimates for educational purposes only"); roadmap
  states "a planning aid, **not financial advice**."
- Privacy is stated where it matters: homepage ("No signup, nothing leaves your
  browser"), dashboard ("this browser only — no account, no cloud, no tracking"),
  journey strip ("everything stays in your browser").
- Admin is fail-closed (Basic auth) and `noindex`.
- Analytics reports honest blanks, never fabricated numbers (P0-3).

**Verified weaknesses (ranked in Part 7 where actionable):**

- **Reviewer is an org string** ("EasyTechLabs Finance Team"), not a named,
  credentialed reviewer. E-E-A-T rewards a real author. The **honest** fix is a "How
  we build and review these tools" page describing the deterministic method, the
  regulator sources, and the review process — **not** inventing a person (#9).
- **Some sources are label-only** (CBDT, Finance Act, IT Act §10(13A), Rule 2A, EPF
  Act, Gratuity Act, §10(10)) — no URL, so they render as non-clickable pills. Adding
  official URLs strengthens both trust and AI citations (folded into #5).
- **Disclaimer wording is inconsistent:** calculators say "educational purposes
  only"; "not financial advice" appears only on the roadmap and 9 articles. Minor;
  align wording during the #9 trust pass.
- `.env.example` doc claimed providers "show deterministic sample data" — stale and
  contradicted the honest-empty behavior. **Fixed this sprint** (honesty/correctness).

**Verdict:** trust is a genuine strength and a defensible moat. The gaps are
credibility-surface polish, not integrity problems.

---

## PART 6 — Retention

The retention machinery is **already built** (PROJECT-002/003, PLATFORM-002); the
mission's rule against new frameworks applies here in full. The evaluation is
therefore "is what we have used, and how do we measure it," not "what to build."

| Surface                | State                                          | Retention role                              | Action                                                                                       |
| ---------------------- | ---------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Dashboard              | Live, local-only, empty until a roadmap exists | The "come back and see your position" hook  | Measure views + return rate post-Gate 0; refine empty-state copy only                        |
| Roadmap                | Live, deterministic 8-step plan + health score | The reason to return and the profile source | Measure start/completion; the payoff must be shown _before_ the effort (copy, not structure) |
| 90-day review          | Live banner via `reviewDue()`                  | The built-in return trigger for planners    | Measure `markReviewed` rate; it is the closest thing to a no-login re-engagement loop        |
| Recent calculations    | Live, capped 8, cross-tab                      | Continuity — "pick up where you left off"   | Measure reuse; no change                                                                     |
| Journey strip          | Live on every calculator                       | Discovery of the connected experience       | Measure click-through; refine placement/copy from data                                       |
| Return-visit incentive | localStorage memory + bookmarkability          | The honest no-login retention model         | The incentive is _being worth returning to_; measured by return-visitor rate, not gimmicks   |

**Recommendation:** ship **no new retention features**. The first-quarter retention
work is entirely measurement: instrument nothing new, read what the existing surfaces
already emit once Gate 0 opens, and refine copy where data shows drop-off.

---

## PART 7 — Top 10 highest-impact improvements

Ranked by impact against the first-1,000 goal, honest about effort and about the
observation freeze (structural, pre-identified, low-risk items ship as _plumbing_;
experiments wait for data).

| #   | Improvement                                                                      | Type                | Effort            | Status                         |
| --- | -------------------------------------------------------------------------------- | ------------------- | ----------------- | ------------------------------ |
| 1   | **Gate 0** — 3 provider grants (founder, ~10 min)                                | Unblock measurement | Trivial (founder) | ⛔ Pending — blocks everything |
| 2   | **Calculator → article internal links** (reverse the one-way flow)               | SEO plumbing        | Medium            | Planned (post-Gate 0 batch)    |
| 3   | **Comparison rendering fix** (own section, unconditional, valid DOM)             | Bug / usability     | Small             | ✅ Shipped this sprint         |
| 4   | **AI-crawler `robots.ts` directives** (GPTBot/OAI/Perplexity/Claude/CCBot allow) | AI discoverability  | Small             | Planned                        |
| 5   | **`HowTo` schema + official URLs** on "how X is calculated" surfaces             | AI + trust          | Medium            | Planned                        |
| 6   | **Comparison discoverability + `ItemList` schema** (via existing Learn index)    | AI + commercial     | Medium            | Planned                        |
| 7   | **Homepage positioning** — lead the `<title>`/H1 with India-finance intent       | SEO/conversion      | Small             | Planned                        |
| 8   | **Per-article OG images** (articles use site-default today)                      | Sharing CTR         | Small             | Planned                        |
| 9   | **"How we build & review" trust page** + disclaimer-wording alignment            | Trust / E-E-A-T     | Medium            | Planned                        |
| 10  | **Community-seeding execution** (Reddit/Quora, value-first, founder-led)         | Acquisition         | High (ongoing)    | Founder-led, continuous        |

`.env.example` honesty correction also shipped this sprint (below the top 10 — pure
correctness).

**Sequencing note (respects the observation freeze):** items 2 and 4–8 are
structural SEO/schema plumbing, not A/B experiments — they are pre-identified and
low-risk. Ship them as a single early batch right after Gate 0 so their aggregate
effect is measurable against a clean baseline, rather than dribbling "quick wins"
through the 30-day observation window (which would contaminate it).

---

## The 90-day plan

### Phase 0 — Restore sight (Week 0)

- **Founder:** open Gate 0 (the 3 grants). Verify with `node scripts/observe.mjs`
  → all providers `live`. _Nothing measurable happens until this is done._
- **Shipped this sprint:** comparison rendering fix (#3), `.env.example` honesty
  fix, and this plan.

### Phase 1 — Foundation + spearhead (Weeks 1–4)

- **Structural SEO batch** (one measured deploy): items #2, #4, #5, #6, #7, #8.
- **Community spearhead begins** (founder-led, value-first): 2–3 genuinely helpful
  Reddit/Quora answers per week where a calculator is the natural "check your own
  numbers" step. Track referral sessions once Gate 0 is open.
- **Weekly Monday operating loop** (below) starts and runs every week hereafter.

### Phase 2 — Read reality, double down (Weeks 5–8)

- First real data readable (retroactive to launch). Run the OBSERVATION day-30 diff:
  top/worst landing pages, CTR-vs-position gaps, bounce, zero-traffic pages,
  comparison engagement.
- Re-rank the backlog from evidence. Double down on whichever of Search / AI /
  Reddit / Quora is actually producing engaged, returning visitors.
- Trust page (#9) ships.

### Phase 3 — Scale + first revenue (Weeks 9–12)

- Scale the one or two channels the data proved. Deepen content only where GSC shows
  real ranked demand (position 11+ with impressions) — never speculative articles.
- **First affiliate** via the REVENUE-001 runbook (one founder choice + one small
  PR; ranking never changes for payment). Measure `comparison_cta_click`.
- **Day-90 Growth Report:** assembled from the 12–13 weekly snapshots; every number
  cited to a snapshot; unknowns written "unknown."

---

## Execution schedule (at a glance)

| Week | Primary focus                       | Deliverable                             |
| ---- | ----------------------------------- | --------------------------------------- |
| 0    | Gate 0 + sprint fixes               | Providers live; comparison fix deployed |
| 1    | Structural SEO batch (#2,4,5,6,7,8) | One measured deploy                     |
| 1–4  | Community seeding starts            | 2–3 value-first answers/week            |
| 2–4  | Weekly operating loop               | Snapshots committed                     |
| 5    | Observation day-30 diff             | Ranked, evidence-based backlog          |
| 5–8  | Double down on proven channel(s)    | Trust page (#9)                         |
| 9–11 | Scale + prepare affiliate           | First affiliate live (REVENUE-001)      |
| 12   | Day-90 Growth Report                | Quarter review + next-quarter roadmap   |

---

## Weekly operating checklist (every Monday, ~20 min)

Extends the OPERATION-001 cadence with the acquisition layer.

```
# Measure (existing cadence)
npx tsx scripts/weekly.mjs      # Executive Growth Report  -> .forge/reports/
npx tsx scripts/observe.mjs     # provider snapshot        -> .forge/observations/
forge execution production verify --url https://www.esytol.com -e 'id="domain-finance"' -x "open source"
forge doctor --repo esytol

# Acquire (this plan)
[ ] Post 2–3 value-first Reddit/Quora answers (a calculator is the "check yourself" step, never a drop)
[ ] Log where each link went (channel attribution for when Gate 0 data lands)
[ ] Review Marketing Agent + SEO Engine recommendations (/admin/marketing, /admin/growth)

# Decide (only from data, once Gate 0 open)
[ ] Any metric unreadable this week -> write "unknown", never estimate
[ ] Re-rank backlog only on evidence; roadmap changes happen monthly, not weekly

# Commit the report + snapshot. Until Gate 0: weekly.mjs exits 1 while blind —
# that exit code is the week's headline.
```

---

## PART 7 (metrics) — Success metrics for the first growth phase

Defined now; **readable the day Gate 0 opens** (GA4/Clarity history is retroactive to
launch). Until then, every value is **"unknown," never estimated.**

**Definition of "user" (no-login product):** a person who has completed at least one
calculation (a GA engagement event), de-duplicated by GA client. The **goal is 1,000
such users**; the _quality_ sub-goal — the one that proves trust-based growth rather
than a traffic spike — is the **returning-visitor rate** among them.

| Layer                  | Metric                                                        | Source                  | Target signal                         |
| ---------------------- | ------------------------------------------------------------- | ----------------------- | ------------------------------------- |
| **North star**         | Returning visitors                                            | GA4                     | Rising share of returning vs new      |
| Acquisition            | Organic sessions · impressions · avg position                 | GSC + GA4               | Up and to the right over the quarter  |
| Acquisition            | AI-assistant / referral sessions                              | GA4 referrer            | Any measurable, growing trickle       |
| Activation             | Calculator completion rate                                    | GA4 event               | ≥ baseline, then improving            |
| Activation             | Roadmap starts + completions                                  | GA4 event               | Any adoption, then growth             |
| Engagement             | Dashboard views · journey-strip clicks                        | GA4 event               | Discovery of the connected experience |
| Retention              | Return-visit rate · 90-day-review completions                 | GA4                     | The no-login retention proof          |
| Navigation             | Tool → article click-through (once #2 ships)                  | GA4 paths               | Session depth increases               |
| Revenue (once enabled) | `comparison_view` · `comparison_cta_click` · affiliate clicks | GA4 + partner dashboard | Instrumented; live since REVENUE-001  |

**The 1,000-user milestone is reached when GA4 shows 1,000 unique engaged users** —
and the plan is judged a success only if a healthy share of them **return**, because
sustainable trust-based growth, not a spike, is the mission.

---

## Rules honored

No new calculators. No new frameworks. No speculative AI features. No speculative
articles. No fabricated metrics. No technical complexity without measured value.
Every recommendation traces to a verified code fact or an established regulator
source. Execution over expansion: of the top 10, the only new code is pre-identified
SEO/schema plumbing and one bug fix — the rest is measurement and founder-led
distribution.
