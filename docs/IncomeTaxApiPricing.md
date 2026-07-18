# Income Tax API — Pricing Proposal

> **Purpose:** A proposed tier structure for the marketplace listing.
> **Status:** ⚠️ **HYPOTHESIS — to be validated after launch.** Not a committed price sheet.
> **Last Updated:** 2026-07-18
> **Related:** [Launch Guide](IncomeTaxApiMarketplaceLaunch.md) · [Listing](IncomeTaxApiListing.md) · [Business Case](IncomeTaxBusinessCase.md)

---

## ⚠️ Read this first — pricing is a hypothesis

**Every number on this page is an assumption, not a validated price.** We have **no revenue data
and no conversion data** for this API — it has never been sold. These tiers are a _starting point_
designed to be published, measured, and **corrected by real usage**. Do not treat them as fixed.
The first paying subscriber and the first two weeks of RapidAPI conversion data are what turn any of
this from a guess into a decision. Per STRATEGY-005/006: unknowns stay labelled, and we set no target
without evidence.

## The evidence we do have (and its limits)

| Signal                                | Value                          | Grade    | What it does _not_ tell us                      |
| ------------------------------------- | ------------------------------ | -------- | ----------------------------------------------- |
| RapidAPI income-tax-India API         | **deprecated**                 | observed | the price it charged, or its volume             |
| Incumbents (Sandbox/Quicko, ClearTax) | full-compliance suites         | observed | per-call calc-API pricing (they don't sell one) |
| Payroll SaaS willingness-to-pay       | **₹40–120 per employee/month** | T2       | how that maps to a per-_request_ API price      |

**The honest gap:** there is **no observed market price for a lightweight tax-calculation API**.
The payroll WTP is a _product_ signal, not an API-metering signal. So the dollar figures below are
inferred from RapidAPI norms for a Finance utility API, **not** from a comparable we measured.
`[ASSUMPTION]` marks every such inference.

## Proposed tiers `[ASSUMPTION]`

Currency is **USD** (RapidAPI bills in USD). "Requests" = calls to `POST /income-tax/calculate`.

| Tier             | Price/mo               | Included requests | Overage                    | Rate limit | For                                   |
| ---------------- | ---------------------- | ----------------- | -------------------------- | ---------- | ------------------------------------- |
| **Basic (Free)** | $0                     | 500 / mo          | hard stop (429)            | 60/min     | Trial, hobby, evaluation              |
| **Pro**          | **$10** `[ASSUMPTION]` | 10,000 / mo       | $0.002/req `[ASSUMPTION]`  | 60/min     | A live small app / early payroll tool |
| **Ultra**        | **$29** `[ASSUMPTION]` | 100,000 / mo      | $0.0008/req `[ASSUMPTION]` | 120/min    | A growing product with real volume    |
| **Mega**         | **$99** `[ASSUMPTION]` | 1,000,000 / mo    | $0.0004/req `[ASSUMPTION]` | 300/min    | High-volume / white-label             |

> The rate-limit numbers align with the deployed limiter defaults (`DEFAULT_RATE_LIMIT = 60/min`);
> higher tiers assume raising that config value — a one-line change **not made this sprint**.

### Why these shapes (the reasoning, not a justification of the numbers)

- **A free tier exists on purpose.** The #1 launch goal is _developers trying it_. 500 free
  requests/month is enough to build and evaluate, small enough to convert real usage. Free-tier
  size is the single biggest lever on the conversion metric — expect to tune it.
- **A low first paid rung ($10).** The point of the first paid tier is to cross ₹0 → first payment
  with the least friction, not to maximize ARPU. A low, obvious upgrade beats a "call sales" wall.
- **Decreasing marginal price up the tiers.** Standard usage-API shape: heavier users pay less per
  call. Encourages the volume customers we actually want.

## Upgrade path

Free → Pro is the critical conversion. It should happen when a developer's real traffic bumps the
free ceiling — so the free ceiling is a _product decision_, not just a cost control. RapidAPI handles
the plan change, metering, and billing; **we implement no billing code** (STOP condition). Overage
pricing lets a customer burst past the included quota without an immediate forced upgrade.

## Assumptions, stated plainly

1. **Willingness-to-pay for a calc API is unproven.** Inferred from payroll WTP + RapidAPI norms. `[ASSUMPTION]`
2. **RapidAPI's revenue share** (~20%) is absorbed in these prices, not passed on. `[ASSUMPTION]`
3. **Marginal cost per call ≈ near-zero** (pure compute, serverless) — so pricing is value-based, not cost-plus.
4. **The free ceiling (500)** is a starting guess; the true conversion-optimal number is unknown.
5. **Higher-tier rate limits** assume a future config bump, not new architecture.

## What would change this page (the validation plan)

- **First payment** at _any_ tier → the price point is at least _viable_; note which tier.
- **Signups but no conversion** → free tier too generous, or Pro too expensive, or value unclear. Adjust one, measure.
- **No signups at all** → a _discovery_ problem (listing/SEO), not a _price_ problem — don't cut price to fix reach.
- **Overage revenue > subscription revenue** → the tier ceilings are mispriced; re-band.

Review after **two weeks of real RapidAPI data**. Until then, these numbers are a hypothesis on a page.
