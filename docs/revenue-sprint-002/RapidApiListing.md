# RapidAPI Listing — Esytol Income Tax API (India)

> **Purpose:** Copy-paste-ready assets for publishing the Income Tax API on RapidAPI.
> **Prepared:** Growth Sprint 002 · **Status:** ready to publish (Founder submits the listing).
> **Related:** [pricing rationale](../IncomeTaxApiPricing.md) · [prior listing draft](../IncomeTaxApiListing.md) · [launch checklist](../IncomeTaxApiLaunchChecklist.md)

RapidAPI supplies keys, metering, and billing. Our server verifies the RapidAPI proxy secret
(`RAPIDAPI_PROXY_SECRET`) and reads `X-RapidAPI-Subscription` to apply plan limits — see `lib/api/identity.ts`.

---

## Name

**Esytol Income Tax API (India)**

## Category

`Finance` · secondary tags: `tax`, `india`, `payroll`, `calculator`, `fintech`, `deterministic`

## Short description (≤ 100 chars)

Deterministic Indian income-tax API — Old vs New regime, multi-year, with a §-level computation trace.

## Long description

A fast, deterministic API to compute Indian personal income tax under both the **Old and New regimes** for a
selectable assessment year (**AY 2024-25, 2025-26, 2026-27**). Every response includes a **§-level computation
trace** (standard deduction, §87A rebate, surcharge, cess) so results are fully explainable and audit-friendly.

- **Deterministic:** identical inputs always return identical outputs — safe to cache and test.
- **Explainable:** a step-by-step trace with statutory sections, not a black box.
- **Private:** no data is stored; incomes are never logged.
- **Simple:** one `POST` with an income object; read `result.recommended` and each regime's `totalTax`.
- **Documented:** OpenAPI 3.1 spec + a live playground at https://www.esytol.com/developers/income-tax-api

Covers resident individuals below 60 and applies each year's Finance Act. Capital-gains special rates and
firms/companies are out of scope on the standard tiers (available under Enterprise).

## Base URL

`https://www.esytol.com/api/v1`

## Endpoints

| Method | Path                    | Purpose                                             |
| ------ | ----------------------- | --------------------------------------------------- |
| POST   | `/income-tax/calculate` | Compute tax (both regimes) + recommendation + trace |
| GET    | `/version`              | Engine + API version, supported years               |
| GET    | `/usage`                | Caller's current-month usage for the resolved plan  |
| GET    | `/health`, `/ready`     | Liveness / readiness                                |
| GET    | `/openapi.json`         | OpenAPI 3.1 document                                |

## Pricing (USD — hypothesis, see IncomeTaxApiPricing.md)

| Plan         | Price/mo | Included / mo | Rate limit | Overage     |
| ------------ | -------- | ------------- | ---------- | ----------- |
| Basic (Free) | $0       | 500           | 60/min     | hard stop   |
| Pro          | $10      | 10,000        | 60/min     | $0.002/req  |
| Ultra        | $29      | 100,000       | 120/min    | $0.0008/req |
| Mega         | $99      | 1,000,000     | 300/min    | $0.0004/req |
| Enterprise   | Custom   | Negotiated    | 600/min+   | Invoiced    |

> Single source of truth: `lib/api/plans.ts`. Configure the RapidAPI plan names as **BASIC / PRO / ULTRA / MEGA / CUSTOM** so the gateway header maps to our plan ids.

## Example — request

```bash
curl -X POST "https://www.esytol.com/api/v1/income-tax/calculate" \
  -H "Content-Type: application/json" \
  -H "X-RapidAPI-Key: <your-rapidapi-key>" \
  -d '{ "assessmentYear": "2026-27", "income": { "salary": 1800000 } }'
```

## Example — response (abridged)

```json
{
  "success": true,
  "apiVersion": "1",
  "engineVersion": "2.0.0",
  "assessmentYear": "2026-27",
  "result": {
    "recommended": "new",
    "new": { "totalTax": 171600, "effectiveRate": 0.0953, "trace": [/* §-level steps */] },
    "old": { "totalTax": 296400 },
    "taxSaved": 124800
  }
}
```

## Code samples

JavaScript / Python / Java samples are on the docs page and in the OpenAPI spec — reuse them verbatim in the
RapidAPI "Code Snippets" (RapidAPI auto-generates these from the OpenAPI import too).

## Logo

`public/api-logo.svg` (512×512, brand gradient). Export to 512×512 PNG for RapidAPI's uploader if it rejects SVG.

## Screenshots

See `RapidApiScreenshots.md` for the exact shots to capture from the live site (must be real captures, not mockups).
