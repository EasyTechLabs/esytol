# AdSense Preparation — Esytol

This is a **readiness guide**, not an instruction to apply. Ads are intentionally
**not implemented** — `NEXT_PUBLIC_ADSENSE_ID` ships empty and no ad code runs.
Apply only when the thresholds below are comfortably met; a premature or failed
application slows re-review.

> Do not enable AdSense as part of launch. Grow traffic and content first.

## 1. AdSense program policies (the ones that bite)

- **Sufficient, original, high-value content.** Calculators + FAQs count, but
  the site must not feel thin or "under construction".
- **No placeholder / empty pages.** Already handled: coming-soon tools, empty
  categories, and `/blog` are `noindex` or hard-404, and hidden from listings.
- **Working navigation and no broken links.** Verified in production.
- **Required legal pages present and substantive** (see §2).
- **No prohibited content** (Esytol is clean — finance utilities).
- **Own the domain / can edit the site.** Yes (Vercel + GoDaddy).
- **YMYL care.** Finance is "Your Money or Your Life" — the per-calculator
  financial disclaimer and accurate, sourced formulas matter for approval and
  for ranking.

## 2. Required pages (all present ✅)

| Page             | Route      | Status                                                                            |
| ---------------- | ---------- | --------------------------------------------------------------------------------- |
| About            | `/about`   | Substantive (mission, engineering, accuracy, roadmap)                             |
| Contact          | `/contact` | Email `hello@esytol.com` + channels                                               |
| Privacy Policy   | `/privacy` | Cookies, analytics, **future AdSense disclosure**, third-party, retention, rights |
| Terms of Service | `/terms`   | Financial disclaimer, liability, jurisdiction                                     |

The Privacy Policy already contains an **"Advertising (future)"** section
describing third-party ad cookies — keep it and update the "Last updated" date
when ads actually go live.

## 3. Traffic & content expectations

AdSense has no official minimum, but realistic guidance before applying:

- **Content depth:** a solid set of genuinely useful pages (Esytol's 10
  calculators, each with unique FAQs, qualifies on quality — breadth helps).
- **Age & indexing:** site indexed in Google, ideally **1–3+ months** old with
  steady organic impressions in Search Console.
- **Traffic:** consistent organic visitors (a common informal bar is **~100+
  organic/day** trending up) from real search, not artificial.
- **Engagement:** low bounce on calculators, some returning users.

Use Search Console + GA4 to confirm real, growing organic traffic before
applying.

## 4. Common rejection reasons (and how Esytol avoids them)

| Rejection reason                     | Mitigation status                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| "Insufficient content" / low value   | Ship more calculators; keep FAQs rich; avoid thin pages                            |
| "Site under construction"            | Empty categories/tools are hidden + noindex/404 ✅                                 |
| "No/hard-to-find navigation"         | Header, footer, categories, search all work ✅                                     |
| Missing privacy policy / contact     | Both present and substantive ✅                                                    |
| Policy-violating / duplicate content | Original engines + copy; no scraping ✅                                            |
| Deceptive layout / accidental clicks | When adding ads, keep clear separation from controls; no ads inside inputs/results |
| Insufficient traffic                 | Grow via SEO first (§3)                                                            |

## 5. When you do apply

1. Confirm §2 pages + §3 traffic.
2. Create the AdSense account, add `www.esytol.com`, get the publisher ID
   (`ca-pub-…`).
3. Implement ad slots as a **separate, reviewed code change** (env-gated on
   `NEXT_PUBLIC_ADSENSE_ID`, mirroring the analytics pattern) and **allow
   AdSense domains in the CSP** in `next.config.ts`
   (`pagead2.googlesyndication.com`, `googleads.g.doubleclick.net`, etc.).
4. Place the verification snippet, submit for review, then add units after
   approval — never before.
5. Update the Privacy Policy "Last updated" date and confirm the advertising
   section is accurate.

Keep ad density low and never overlay calculator inputs/results — both for
policy compliance and UX.
