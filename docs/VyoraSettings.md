# Vyora Settings — Merchant Trust Page

> **Status:** ✅ Implemented (V2-002) · **Merchant capability:** never lose data (core capability 8) ·
> **Everything local — no cloud, no login, no server, no sync** · **Last Updated:** 2026-08-01

- **Domain:** [`lib/vyora/settings.ts`](../lib/vyora/settings.ts) (pure)
- **Screen:** [`features/vyora/screens/Settings.tsx`](../features/vyora/screens/Settings.tsx) · route
  `/vyora/settings`
- **Tests:** [`tests/vyora/settings.test.ts`](../tests/vyora/settings.test.ts)

---

## 1. It answers one question

Not a preferences page. It exists to answer **"is my business data safe?"** in three seconds, which
is why the status card is the first thing on it and everything else comes after.

| Status                        | When                                                               |
| ----------------------------- | ------------------------------------------------------------------ |
| ✅ **Your data is backed up** | a backup exists, nothing recorded since, and it is not stale       |
| ⚠️ **Backup recommended**     | entries recorded since the last backup, **or** the backup is stale |
| ❌ **Never backed up**        | no `BackupCreated` event has ever been recorded                    |

**"Entries since backup" is the number that makes risk concrete.** A merchant understands
_"31 entries would be lost"_ far better than _"last backup 9 days ago"_. Staleness follows their own
reminder choice — daily (1d), weekly (7d), never (still warns at 30d, because silence would be a
lie).

## 2. The two trust promises, kept in code

**"Backed up" is only claimed when a backup actually happened.** The status is _derived_ from
`BackupCreated` events, so it cannot be faked, and it degrades the instant a new entry is recorded.
The event is emitted by the `BackupLedger` command, and the screen only reports success **after** the
file was generated and handed to the browser; if that throws, it says so and claims nothing.

**"Restore completed" is only claimed when validation passed.** The chosen file is parsed and
counted _before_ anything is replaced. The merchant sees how many contacts, credit entries and
payments will land — and what they currently have — and confirms explicitly.

## 3. What was reused

| Layer                          | Used for                                                                   |
| ------------------------------ | -------------------------------------------------------------------------- |
| **Command Engine** (ARCH-003)  | `BackupLedger` for export, `ImportLedger` for restore — no second exporter |
| **Event Log** (ARCH-002)       | `BackupCreated` drives the entire safety status                            |
| **Debug Bus** (ENG-008)        | `runIntegrityChecks` powers the integrity line                             |
| **Module Registry** (ARCH-005) | Settings module; nav picked it up **without editing the shell**            |
| **Golden Ledger** (QA-001)     | export→preview→import tested at 15,000 entries                             |

**One small addition:** `previewImport(payload)` in `commands.ts`. It reuses the _same_ parser
`ImportLedger` validates with, so the counts a merchant confirms are exactly the rows they will get.
Writing a second "what's in this file" reader would have been the duplication the brief forbids.

## 4. Two decisions worth your review

**Export uses `BackupLedger`, not `ExportLedger`.** The brief specified `ExportLedger` — but that
command deliberately emits _no_ event (it is a read), so using it would leave "last backup" saying
_never_ forever, and the whole trust hero would be a lie. `BackupLedger` returns the identical file
from the identical serializer **and** records that a backup happened. Downloading your book _is_
taking a backup.

**Settings are stored outside the event log**, under their own `vyora.settings.v1` key. The log is
the ledger's history; a shop's name is not a ledger fact. It also means **restoring a backup cannot
overwrite the merchant's own profile** with whoever's file they imported — which is what anyone
would expect and nobody would think to ask for.

## 5. Known limitations

- **"Clear demo data" is disabled** — there is no demo-data concept in Vyora, so there is nothing to
  distinguish or clear. Shown as unavailable rather than faked.
- **Language does nothing yet.** The preference is stored; there is no i18n layer (Epic D,
  pilot-gated). The screen says so rather than implying a working toggle.
- **PWA status reports "not yet"** — Vyora is not installable. Honest placeholder for a real
  milestone.
- **A browser cannot confirm a download completed.** We know the file was generated and handed over;
  if the merchant cancels the OS save dialog, the backup is still recorded. Closing that gap is not
  possible from a web app.
- **Currency is stored but not applied** — amounts are still formatted as INR throughout.
- **The bottom nav now has four items plus two action buttons.** It is getting crowded on small
  phones and deserves a look.
