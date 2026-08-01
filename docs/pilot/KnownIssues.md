# Known Issues — Vyora 1.0.0-rc1

> **Verified only.** Every entry below was observed during ENG-009, ENG-010 or V2-007 verification.
> Nothing here is speculation, and nothing known has been left out.
>
> Last verified: 2026-08-01 against build `1.0.0-rc1`.

---

## Critical — must close before onboarding merchants

### C1 — Vyora has never run on a real device

**Verified:** service workers do not run in the test environment (jsdom), and no browser was
available during any milestone. Install, offline startup, service-worker update, share sheet,
long-press and iOS safe areas are implemented and unit-tested where testable; **none is confirmed
working on hardware.**

**Impact:** the install and offline promises — the two things that make Vyora feel like an app —
are unproven. A pilot could fail on day one for a reason nobody has looked for.

**Workaround:** none. This must be tested, not worked around.

**To close:** run section B of `PilotChecklist.md` on one real Android phone and one iPhone.
Roughly 30 minutes.

**Status:** Open · **Owner:** Founder

### C2 — iOS installs show esytol's icon, not Vyora's

**Verified:** the manifest ships SVG icons. Chrome and Android accept them, including the maskable
variant; **iOS ignores SVG** and falls back to `/icon-192.png`, which is esytol's mark.

**Impact:** an iPhone merchant installs an app that does not look like the one you showed them.

**Workaround:** onboard Android merchants first.

**To close:** generate PNGs and point the manifest at them —

```bash
npx svgexport public/vyora/icon.svg public/vyora/icon-192.png 192:192
npx svgexport public/vyora/icon.svg public/vyora/icon-512.png 512:512
npx svgexport public/vyora/icon.svg public/vyora/apple-touch-icon.png 180:180
```

**Status:** Open · **Owner:** Engineering

---

## High

### H1 — Three high-severity CVEs in dependencies

**Verified:** `npm audit --omit=dev` reports 3 high, all reached through `next@15.5.22` →
`postcss`, `sharp` (libvips CVE-2026-33327/33328/35590/35591). `npm audit fix` cleared one; the rest
need `npm audit fix --force`, a Next major upgrade.

**Impact:** none demonstrated for Vyora. `sharp` is build-time image optimisation; Vyora ships no
user-supplied images. Listed because it is real and unfixed.

**Workaround:** none needed for the pilot.

**Status:** Open · **Owner:** Engineering · **Decision:** not upgrading Next during a release candidate

### H2 — Merchant preferences are not in the backup

**Verified by design and test:** business name, per-contact credit periods, favourites, recent
customers and day notes live in `vyora.settings.v1`, outside the ledger export.

**Impact:** a merchant restoring to a new phone gets their whole book back, but an empty shop name
(so reminder messages lose the signature) and no pins or defaults.

**Workaround:** after restoring, re-enter the business name in Settings. Tell them during onboarding.

**Status:** Open · **Owner:** Engineering

---

## Medium

### M1 — Long-press "Record credit / payment" does not pre-fill the customer

**Verified:** the sheet navigates with `?contact=`, but the capture screens do not read it.

**Impact:** the merchant retypes the name. Two seconds, not a blocker.

**Workaround:** type the name; it will match the existing customer.

**Status:** Open · **Owner:** Engineering

### M2 — "Accounts closed" in Daily Closing can over-count

**Verified:** it counts contacts at zero who received a payment today, and cannot distinguish an
account settled today from one already at zero when a small payment landed. Vyora does not allocate
payments to individual entries.

**Impact:** a Closing "win" may be flattering.

**Workaround:** treat it as indicative.

**Status:** Open · **Owner:** Engineering

### M3 — Coming-due figures are scheduled credit, not unpaid balances

**Verified:** Home and Closing sum the face value of credits by due date. A partly-settled credit
still shows in full, because payments are not allocated to entries.

**Impact:** "Due this week" reads higher than what is actually outstanding.

**Workaround:** the screen says so in its caption. Chase uses real balances and is correct.

**Status:** Open by design · **Owner:** Engineering

### M4 — `tests/lib/emi.test.ts` fails in the full test run

**Verified:** times out at ~61s against a 60s limit in the parallel run; **passes in isolation
(84/84 in 36s)**. Pre-existing esytol code, untouched by any Vyora work.

**Impact:** repository CI is red. No merchant impact.

**Workaround:** run `npx vitest run tests/lib/emi.test.ts` separately.

**Status:** Open · **Owner:** Engineering (esytol, not Vyora)

---

## Low

### L1 — Language and currency settings do nothing

**Verified:** both persist; there is no i18n layer and amounts always format as INR.

**Workaround:** do not show these fields to merchants.

**Status:** Open by design — Hindi is pilot-gated · **Owner:** Product

### L2 — Service-worker version is bumped by hand

**Verified:** `SW_VERSION` in `public/vyora/sw.js` is a constant. If a deploy does not bump it,
merchants are never offered the update banner.

**Workaround:** it is a line in `DeploymentChecklist.md`.

**Status:** Open · **Owner:** Engineering

### L3 — Deleting entries is slower than adding them

**Verified:** replay appends are O(E) after ENG-010; deletions re-filter, O(N) each. Measured
cold start at 20,000 entries is 22 ms, so this is invisible at any realistic size.

**Workaround:** none needed.

**Status:** Accepted · **Owner:** Engineering

---

## Fixed in RC1

**Silent write failure** — a quota-exhausted save returned `false` and was ignored while the merchant
read a success toast; the entry looked saved and vanished on reload. Now surfaced as
`STORAGE_FULL` with a merchant-facing message and no success confirmation. _(Found in V2-007
verification. This was the most dangerous defect in the product.)_

**Reminder tone type mismatch** — the Recovery screen's default "normal" tone did not type-check
against its own command. _(ENG-009.)_

**Golden Ledger contained no suppliers** — the test fixture claimed to cover payable contacts but
generated none, so "recovery never chases someone you owe" was passing vacuously. _(ENG-009.)_

**O(E²) cold start** — replay took 537 ms at 20,000 entries; now 0.49 ms. _(ENG-010.)_
