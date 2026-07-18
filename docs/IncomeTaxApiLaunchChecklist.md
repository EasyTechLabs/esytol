# Income Tax API — Launch Checklist

> **Purpose:** The gate that must be green before pressing "Publish" on the marketplace listing,
> and the developer-onboarding checks that prove the listing actually works.
> **Status:** Pre-launch · technical checks verified 2026-07-18; listing steps pending publish.
> **Related:** [Launch Guide](IncomeTaxApiMarketplaceLaunch.md) · [Listing](IncomeTaxApiListing.md) · [Pricing](IncomeTaxApiPricing.md) · [Runbook](IncomeTaxApiRunbook.md)

---

## A. Technical readiness (verified against production 2026-07-18)

| #   | Check                                  | How                                                    | Result        |
| --- | -------------------------------------- | ------------------------------------------------------ | ------------- |
| A1  | OpenAPI spec is valid & importable     | `GET /api/v1/openapi.json` → 200, 3.1, schemas present | ✅            |
| A2  | Request examples present in spec       | example under the calculate request body               | ✅            |
| A3  | Error responses documented             | spec lists `200/400/422/429`                           | ✅            |
| A4  | Rate-limit headers emitted             | response has `X-RateLimit-Limit/Remaining/Reset`       | ✅ (limit 60) |
| A5  | Request-id emitted                     | response has `X-Request-Id`                            | ✅            |
| A6  | CORS open for browser callers          | `Access-Control-Allow-Origin: *`                       | ✅            |
| A7  | Health endpoint                        | `GET /api/v1/health` → 200                             | ✅            |
| A8  | Readiness endpoint                     | `GET /api/v1/ready` → 200 (engine computes)            | ✅            |
| A9  | Version endpoint lists supported years | `GET /api/v1/version` → 200                            | ✅            |
| A10 | Wrong method rejected cleanly          | `GET` on calculate → **405** (no stack trace)          | ✅            |
| A11 | Validation error shape                 | bad body → **422** with `{code,message,field}`         | ✅            |
| A12 | Malformed JSON handled                 | non-JSON body → **400**                                | ✅            |
| A13 | Happy path correct                     | `POST` ₹18L → `result.recommended` + §-cited trace     | ✅            |
| A14 | Support page live                      | `GET /contact` → 200                                   | ✅            |

## B. Publish-time configuration (do at RapidAPI, no code change)

- [ ] **Base URL** set to `https://www.esytol.com/api/v1` (the spec `servers` is relative — B-item, not a code fix).
- [ ] Endpoints imported from `/api/v1/openapi.json` (or added manually: the calculate POST + the 4 GETs).
- [ ] Tiers configured from [Pricing](IncomeTaxApiPricing.md) (Basic free / Pro / Ultra / Mega), each marked _hypothesis_.
- [ ] Category = Finance; tags from the [Listing](IncomeTaxApiListing.md).
- [ ] Long description, key features, target audience, FAQ pasted from the [Listing](IncomeTaxApiListing.md).
- [ ] Support contact set: `https://www.esytol.com/contact` + email.
- [ ] API terms text pasted (short form in the [Listing](IncomeTaxApiListing.md)); link to `/terms`.
- [ ] Changelog summary pasted.
- [ ] Decide on the **proxy-secret toggle** (see the [Runbook](IncomeTaxApiRunbook.md)) — publish with metering-bypass accepted for launch, or enable the seam. **Default this sprint: leave off** (auth is EXPOSE-002).

## C. Content & link verification (before publish)

- [ ] Every link in the listing resolves (no broken links): `/contact`, `/terms`, `/developers/income-tax-api`, `/api/v1/openapi.json`.
- [ ] Every code example in the listing runs verbatim and returns 200 (curl at minimum).
- [ ] The example request/response in the listing matches the live response shape.
- [ ] Supported assessment years in the copy match `GET /api/v1/version`.
- [ ] Screenshots (if any) show the current response shape.

## D. Developer-onboarding smoke test (prove first-call-in-minutes)

Run as a first-time developer, from the RapidAPI test console:

- [ ] Subscribe to the **free** tier.
- [ ] Send the example `POST` unchanged → **200**, `result.recommended` present.
- [ ] Change the salary → number changes sensibly; both regimes returned.
- [ ] Send a negative income → **422** with the offending `field`.
- [ ] Send malformed JSON → **400**.
- [ ] Exceed the rate limit → **429** with `X-RateLimit-*`.
- [ ] Confirm `X-Request-Id` is present (for support triage).

## E. Post-publish (day 0)

- [ ] Confirm the listing is publicly discoverable (search the marketplace for "india income tax").
- [ ] Record the publish date in [ProductFactory metrics](../../easytech-workspace/ProductFactory/Knowledge/Products/Esytol/Metrics/ProjectMetrics.md).
- [ ] Set a reminder to review the [success metrics](IncomeTaxApiMarketplaceLaunch.md#part-7--launch-success-metrics-no-invented-targets) after 2 weeks.
- [ ] Do **nothing else** — no billing/analytics/redesign until real feedback (STOP condition).

> **Gate rule:** all of **A** is green (already verified). Do not publish until **B** and **C** are
> complete and **D** passes from the live marketplace console.
