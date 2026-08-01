# Vyora Observability & Founder Mode

> **Status:** ✅ Implemented (ENG-008) · **Local-only — no network, no telemetry, no persistence** ·
> **Last Updated:** 2026-08-01

- **Debug bus:** [`lib/vyora/debug.ts`](../lib/vyora/debug.ts)
- **Screen:** [`features/vyora/screens/FounderMode.tsx`](../features/vyora/screens/FounderMode.tsx)
  · route `/vyora/founder`
- **Tests:** [`tests/vyora/debug.test.ts`](../tests/vyora/debug.test.ts)

---

## 1. Nothing leaves the device

No `fetch`, no `XMLHttpRequest`, no `sendBeacon`, no `localStorage`, no cookies. The buffer lives in
memory and dies with the tab. This is the privacy position recorded in `KnownIssues.md` K7 and the
"local-only diagnostics" specification for Founder Mode — **a test asserts the source contains none
of those calls**, so the property survives future edits rather than depending on nobody adding one.

## 2. Off by default, and free when off

```ts
export function time<T>(channel, label, fn: () => T): T {
  if (!enabled) return fn();   // one boolean test — no clock, no allocation
  ...
}
```

This matters more here than in most apps: capture speed has a standing gate that entry must stay at
or below a paper notebook. Instrumentation that always ran would spend that budget. Disabling also
**clears the buffer** — a merchant leaving Founder Mode should not carry a record of their afternoon
around in memory.

The buffer is a fixed 500-entry ring, so an enabled session cannot grow without bound.

## 3. What is instrumented

| Channel     | Where                                                            | Why there                                      |
| ----------- | ---------------------------------------------------------------- | ---------------------------------------------- |
| `command`   | `dispatch` in `VyoraProvider`                                    | every write, labelled by command type          |
| `selector`  | `ledgerFor` (`buildLedger`) and the incremental `appendToLedger` | the two places real derivation happens         |
| `integrity` | `runIntegrityChecks`                                             | records pass/fail plus how long the sweep took |
| `render`    | _not yet wired_                                                  | see §6                                         |

**Performance timeline** aggregates the ring by channel + label — count, mean, max — computed on
read so recording stays cheap. The window is the ring, so these are "the last 500 samples", stated
that way on screen rather than implied to be lifetime totals.

**Integrity timeline** runs the same invariants the golden-ledger suite asserts in CI, but against
the merchant's own data — the only place a real-world violation would ever appear:

- `receivable − payable = net`
- sum of contact nets = portfolio net
- indexed entry/contact counts match the projection
- every statement ends on that contact's balance
- no entry belongs to a missing contact

## 4. Founder Mode

Hidden: tap the **"Alpha" badge five times**. Nothing links to it, and the route is marked
`noindex`. It shows ledger totals, device storage and log version, last backup, import/deletion
counts, the integrity results and the performance timeline.

Diagnostics live exactly as long as the screen does — mounting enables the bus, unmounting disables
it and clears the buffer.

It **owns no commands**. A diagnostics surface that could change the ledger would be a diagnostics
surface nobody should trust.

It is also the **first module added through the ARCH-005 registry** rather than by editing the shell
— which is the first real evidence that the module boundary works.

## 5. Why this unblocks the pilot

`pilot/MetricsTracker.md` sources eight of the pilot's metrics from Founder Mode, and
`pilot/PilotChecklist.md` instructs the operator to open it by tapping the Alpha badge 5×. Both
documents described a screen that did not exist in the code. It exists now.

Two gaps remain against those documents: **Settings → Export data** and **Settings → Clear all
data** are still absent (Clear data lives in the dashboard footer), and export counts are reported
from `ImportCompleted` / `BackupCreated` events rather than from an export UI that does not exist.

## 6. Not built

- **Render timing.** The channel exists and the bus accepts it, but no component is instrumented.
  Doing it well means a hook on the screens that matter, and adding one to the capture path is
  exactly the kind of thing the speed gate exists to stop being done casually.
- **Persisted timings.** Deliberate: nothing is written to disk, so numbers are per-session.
- **Enabling diagnostics outside Founder Mode.** By design.
