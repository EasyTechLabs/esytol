# Microsoft Clarity — Esytol

[Microsoft Clarity](https://clarity.microsoft.com) is a free, privacy-friendly
behavioural analytics tool: **heatmaps**, **session recordings**, and
frustration signals (rage clicks, dead clicks, excessive scrolling). It
complements GA4 (which tells you _what_) by showing _why_.

- Production site: **https://www.esytol.com**

## 1. Create a project

1. Sign in at https://clarity.microsoft.com with a Microsoft/Google account.
2. **Add new project** → name "Esytol", site URL `https://www.esytol.com`,
   category "Web app / Tools".
3. Copy the **Clarity project ID** (a short alphanumeric token) and the install
   snippet.

## 2. Install (choose one)

Clarity is a third-party script, so — like GA — it is blocked by the default
CSP until you allow its domains. There are two ways to add it:

### Option A — via Google Tag Manager (no code change)

If you set up GTM, add Clarity from the GTM template gallery (search "Microsoft
Clarity"), paste the project ID, publish. You still need the CSP change in
step 3.

### Option B — a small code addition (mirrors the GA loader)

Follow the same pattern as [`analytics/Analytics.tsx`](../analytics/Analytics.tsx):
gate a `next/script` block on a new env var (e.g. `NEXT_PUBLIC_CLARITY_ID`) and
mount it in `app/layout.tsx`. Keep it env-gated so it ships disabled by default.
This is a deliberate code change — implement it in its own PR, validate, and
deploy. (Not part of the docs-only setup.)

## 3. ⚠️ Update the Content-Security-Policy (required either way)

Add Clarity's domains to the `contentSecurityPolicy` in
[`next.config.ts`](../next.config.ts):

```
"script-src 'self' 'unsafe-inline' https://www.clarity.ms https://scripts.clarity.ms",
"connect-src 'self' https://*.clarity.ms https://c.clarity.ms",
"img-src 'self' data: blob: https://*.clarity.ms",
```

Deploy after editing. Without this, Clarity's script is blocked and no sessions
are recorded.

## 4. Verify

1. Visit `https://www.esytol.com` and click around a calculator.
2. Clarity dashboard → sessions appear within a few minutes.
3. DevTools → Network shows requests to `clarity.ms` with no CSP violations.

## 5. What to watch

- **Heatmaps** on the top calculators (EMI, Home Loan, SIP) — are inputs and the
  results/CSV/share controls being used? Are people missing the amortization
  table?
- **Recordings** filtered by rage/dead clicks — surface confusing UI.
- **Scroll depth** — is the FAQ / related-tools section reached?

## 6. Privacy

Clarity masks text/inputs by default. Because every calculator runs client-side
and Esytol collects no personal data, Clarity sees only anonymous interaction —
but it **does** set cookies, so keep the [Privacy Policy](../app/privacy/page.tsx)
in sync and gate it behind consent where required (EU/India).
