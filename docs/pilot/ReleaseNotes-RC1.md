# Vyora 1.0.0-rc1 — Release Notes

> First build intended for real merchants. Log format **v2** · service worker **1.0.0-rc1** ·
> built 2026-08-01.
>
> Full deployment detail: `docs/releases/RC1-ReleaseNotes.md`. Blockers: `KnownIssues.md`.

---

## What a merchant can do

|                                |                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------- |
| **Record credit and payments** | Amount autofocused, customer created by typing their name, quick-amount chips |
| **Set a due date in one tap**  | Today / 7 / 15 / 30 / 45 / custom, shown as _"Due 31 Aug · Sunday"_           |
| **Know who to call first**     | Ranked chase list with amount, age, phone, last payment, last reminder        |
| **Send a safe reminder**       | Gentle / normal / firm, written for them, sent from their own WhatsApp        |
| **See a full statement**       | Every entry with running balance, issued and due dates                        |
| **Close the day**              | Money in, credit out, cash out, who is due tomorrow, in one screen            |
| **Keep the book safe**         | Honest backup status, one-tap export, validated restore                       |
| **Install to the home screen** | Works with no signal once installed                                           |
| **Read local diagnostics**     | Founder Mode — totals, storage, integrity, timings                            |

**Local-first throughout.** No account, no login, no backend, no cloud, no telemetry, no analytics.
Data lives in four browser keys on the merchant's phone and is transmitted nowhere.

## Architecture

Seven layers, all complete and frozen:

| Layer                          | What it does                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| **Ledger Engine** (ARCH-001)   | One normalized index set per data version; every balance derived once, never stored      |
| **Event Log** (ARCH-002)       | Append-only events are the source of truth; ledger state is a projection                 |
| **Command Engine** (ARCH-003)  | Every write validates, executes, emits, returns a result — with merchant-readable errors |
| **Workflow Engine** (ARCH-004) | Explicit state machines; no boolean explosion, no impossible states                      |
| **Module Registry** (ARCH-005) | Features declare their own routes and commands; the shell knows none of them by name     |
| **Debug Bus** (ENG-008)        | Local diagnostics, off by default, free when off, nothing leaves the device              |
| **Golden Ledger** (QA-001)     | One canonical 500-contact / 15,000-entry fixture behind every test                       |

## Engineering improvements

- **ENG-009** — first full execution of the toolchain. 21 defects found and fixed: a reminder-tone
  type mismatch, a `Omit` that collapsed the event union, an import toast reading the wrong field,
  a test fixture that claimed to contain suppliers and did not, and lint/format debt.
- **ENG-010** — event replay reduced from O(E²) to O(E).

## Performance (measured)

| Entries | Cold start before | after        | Speedup   |
| ------- | ----------------- | ------------ | --------- |
| 2,000   | 6.48 ms           | **2.55 ms**  | 2.5×      |
| 10,000  | 80.73 ms          | **10.83 ms** | 7.5×      |
| 20,000  | 460.36 ms         | **22.13 ms** | **20.8×** |

Replay alone is 1,092× faster at 20,000 entries (537 ms → 0.49 ms). Cold start is the path a
merchant waits on every time they open the app.

## Bug fixes

- **Silent write failure** — a full or blocked device returned a failure that was ignored while the
  merchant saw a success message. The entry looked saved and disappeared on reload. Now reported
  honestly, with no confirmation. _The most dangerous defect found in the product._
- **Reminder tone mismatch** — the Recovery screen's default tone did not type-check against its
  command.
- **Import confirmation** read the wrong field and displayed "Restored undefined contacts".
- **Golden Ledger had no payable contacts**, so "never chase someone you owe" was passing vacuously.

## Verification

| Gate                         | Result                                                |
| ---------------------------- | ----------------------------------------------------- |
| Type-check, lint, formatting | ✅ clean                                              |
| **Vyora test suite**         | ✅ **390 tests across 16 files, all pass**            |
| Whole repository             | ⚠️ 2,337 / 2,338 — one pre-existing non-Vyora timeout |
| Production build             | ✅ 142 pages                                          |
| Storage audit                | ✅ exactly 4 keys, no others                          |
| Network audit                | ✅ no telemetry, analytics or ledger transmission     |

## Known limitations

Full list with severities and owners in `KnownIssues.md`. In short:

- **Never run on a real device** — install, offline and update behaviour are unproven _(blocker)_
- **iOS shows esytol's icon** _(blocker)_
- 3 high CVEs via Next.js, unfixable without a major upgrade
- Merchant preferences are not inside the ledger backup
- Coming-due totals count scheduled credit, not unpaid balances
- Hindi, currency switching, reports, cloud sync and reminders-that-send-themselves do not exist and
  are not planned for the pilot
