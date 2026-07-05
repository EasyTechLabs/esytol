# Microsoft Clarity — Esytol

[Microsoft Clarity](https://clarity.microsoft.com) is a free, privacy-friendly
behavioural analytics tool: **heatmaps**, **session recordings**, and
frustration signals (rage clicks, dead clicks, excessive scrolling). It
complements GA4 (which tells you _what_) by showing _why_.

Clarity is **already integrated** in the codebase, using the same env-gated
architecture as Google Analytics. It loads only when its environment variable is
set and ships **disabled by default** — no tracking ID is hardcoded.

- Production site: **https://www.esytol.com**
- Env var: **`NEXT_PUBLIC_CLARITY_ID`**
- Loader: [`analytics/Analytics.tsx`](../analytics/Analytics.tsx) (official
  Clarity bootstrap snippet, no third-party wrapper) + config in
  [`analytics/index.ts`](../analytics/index.ts), mounted once in
  [`app/layout.tsx`](../app/layout.tsx).
- CSP: the required Microsoft domains are **already allowlisted** in
  [`next.config.ts`](../next.config.ts) — no code change is needed to turn
  Clarity on.

## 1. Create a project

1. Sign in at https://clarity.microsoft.com with a Microsoft/Google account.
2. **Add new project** → name "Esytol", site URL `https://www.esytol.com`,
   category "Web app / Tools".
3. Copy the **Project ID** — a short alphanumeric token (example only:
   `xhjydf0y97`). This is the value of `NEXT_PUBLIC_CLARITY_ID`.

> Never hardcode the ID in the repo — it is read from the environment.

## 2. Enable it (no code change)

1. Vercel → **Project → Settings → Environment Variables**.
2. Add `NEXT_PUBLIC_CLARITY_ID` = your Project ID for the **Production**
   environment (and Preview if you want Clarity on preview deploys).
3. **Redeploy** — public (`NEXT_PUBLIC_*`) env vars are inlined at build time,
   so a new build is required.

Locally: add the same line to `.env.local` (git-ignored) and restart `npm run
dev`.

## 3. Content-Security-Policy (already done)

The default CSP blocks external scripts, so Clarity's domains are already
included in `next.config.ts`. No action needed. For reference, the minimum
Microsoft domains allowed are:

| Directive     | Domain                   | Why                                           |
| ------------- | ------------------------ | --------------------------------------------- |
| `script-src`  | `https://www.clarity.ms` | Loads the Clarity tag (`/tag/<id>`)           |
| `script-src`  | `https://c.clarity.ms`   | Session-recorder script CDN                   |
| `connect-src` | `https://*.clarity.ms`   | Recording/metric upload (regional collectors) |
| `connect-src` | `https://c.bing.com`     | Clarity/Microsoft telemetry & cookie sync     |

No other external hosts are permitted, so the policy stays strict.

## 4. Verify

1. Visit `https://www.esytol.com` and interact with a calculator.
2. In DevTools → **Network**, confirm a request to
   `https://www.clarity.ms/tag/<your-id>` and uploads to `*.clarity.ms`, with no
   **CSP violation** errors in the Console.
3. Clarity dashboard → sessions appear within a few minutes; heatmaps populate as
   traffic grows.

## 5. What to watch

- **Heatmaps** on the top calculators (EMI, Home Loan, SIP) — are inputs and the
  results / CSV / share controls being used? Is the amortization table reached?
- **Recordings** filtered by rage/dead clicks — surface confusing UI.
- **Scroll depth** — do users reach the FAQ / related-tools section?

## 6. Privacy

Clarity masks text and input values by default. Because every calculator runs
client-side and Esytol stores no personal data, Clarity sees only anonymous
interaction — but it **does** set cookies, which the
[Privacy Policy](../app/privacy/page.tsx) already anticipates. Where consent is
required (EU/India), gate `NEXT_PUBLIC_CLARITY_ID` behind a consent banner
before enabling.
