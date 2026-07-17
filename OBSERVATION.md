# OPTIMIZATION-001 — The Observation Protocol

> **Purpose:** For 30 days, build almost nothing. Measure what users actually do, then produce one ranked optimization backlog.
> **Window:** starts the day the data grants land (see Gate 0) — GA4 and Clarity have been recording since launch, so history back to launch becomes readable retroactively.
> **Status:** Gate 0 pending
> **Rule:** every number in the day-30 report must come from one of the four sources below. A metric we cannot read is written **"unknown"**, never estimated.

## Gate 0 — restore sight (founder, ~10 minutes, blocks everything)

All three grants go to **`esytol-dashboard@easytechlabs.iam.gserviceaccount.com`**:

1. **Search Console** → esytol.com property → Settings → Users → add the address above. Then set `GSC_SITE_URL` (exactly as the property is registered) in Vercel + locally.
2. **GA4** → Admin → Property access management → add as **Viewer**; note the numeric property id → set `GA4_PROPERTY_ID` (+ service-account JSON) in Vercel + locally.
3. **Clarity** → Settings → Data Export → Generate token → set `CLARITY_API_TOKEN`.

Verification that the gate is open: `node scripts/observe.mjs` reports all three providers `live`.

## The cadence

| When               | Action                                                                       |
| ------------------ | ---------------------------------------------------------------------------- |
| Day 0 (grants day) | `node scripts/observe.mjs` — first snapshot; includes launch-to-date history |
| Every Monday       | `node scripts/observe.mjs` — snapshot to `.forge/observations/` (commit it)  |
| Every Monday       | `forge doctor` + `forge execution production verify` — reality checks        |
| Day 30             | Diff the snapshots → answer the questions below → write the ranked backlog   |

**Do not optimize during the window.** Ship only corrections of factual errors and P0s. Every "quick improvement" shipped mid-window contaminates the measurement.

## The questions the day-30 report must answer (from the data, or "unknown")

- Top / worst landing pages (GSC clicks + GA sessions by landing page)
- Highest / lowest CTR at position (GSC — the CTR-vs-expected-curve gap per page)
- Highest bounce / longest engagement (GA)
- Highest exit pages (GA)
- Pages with **zero** traffic in 30 days (sitemap minus GSC/GA pages — candidates for improve-or-merge, not deletion by reflex)
- Comparison engagement: `comparison_view` and `comparison_cta_click` by comparison id (GA events, live since REVENUE-001)
- Behaviour signals: rage clicks, dead clicks, quick-backs by page (Clarity)
- Ranking movements: position deltas per query/page (GSC previous-period diff — already computed by `lib/growth`)

## Day-0 baseline — what is real _today_ (no user data)

| Fact                     | Value                                                                             | Source                         |
| ------------------------ | --------------------------------------------------------------------------------- | ------------------------------ |
| Production state         | HEAD live, verified                                                               | forge production verify (PASS) |
| Pages                    | 102 static · 58 sitemap URLs · 31 articles · 16 tools                             | build + sitemap                |
| Cluster coverage         | Tax 100 · Investment 100 · Loans 100 · Retirement 100 · Everyday 50 · Developer 0 | SEO engine (registry-derived)  |
| Internal links           | 111 article→article · 0 broken · 0 orphans                                        | link audit                     |
| Comparisons instrumented | 6 comparisons on 10 pages, events firing                                          | REVENUE-001                    |
| Collection tags          | GA4 (`G-XD3FF23LGR`) + Clarity live in prod HTML                                  | production fetch               |
| **Read access**          | **none — Gate 0 pending**                                                         | provider check (this sprint)   |

## The seeded backlog (facts only; user-data ranks pending)

Ranked by what is knowable today. **Items marked ⏳ cannot be ranked until the window closes — the whole point of this sprint is to stop guessing at them.**

| #   | Item                                                    | Basis                                                                       | Impact guess → replaced by data                                                         |
| --- | ------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 0   | **Gate 0 grants**                                       | Blocks all observation                                                      | — (prerequisite)                                                                        |
| 1   | **Tools → Learn linking is still one-way**              | CONTENT-001 finding; tool pages carry the traffic and pass none to articles | High (⏳ confirm with GA navigation paths)                                              |
| 2   | **`category` overload** (display taxonomy = trust gate) | PLATFORM-001 architecture debt; blocks honest categorisation                | Medium, rises with every new non-finance tool                                           |
| 3   | **Finance Act 2026 verification** of tax figures        | Content maintenance; needs official text                                    | High for trust if rules changed (⏳ seasonal query data will show filing-season demand) |
| 4   | Everyday cluster 50% coverage                           | Engine                                                                      | Low by strategy (⏳ unless GSC shows real demand)                                       |
| 5   | ⏳ CTR fixes on under-earning page-1 pages              | **awaiting GSC**                                                            | unknown                                                                                 |
| 6   | ⏳ Zero-traffic page rescue/merge list                  | **awaiting GSC+GA**                                                         | unknown                                                                                 |
| 7   | ⏳ High-bounce page fixes                               | **awaiting GA/Clarity**                                                     | unknown                                                                                 |
| 8   | ⏳ First affiliate partnership target                   | **awaiting comparison_cta data**                                            | unknown                                                                                 |
| 9   | ⏳ Rage/dead-click UX fixes                             | **awaiting Clarity**                                                        | unknown                                                                                 |

Day-30 output: this table re-ranked with real numbers, one page each for the top 5, and nothing optimized until then.

---

# OPERATION-001 — The 90-Day Operating Calendar

## Every Monday (~15 minutes)

```
npx tsx scripts/weekly.mjs        # Executive Growth Report -> .forge/reports/
npx tsx scripts/observe.mjs       # provider snapshot        -> .forge/observations/
forge execution production verify --url https://www.esytol.com -e 'id="domain-finance"' -x "open source"
forge doctor --repo esytol        # HEAD deploy status + production age
```

Commit the report and snapshot. The weekly script exits 1 while all providers are
blind — that exit code is the week's headline until Gate 0 opens.

## Monthly (first Monday)

Diff the four weekly reports: impressions, clicks, CTR, position, comparison
views/CTA clicks, returning visitors, top/worst pages. Re-rank the backlog from
evidence. Roadmap changes happen here and only here.

## Content rule

No speculative articles. A new article requires either search-data demand (GSC
queries we rank 11+ for with real impressions) or explicit user demand. The
freshness module governs updates to existing articles.

## Optimization rule

Touch only: top-10 landing pages, top-10 opportunity pages (engine-ranked), top-10
comparison pages — all three lists require live data. Until Gate 0: optimization
is frozen (there is nothing honest to optimize against).

## Revenue: the ONE affiliate launch (runbook)

The plumbing has been ready since REVENUE-001. The launch is one founder action
plus one small PR:

1. **Founder:** choose ONE program matched to our strongest decision surface —
   recommended order: credit-score/loan marketplace, direct-MF platform,
   tax-filing software. Register, obtain the tracked link and the payout terms.
2. **Code (10 minutes):** add the partner as ONE option `link` in
   `content/comparisons.ts` with `sponsored: true` — the UI renders the Sponsored
   tag, `rel="sponsored"`, and the disclosure automatically. **In the same commit**,
   update the guard test in `tests/content/comparisons.test.ts` that currently
   forbids all affiliate links (it exists precisely so this step is deliberate).
   Update the comparison's disclosure text to name the partnership.
3. **Measure:** `comparison_cta_click{affiliate:"yes"}` is already instrumented;
   partner-side conversions come from the program dashboard weekly.
4. **Rule:** ranking never changes for payment; the partner joins as an option,
   not a winner.

## Day-90 Growth Report

Assembled from the 12–13 weekly reports: traffic, rankings, revenue, user
behaviour, lessons learned, next-quarter roadmap. Every number cited to a weekly
snapshot.
