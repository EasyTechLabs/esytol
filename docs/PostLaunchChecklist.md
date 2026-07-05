# Post-Launch Checklist — Esytol

Operating cadence after go-live. Most of this is monitoring; the site is static
and has no backend, so ops is light.

- Production: **https://www.esytol.com** · Hosting: **Vercel** · Source:
  **github.com/EasyTechLabs/esytol**

## Daily (first 2 weeks, then as needed)

- [ ] Site loads: `https://www.esytol.com` returns `200` (Vercel status green).
- [ ] Vercel **Deployments** — latest is "Ready", no failed builds.
- [ ] Vercel **Logs / Observability** — no spike in function errors on `/tools`
      (the only server-rendered route).
- [ ] GA4 **Realtime** shows traffic (once GA is enabled).
- [ ] Search Console — no new **Coverage** errors or manual actions.

## Weekly

- [ ] **Search Console → Performance**: impressions, clicks, avg position, top
      queries. Note which calculators are gaining.
- [ ] **Search Console → Pages**: indexed count trending up; investigate any
      "Crawled – not indexed".
- [ ] **GA4**: top pages, engagement, bounce, referral sources.
- [ ] **Clarity** (if enabled): review recordings with rage/dead clicks.
- [ ] Dependency/security: check GitHub Dependabot / `npm audit` for anything
      new (currently 2 known moderate build-time advisories).
- [ ] Uptime check passing (see Monitoring).

## Monthly

- [ ] Run **Lighthouse** (mobile + desktop) on the homepage and 2–3 calculators;
      log Core Web Vitals (LCP, INP, CLS).
- [ ] **Search Console → Core Web Vitals** and **Mobile Usability** reports —
      resolve any regressions.
- [ ] Review keyword opportunities from Search Console; refine titles/FAQs.
- [ ] Bing Webmaster site scan.
- [ ] Refresh `lastUpdated` on tools that changed; update legal "Last updated"
      dates if policies changed.
- [ ] Re-evaluate AdSense readiness against
      [`AdSensePreparation.md`](AdSensePreparation.md).
- [ ] `npm outdated` — plan safe dependency updates (esp. a Next release that
      clears the postcss advisory).

## SEO

- [ ] After adding a calculator: it appears in the sitemap automatically; submit
      its URL in Search Console + Bing to speed discovery.
- [ ] Keep each tool's FAQ and description unique and useful (E-E-A-T).
- [ ] Maintain internal linking (related tools, footer) — avoid orphan pages.
- [ ] Verify canonical/OG stay on `www`; never introduce `localhost` or apex
      canonicals.
- [ ] Build backlinks (finance blogs, communities) — the main lever for a new
      domain.

## Monitoring

- [ ] **Uptime**: add an external monitor (e.g. UptimeRobot / BetterStack) on
      `https://www.esytol.com/` and `/tools/emi-calculator`, alerting to email.
- [ ] **Vercel Analytics / Speed Insights** (optional) for real-user CWV.
- [ ] **Error visibility**: `app/error.tsx` logs to the console today; consider
      wiring an error reporter (e.g. Sentry) as a future, env-gated addition.
- [ ] **Search Console + Bing email alerts** enabled for coverage/manual
      actions.

## Backups

- [ ] **Source of truth is GitHub** — ensure `main` is always pushed (this
      repo's launch missions keep it synced). No database to back up.
- [ ] Confirm the GitHub repo has branch protection on `main` (optional) and
      that at least one maintainer has admin access.
- [ ] Vercel keeps every past deployment — **instant rollback** via **Promote to
      Production** (see [`../DEPLOYMENT.md`](../DEPLOYMENT.md) §7). No separate
      artifact backup needed.
- [ ] Export/note critical config off-repo: domain registrar (GoDaddy) login,
      Vercel project, and the values of any `NEXT_PUBLIC_*` env vars.

## Performance

- [ ] Keep First Load JS in check (baseline ~103 kB shared; calculators
      ~118–120 kB). Watch the build output after dependency changes.
- [ ] Recharts is code-split (`dynamic ssr:false`) so it loads only on
      calculator pages — keep it that way; consider a lighter chart lib if the
      bundle grows.
- [ ] Prefer static rendering; keep `/tools` the only dynamic route unless a new
      feature genuinely needs SSR.
- [ ] Images: keep using sized assets / `next/image`; no raw `<img>`.
- [ ] Re-run `npm run validate` before every deploy; CI enforces it on `main`.
