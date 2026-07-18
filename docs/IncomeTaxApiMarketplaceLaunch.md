# DISTRIBUTE-001 — Income Tax API Marketplace Launch Guide

```
── Sprint Declaration (STRATEGY-004/005/006) ─────────
Platform:             Esytol / EasyTechLabs
Domain:               Finance
Category:             API distribution (no new code)
Tool(s):              income-tax API (already live from EXPOSE-001)
Priority Score:       ~86 / 100 (the flagship Revenue engine)
Admission Result:     ADMIT
Capital Allocation:   Revenue portfolio · Stage-A #1 funded position · this is the step
                      that turns the Live API into a *revenue-Live* one (first payment)
Dependencies:         EXPOSE-001 (live API), RESEARCH-001 (evidence), STRATEGY-005/006
Expected Maintenance: listing kept in sync with the engine changelog
Platform Impact:      External distribution of the flagship engine. Artifacts only — no
                      API redesign, no engine change, no billing/analytics code.
──────────────────────────────────────────────────────
```

> **Purpose:** Everything needed to publish the Income Tax API on an API marketplace (RapidAPI first) as a high-quality listing. The umbrella for the listing content, pricing, checklists, and runbook.
> **Status:** Launch-prep · artifacts complete, awaiting the founder's "Publish."
> **Last Updated:** 2026-07-18
> **Owner (document):** Income Tax API distribution
> **Related:** [Listing](IncomeTaxApiListing.md) · [Pricing](IncomeTaxApiPricing.md) · [LaunchChecklist](IncomeTaxApiLaunchChecklist.md) · [Runbook](IncomeTaxApiRunbook.md) · [Developer Guide](IncomeTaxApiGuide.md) · [OpenAPI](/api/v1/openapi.json)

---

## Why now (the evidenced opportunity)

The governance stack selected this engine as the #1 Revenue position, and the market evidence
(RESEARCH-001, cited in the [Business Case](IncomeTaxBusinessCase.md)) shows a real, current gap:
the income-tax-India API on RapidAPI is **deprecated**, the incumbents (Sandbox/Quicko, ClearTax)
sell heavy _full-compliance_ suites, and it is **filing season**. The API is live and tested; the
only missing thing is discoverability. This sprint produces the listing.

## PART 1 — Marketplace audit (current API vs marketplace expectations)

Audited against the live production API on 2026-07-18.

| Area                     | Marketplace expectation             | Status                                                 | Action                                                                                    |
| ------------------------ | ----------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| **Endpoints**            | Stable, versioned                   | ✅ `/api/v1/*`, clean 405 on wrong method              | none                                                                                      |
| **OpenAPI**              | Importable 3.1 with schemas         | ✅ `/api/v1/openapi.json`, all schemas                 | none                                                                                      |
| **Examples**             | Request/response examples           | ✅ in the spec + Developer Guide (curl/JS/Python/Java) | none                                                                                      |
| **Error documentation**  | Every error shape documented        | ✅ 400/422/429 in spec + guide                         | none                                                                                      |
| **Rate limiting**        | Headers present                     | ✅ `X-RateLimit-*`, `X-Request-Id`                     | none                                                                                      |
| **Health/observability** | Probes                              | ✅ `/health`, `/ready`, `/version`                     | none                                                                                      |
| **Base URL**             | Absolute base for the marketplace   | ⚠️ spec `servers` is relative (`/api/v1`)              | **Set the RapidAPI Base URL to `https://www.esytol.com/api/v1`** (config, not code)       |
| **Metadata**             | Title, descriptions, tags, category | ➕ not on the marketplace yet                          | [Listing](IncomeTaxApiListing.md) provides it                                             |
| **Pricing presentation** | Tiers + limits                      | ➕ RapidAPI config                                     | [Pricing](IncomeTaxApiPricing.md) proposal                                                |
| **Terms**                | API usage terms                     | ⚠️ site `/terms` is general                            | [Listing](IncomeTaxApiListing.md) includes API terms text                                 |
| **Support**              | A contact channel                   | ✅ `/contact` live                                     | Use `/contact` (+ optional `support@esytol.com` alias)                                    |
| **Abuse protection**     | Prevent metering bypass             | ⚠️ direct calls bypass RapidAPI metering               | Runbook documents the proxy-secret toggle (auth seam exists; **not enabled this sprint**) |

**Verdict:** the _API_ is ready; the gaps are all listing artifacts (produced here) plus two
config items done at publish time (RapidAPI base URL, proxy-secret toggle). No code redesign.

## PART 4 — Developer experience (onboarding journey)

The success criterion is: a developer with no prior knowledge makes a correct request fast.

| Metric                               | How it's measured                       | Current state                                                                            |
| ------------------------------------ | --------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Time to first successful request** | From landing on the listing to a 200    | Fast — no signup; copy-paste curl works; live playground at `/developers/income-tax-api` |
| **Clarity of examples**              | curl + JS + Python + Java, all runnable | Provided in the guide and the listing                                                    |
| **Common mistakes**                  | (see below)                             | Documented with fixes                                                                    |
| **Troubleshooting**                  | Error table with codes + fixes          | In the guide and the listing FAQ                                                         |

### Common mistakes → the fix (troubleshooting)

- **Sending `salary` at the top level** → it lives under `income.salary`. (See the request schema.)
- **Expecting one regime** → both are always returned; read `result.recommended`.
- **Wrong assessment year format** → use `2026-27`, not `2026` or `FY2025-26`.
- **`GET` on the calculate endpoint** → it is `POST` only (405 otherwise).
- **Non-numeric or negative values** → 422 with the offending `field`.

### Onboarding checklist (a developer's first 10 minutes)

- [ ] Open the RapidAPI listing (or `/developers/income-tax-api`).
- [ ] Copy the curl example and run it → receive a 200 with `result.recommended`.
- [ ] Try the interactive playground with your own salary.
- [ ] Import `/api/v1/openapi.json` into Postman/Insomnia/Swagger UI.
- [ ] Read the error table; deliberately send a bad request to see the 422 shape.
- [ ] Check `/api/v1/version` for supported assessment years.

## PART 7 — Launch success metrics (no invented targets)

Definitions only. Measured from **RapidAPI's own analytics** once live (we implement no analytics
this sprint — STOP condition). Per STRATEGY-005/006, **no numeric target is set without evidence**;
the first review happens after two weeks of real data, and unmeasured values are "unknown."

| Metric                        | Definition                                | Source             | Baseline    |
| ----------------------------- | ----------------------------------------- | ------------------ | ----------- |
| **First payment** _(the KPI)_ | Date of the first paid subscription       | RapidAPI billing   | **not yet** |
| API subscriptions             | Free + paid subscribers                   | RapidAPI           | 0           |
| Successful requests           | 2xx responses                             | RapidAPI analytics | 0           |
| Free → paid conversion        | Paid ÷ total subscribers                  | RapidAPI           | unknown     |
| Developer retention           | Subscribers still calling after 2/4 weeks | RapidAPI           | unknown     |
| Support requests              | Tickets via `/contact`                    | Inbox              | 0           |
| Error rate                    | 4xx/5xx ÷ total                           | RapidAPI           | unknown     |

The one number that matters: **first payment** — the entire EXECUTION-001 → EXPOSE-001 →
DISTRIBUTE-001 arc exists to move it off zero, honestly.

## The launch, in one paragraph

The API is live and audited. To publish: create the RapidAPI listing using
[IncomeTaxApiListing.md](IncomeTaxApiListing.md) (title/descriptions/tags/FAQ), set the Base URL to
`https://www.esytol.com/api/v1`, configure the tiers from [IncomeTaxApiPricing.md](IncomeTaxApiPricing.md),
run the [Launch Checklist](IncomeTaxApiLaunchChecklist.md), and operate it with the
[Runbook](IncomeTaxApiRunbook.md). Then wait for real subscribers and feedback — no billing,
analytics, or redesign work until there is evidence to act on.
