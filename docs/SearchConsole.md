# Google Search Console — Esytol

Get Esytol indexed by Google and monitor its search performance.

- Console: https://search.google.com/search-console
- Production site: **https://www.esytol.com**
- Sitemap: **https://www.esytol.com/sitemap.xml**

## 1. Add the property

You can add either a **Domain** property (covers apex + `www` + all schemes) or
a **URL-prefix** property (a single origin). Recommended: **Domain property**
(`esytol.com`) so both the apex and `www` are covered.

## 2. Domain verification

**Domain property (DNS TXT) — recommended:**

1. In Search Console → **Add property → Domain** → enter `esytol.com`.
2. Copy the `TXT` record Google provides
   (e.g. `google-site-verification=…`).
3. Add it at your DNS registrar (GoDaddy) as a `TXT` record on the root
   (`@`/host `esytol.com`).
4. Wait for DNS propagation (minutes–hours), then click **Verify**.

**URL-prefix alternatives (if you use `https://www.esytol.com`):**

- **HTML tag** — add a `<meta name="google-site-verification" …>` to
  `app/layout.tsx` `<head>`. (Requires a small code change + deploy.)
- **HTML file** — upload the provided file to `public/`; it is served at the
  site root. (Requires a commit + deploy.)
- **Google Analytics / Tag Manager** — if GA4 is already installed
  (see [`GoogleAnalytics.md`](GoogleAnalytics.md)), verify via that connection.

> Prefer DNS verification — it needs no code change and survives redeploys.

## 3. Submit the sitemap

1. Search Console → **Sitemaps**.
2. Enter `sitemap.xml` and **Submit**.
3. Status should become **Success**; discovered URL count should match the live
   sitemap (all live calculators + core pages + `/contact` + the live category).

The sitemap already excludes `coming-soon` tools and empty categories, so only
indexable URLs are submitted.

## 4. URL Inspection

Use **URL Inspection** (top search bar) on key pages:

- `https://www.esytol.com/`
- `https://www.esytol.com/tools/emi-calculator`
- `https://www.esytol.com/tools/home-loan-calculator`

For each: confirm **URL is on Google** (after indexing), **Coverage: Submitted
and indexed**, mobile usable, and that the **canonical** Google picked matches
your declared canonical (the `www` URL).

## 5. Request indexing

For high-priority pages (homepage + top calculators):

1. URL Inspection → enter the URL → **Request Indexing**.
2. Google queues a crawl (usually hours–days). Don't spam — a few key URLs is
   enough; the sitemap handles the rest.

## 6. Common indexing issues

| Symptom                                    | Likely cause                          | Fix                                                                                |
| ------------------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------------- |
| "Discovered – currently not indexed"       | New/low-authority site; crawl budget  | Be patient; build internal links + backlinks; ensure fast load                     |
| "Crawled – currently not indexed"          | Thin/duplicate content                | Improve page depth (FAQs help); ensure unique titles/descriptions                  |
| "Excluded by 'noindex' tag"                | Page is intentionally `noindex`       | Expected for coming-soon tools, empty categories, `/blog` — no action              |
| "Alternate page with proper canonical tag" | Non-canonical variant (apex vs `www`) | Expected — apex redirects to `www`; canonical is `www`                             |
| "Soft 404"                                 | 200 status on a not-found page        | Fixed in code (`dynamicParams=false` → hard 404 for unknown slugs)                 |
| "Page with redirect"                       | Apex/`http` URLs                      | Expected — they 308 to `https://www.esytol.com`                                    |
| Sitemap "Couldn't fetch"                   | Wrong URL or blocked                  | Confirm `NEXT_PUBLIC_SITE_URL` is `https://www.esytol.com`; robots allows crawling |

## 7. Ongoing

- Check **Performance** weekly (impressions, clicks, average position, top
  queries) — see [`PostLaunchChecklist.md`](PostLaunchChecklist.md).
- After any domain/redirect change, **resubmit the sitemap**.
