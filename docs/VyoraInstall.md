# Vyora Install & Offline (PWA)

> **Status:** ✅ Implemented (V2-005) · **Scoped to `/vyora/` — the rest of esytol is untouched** ·
> **No backend, no push, no telemetry** · **Last Updated:** 2026-08-01

- **Detection:** [`lib/vyora/pwa.ts`](../lib/vyora/pwa.ts) (pure)
- **Surfaces:** [`features/vyora/PwaSurfaces.tsx`](../features/vyora/PwaSurfaces.tsx)
- **Worker / manifest / offline page:** `public/vyora/`
- **Tests:** [`tests/vyora/pwa.test.ts`](../tests/vyora/pwa.test.ts)

---

## 1. The scope decision — read this first

**esytol hosts many tools on one origin.** A root-scoped service worker would begin intercepting
every one of them, and unregistering a bad worker from a live site is genuinely painful.

So the worker lives at **`/vyora/sw.js`**, which scopes it to `/vyora/` and nothing else. The
manifest is declared in `app/vyora/layout.tsx`, not the root layout. `app/layout.tsx` and
`public/sw.js` are untouched — asserted by test.

## 2. What the merchant gets

- **Install banner** — "Works offline · Private · No login · Opens instantly", with a real
  `beforeinstallprompt` on Android/desktop and Share → Add to Home Screen steps on iOS.
- **Offline** — the app opens with no signal. The ledger was always local, so **nothing degrades**;
  only the shell needed caching. A merchant never sees a browser error page.
- **Update** — "New version available · Reload". **Never automatic.** Losing a half-typed entry to a
  surprise refresh is worse than running yesterday's build for another minute.
- **First-run tutorial** — three pages (add a customer · record credit · recover money), shown once
  and never again once dismissed.

## 3. Detection is two checks, not one

`display-mode: standalone` covers Android and desktop; **`navigator.standalone` covers iOS**, which
shipped its flag years before the media query. Missing the second is why install banners keep
appearing inside installed iOS apps. Both are tested.

The banner only renders when it can actually lead somewhere: a real prompt exists, or the platform
is iOS where instructions _are_ the install. Once installed or dismissed, it never returns.

## 4. Where the flags live

PWA flags get their **own** localStorage key — not the ledger, not merchant settings. They are facts
about this browser, and they must survive **"clear all data"**: erasing the ledger should not make
the tutorial reappear as though the merchant were new.

Persistence goes through `store.ts` and is exposed on the provider, so no component touches storage
directly — the ARCH-003 boundary holds.

## 5. Known limitations

- **Icons are SVG, plus esytol's existing PNGs.** I cannot generate binary PNGs here. Chrome and
  Android accept the SVG (including maskable); **iOS ignores it** and will fall back to
  `/icon-192.png`, which is esytol's mark, not Vyora's. To fix properly:

  ```bash
  npx svgexport public/vyora/icon.svg public/vyora/icon-192.png 192:192
  npx svgexport public/vyora/icon.svg public/vyora/icon-512.png 512:512
  npx svgexport public/vyora/icon.svg public/vyora/apple-touch-icon.png 180:180
  ```

  then point the manifest and `appleWebApp` icon at them.

- **Service-worker version is manual.** `SW_VERSION` in `sw.js` must be bumped on each deploy or
  the update banner will not fire. A build-time stamp would need a build step, which is more
  architecture than this milestone allows.
- **The offline page is a static HTML file**, deliberately outside Next.js, so it renders from cache
  with nothing else available. It does not carry the app shell's styling.
- **First navigation must be online.** A merchant who has never opened Vyora cannot open it offline —
  there is nothing cached yet.
- **iOS gives no install prompt at all.** The instructions are the best any web app can do there.
- **Untested on a real device.** Service workers do not run in jsdom, so the tests cover detection,
  manifest correctness and worker _source_ guarantees. Install, offline and update behaviour need a
  real phone against the deployed build.

## 6. Deploy note

Service workers require HTTPS (or localhost). On Vercel that is automatic. After the first deploy,
verify on a phone: open `/vyora`, install, turn on airplane mode, reopen from the home-screen icon.
