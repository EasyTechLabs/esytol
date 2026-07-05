# Google Analytics 4 — Esytol

Esytol ships **analytics-ready but disabled**. GA4 turns on only when the
`NEXT_PUBLIC_GA_ID` environment variable is set — no code change is required to
enable it, but you **must** also widen the Content-Security-Policy (see §3).

**How it works in the repo:**

- [`analytics/index.ts`](../analytics/index.ts) — reads `NEXT_PUBLIC_GA_ID`;
  `enabled` is `true` only when it is set.
- [`analytics/Analytics.tsx`](../analytics/Analytics.tsx) — renders `gtag.js`
  from `googletagmanager.com` **only when enabled**; otherwise renders nothing.
- Mounted once in [`app/layout.tsx`](../app/layout.tsx).
- `trackEvent(name, props)` / `trackPageView(path)` are no-ops until enabled.

## 1. Create a GA4 property

1. Go to https://analytics.google.com → **Admin → Create → Property**.
2. Name it "Esytol", set timezone/currency (India / INR).
3. Under the property → **Data Streams → Add stream → Web**.
4. Site URL: `https://www.esytol.com`, stream name "Esytol Web".

## 2. Get the Measurement ID

- In the web stream details, copy the **Measurement ID** — format `G-XXXXXXXXXX`.
- This is the value of `NEXT_PUBLIC_GA_ID`.

## 3. ⚠️ Update the Content-Security-Policy (required)

The default CSP in [`next.config.ts`](../next.config.ts) blocks external
scripts, so GA will be silently blocked until you allow Google's domains. Edit
the `contentSecurityPolicy` array:

```
"script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
"img-src 'self' data: blob: https://www.google-analytics.com",
"connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
```

Commit this change and deploy. Without it, GA loads nothing and Realtime stays
empty.

## 4. Set the Vercel environment variable

1. Vercel → **Project → Settings → Environment Variables**.
2. Add `NEXT_PUBLIC_GA_ID` = `G-XXXXXXXXXX` for the **Production** environment
   (and Preview if you want analytics on preview deploys).
3. **Redeploy** (env changes require a new build for `NEXT_PUBLIC_*` values to
   be inlined).

> Locally: add the same line to `.env.local` (git-ignored). GA also only fires
> in the browser, not during SSR/build.

## 5. Verify

1. Open `https://www.esytol.com` in a normal (non-adblock) browser.
2. GA4 → **Reports → Realtime** — you should appear within ~30s.
3. In DevTools → Network, confirm a request to
   `googletagmanager.com/gtag/js?id=G-…` and `collect` beacons to
   `google-analytics.com` (no CSP violations in the Console).
4. Use the [GA Debugger / DebugView](https://support.google.com/analytics/answer/7201382)
   for detailed event inspection.

## 6. Events

GA4 auto-collects **page_view**, **scroll**, **click** (outbound), and
**file_download** via Enhanced Measurement (enable it on the stream).

For product-specific events, call the existing helper from a client component
(no new dependency):

```ts
import { trackEvent } from "@/analytics";

// e.g. when a user downloads an amortization CSV
trackEvent("csv_download", { tool: "emi-calculator" });

// e.g. when a calculation completes
trackEvent("calculation", { tool: "sip-calculator" });
```

Recommended custom events to consider later: `csv_download`, `share_url`,
`copy_result`, `tool_view`. Mark the important ones as **Key events**
(conversions) in GA4 → Admin → Events.

## 7. Privacy note

Enabling GA changes what the [Privacy Policy](../app/privacy/page.tsx) already
anticipates (it documents Google Analytics + cookies). If you operate in the
EU/India under consent regimes, add a consent banner before loading GA and gate
`<Analytics />` on consent.
