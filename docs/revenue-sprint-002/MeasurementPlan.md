# Measurement Plan — Growth Sprint 002

> **Rule honored:** never invent a metric. Every number below has a **real source**; where a source is not yet
> connected, the value is **unknown**, not estimated.

## The four required metrics → their authoritative source

| Metric          | Authoritative source                        | Secondary / our-side source                                                      | Status                                                                                    |
| --------------- | ------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **API signups** | RapidAPI dashboard (subscriptions per plan) | GA event `api_key_cta_click` (intent, not signup)                                | RapidAPI: after listing goes live. GA: live once Gate-0 GA read access + a GA id are set. |
| **API usage**   | RapidAPI analytics (global, authoritative)  | `GET /api/v1/usage` + billing logs (`kind:"billing"`) — real per-instance counts | Our-side: **live now** (metering wired). RapidAPI: after launch.                          |
| **Conversions** | RapidAPI (free→paid upgrades)               | GA funnel: `get_started_click` → `api_key_cta_click`; `lead_submitted`           | Computed from the above once both connected.                                              |
| **Revenue**     | RapidAPI payouts (the billing rail)         | Enterprise: `POST /api/v1/contact` leads → closed deals (manual)                 | RapidAPI: after first subscriber. **₹0 today (honest).**                                  |

## What is instrumented in code this sprint (real, not invented)

- **Usage metering** (`lib/api/metering.ts`) — every `/calculate` call increments a real per-principal, per-month
  counter and emits a structured billing event (`lib/api/billing.ts`, `kind:"billing"`), captured by Vercel logs.
  Exposed at `GET /api/v1/usage` and in `X-Usage-*` response headers.
- **Conversion events** (GA, `analytics/`) — `get_started_click`, `api_key_cta_click`, `contact_sales_click`,
  `lead_submitted`. These are **no-ops until a GA id is configured** — they never fabricate data.
- **Lead capture** (`lib/api/leads.ts`, `POST /api/v1/contact`) — durably logs enterprise/sales/api-key intent.

## Honest limitations (stated, per the rules)

1. **Our meter is per-serverless-instance and in-memory** — best-effort local telemetry, not the system of record.
   The authoritative meters are **RapidAPI** (marketplace) and the **structured logs**. A durable KV/Redis meter is
   the swap-in when direct (off-marketplace) billing needs exact global counts.
2. **GA analytics read access is Gate-0 pending** (see `OBSERVATION.md`) — until granted, conversion events are
   emitted but not readable by us. This is the #1 backlog item from Revenue Sprint 001.
3. **Revenue is ₹0 today** and will remain reported as ₹0 until RapidAPI records a real payout. No projection is
   presented as actual.

## First-customer tripwires (what a real signal looks like)

- **First RapidAPI subscription** (any tier) → the price point is at least viable; note the tier.
- **First `lead_submitted` of type `enterprise`** → an off-marketplace/enterprise conversation to run manually.
- **Usage climbing on a keyed principal past its included quota** (`quota_exceeded` billing events) → an upgrade
  conversation or overage revenue.
