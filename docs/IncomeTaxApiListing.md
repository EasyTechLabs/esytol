# Income Tax API — RapidAPI Listing Content (paste-ready)

> **Purpose:** Copy-paste-ready marketplace listing content for the Income Tax API.
> Every field a RapidAPI listing needs, written and ready to paste.
> **Status:** Ready to publish · **Last Updated:** 2026-07-18
> **Related:** [Launch Guide](IncomeTaxApiMarketplaceLaunch.md) · [Pricing](IncomeTaxApiPricing.md) · [Developer Guide](IncomeTaxApiGuide.md)

---

## Product title

**India Income Tax Calculator API — Old vs New Regime (AY 2024-25 → 2026-27)**

Short form (where a shorter field is required): **India Income Tax Calculator API**

## Base URL (RapidAPI config)

```
https://www.esytol.com/api/v1
```

> The OpenAPI `servers` entry is relative; enter this absolute base in the RapidAPI config.

## Short description (one line, ≤ 160 chars)

> Calculate Indian income tax for both the Old and New regimes in one call — section-cited, statutorily rounded, multi-year (AY 2024-25 to 2026-27). JSON in, JSON out.

## Long description (Markdown)

Paste the block below into the marketplace's long-description field. JSON examples are shown
indented (not fenced) so this whole section stays one clean, copyable Markdown block.

```
# India Income Tax Calculator API

Compute Indian income tax **precisely** for both the **Old** and **New** regimes in a
single request, and get back the recommended regime, the tax due, and a **section-cited,
step-by-step computation trace** you can show your users.

Built for developers who need correct numbers, not a full compliance suite: payroll and
HR tools, fintech apps, salary/CTC calculators, financial advisors, and internal tools.

## Why this API

- **Both regimes, one call** — no need to run two requests; you get both and a recommendation.
- **Multi-year** — Assessment Years 2024-25, 2025-26, and 2026-27, versioned so results are stable.
- **Auditable** — every result includes a section-cited computation trace (which section, what amount).
- **Statutorily correct rounding** — rounds per Sec. 288A/288B (to the nearest ₹10), like the real return.
- **Deterministic** — same input, same output. No surprises, no drift.
- **Fast & simple** — plain JSON, no SDK required, first successful call in minutes.
- **Privacy-respecting** — incomes are never logged.

## What it is not

It is a **calculation** API — not e-filing, not ITR generation, not a full compliance platform.
If you need correct tax math inside your product, this is the lightweight building block.

## Endpoints

- POST /income-tax/calculate — compute tax for both regimes.
- GET /health, /ready, /version — liveness, readiness, and supported years.
- GET /openapi.json — the full OpenAPI 3.1 spec (import into Postman/Insomnia/Swagger UI).

## Example request

    {
      "assessmentYear": "2026-27",
      "income": { "salary": 1800000 },
      "deductions": { "section80C": 150000 }
    }

## Example response (shape)

    {
      "success": true,
      "apiVersion": "v1",
      "engineVersion": "2.0.0",
      "assessmentYear": "2026-27",
      "requestId": "...",
      "result": {
        "recommended": "new",
        "old": { "taxPayable": "...", "trace": [ ... ] },
        "new": { "taxPayable": "...", "trace": [ ... ] }
      }
    }

Read the full request/response schema in the Developer Guide or the OpenAPI spec.
```

## Key features (bullet list field)

- Old **and** New regime in a single call, with a recommendation
- Assessment Years 2024-25, 2025-26, 2026-27 (versioned)
- Section-cited, step-by-step computation trace
- Statutory rounding (§288A/§288B, nearest ₹10)
- Deterministic — reproducible results
- Plain JSON; no SDK; first call in minutes
- OpenAPI 3.1 spec + interactive playground
- Rate-limit headers + per-request `X-Request-Id`
- Incomes are never logged (privacy by design)

## Target audience

Payroll/HR software, fintech and neobank apps, salary & CTC calculators, financial advisors
and wealth apps, accounting/tax-prep tools, and internal finance tooling — anyone who needs
**correct Indian income-tax math** as a component, not a full compliance product.

## Category & tags

- **Primary category:** Finance
- **Secondary:** Business / Data
- **Tags:** `india`, `income-tax`, `tax-calculator`, `tax-api`, `finance`, `payroll`, `salary`, `fintech`, `india-tax`, `tax-computation`

## FAQ (paste into the listing's FAQ)

**Q: Which regimes does it calculate?**
Both the Old and the New regime, in a single request, plus which one is cheaper for that input.

**Q: Which years are supported?**
Assessment Years 2024-25, 2025-26, and 2026-27. Call `GET /version` for the live list.

**Q: Is the tax figure rounded like a real return?**
Yes — it rounds per §288A/§288B (to the nearest ₹10).

**Q: Can I see how the number was reached?**
Yes. Every result includes a section-cited, step-by-step trace you can display to end users.

**Q: Does it file returns or generate an ITR?**
No. It is a calculation API — correct tax math as a building block, not e-filing or compliance.

**Q: Do you store or log my users' incomes?**
No. Incomes are never logged; the service records only request metadata (timing, status, ids).

**Q: What happens on a bad request?**
You get a clear JSON error: `400` for malformed JSON, `422` with the offending `field` for
validation problems, `429` if you exceed the rate limit. Never a stack trace.

**Q: Is there a free tier?**
Yes — see the pricing tiers. (Pricing is being validated with real usage after launch.)

**Q: How fast can I get started?**
Minutes. Copy the example request, send it, and read `result.recommended`. No SDK needed.

## Support contact

- **Support page:** https://www.esytol.com/contact
- **Email:** easytechmarketingpvtltd@gmail.com (a `support@esytol.com` alias may be configured for the listing)
- **Docs:** the Developer Guide and the interactive playground at `/developers/income-tax-api`

## Changelog summary (for the listing)

- **API v1 (2026-07-18)** — first public HTTP API: `POST /income-tax/calculate` (both regimes),
  health/ready/version/openapi endpoints, OpenAPI 3.1, validation, rate-limit headers, request ids.
- **Engine v2.0.0** — multi-year (AY 2024-25 → 2026-27), enterprise attribution, §-cited
  computation trace, statutory §288A/§288B rounding.

> Keep this section in sync with `docs/IncomeTaxChangelog.md` on every engine change.

## API usage terms (short form for the listing)

> Full site terms: https://www.esytol.com/terms

- The API returns **computational estimates** for informational purposes. It is **not** tax,
  legal, or financial advice and does not constitute filing or compliance.
- Verify results against official sources before relying on them for filing. Esytol is not
  liable for decisions made solely on API output.
- Fair use: respect the plan's rate limits; automated abuse or resale-as-is of the raw API
  may result in suspension.
- Availability is provided on a commercially reasonable best-effort basis; see the tier for any
  stated limits. No uptime SLA is offered on the free tier.
- Incomes submitted are processed to compute a result and are **not logged or stored**.

```

```
