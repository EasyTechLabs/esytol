# Vyora — Pilot Readiness Report (PILOT-001)

**Objective:** prepare Vyora for its first merchant pilot.
**Nature of this document:** findings only — no features added, no code changed.
**Reviewer constraint (disclosed up front):** `dev.esytol.com` is behind Vercel
Deployment Protection and could not be opened, so this is a **code-level review plus
measured benchmarks**. Anything that can only be confirmed on a real device
(install prompt, offline behaviour, dark mode, screen-reader AT) is marked
**code-verified, not device-verified**.

---

## 1. Screen-by-screen review

| Screen        | Nav                           | Empty state            | Notes                                                                                                     |
| ------------- | ----------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------- |
| **Dashboard** | ✅ recovery-first landing     | ✅ "All caught up"     | Totals from one memoized sweep. **Slow at the 50k ceiling** (§3).                                         |
| **Contacts**  | ✅ FAB + search + filters     | ✅ Empty + CTA         | Renders **all rows, no virtualization** — heavy at 1000 contacts (§3). a11y strong (12 labels).           |
| **Collect**   | ✅                            | ✅ "All caught up"     | Overdue + open split correctly. Ranked via the single `rankOverdue`. **Slow at 50k** (§3).                |
| **Statement** | ✅ back + deep-link highlight | ✅ "Contact not found" | Outstanding = `partyNet` (single source). Month-grouped timeline, delete-contact with rich confirm.       |
| **Credit**    | ✅ Save→Statement             | n/a (form)             | Fast entry, draft crash-recovery, duplicate-save guard, default credit-days.                              |
| **Payment**   | ✅ Save→Statement             | n/a (form)             | Mode select, default mode, "Account settled" at zero.                                                     |
| **Settings**  | ✅                            | ✅ nothing-deleted     | Profile, prefs, appearance, backup, recently-deleted, import entry, about. Backup status = single source. |
| **Closing**   | ✅                            | ✅ "No closings yet"   | Today's cash + top-5 pending + backup reminder + 30-day history. Reuses dashboard sweep.                  |
| **Search**    | ✅ Ctrl/⌘-K + bar             | ✅ "No matches"        | Index gated on open, map-based; **fast even at 67k items** (§3).                                          |

No dead links or broken navigation found. Every list screen has a real empty state.

---

## 2. Verification matrix

| Area                                   | Result            | Evidence                                                                                                                           |
| -------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Navigation**                         | ✅ Pass           | Bottom nav + back + deep links reviewed across all 9 screens.                                                                      |
| **Empty states**                       | ✅ Pass           | All 7 list/data screens have empty states (entry forms exempt).                                                                    |
| **Accessibility**                      | 🟡 Code-verified  | ENG-003 WCAG-AA pass (labels, roles, dialog semantics, contrast). **Not tested with a screen reader** on a device.                 |
| **Offline**                            | 🟡 Code-verified  | ENG-006 service worker caches static shell only; offline page precached. **Not device-verified** (Vercel gate).                    |
| **Backup**                             | ✅ Pass           | On-device backup + export/import file + last-backup status + integrity + 30-day recently-deleted. Manual (no cloud) — see risk R3. |
| **Import**                             | ✅ Pass           | P3-005 wizard (CSV/JSON, mapping, validation, dedupe); 13 tests. Type interpretation is heuristic (R5).                            |
| **Performance — typical**              | ✅ Pass           | ≤ ~5k entries: every sweep completes in a few ms (instant).                                                                        |
| **Large dataset — 1000 contacts**      | 🟠 Concern        | Contacts renders 1000 un-virtualized rows; recovery sweep O(parties).                                                              |
| **Large dataset — 50000 transactions** | 🔴 Fail vs target | Recovery/Collect sweeps 1.3–1.5s **on desktop** (§3); worse on low-end Android.                                                    |
| **Data integrity**                     | ✅ Pass           | ENG-005 verify+repair on startup/import/restore; report in Founder Mode.                                                           |

---

## 3. Performance — measured at the pilot ceiling

Benchmarked on the dev machine (Node/Vitest) at **1000 contacts × 50 transactions =
50,000 transactions + ~17k payments**. Means:

| Operation (runs on every data change) | 50k dataset   | Verdict                 |
| ------------------------------------- | ------------- | ----------------------- |
| `recoverySummary` — Dashboard sweep   | **~1,518 ms** | 🔴                      |
| `collectList` — Collect sweep         | **~1,373 ms** | 🔴                      |
| `portfolioAging`                      | ~819 ms       | 🔴                      |
| `rankOverdue` — scoring               | ~597 ms       | 🟠                      |
| `partyNet` — one contact row          | ~0.63 ms      | ✅ (×1000 rows ≈ 0.6 s) |
| Search index build (~67k items)       | ~16 ms        | ✅                      |
| Search filter per keystroke           | ~2 ms         | ✅                      |

**Root cause:** the aging/recovery sweep is **O(parties × transactions)** — each
contact re-filters the full transaction array (`agingForParty` /
`data.transactions.filter(partyId === …)`). At 1000×50k that is ~50M operations per
recompute, and it re-runs after every credit/payment. On a low-end Android (the
target device) expect **3–5× worse → multi-second freezes** on load and after each
entry at this scale.

**At typical merchant scale it is a non-issue:** a real udhaar shop has tens–low-
hundreds of contacts and a few thousand entries/year, where every sweep is a few ms.
Search, integrity, backup and import all scale fine.

**Recommended remediation (fast-follow, NOT done here — findings only):** pre-group
transactions/payments by `partyId` once per sweep (Map), turning O(P×N) into O(N).
Estimated to bring the 50k sweeps from ~1.5s to well under 50ms. One focused task.

---

## 4. Known issues

| ID  | Severity | Issue                                                                                                                                                                                     |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1  | **High** | Recovery/Collect/Dashboard sweeps are O(parties × transactions) → 1.3–1.5s at 50k on desktop, multi-second on low-end mobile. Misses the <500ms interaction target at the stated ceiling. |
| K2  | Medium   | Contacts list is not virtualized — 1000 DOM rows render at once.                                                                                                                          |
| K3  | Medium   | Offline / PWA install / dark mode / screen-reader AT are **code-verified only** — the gated preview blocked real-device testing.                                                          |
| K4  | Low      | Import "type" interpretation is heuristic (keyword-based); the review summary lets the merchant catch mis-splits before importing.                                                        |
| K5  | Low      | Pre-existing flaky `tests/lib/emi.test.ts` under full-suite parallel load (unrelated to Vyora; passes 84/84 in isolation).                                                                |

No correctness defects were found in the reviewed calculations (see ENG-007 Trust
Review — every merchant-visible value has one source).

---

## 5. Risk register

| ID  | Risk                                                                                               | Likelihood                                      | Impact              | Mitigation                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| R1  | App janks for a large merchant (near 50k)                                                          | Low for a _first_ pilot (merchants start small) | High (feels broken) | Cap pilot to typical-scale merchants; ship the O(N) sweep fix before onboarding large books.                          |
| R2  | Pilot merchant can't install / run offline as intended                                             | Medium (unverified on device)                   | High                | Founder lifts Vercel protection; verify install + offline on one real Android before onboarding.                      |
| R3  | **Data loss** — local-only, single browser; clearing site data / switching phones loses the ledger | Medium                                          | High                | Backup reminders + weekly export briefing + recently-deleted (30d) + integrity repair. Brief the merchant explicitly. |
| R4  | Merchant treats Alpha as system-of-record                                                          | Medium                                          | Medium              | Persistent "Alpha — don't rely for business-critical records" banner already shown; reinforce verbally.               |
| R5  | Import mis-classifies credit vs payment                                                            | Low                                             | Medium              | Heuristic + explicit review step with summary before commit.                                                          |
| R6  | Leaked GitHub PAT still active                                                                     | Certain until rotated                           | High (repo access)  | **Rotate the token now** (founder action).                                                                            |

---

## 6. Production checklist

**Blockers (must clear before onboarding a merchant):**

- [ ] Founder: **lift Vercel Deployment Protection** on `dev.esytol.com` so the app is reachable/installable.
- [ ] Founder: **rotate the leaked GitHub PAT** (R6).
- [ ] Verify on **one real Android**: install prompt, opens offline after first load, dark mode renders cleanly, welcome tour appears.
- [ ] Confirm the intended pilot merchant is **typical scale** (≤ ~few hundred contacts / few thousand entries) — not a 50k book.

**Ready / verified in code:**

- [x] All 9 screens reviewed; navigation + empty states complete.
- [x] Single-source calculations (ENG-007) + data integrity (ENG-005).
- [x] Backup / export / import / recently-deleted.
- [x] `npm run validate` green (tsc + lint + 2025 tests + build) on `develop`.

**Fast-follow (post-pilot-start, before scaling):**

- [ ] O(N) sweep optimization (K1) — the one perf fix that unlocks large books.
- [ ] Contacts list virtualization (K2).
- [ ] Real screen-reader pass (K3).

---

## 7. Go / No-Go recommendation

### 🟢 CONDITIONAL GO — for a _limited, typical-scale_ first pilot.

Vyora is **functionally complete and correct** for a real udhaar merchant: fast entry,
correct balances (single-source, trust-reviewed), recovery worklist, statements,
backup, import, integrity, and offline support are all in place, with a green
validation suite. At the scale a first pilot merchant actually operates at, it is
instant and trustworthy.

**Proceed** with **1–3 typical-scale merchants** once the four blockers above are
cleared (Vercel unblock, token rotation, one real-device verification, scale check).

**Do NOT** onboard a large/near-50k merchant, and do not treat this as a broad launch,
until K1 (the O(N) sweep fix) lands — at the stated ceiling the app janks for seconds
per action.

**Bottom line:** GO for a controlled first pilot; the product is ready, the gating
items are operational (device access + token) plus one known, well-understood
performance fast-follow that does not affect typical-scale users.
