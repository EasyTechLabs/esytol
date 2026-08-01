# Pilot Go / No-Go — Vyora 1.0.0-rc1

> Decided 2026-08-01 on verified evidence only. Re-decide after the blockers close.

---

# ❌ FAIL

**Vyora RC1 is not yet approved for onboarding pilot merchants.**

Two blockers. Both are verification gaps rather than defects, and both close in well under a day.

---

## Blockers

### C1 — The application has never run on a real device

Service workers do not run in the test environment, and no browser was available during any
milestone. **Install, offline startup, service-worker update, the share sheet, long-press and iOS
safe areas have never been executed on hardware.**

They are implemented and unit-tested wherever a test can reach them. That is not the same as
working, and the pilot's first impression depends entirely on them.

**Closes when:** section B of `PilotChecklist.md` passes on one real Android phone and one iPhone.
**Roughly 30 minutes.**

### C2 — iOS merchants install an app showing esytol's icon

The manifest ships SVG icons. Android accepts them; **iOS ignores SVG** and falls back to
`/icon-192.png`, which is esytol's mark.

**Closes when:** the three PNGs in `KnownIssues.md` C2 are generated and referenced.
**Roughly 15 minutes.**

---

## What is already proven

Everything below was measured, not assumed.

|                              |                                                                |
| ---------------------------- | -------------------------------------------------------------- |
| Type-check, lint, formatting | ✅ clean                                                       |
| **Vyora test suite**         | ✅ **390 tests / 16 files, all pass**                          |
| Production build             | ✅ 142 pages                                                   |
| Cold start @ 20,000 entries  | ✅ **22 ms** (was 460 ms)                                      |
| Storage audit                | ✅ exactly four keys, no others written                        |
| Network audit                | ✅ no telemetry, analytics, or ledger transmission             |
| Ledger correctness           | ✅ verified against a 500-contact / 15,000-entry fixture       |
| Silent write failure         | ✅ **fixed** — the device can no longer lose an entry silently |

The product itself is in good shape. The gap is that nobody has held it.

## Explicitly not blockers

- **3 high CVEs** via Next.js — build-time image tooling, no demonstrated path into Vyora, and
  clearing them needs a major upgrade during a release candidate.
- **`emi.test.ts` parallel-run timeout** — pre-existing esytol code, passes in isolation.
- **Preferences not inside the backup** — real, documented, and covered by telling the merchant to
  re-enter their shop name after a restore.
- **Coming-due totals count scheduled credit** — captioned on screen; Chase uses real balances.

None of these can lose a merchant's money or their trust.

## To reach PASS

1. Run `PilotChecklist.md` section B on one Android phone and one iPhone.
2. Generate the Vyora PNG icons and redeploy.
3. Re-run `npx vitest run tests/vyora` and `npm run build`.
4. Update this file.

On completion, this document should read:

> **Vyora RC1 is approved for onboarding the first 3–5 pilot merchants.**

I am not writing that sentence today, because it would not be true.

## A note on the recommendation

Three of the last four milestones have ended with me saying the same thing: the code is verified and
the device is not. That is now the only thing standing between this build and real merchants — and
it is a half-day of someone's afternoon, not another milestone.

**Do not schedule more engineering work to close this.** Pick up a phone.
