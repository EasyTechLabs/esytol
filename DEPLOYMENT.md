# Deployment Guide — Esytol

This document describes how to deploy **Esytol** to production. The app is a
statically-generated **Next.js 15 (App Router)** site and is optimised for
**Vercel**, but it runs on any Node ≥ 20 host or container.

- **Framework:** Next.js 15 · React 19 · TypeScript (strict)
- **Rendering:** Mostly static (SSG). `/tools` is server-rendered on demand to
  power search; everything else is prerendered.
- **Runtime data:** None. Every calculator runs 100% in the browser; there is no
  database, no API, and no server-side secrets.

---

## 0. Definition of "Shipped" (release policy)

**A local commit is not a release.** The canonical Release & Deployment Policy lives in the
ProductFactory (`easytech-workspace/ProductFactory/Knowledge/Workflows/ReleaseWorkflow.md`) and
governs every sprint. In short, the pipeline is:

```
Build → Tests → Commit → Push → GitHub → CI → Deployment → Production Verification → Shipped
```

A change is **SHIPPED** only when **all** of these are true — otherwise it is **NOT SHIPPED**:

1. Working tree clean · commit created · **pushed** · `origin/main` contains it (ahead 0 / behind 0)
2. CI green · **deployment succeeded** · the **production URL** serves the change
3. **Production verified** against the live public URL (§9 Post-Deploy Checklist), evidence recorded

`git add` / `git commit` / `git push` are the normal, authorized close of every sprint. **If a
deployment fails, the work remains INCOMPLETE** — inspect the Vercel status/logs, fix, redeploy,
and re-verify. A green build + clean push + `ahead 0 / behind 0` are _permission to attempt a
deploy, never evidence of one_ (see the P0-1 incident, §10).

---

## 1. Prerequisites

| Requirement | Version                                        |
| ----------- | ---------------------------------------------- |
| Node.js     | ≥ 20 (pinned via `engines` in `package.json`)  |
| npm         | ≥ 10 (bundled lockfile is `package-lock.json`) |
| Git         | any recent                                     |

Install and validate locally before deploying:

```bash
npm ci             # clean, lockfile-exact install
npm run validate   # type-check → lint → format:check → test → build
```

`npm run validate` is the single command that must pass before any deploy. It
mirrors the CI pipeline in `.github/workflows/ci.yml`.

---

## 2. Environment Variables

Public configuration uses `NEXT_PUBLIC_*` variables. **Server-side secrets exist
since GROWTH-010/P0-2** — the Growth-Dashboard provider credentials and the
`ADMIN_USER`/`ADMIN_PASSWORD` pair that gates `/admin` (fail-closed: while unset,
`/admin` returns 401 for everyone). Set secrets only in the deployment
environment; a template lives in [`.env.example`](.env.example).

| Variable                 | Required        | Default (if unset)           | Purpose                                                                                                                                   |
| ------------------------ | --------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`   | **Recommended** | `https://esytol.com`         | Absolute base URL. Drives canonical URLs, the sitemap, `robots.txt`, and OpenGraph/Twitter tags. **Set this to the production domain.**   |
| `NEXT_PUBLIC_SITE_NAME`  | Optional        | `Esytol`                     | Reserved for display/branding overrides. Informational today.                                                                             |
| `NEXT_PUBLIC_GA_ID`      | Optional        | _(empty → GA disabled)_      | Google Analytics 4 measurement ID (`G-XXXXXXXXXX`). GA4 loads only when set. Its CSP domains are already allowlisted in `next.config.ts`. |
| `NEXT_PUBLIC_CLARITY_ID` | Optional        | _(empty → Clarity disabled)_ | Microsoft Clarity project ID. Clarity loads only when set. Its CSP domains are already allowlisted in `next.config.ts`.                   |
| `NEXT_PUBLIC_ADSENSE_ID` | Optional        | _(empty → ads disabled)_     | AdSense publisher ID. Leave **empty**. Ads are not implemented.                                                                           |

> For a clean launch, set **only** `NEXT_PUBLIC_SITE_URL=https://esytol.com`.
> Analytics (`GA`, `CLARITY`) and `ADSENSE` are optional and ship disabled.

### Microsoft Clarity setup

Clarity (heatmaps + session replay) is integrated via the same env-gated
`<Analytics />` loader as GA4, and its domains are already in the CSP.

1. Create a project at https://clarity.microsoft.com and copy the **Project ID**
   (e.g. `xhjydf0y97`).
2. Vercel → **Project → Settings → Environment Variables** → add
   `NEXT_PUBLIC_CLARITY_ID` = your project ID for **Production**.
3. **Redeploy** (public env vars are inlined at build time), then confirm
   sessions appear in the Clarity dashboard.

See [`docs/MicrosoftClarity.md`](docs/MicrosoftClarity.md) for details.

### Local setup

```bash
cp .env.example .env.local
# edit .env.local — for local dev the default http://localhost:3000 is fine
```

`.env.local` is git-ignored and must never be committed.

---

## 3. Vercel Deployment (recommended)

### First-time setup

1. Push the repository to GitHub (already at
   `github.com/EasyTechLabs/esytol`, branch `main`).
2. In the Vercel dashboard → **Add New → Project → Import** the `esytol` repo.
3. Vercel auto-detects Next.js. Confirm the build settings:
   - **Framework preset:** Next.js
   - **Build command:** `next build` (default; `npm run build`)
   - **Output:** `.next` (managed by Vercel — do not override)
   - **Install command:** `npm ci`
   - **Node version:** 20.x (honoured from `engines`)
4. **Environment Variables** → add `NEXT_PUBLIC_SITE_URL=https://esytol.com`
   for the **Production** environment (and a preview value if desired).
5. **Deploy.** The first production deploy builds and serves automatically.

### How rendering maps to Vercel

- Static pages (`/`, all `/tools/<calculator>`, legal pages) are served from
  Vercel's edge CDN.
- `/tools` (search) is a Next.js server function invoked on demand.
- `robots.txt`, `sitemap.xml`, and `manifest.webmanifest` are generated by
  Next.js metadata routes and served automatically.

### Security headers

Baseline security headers are defined in
[`next.config.ts`](next.config.ts) via `headers()` and apply to every route:
`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy`, and `Strict-Transport-Security`. They
are verified to be present in `next start` output. **If analytics/ads are ever
enabled, update the CSP** to allow the provider's domains before deploying.

---

## 4. DNS & Domain Connection

1. In Vercel → **Project → Settings → Domains → Add** `esytol.com`
   (and `www.esytol.com`).
2. Vercel shows the exact records to create at your DNS registrar. Typical setup:

   | Type    | Host / Name             | Value                  | Notes                                            |
   | ------- | ----------------------- | ---------------------- | ------------------------------------------------ |
   | `A`     | `@` (apex `esytol.com`) | `76.76.21.21`          | Vercel's apex IP (use the value Vercel displays) |
   | `CNAME` | `www`                   | `cname.vercel-dns.com` | Redirects `www` → apex                           |

   > Prefer the **A record for the apex** and a **CNAME for `www`**. If your
   > registrar supports it, an apex `ALIAS`/`ANAME` to `cname.vercel-dns.com`
   > also works.

3. Choose the **primary** domain in Vercel (e.g. redirect `www` → apex, or
   vice-versa) so canonical URLs stay consistent with `NEXT_PUBLIC_SITE_URL`.
4. DNS propagation is usually minutes but can take up to 24–48h.

---

## 5. HTTPS

- **Automatic.** Vercel provisions and renews **Let's Encrypt** TLS
  certificates for every added domain — no configuration needed.
- HTTP is redirected to HTTPS automatically.
- The app sends `Strict-Transport-Security` (HSTS, 2 years, `includeSubDomains`,
  `preload`) and the CSP includes `upgrade-insecure-requests`. Only submit the
  domain to the [HSTS preload list](https://hstspreload.org/) once you are
  confident all subdomains will always be HTTPS.

---

## 6. Production Build & Start (self-hosting / verification)

To run the exact production server locally or on a Node/container host:

```bash
npm ci
npm run build      # produces the optimized .next output
npm run start      # serves the production build (default port 3000)
# custom port:
npx next start -p 8080
```

Verified locally: all routes return `200`, security headers are present, and the
sitemap emits absolute `https://esytol.com` URLs.

### Docker (optional)

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV NEXT_PUBLIC_SITE_URL=https://esytol.com
RUN npm run build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
CMD ["npm", "run", "start"]
```

---

## 7. Rollback

**Vercel (instant):**

1. Vercel → **Project → Deployments**.
2. Find the last known-good deployment.
3. **⋯ → Promote to Production** (or **Rollback**). Traffic switches
   immediately — no rebuild required.

**Git-based:**

```bash
# revert the offending commit and let CI/Vercel redeploy
git revert <bad_commit_sha>
git push origin main
```

> Do **not** force-push or rewrite `main` history to roll back — use a revert
> commit or Vercel's instant promote, both of which are safe and auditable.

---

## 8. Cache Invalidation

- **New deploys bust caches automatically.** Next.js fingerprints every static
  asset (`/_next/static/**` with content hashes), so a new build serves new
  URLs and the CDN never serves stale JS/CSS.
- **HTML / metadata routes** (`/`, tools, `sitemap.xml`, `robots.txt`) are
  re-served fresh on each deploy from the new build.
- **Force a CDN purge (rare):** Vercel → **Project → Settings → Data Cache /
  Purge Everything**, or simply **redeploy** (Deployments → ⋯ → Redeploy).
- **Client-side:** a hard refresh (`Ctrl/Cmd+Shift+R`) clears a user's local
  copy if needed; normally unnecessary because of content hashing.
- **`robots.txt` / `sitemap.xml`:** regenerated every deploy. After a domain
  change, resubmit the sitemap in Google Search Console.

---

## 9. Post-Deploy Checklist

- [ ] `NEXT_PUBLIC_SITE_URL` set to the production domain in Vercel.
- [ ] `https://esytol.com` loads; `http://` and `www` redirect correctly.
- [ ] `https://esytol.com/robots.txt` and `/sitemap.xml` return the production
      domain (no `localhost`).
- [ ] Security headers present (`curl -I https://esytol.com`).
- [ ] Spot-check a calculator (e.g. `/tools/emi-calculator`): results, charts,
      CSV download, and the financial disclaimer all render.
- [ ] Search works (`/tools?q=emi`).
- [ ] Submit `sitemap.xml` to Google Search Console.
- [ ] `hello@esytol.com` mailbox is live (referenced on the Contact page).

---

## 10. Notes & Out of Scope

- **Analytics & Ads are intentionally not implemented.** The `NEXT_PUBLIC_GA_ID`
  / `NEXT_PUBLIC_ADSENSE_ID` variables exist but ship empty (inactive).
- **Known low-severity item:** `npm audit` reports 2 moderate advisories in
  Next's build-time `postcss` toolchain. There is no safe patch (the only fix
  downgrades Next to v9); it is build-time only and not runtime-reachable.
  Resolve by upgrading Next when a patched release is available.
- **Optional polish before/after launch:** replace the placeholder
  `public/og-default.png` and `app/favicon.ico` with final brand assets.

---

## 10. Incident P0-1 — deployments silently stopped (2026-07)

Between 2026-07-07 and 2026-07-17 production served commit `f3cbb0a` (GROWTH-011)
while `main` advanced five sprints to `8f596cf`. Every push after 2026-07-07
produced **no deployment**, and nothing in the local pipeline could tell: git sync
was clean, CI was green, and the (since corrected) deployment workflow never
fetched the live URL.

Evidence gathered during recovery: the CDN cache for `/` dated to ~3 minutes after
GROWTH-011's push (auto-deploy worked at that point); `npm ci --dry-run` clean
(lockfile in sync, so builds were not failing on install); no `vercel.json`, no
local Vercel link, no CI-driven deploy — deployment depends entirely on the
Vercel↔GitHub integration, which is only inspectable from the Vercel dashboard.

**Standing rule (from `ProductFactory/Execution`):** a deployment exists only when
`forge execution production verify` passes against the public URL. Git sync and a
green build are _permission to attempt_ a deployment, never evidence of one.
