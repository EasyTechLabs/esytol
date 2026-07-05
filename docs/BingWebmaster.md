# Bing Webmaster Tools — Esytol

Bing (and by extension Yahoo, DuckDuckGo, and increasingly AI answer engines)
is worth 5 minutes of setup. Tools: https://www.bing.com/webmasters

- Production site: **https://www.esytol.com**
- Sitemap: **https://www.esytol.com/sitemap.xml**

## 1. Add the site

Two paths:

- **Import from Google Search Console (fastest).** If GSC is already verified
  ([`SearchConsole.md`](SearchConsole.md)), Bing → **Add site → Import from
  GSC** and authorize. It pulls verification and sitemaps automatically.
- **Add manually.** Enter `https://www.esytol.com`.

## 2. Verify (manual path)

Pick one:

| Method                    | Steps                                                              | Requires deploy? |
| ------------------------- | ------------------------------------------------------------------ | ---------------- |
| **DNS TXT (recommended)** | Add the `CNAME`/`TXT` record Bing shows at GoDaddy on `esytol.com` | No               |
| **XML file**              | Upload `BingSiteAuth.xml` to `public/` (served at site root)       | Yes              |
| **Meta tag**              | Add `<meta name="msvalidate.01" …>` to `app/layout.tsx` head       | Yes              |

Prefer DNS — no code change and survives redeploys.

## 3. Submit the sitemap

Bing → **Sitemaps → Submit sitemap** → `https://www.esytol.com/sitemap.xml`.

## 4. Useful features

- **URL Inspection** — check indexability of key pages.
- **Submit URLs** — Bing allows submitting URLs directly (larger daily quota
  than Google's "Request Indexing").
- **IndexNow** — Bing supports [IndexNow](https://www.indexnow.org/) for instant
  URL notifications. Optional; a static site rarely needs it, but it can speed up
  discovery after new calculators ship.
- **Crawl Control / Site Scan** — free on-page SEO audit; run it monthly.

## 5. Common issues

| Symptom                                    | Fix                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| Sitemap "Pending"/"Failed"                 | Confirm the sitemap URL loads and uses the `www` domain                        |
| Pages not indexed                          | Bing indexing is slower for new sites — be patient; ensure robots allows crawl |
| "Blocked by robots.txt" on `/api`,`/_next` | Expected — those are intentionally disallowed                                  |
| Verification fails                         | DNS not propagated yet — wait and retry                                        |
