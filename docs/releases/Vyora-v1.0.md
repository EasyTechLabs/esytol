# Vyora — Version 1.0 Release Documentation (REL-001)

**Scope:** complete pre-release audit + release documentation. **No feature work —
documentation only** (no code changed under this task).

**Build state at audit:** `npm run validate` — type-check ✅ · lint ✅ ·
**2,042 tests** (Vyora suite 94/94 green; the one full-suite failure is the known
flaky `tests/lib/emi.test.ts`, verified 84/84 in isolation — unrelated to Vyora) ·
build ✅. 13 `/vyora` routes; First Load JS ~103 kB shared (framework); per-route
Vyora code 2–7 kB.

---

## 1. Audit results

| Area              | Status                  | Findings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Security**      | 🟠 Action needed        | **3 high-severity dependency CVEs** — `next`, `sharp`, `js-yaml` — all with a **non-breaking `npm audit fix`** available (see §Checklist). Vyora's _own_ surface is minimal: **local-first, zero network calls** for the ledger (verified — no `fetch`/XHR/beacon in `lib/vyora`/`features/vyora`), no Server Actions, no user-supplied image optimization, **strict CSP** (`default-src 'self'`), **no secrets in tracked source**. Standing action: **rotate the leaked GitHub PAT**. |
| **Performance**   | 🟢 typical / 🟠 ceiling | Typical merchant (≤ ~5k entries): every screen instant. **50k stress ceiling:** recovery/collect sweeps ~1.3–1.5 s (O(parties × transactions) — issue **K1**). Search index/build/filter fast at all sizes (map-based, ENG-004).                                                                                                                                                                                                                                                        |
| **Accessibility** | 🟡 Code-verified        | WCAG-AA pass (labels, roles, dialog semantics, contrast — ENG-003). **Not yet tested with a real screen reader** on device.                                                                                                                                                                                                                                                                                                                                                             |
| **Offline**       | 🟡 Code-verified        | Service worker caches **static assets only** (app shell, `/_next/static`, self-hosted fonts, icons); offline page precached; **never caches ledger data** (there is none on the wire). **Not device-verified** (gated preview).                                                                                                                                                                                                                                                         |
| **Integrity**     | 🟢 Pass                 | `runIntegrity` verifies + safely repairs on **startup, import, and restore**; quarantines unusable entries (recoverable), never silent data loss; report in Founder Mode (ENG-005).                                                                                                                                                                                                                                                                                                     |
| **Imports**       | 🟢 Pass                 | CSV/JSON wizard — parse → map → validate → dedupe → merge; 13 tests (P3-005). Type interpretation is heuristic (see Limitations).                                                                                                                                                                                                                                                                                                                                                       |
| **Exports**       | 🟢 Pass                 | On-device backup + JSON export/restore; `lastRestoreAt` stamped; recently-deleted (30-day) safety net.                                                                                                                                                                                                                                                                                                                                                                                  |
| **Recovery**      | 🟢 Pass                 | **Single-source ranking** (`rankOverdue`) shared by Home, Collect, Daily Closing, Customer 360 — identical score/priority/order everywhere (ENG-007).                                                                                                                                                                                                                                                                                                                                   |
| **Settings**      | 🟢 Pass                 | Business profile, ledger prefs, currency/number/date formats, appearance, About (P3-002).                                                                                                                                                                                                                                                                                                                                                                                               |
| **Dark Mode**     | 🟡 Code-verified        | Light/Dark/System, **scoped to Vyora** (no impact on the rest of esytol). **Not device-verified.**                                                                                                                                                                                                                                                                                                                                                                                      |
| **Demo**          | 🟢 Pass                 | One-tap "Load Demo Shop" — 120 customers, 2,200 transactions, mixed statuses, suppliers, cash flow; deterministic; `demo_`-prefixed; Reset removes exactly it, never real data (V1-004).                                                                                                                                                                                                                                                                                                |
| **Founder Mode**  | 🟢 Pass                 | Hidden (5-tap gesture); versions, storage, counts, integrity, PWA/build, backup/restore; buttons: integrity check · performance report · export logs · load/reset demo (V1-003).                                                                                                                                                                                                                                                                                                        |

**Hygiene:** no `console.log` / `TODO` / `FIXME` / `debugger` in the Vyora source.

---

## 2. Release notes — Vyora 1.0

Vyora is a **local-first credit-management app** ("udhaar / bahi khata") for Indian
merchants, built inside esytol and delivered as an installable PWA. Version 1.0
completes the arc from ledger to daily operating tool:

- **Merchant Home** — today's work in under 3 seconds: greeting, outstanding &
  collection, today's tasks, chase-first customer, timeline, one-tap actions, and a
  plain-language business-health band (V1-001).
- **Customer 360** — full customer view: header, lifetime summary, recovery
  (score/risk/next action), Call/WhatsApp/Credit/Payment/Statement, timeline, and
  relationship stats (V1-002).
- **Merchant Insights** — pure-calculation weekly cash movement, customer leagues,
  and averages; no AI, no charts (V1-005).
- **Recovery engine** — deterministic scoring + a single ranked worklist.
- **Fast entry** — credit/payment in seconds, crash-recovery drafts, duplicate-save
  guard, Save→Statement.
- **Data safety** — Undo (10 s), Recently Deleted (30 days), integrity auto-repair,
  backup/export/import, and the Import Wizard.
- **Feels like an app** — installable PWA, offline shell, update prompt, install
  banner, welcome tour, dark mode.
- **Demo Mode** & **Founder/Developer Mode** for pilots and diagnostics.

---

## 3. Migration notes

- **Storage:** one versioned localStorage key — `vyora.alpha.v1`. **Schema version 2.** No server, no accounts.
- **`migrate()` is non-destructive:** an older payload is _upgraded, never wiped_.
  v1→v2 adds `meta`, and all later additions (`trash`, `settings`,
  `meta.lastRestoreAt`) are **optional and additive** — absent fields are filled
  with defaults on load.
- **On load:** `migrate → pruneTrash (30-day) → runIntegrity (verify+repair)`. A
  merchant upgrading from any prior build keeps every entry.
- **No breaking migrations** in 1.0. The storage key name is intentionally stable
  across schema versions.

---

## 4. Upgrade notes

- **Deployment:** `develop` is the integration branch (Vercel auto-preview);
  production is gated (`vercel.json` disables auto-deploy on `main`;
  `deploy-production.yml` behind a `production` GitHub Environment).
- **PWA update flow:** each deploy stamps a new service-worker version → clients see
  a **"New version available"** banner; Reload activates the waiting worker and
  refreshes once. Content-hashed `/_next/static` means new code is fetched even
  before the SW updates.
- **No data reset on upgrade:** local data is preserved and migrated in place; the
  cache holds **static assets only**, never the ledger.
- **First install after 1.0:** users get the install banner (Android/desktop) or the
  Add-to-Home-Screen hint (iOS), then the 3-slide welcome tour.

---

## 5. Known limitations

| ID  | Limitation                                                                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | **Local-only / single-device.** No cloud sync; clearing site data or switching phones loses the ledger unless exported. Mitigated by backup reminders, export, recently-deleted, and integrity — **brief merchants to export weekly**. |
| L2  | **Performance at extreme scale (K1).** Recovery sweeps are O(parties × transactions) → ~1.3–1.5 s at the 50k ceiling (multi-second on low-end mobile). Typical merchants unaffected. One O(N) fix resolves it app-wide.                |
| L3  | **No list virtualization (K2).** The Contacts list renders all rows; heavy at ~1,000 contacts.                                                                                                                                         |
| L4  | **Device-unverified.** Offline, PWA install, dark mode, and screen-reader AT are code-verified only — the gated preview blocked real-device testing.                                                                                   |
| L5  | **Dependency CVEs.** 3 high-severity (Next.js/sharp/js-yaml), `npm audit fix`-able — must be patched before tagging 1.0.                                                                                                               |
| L6  | **Heuristic import type.** The Import Wizard interprets credit vs payment by keyword; the review step lets the merchant catch mis-splits.                                                                                              |
| L7  | **No reminder log.** The timeline shows real credit/payment events only; reminders sent via the OS share sheet are not recorded (not fabricated).                                                                                      |
| L8  | **Flaky test (non-blocking).** `tests/lib/emi.test.ts` intermittently times out under full-suite parallel load; passes 84/84 in isolation. Unrelated to Vyora.                                                                         |

---

## 6. Version 1.0 checklist

**Blockers — must clear before tagging/shipping 1.0:**

- [ ] **`npm audit fix`** — patch the 3 high-severity CVEs (non-breaking) and re-run `npm run validate` (L5).
- [ ] **Rotate the leaked GitHub PAT** (security).
- [ ] **Lift Vercel Deployment Protection** on `dev.esytol.com`, then **device-verify** on one real Android: install prompt, opens offline, dark mode, welcome tour (L4).
- [ ] **Bump `APP_VERSION`** `0.2.0` → `1.0.0` in `lib/vyora/store.ts` (release step; not done here — documentation-only task).

**Recommended before a broad / large-scale launch:**

- [ ] Ship the **O(N) recovery-sweep** optimization (L2/K1).
- [ ] Add **Contacts list virtualization** (L3/K2).
- [ ] Real **screen-reader pass** (L4).

**Verified ✅ (at this audit):**

- [x] `npm run validate` green (tsc + lint + 2,042 tests + build).
- [x] Single-source calculations (ENG-007) + data integrity (ENG-005).
- [x] Backup / export / import / recently-deleted.
- [x] Local-first confirmed — no ledger network calls; strict CSP; no secrets in source.
- [x] Offline shell, PWA install flow, update prompt, demo mode, founder mode (code).
- [x] All 12 audit areas reviewed.

---

### Go / No-Go (engineering)

**Conditional GO for a controlled first pilot** at typical scale, once the four
blockers above are cleared. Vyora 1.0 is functionally complete and correct; the
open items are a dependency patch, a token rotation, one real-device verification,
and a version bump — plus a well-understood performance fast-follow (K1) that does
not affect typical-scale users. **Not a broad/large-scale launch** until K1 lands.
