# Launch Readiness — Income Tax API (Growth Sprint 002 closure)

> **Scope:** ship the Income Tax API as Esytol's first revenue product. Feature-frozen. This document is the
> deployment-ready release package: deployment checklist, launch checklist, rollback, deployment, monitoring,
> known limitations, and support plan.
> **Prepared:** 2026-07-20 · **Related:** [README](README.md) · [MeasurementPlan](MeasurementPlan.md) · [RapidApiListing](RapidApiListing.md) · [DEPLOYMENT.md](../DEPLOYMENT.md)

---

## Phase 3 — Deployment checklist (verification status)

| Item                 | Status                        | Evidence / note                                                                                                                                                                          |
| -------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Production build** | ✅ green                      | `npm run build` exit 0; new routes prerendered (`/pricing`, `/enterprise` static; `/api/v1/usage`, `/api/v1/contact` handlers).                                                          |
| **Type safety**      | ✅ clean                      | `tsc --noEmit` no errors.                                                                                                                                                                |
| **Lint**             | ✅ clean                      | `eslint .` no warnings/errors.                                                                                                                                                           |
| **Format**           | ✅ clean                      | `prettier --check .` all files.                                                                                                                                                          |
| **Tests**            | ✅ 1948 / 1948                | full suite; API productization 16 new + 15 existing green.                                                                                                                               |
| **Production URLs**  | ⏳ code ready                 | Live verification is post-deploy (`forge production verify`); see P0-1 caveat below.                                                                                                     |
| **RapidAPI assets**  | ✅ ready                      | `RapidApiListing.md`, `public/api-logo.svg`, `RapidApiScreenshots.md` (real captures pending, by design).                                                                                |
| **robots.txt**       | ✅                            | `app/robots.ts` — allows marketing pages, disallows `/api/`, `/admin/`, `/_next/`; references sitemap.                                                                                   |
| **sitemap**          | ✅                            | `/developers/income-tax-api`, `/pricing`, `/enterprise` added to `app/sitemap.ts`.                                                                                                       |
| **OpenGraph**        | ✅                            | New pages use the valid dynamic `/og/site`; per-tool OG unchanged.                                                                                                                       |
| **Schema (JSON-LD)** | ✅ (tools) / ➖ (marketing)   | Tool pages keep SoftwareApplication/FAQ/Breadcrumb; marketing pages carry standard metadata. Dedicated API schema is a post-launch nice-to-have (not a blocker).                         |
| **SEO**              | ✅                            | Metadata + canonical on all new pages; indexable; API endpoints correctly noindex via robots.                                                                                            |
| **GA4**              | ⏳ instrumented, read pending | Events wired (`api_key_cta_click`, `get_started_click`, `contact_sales_click`, `lead_submitted`); no-op until `NEXT_PUBLIC_GA_ID` set. Read access is Gate-0 pending (`OBSERVATION.md`). |
| **Search Console**   | ⏳ pending                    | No `google-site-verification` meta yet; submit sitemap + verify post-deploy (backlog RS1 item).                                                                                          |
| **Error monitoring** | ⚠️ logs-only                  | Structured `console.log` JSON captured by Vercel; **no APM/Sentry** (see Known Limitations).                                                                                             |

---

## Launch Checklist (go-live steps — Founder-gated in bold)

1. ✅ Code merged to `main`, validate pipeline green, release tagged.
2. **⬜ Confirm the Vercel deploy actually shipped `main`** (compare deployed commit to `main` HEAD — the P0-1 rule).
3. **⬜ Set env vars in Vercel** (no code change): `RAPIDAPI_PROXY_SECRET`, `NEXT_PUBLIC_RAPIDAPI_URL`, `ESYTOL_API_KEYS` (optional, enterprise), `NEXT_PUBLIC_GA_ID` (if not set).
4. **⬜ Smoke-test production:** `GET /api/v1/health` → 200; `POST /api/v1/income-tax/calculate` (anon) → 200 with `X-Usage-Plan: free`; `/pricing`, `/enterprise`, `/developers/income-tax-api` load.
5. **⬜ Publish the RapidAPI listing** using `RapidApiListing.md` + logo; set the four plan names BASIC/PRO/ULTRA/MEGA + CUSTOM; capture real screenshots per `RapidApiScreenshots.md`.
6. **⬜ Verify the RapidAPI proxy path:** a RapidAPI test call carries `X-RapidAPI-Proxy-Secret` matching the env → returns the subscribed plan's limits.
7. **⬜ Submit sitemap to Search Console; add site-verification.**
8. **⬜ Announce** to the developer-community channels (`FirstCustomerPlaybook.md`).

---

## Rollback Plan

- **Trigger:** a production regression on the public calculator/API, elevated 5xx on `/api/v1/*`, or a broken marketing page.
- **Primary rollback:** Vercel → **Instant Rollback** to the previous deployment (one click, ~seconds). No data migration exists, so rollback is stateless and safe.
- **Config rollback:** the paid path is entirely env-gated — **unset `RAPIDAPI_PROXY_SECRET`** and RapidAPI headers are ignored (all callers fall back to the public Free tier); **unset `ESYTOL_API_KEYS`** and direct keys disable. No redeploy required to neutralize the productization.
- **Blast radius:** minimal — anonymous/free behavior is unchanged from pre-sprint, so a rollback of the API layer cannot break existing calculator users.
- **Verify after rollback:** `GET /api/v1/health` 200 + a sample `calculate` 200.

## Deployment Plan

- **Platform:** Vercel, repo `EasyTechLabs/esytol`, branch `main`, `next build`. No `vercel.json`; deploy is via the Vercel↔GitHub integration.
- **Steps:** merge to `main` → Vercel auto-build → **manually confirm the deployed commit == `main` HEAD** (P0-1 guard) → set env vars → smoke-test (Launch Checklist #4) → publish RapidAPI listing.
- **Zero-downtime:** additive routes + env-gated features; no schema/state changes; safe to deploy anytime.
- **DNS/HTTPS:** unchanged (`esytol.com` + `www`, Vercel-managed TLS).

## Monitoring Plan

- **The four metrics + sources:** see [MeasurementPlan.md](MeasurementPlan.md) (RapidAPI dashboard = authoritative usage/billing; our `/api/v1/usage` + billing logs = per-instance real counts; GA events = conversion intent; leads via `/api/v1/contact`).
- **Health:** `GET /api/v1/health` (liveness) + `GET /api/v1/ready` (runs a real compute, 503 on engine failure) — wire an uptime pinger.
- **Logs:** Vercel captures the structured JSON lines (`service:"income-tax-api"`, `kind:"billing"`, `service:"esytol-leads"`). No income/PII is logged.
- **First-payment tripwire:** the first RapidAPI subscription (any tier) — watch the RapidAPI dashboard.

## Known Limitations (stated honestly)

1. **No APM/error monitoring (Sentry).** Errors are visible only via Vercel structured logs. _Adding Sentry is post-launch (a feature, deferred by the freeze)._
2. **Usage meter is per-serverless-instance, in-memory.** Best-effort local telemetry; **RapidAPI is the authoritative meter + billing**. Exact global direct-billing needs a durable KV/Redis meter (seam ready).
3. **Rate limiter is per-instance** (documented in `rateLimit.ts`) — best-effort, not a global quota; RapidAPI enforces marketplace quotas.
4. **GA read access is Gate-0 pending** — conversion events are emitted but not yet readable by us.
5. **Pricing is a hypothesis** (`IncomeTaxApiPricing.md`) — to be corrected by real conversion data.
6. **Engine scope:** resident individuals below 60; excludes capital-gains special rates and firms/companies (Enterprise covers custom regimes).
7. **Live-deploy verification is manual** (P0-1) — a green build/push is permission to attempt a deploy, not proof of one.

## Support Plan

- **Free/Basic + Pro/Ultra/Mega:** support via **RapidAPI** (comments/support tab) + the public docs + live playground. Email support is a Pro+ feature (route to a monitored inbox).
- **Enterprise:** `/enterprise` → `POST /api/v1/contact` (type `enterprise`) → lead logged → **respond within one business day** (manual today; CRM/email adapter is the swap-in in `lib/api/leads.ts`).
- **Incidents:** health/ready endpoints + Vercel logs + Instant Rollback; escalation per `docs/IncomeTaxApiRunbook.md`.
- **Status/SLA:** no formal status page yet (post-launch); Enterprise SLAs are per-contract.
