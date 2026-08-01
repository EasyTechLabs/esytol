# Vyora Golden Ledger

> **Status:** ✅ Implemented (QA-001) · **Scope:** test fixture + regression suite + benchmarks —
> no production code changed · **Last Updated:** 2026-08-01

The canonical test ledger: **500 contacts, 15,000 credit entries**, plus payments, deletions,
restores and a removed contact. Every regression suite and benchmark that needs realistic scale
reads it from here.

- **Fixture:** [`tests/vyora/golden-ledger.ts`](../tests/vyora/golden-ledger.ts)
- **Suite:** [`tests/vyora/golden-ledger.test.ts`](../tests/vyora/golden-ledger.test.ts)
- **Benchmarks:** [`tests/vyora/golden-ledger.bench.ts`](../tests/vyora/golden-ledger.bench.ts) —
  `npm run bench`

---

## 1. Built as an event log, not as state

Since ARCH-002 the log is the source of truth, so the fixture is a **log**. That is not a stylistic
choice: it means the fixture exercises the whole stack — events → projection → indexes — and it lets
deleted, restored and undone entries exist as _real history_ rather than as data that was quietly
never written.

```
ImportCompleted  ──►  500 × ContactCreated  ──►  15,000 × CreditRecorded
      │                                                      │
      │                       4,000 × PaymentRecorded  ◄──────┘
      │                                   │
      └──►  200 × EntryDeleted  ──►  50 restores  ──►  ContactDeleted  ──►  BackupCreated
```

**Fully deterministic.** A seeded LCG drives every choice, and ids come from counters — never
`crypto.randomUUID`, never a clock. The same build produces the same bytes on every machine, which
is what makes a benchmark comparable to yesterday's and a failure reproducible. `GOLDEN_TODAY` is
fixed, so overdue ages never drift with the wall clock.

Building it is not free, so every accessor is memoized per process.

## 2. Edge cases it deliberately contains

| Case                     | How                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| **Suppliers**            | ~20% of credits are `taken`, with `paid` settlements — keeps `payable` and negative nets real   |
| **Partial payments**     | payments are 10–70% of the credit they settle, so balances stay open and aging stays meaningful |
| **Long overdue**         | ~25% carry due dates well before `GOLDEN_TODAY`, some ancient                                   |
| **Deleted entries**      | 200 `EntryDeleted`                                                                              |
| **Restore**              | 50 of those re-emitted with their **original row**                                              |
| **Undo**                 | `revertLastEvent` asserted to restore the previous projection exactly                           |
| **Duplicate imports**    | importing the same file twice asserted to change nothing                                        |
| **Negative attempts**    | 13 commands that must be rejected _and_ emit nothing (`GOLDEN_REJECTED`)                        |
| **Duplicate names**      | every 97th contact is "Ramesh" — real ledgers have two                                          |
| **Out-of-order history** | a restore re-emits an older row, driving the index engine down its fallback path on purpose     |

## 3. What runs against it, and what deliberately does not

The suite asserts integrity at scale: per-contact nets, the full portfolio ranking, dashboard
totals, `receivable − payable = net`, the sum of parts equalling the whole, one contact's complete
statement, and that every statement ends on that contact's current balance.

**The pre-v2 equivalence sweep stays on the small fixtures in `ledger.test.ts`.** `refPartyStatement`
is O(N×P) per contact, so sweeping all 500 contacts against 15,000 entries is ~3.7 **billion**
operations. Against the golden ledger the reference is used at portfolio level only, plus one
contact deeply. "Every regression test runs against it" is true for everything except that sweep,
and pretending otherwise would mean a test suite nobody waits for.

## 4. ⚠️ What the fixture found: cold start is O(E²)

`reduceEvents` folds the log with `applyEvent`, and every append copies the whole array:

```ts
case "CreditRecorded":
  return { ...data, transactions: [...data.transactions, event.transaction] };
```

For the golden log that is **~124 million element copies**:

| Source         | Copies           |
| -------------- | ---------------- |
| 15,000 credits | 112,492,500      |
| 4,000 payments | 7,998,000        |
| 200 deletions  | 3,800,000        |
| **total**      | **~124,290,500** |

This runs on **every app open** — `loadLog()` → `reduceEvents()` — before anything renders. ARCH-001
made reads O(1) and ARCH-002 made writes incremental, but nothing made _replay_ incremental, and
until now no fixture was large enough to show it.

The fix is contained: fold with a mutable accumulator inside `reduceEvents` (it owns the
accumulator, so mutating it is safe) and freeze once at the end, turning ~124M copies into ~19k
pushes. **Not done here** — QA-001 is "create the canonical test ledger", and changing the reducer
is production work that deserves its own milestone and its own review. The benchmark that proves it
is in place.

## 5. Using it

```ts
import { goldenLedger, goldenProjection, goldenEvents, goldenSample } from "./golden-ledger";

const ledger = goldenLedger(); // memoized indexes
const data = goldenProjection(); // memoized projection
const { contact, transaction } = goldenSample(); // stable handles
```

Add a new edge case by extending `buildGoldenEvents` — keep it deterministic (no clock, no random
ids), and add the assertion that proves the case is actually present. A fixture that claims an edge
case it does not contain is worse than one that never claimed it.
