# Income Tax API — Operational Runbook

> **Purpose:** How to operate the Income Tax API once it is live on the marketplace — support,
> versioning, deprecation, incidents, and keeping the listing in sync.
> **Status:** Operational reference · **Last Updated:** 2026-07-18
> **Related:** [Launch Guide](IncomeTaxApiMarketplaceLaunch.md) · [Launch Checklist](IncomeTaxApiLaunchChecklist.md) · [Developer Guide](IncomeTaxApiGuide.md) · [Changelog](IncomeTaxChangelog.md)

---

## 1. Support process

- **Channels:** the marketplace's own support thread, `https://www.esytol.com/contact`, and email
  `easytechmarketingpvtltd@gmail.com` (optionally a `support@esytol.com` alias for the listing).
- **Triage:** ask the reporter for the **`X-Request-Id`** from the response headers — it appears in
  the structured logs and lets you find the exact request (metadata only; **incomes are never logged**).
- **First response target:** best-effort, within one business day at launch scale. No paid SLA
  is offered on the free tier; do not promise one until there is a support-load reason to.
- **Common questions → the fix:** see the troubleshooting list in the
  [Launch Guide](IncomeTaxApiMarketplaceLaunch.md#common-mistakes--the-fix-troubleshooting) and the
  listing FAQ. Most tickets are request-shape mistakes (`income.salary` nesting, AY format, POST-only).

## 2. Version policy

- **Transport version** is in the URL: `/api/v1`. Breaking changes to the request/response contract
  ship as `/api/v2`; **v1 keeps working** — the two coexist (that was the point of URL versioning).
- **Engine version** (`engineVersion`, e.g. `2.0.0`) is returned in every response and at
  `GET /api/v1/version`. Rule-content changes (a new Finance Act year, corrected rates) are **engine**
  changes, not transport changes: they bump the engine version and add an assessment year; the API
  contract is unchanged, so consumers are not broken.
- **Never silently change a computed number** for an existing assessment year. A correction is a
  changelog entry (§ and reason) and, if material, a support notice.

## 3. Deprecation policy

- Nothing is deprecated at launch. If a future `/api/v2` supersedes `/api/v1`:
  - Announce in the [changelog](IncomeTaxChangelog.md) and on the marketplace listing.
  - Keep v1 live for a **stated minimum window** (propose **6 months**) after v2 is stable.
  - Add a `Deprecation`/`Sunset` note in the docs (and optionally response headers) before removal.
- An **assessment year** is retired only if the law makes it irrelevant; supported years are always
  discoverable at `GET /api/v1/version`, so a consumer can detect the set programmatically.

## 4. Incident response

**Detection:** marketplace error-rate alerts, a spike in `/contact` tickets, or a failing probe.

| Symptom                         | First check                                              | Likely cause              | Action                                                                             |
| ------------------------------- | -------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------- |
| 5xx / all calls failing         | `GET /api/v1/health`, Vercel deploy status               | bad deploy                | roll back the Vercel deployment to the last good commit                            |
| `/ready` fails but `/health` ok | `GET /api/v1/ready`                                      | engine can't compute      | investigate the engine; the last green commit is the safe target                   |
| Widespread 429                  | `X-RateLimit-*` on samples                               | limiter too tight / abuse | inspect; if legitimate load, raise `DEFAULT_RATE_LIMIT` (config)                   |
| Wrong tax number reported       | reproduce with the request-id input                      | rule/data error           | **highest priority** — fix engine, add a regression test, changelog the correction |
| Metering bypass suspected       | traffic hitting the origin directly, not via marketplace | proxy-secret off          | consider enabling the proxy-secret toggle (§6)                                     |

- **Rollback is the default mitigation** — push main → Vercel auto-deploys; roll back via the Vercel
  dashboard or by reverting the commit. Verify recovery with `forge execution production verify`.
- **Correctness incidents beat availability incidents.** A silently wrong tax figure is worse than a
  clean 5xx; treat a numeric error as P0 and communicate the correction.

## 5. Marketplace update procedure (keep the listing in sync)

When the engine or API changes:

1. Update `docs/IncomeTaxChangelog.md` (the source of truth).
2. Mirror the change into the listing's **Changelog summary** and, if the response shape or supported
   years changed, the **example** and **FAQ** in [IncomeTaxApiListing.md](IncomeTaxApiListing.md).
3. If a new assessment year was added, update the title/description year range and re-run check **C4**
   in the [Launch Checklist](IncomeTaxApiLaunchChecklist.md) (copy years == `GET /version`).
4. Re-import `/api/v1/openapi.json` on the marketplace if endpoint metadata changed.
5. Re-run the **onboarding smoke test** (Checklist §D) after any contract-visible change.
6. Update the ProductFactory sprint record + metrics.

## 6. The proxy-secret toggle (revenue protection — documented, not enabled)

The marketplace meters and bills by proxying calls to the origin. **Direct calls to
`https://www.esytol.com/api/v1/...` bypass that metering** (the API is public by design today).
A backend **auth seam already exists** (`apiKeyAuthenticator` in `lib/api/auth.ts`, swappable via
`authConfig`) that can require a shared proxy secret header so only marketplace-forwarded traffic is
served.

- **Status this sprint:** **left off** — enabling auth is EXPOSE-002 scope, not marketplace-launch
  scope, and turning it on would break the public playground and direct docs examples.
- **When to enable:** once there is paid volume worth protecting _and_ a decision to make the API
  marketplace-only. It is a **config flip on an existing seam**, not new architecture — do it as its
  own change, with the playground/docs impact handled.

## 7. Routine operations

- **Yearly:** when a new Finance Act lands, the engine adds the assessment year (engine change);
  then run the update procedure (§5). This is the main recurring maintenance.
- **On every engine/API commit:** `forge execution production verify` must pass; keep the changelog current.
- **Weekly at launch:** skim marketplace analytics and the `/contact` inbox; record nothing as a
  "target" — just observe against the [success metrics](IncomeTaxApiMarketplaceLaunch.md#part-7--launch-success-metrics-no-invented-targets).
