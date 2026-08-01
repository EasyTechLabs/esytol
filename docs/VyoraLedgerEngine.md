# Vyora Ledger Engine v2

> **Status:** ✅ Implemented (ARCH-001) · **Scope:** internal refactor — no schema change, no data
> migration, no UI change, no workflow change · **Last Updated:** 2026-08-01

The engine that turns one `VyoraData` payload into every number Vyora shows. It replaces the
per-call ledger sweeps that the Alpha selectors performed.

- **Source:** [`lib/vyora/ledger.ts`](../lib/vyora/ledger.ts)
- **Read surface:** [`lib/vyora/selectors.ts`](../lib/vyora/selectors.ts)
- **Tests:** [`tests/vyora/ledger.test.ts`](../tests/vyora/ledger.test.ts)
- **Benchmark:** [`tests/vyora/ledger.bench.ts`](../tests/vyora/ledger.bench.ts) — `npm run bench`

---

## 1. The problem

Balances in Vyora are **derived, never stored** — that is why they cannot drift, and it is not
negotiable. The Alpha implementation derived them _per call_:

```ts
// lib/vyora/selectors.ts, before ARCH-001
partyNet(data, id); // full scan of transactions + payments      → O(N)
allBalances(data); // calls partyNet once PER PARTY             → O(P×N)
dashboardTotals(data); // calls allBalances                         → O(P×N)
searchParties(data, q); // calls allBalances                         → O(P×N)
allActivity(data); // parties.find() per entry for the name     → O(N×P)
partyStatement(data, id); // calls allActivity, then filters           → O(N×P)
```

Nothing was cached, so these ran again on **every render** — and `searchParties` ran again on **every
keystroke** in the party picker, the most latency-sensitive surface in the product. At pilot scale
(tens of parties, hundreds of entries) this is invisible. It is quadratic, so it does not stay
invisible.

## 2. The design

One `Ledger` is derived per data version, in a **single linear scan**, and every screen reads from
its indexes. No screen scans the ledger.

```
VyoraData ──scanLedger()──┬─► PartyIndex        byId · byNormalizedName · all
   (one pass)             ├─► TransactionIndex  transactions/payments by party, and by id
                          ├─► BalanceIndex      netByParty · ranked (by exposure)
                          ├─► StatisticsIndex   receivable · payable · net · collections by DATE
                          ├─► TimelineIndex     newestFirst · statementByParty (running balance)
                          ├─► SearchIndex       precomputed lowercase haystacks, exposure order
                          └─► DueIndex          transactions by due date · earliest due per party
```

Four properties hold by construction:

| Property                | How                                                                                                                                                                                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **One source of truth** | `selectors.ts` performs no calculation of its own — it is a thin read surface. The engine is the only place a balance is derived.                                                                                                                                                              |
| **Immutable**           | Every index is a `ReadonlyMap` / `readonly` array. Updates return a **new** `Ledger`; nothing mutates in place.                                                                                                                                                                                |
| **Memoized**            | `ledgerFor(data)` caches on `VyoraData` **object identity** in a `WeakMap`. The store replaces `data` wholesale on every mutation, so identity is a sound key and the cache can never be stale. Superseded versions are garbage-collected with their indexes — nothing is invalidated by hand. |
| **Incremental**         | `appendToLedger(prev, next, change)` folds one appended entry into the existing indexes without re-deriving anything.                                                                                                                                                                          |

### Why `StatisticsIndex` stores collections **by date**

"Today's collections" is date-dependent, but the _index_ is not: it stores a per-date map and
`readDashboardTotals(ledger, today)` does one lookup. If `today` were baked in at build time, a
memoized ledger would silently go stale when the clock rolled past midnight.

### The incremental path is guarded, not trusted

A wrong balance is far worse than a slow one. `appendToLedger` takes the fast path **only** when it
is provably equivalent to a rebuild, and falls back to `buildLedger` otherwise. It rebuilds when:

- the change carries no entry, or carries both a transaction and a payment;
- the row counts are not exactly "previous + this change";
- the appended entry is **not** the newest (timeline order would break);
- a new party collides with an existing normalised name (the name index is first-writer-wins);
- the entry's party is unknown, or a supplied new party is not the entry's own party.

`tests/vyora/ledger.test.ts` asserts each of these falls back correctly, and asserts that 250
consecutive folds stay _deep-equal_ to a full rebuild.

### Ordering is preserved exactly

The old timeline was `[...transactions, ...payments].sort(descending)` — a **stable** sort, so
entries sharing a `createdAt` kept transaction-before-payment order. The engine reproduces this
without an O(N log N) sort:

1. Both source arrays are already `createdAt`-ascending (the store is append-only), so they **merge**
   in O(N), taking the transaction side on a tie.
2. `toNewestFirst` reverses _group by group_, keeping each equal-instant group in its original
   order. A plain `.reverse()` would flip tied rows and silently reorder same-second entries.
3. If either array is **not** ascending — only reachable via an imported or hand-edited backup — it
   falls back to the same stable sort. Correctness never depends on the append-only assumption.

## 3. Complexity: before / after

`P` = parties, `N` = entries, `D` = distinct dates, `L` = query length.

| Operation         | Before (per call)                          | After                                                 | Notes                                                |
| ----------------- | ------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------- |
| Build indexes     | — (none)                                   | **O(N + P log P)**                                    | one scan; `P log P` is the exposure ranking          |
| `partyNet`        | O(N)                                       | **O(1)**                                              | map lookup                                           |
| `allBalances`     | **O(P×N)**                                 | **O(1)**                                              | precomputed, ranked                                  |
| `dashboardTotals` | **O(P×N)**                                 | **O(1)**                                              | totals precomputed, today = one lookup               |
| `searchParties`   | **O(P×N)**                                 | **O(P)**                                              | linear over _parties_, zero allocation per keystroke |
| `allActivity`     | O(N×P + N log N)                           | **O(1)**                                              | returns the stored array                             |
| `partyStatement`  | O(N×P + N log N)                           | **O(1)**                                              | stored per party with running balance                |
| `findPartyByName` | O(P×L)                                     | **O(1)**                                              | name index                                           |
| Record an entry   | O(1) write, then O(P×N) on the next render | **O(N + P log P) pointer copies, zero re-derivation** | see below                                            |

**On the O(N) target.** The scan itself is linear, and the timeline merge is genuinely O(N) in the
append-only steady state. The residual `P log P` is the sort that produces the
biggest-exposure-first ordering — a merchant-visible feature, not overhead. Strict O(N) would mean
giving up that ordering. What the target actually asked for is met: **the P×N term is gone.**

**On the incremental fold.** It re-derives nothing — no balance is recomputed, no activity item is
rebuilt, no haystack is re-lowercased. It still pays an O(N) _structural_ copy, because
`newestFirst` is an immutable array and prepending copies its pointers. That is a `memcpy` of
references against re-deriving the entire ledger; it is not free, and the benchmark measures it
rather than assuming it.

## 4. Benchmark

`tests/vyora/ledger.bench.ts` measures each merchant-visible operation twice — once through
`tests/vyora/legacy-selectors.ts` (a **verbatim copy** of the pre-v2 code) and once through the
engine — at two scales: pilot (40 parties / 500 entries) and production (400 parties / 20k entries).

It deliberately includes the case where v2 is at its **worst**: a cold read that must build the
indexes first, so the trade-off is visible instead of hidden behind pre-warmed state.

```bash
npm run bench
```

> ⚠️ **Measured numbers are not recorded here yet.** The toolchain (`node` / `npm`) is not available
> in the environment this milestone was implemented in, so no benchmark run has been executed and no
> figures have been written down. The table above is an **analytical** complexity result derived from
> the code, not a measurement. Run `npm run bench` and paste the results into this section before
> treating any speed-up as evidence. Do not quote a number that has not been produced by a run.

## 5. Memory analysis

The persisted payload in `localStorage` is **unchanged** — no schema change, no new fields, nothing
extra written to the device. This section is about in-memory derived state only.

Per live data version the engine retains:

| Structure          | Size            | Content                                                               |
| ------------------ | --------------- | --------------------------------------------------------------------- |
| `PartyIndex`       | ~2P             | two maps of pointers + P normalised name strings                      |
| `TransactionIndex` | ~2N             | pointers to the _existing_ rows, grouped and keyed — no row is copied |
| `BalanceIndex`     | ~2P             | P numbers + P small `{party, net}` objects                            |
| `StatisticsIndex`  | ~2D             | two date→number maps + five scalars                                   |
| `TimelineIndex`    | **~2N objects** | N `ActivityItem` + N `StatementRow` — the dominant term               |
| `SearchIndex`      | ~2P             | P records + P haystack strings                                        |
| `DueIndex`         | ≤N              | pointers to dated transactions + distinct due dates                   |

The dominant cost is the **two derived objects per entry** in `TimelineIndex`. Estimating a ~10-field
V8 object at roughly 100–150 bytes (strings are _shared references_ to the source rows, not copies),
plus map and array overhead, gives an order-of-magnitude figure of **~300–400 bytes per entry**:

- pilot, N = 500 → **~0.2 MB**
- production, N = 20,000 → **~6–8 MB**

> These are estimates from the data shapes, **not measurements** — same caveat as §4. Confirm with a
> heap snapshot before relying on them.

Two things worth being clear about:

1. **Steady-state memory goes up; allocation churn goes down sharply.** The old code allocated N
   `ActivityItem` objects on _every_ `allActivity()` call — on every render — and immediately threw
   them away. The engine allocates them once per data version and keeps them. Total allocation over
   a session falls by roughly the number of renders.
2. **Nothing leaks.** The memo is a `WeakMap` keyed on the data object. When the store replaces
   `data`, the previous version and its entire index set become unreachable together.

If `TimelineIndex` ever becomes the constraint, the cheapest win is to drop `StatementRow` and
recompute a running balance on statement open (O(k) for that party) — halving the derived objects at
the cost of making one screen do work. It is not needed at any plausible merchant scale.

## 6. Developer guide

### Reading a value

**Never scan `data` in a screen.** Take the ledger from the provider and use a `read*` helper:

```tsx
const { ledger } = useVyora();

const totals = readDashboardTotals(ledger); // O(1)
const activity = readRecentActivity(ledger, 15); // O(limit)
const results = readSearch(ledger, query); // O(P)
const party = readParty(ledger, partyId); // O(1)
const net = readPartyNet(ledger, partyId); // O(1)
const rows = readStatement(ledger, partyId); // O(1)
```

Outside React (tests, scripts), go through `selectors.ts` — same values, memoized on the data
object: `partyNet(data, id)`, `searchParties(data, q)`, `dashboardTotals(data)`, and so on. The
signatures are unchanged from Alpha.

### Writing

Mutations still live in `lib/vyora/store.ts` and are still pure `data → data`. The provider decides
how the ledger advances:

- **Capture paths** (`recordCredit`, `recordPayment`) fold with `appendToLedger` — the speed-critical
  route, which must stay at or below the notebook.
- **Everything else** (create party, delete, reset, first load) rebuilds via `ledgerFor`. These are
  rare, and a rebuild is the simplest thing that is obviously correct.

Anything the provider builds is passed through `cacheLedger`, so a selector touching the same data
version reuses those indexes instead of deriving them a second time.

### Adding a new index

1. Add its shape to `ledger.ts` and a field on `Ledger`.
2. Populate it inside `scanLedger` — **do not add a second pass** over the entries.
3. Handle it in `appendToLedger`, or add a guard in `isAppendable` that forces a rebuild for the
   cases you cannot fold.
4. Add the pair of tests that matter: equivalence with a reference implementation, and
   incremental-equals-rebuild.
5. Give it a consumer — or write down, here, why it exists ahead of one. An index nothing reads and
   nothing justifies is dead code.

> **The one index with no consumer today is `DueIndex`**, and it is a deliberate exception. `dueDate`
> is already captured and stored by the Alpha credit-entry screen but has never been read by
> anything. Indexing it is pure grouping — no policy, no product decision — and it is the primitive
> MLP Mission A1 (aging & overdue) needs. It is covered by tests. If A1 is descoped, delete it rather
> than leave it drifting.

### Running the checks

```bash
npm run test:run      # includes the ledger regression suite
npm run bench         # before/after, legacy vs engine
npm run validate      # type-check → lint → format:check → tests → build
```

## 7. Deliberately not built

Two indexes named in the ARCH-001 brief are **not** implemented, because building them here would
require breaking one of ARCH-001's own constraints:

- **`RecoveryIndex`** — a recovery index needs `lastRemindedAt` per contact, which does not exist in
  the schema, and ARCH-001 states _no schema change_. Its other half (the overdue/aging **policy** —
  bucket boundaries, what "overdue" means, how to rank who to chase) is the deliverable of MLP
  Mission **A1/A2**, and pre-empting it here would hard-code a product decision inside an
  infrastructure task. `DueIndex` deliberately supplies the raw primitive A1 needs — due dates
  grouped, earliest due date per party — with **no policy baked in**, so A1 lands as a thin layer
  rather than a rewrite.
- **`RelationshipIndex`** — there is no relationship data in the domain. `Party` has no edges to
  other parties; a party's role is implied by the direction of each entry, not by a stored
  relationship. There is nothing to index. Implementing one would mean inventing a data model, which
  is a product decision and outside an internal refactor.

Both are noted in `vyora/alpha/KnownLimitations.md` terms: not oversights, conscious scope calls.
