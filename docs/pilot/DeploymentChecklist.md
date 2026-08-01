# Production Deployment Checklist

> Run top to bottom for every deploy that merchants will receive. Sections A–C are the machine;
> section D is a real phone and cannot be skipped.

---

## A. Before pushing

- [ ] `SW_VERSION` in `public/vyora/sw.js` **bumped** — if you forget, no merchant is ever offered
      the update _(KnownIssues L2)_
- [ ] `APP_VERSION` in `lib/vyora/settings.ts` matches the release
- [ ] `BUILD_DATE` updated
- [ ] `npm ci` — clean install from the lockfile
- [ ] `npm run type-check` — clean
- [ ] `npm run lint` — clean
- [ ] `npx prettier --check "lib/vyora/**" "features/vyora/**" "tests/vyora/**" "app/vyora/**" "public/vyora/**"` — clean
- [ ] `npx vitest run tests/vyora` — **all pass** _(390 at RC1)_
- [ ] `npx vitest run tests/lib/emi.test.ts` — passes in isolation _(known parallel-run flake, M4)_
- [ ] `npm run build` — compiles
- [ ] `npm audit --omit=dev` — reviewed; no **new** advisories since the last deploy

## B. Manifest and icons

- [ ] `public/vyora/manifest.webmanifest` parses
- [ ] `start_url` = `/vyora`, `scope` = `/vyora/`
- [ ] `display` = `standalone`, `orientation` = `portrait`
- [ ] `theme_color` `#2563eb` matches `app/vyora/layout.tsx`
- [ ] Icons resolve: `icon.svg`, `icon-maskable.svg`, `/icon-192.png`, `/icon-512.png`
- [ ] **PNG icons are Vyora's, not esytol's** _(KnownIssues C2 — open)_
- [ ] `app/layout.tsx` still has **no** manifest link — Vyora's PWA must not leak to the rest of esytol
- [ ] `public/sw.js` does **not** exist at the origin root

## C. After deploying

- [ ] Site serves over **HTTPS** (automatic on Vercel; service workers require it)
- [ ] `/vyora/manifest.webmanifest` returns 200
- [ ] `/vyora/sw.js` returns 200
- [ ] `/vyora/offline.html` returns 200
- [ ] All ten routes load: `/vyora`, `/credit`, `/payment`, `/parties`, `/parties/[id]`,
      `/recovery`, `/closing`, `/settings`, `/founder`, `/more`
- [ ] Other esytol tools still work — confirm the service worker did not escape its scope

## D. On a real phone — required, not optional

Use a phone that has never had Vyora installed.

**Install**

- [ ] `esytol.com/vyora` loads
- [ ] Install banner appears → install succeeds
- [ ] Home-screen icon is the **Vyora** mark
- [ ] Opening from the icon shows **no address bar**
- [ ] Settings → **App installed: Yes**, **Offline ready: Yes**, correct **version** and **service worker**

**Core workflows**

- [ ] Record a credit with a due-date chip — preview shows the right date and weekday
- [ ] Record a payment — balance updates on Home
- [ ] **Chase** ranks correctly, phone dials, message generates, share sheet opens
- [ ] **Statement** shows issued, due and remaining days
- [ ] **Closing** figures match what was entered; **Finish today** works
- [ ] Long-press a contact → sheet appears; scrolling does **not** trigger it
- [ ] **Founder Mode** opens (tap "Alpha" ×5); **integrity: all passed**

**Data safety**

- [ ] Settings → **Export ledger** downloads a real file
- [ ] Restore that file on a second phone — preview counts match, restore completes
- [ ] Danger zone requires typing `DELETE`

**Offline**

- [ ] Airplane mode → close → reopen from icon → **app opens, data intact**
- [ ] Record a credit offline — succeeds
- [ ] **No browser error page appears at any point**

**Update**

- [ ] Deploy again with a bumped `SW_VERSION` → _"New version available"_ banner appears
- [ ] Tapping **Reload** applies it; nothing refreshes on its own

## E. Security

- [ ] No secrets in the repository or in `public/`
- [ ] No telemetry, analytics, or third-party scripts inside `/vyora`
- [ ] No network call transmits ledger data — the only `fetch` is the service worker proxying navigation
- [ ] Exactly four storage keys: `vyora.events.v2`, `vyora.alpha.v1`, `vyora.settings.v1`, `vyora.pwa.v1`
- [ ] No login, account, or cloud dependency anywhere

## F. Sign-off

- [ ] `KnownIssues.md` updated with anything found here
- [ ] `PilotDecision.md` re-evaluated if a Critical issue was found
- [ ] Deploy recorded: date, commit, version, who ran section D, on which devices
