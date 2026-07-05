# Launch Checklist — Esytol

The go-live runbook. Work top to bottom; each linked doc has the detailed steps.
Production URL: **https://www.esytol.com** (the apex `esytol.com` 308-redirects to
`www`).

> Deployment mechanics (Vercel, DNS, HTTPS, rollback, cache) live in
> [`../DEPLOYMENT.md`](../DEPLOYMENT.md).

## 0. Pre-flight (code & build)

- [ ] `npm run validate` passes locally (type-check → lint → format:check →
      test → build).
- [ ] `NEXT_PUBLIC_SITE_URL=https://www.esytol.com` set in Vercel **Production**.
- [ ] Latest `main` is deployed and green in Vercel.
- [ ] `curl -I https://www.esytol.com` returns `200` with all security headers.
- [ ] `https://esytol.com` and `http://` both 308-redirect to
      `https://www.esytol.com`.

## 1. Core assets & SEO sanity

- [ ] `https://www.esytol.com/robots.txt` resolves and points to the sitemap.
- [ ] `https://www.esytol.com/sitemap.xml` lists all live calculators, `/contact`,
      and only live categories (no `coming-soon`).
- [ ] Canonical, OpenGraph, and Twitter tags use the `www` domain.
- [ ] `manifest.webmanifest` and `favicon.ico` return `200`.
- [ ] Structured data present on tool pages (SoftwareApplication, Breadcrumb,
      FAQ) — validate with the [Rich Results Test](https://search.google.com/test/rich-results).
- [ ] Spot-check one calculator: results, charts, CSV download, financial
      disclaimer all render.

## 2. Search engines

- [ ] Google Search Console — verify domain, submit sitemap, request indexing.
      → [`SearchConsole.md`](SearchConsole.md)
- [ ] Bing Webmaster Tools — verify, submit sitemap.
      → [`BingWebmaster.md`](BingWebmaster.md)

## 3. Analytics & product insight

- [ ] Google Analytics 4 — create property, add `NEXT_PUBLIC_GA_ID` in Vercel,
      **update the CSP** to allow Google domains, verify realtime.
      → [`GoogleAnalytics.md`](GoogleAnalytics.md)
- [ ] Microsoft Clarity — heatmaps & session replay (optional but recommended).
      → [`MicrosoftClarity.md`](MicrosoftClarity.md)

## 4. Monetization (later, not at launch)

- [ ] AdSense readiness reviewed — do **not** apply until traffic + content
      thresholds are met. → [`AdSensePreparation.md`](AdSensePreparation.md)

## 5. Branding & contact

- [ ] Final `public/og-default.png` (1200×630) and `app/favicon.ico` in place.
- [ ] `hello@esytol.com` mailbox is live (linked on the Contact page).

## 6. Go / no-go

- [ ] All P0/P1 items above checked.
- [ ] Rollback plan understood ([`../DEPLOYMENT.md`](../DEPLOYMENT.md) §7).
- [ ] Hand off to the [Post-Launch Checklist](PostLaunchChecklist.md).

## Known non-blocking items

- `npm audit`: 2 moderate advisories in Next's build-time `postcss` — no safe
  patch (only fix downgrades Next); build-time only.
- Analytics/AdSense ship disabled by default (empty env vars).
