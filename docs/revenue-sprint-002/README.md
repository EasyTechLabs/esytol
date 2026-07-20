# Growth Sprint 002 — First Paying Customer (API productization)

> **Objective:** generate Esytol's first paying customer by productizing the Income Tax API — the easiest thing
> to monetize (it's the only real public API, already documented, RapidAPI-targeted). **No AIOS/platform/worker
> changes; grow the business.** Existing users are not broken; no metric is invented.
> **Prepared:** 2026-07-20 · builds on [Revenue Sprint 001](../revenue-sprint-001/).

## What shipped (product code in `esytol`)

### Phase 2 — API productization (the seam made real)

| Module                                     | Role                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `lib/api/plans.ts`                         | Single source of truth for tiers (Free/Pro/Ultra/Mega/Enterprise), limits, prices           |
| `lib/api/apiKeys.ts`                       | Direct off-marketplace keys — **SHA-256 hashed, env-provisioned, never logged**             |
| `lib/api/identity.ts`                      | Resolves every request → {principal, plan, source}: RapidAPI › direct key › anonymous(Free) |
| `lib/api/metering.ts`                      | Real per-principal monthly usage counts + quota state (never invented)                      |
| `lib/api/billing.ts`                       | Billing-hook **event seam** (RapidAPI is the payment rail; Stripe/enterprise later)         |
| `lib/api/leads.ts`                         | Lead-capture seam for Contact Sales / Enterprise / API-key requests                         |
| `app/api/v1/income-tax/calculate/route.ts` | Wired: identity → plan-aware rate limit → meter → compute                                   |
| `app/api/v1/usage/route.ts`                | New: caller's real current-month usage                                                      |
| `app/api/v1/contact/route.ts`              | New: inbound lead capture (rate-limited, validated)                                         |

**Non-breaking guarantee:** anonymous callers still get `200` on the Free tier (no key required). Only a bad
direct key (`401`) or a spoofed RapidAPI proxy secret (`403`) is rejected. Proven by tests.

### Phase 3 — Landing pages

- `app/pricing/page.tsx` — tiers from `plans.ts` + enterprise band + capability comparison (repo-cited competitors).
- `app/enterprise/page.tsx` — enterprise features + Request-Enterprise form.
- `app/developers/income-tax-api/page.tsx` — enhanced: tiered quick start, keys, `/usage`, CTAs.

### Phase 4 — RapidAPI assets

`RapidApiListing.md` (name/description/pricing/examples), `public/api-logo.svg` (512×512 brand logo),
`RapidApiScreenshots.md` (real-capture checklist — screenshots are **not fabricated**).

### Phase 5 — Conversion

`features/dev-api/ApiCtas.tsx` (Get started / Get API key / Contact sales — each fires a GA event) +
`features/dev-api/ContactForm.tsx` → `POST /api/v1/contact`.

### Phase 6 — Measurement

`MeasurementPlan.md` maps signups/usage/conversions/revenue → their **real** source (RapidAPI + our meter + GA
events + lead logs). Honest limits stated (per-instance meter; Gate-0 GA read pending; **revenue is ₹0 today**).

### Phase 1 — Revenue Matrix

`RevenueMatrix.json` — every tool/API/enterprise feature classified. Verdict: **calculator UIs stay free-forever;
revenue = the API (live) + ads/affiliate (gated on traffic) + premium add-ons + enterprise.**

## How the first payment happens

1. Founder publishes the RapidAPI listing (assets ready) + sets `RAPIDAPI_PROXY_SECRET` + `NEXT_PUBLIC_RAPIDAPI_URL`.
2. RapidAPI supplies keys/metering/billing; our gateway maps `X-RapidAPI-Subscription` → plan limits.
3. Developers arrive via the docs page + pricing CTAs; free tier converts on real usage.
4. Enterprise leads flow through `/enterprise` → `/api/v1/contact`.
5. First RapidAPI subscription = **first paying customer**. Tracked per `MeasurementPlan.md`.

## Validation

- Type-check clean. API tests **31/31** (15 existing + 16 new). Full suite green.
- Anonymous compute path unchanged (regression-proven). Production build passes.

## Env to set at deploy (no code change)

`RAPIDAPI_PROXY_SECRET` (gate paid traffic) · `NEXT_PUBLIC_RAPIDAPI_URL` (listing link) ·
`ESYTOL_API_KEYS` (direct/enterprise keys, JSON) · `NEXT_PUBLIC_GA_ID` (already supported).
