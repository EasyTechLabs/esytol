/**
 * Vyora — the device clock (WEB-LEDGER-ORDERING-001).
 *
 * The timeline merges credits and payments by `createdAt`, and
 * `new Date().toISOString()` resolves to the millisecond. Two entries recorded
 * back to back land inside one — measured at **294 collisions in 300** on this
 * path, because minting an event is pure JavaScript with no I/O between the two.
 *
 * On a tie `mergeAscending` gives the **transaction side** the win, which
 * reproduces a stable sort of `[...transactions, ...payments]`. That is fine
 * when the credit really was first and wrong when it was not:
 *
 *     payment ₹500 recorded, then credit ₹2,000, same millisecond
 *     folded as  credit → payment      running  2000, 1500
 *     recorded as payment → credit     running  -500, 1500
 *
 * The merchant reads a running balance that never happened. Note this is the
 * *mirror* of the mobile defect: mobile broke ties on the entry id, where
 * `pay_` sorts before `txn_`, so mobile misplaced a payment ahead of a credit.
 * The web misplaces a credit ahead of a payment. Same cause — a tiebreak that
 * carries no recording order — opposite symptom.
 *
 * The tiebreak is deliberately left alone. `mergeAscending` is what every screen
 * and test has always seen, and the API and mobile order by `created_at` too;
 * changing one surface's rule is how three surfaces start disagreeing about the
 * same entries. What changes is that this device never mints the same instant
 * twice, so the ordering key alone carries recording order and no tiebreak is
 * ever reached.
 *
 * ## Purity
 *
 * This module performs **no I/O**, deliberately. `executeCommand` reads a
 * context and returns events; persisting them is the provider's job, and that
 * is what makes the whole rule set testable without a browser. So the floor is
 * *seeded* from storage when the provider boots and *persisted* by the provider
 * on the same write that saves the log — the clock itself only counts.
 *
 * ## What this cannot promise
 *
 * Two tabs. Each holds its own counter, and there is no atomic read-modify-write
 * across tabs in `localStorage`. Two tabs writing inside the same millisecond
 * can still mint the same instant. That residual risk is documented rather than
 * papered over — and it sits behind a much larger pre-existing one, since
 * `saveLog` rewrites the whole log from one tab's memory and a second tab's
 * entries are lost outright. See `VyoraEventLog.md`.
 */

export interface DeviceClock {
  /** Mint the next instant. Never equal to, and never before, the last one. */
  (): string;
  /** Milliseconds of the last instant issued, or -1 if none has been. */
  lastMs(): number;
  /** Raise the floor. Never lowers it — that is the whole point. */
  seed(ms: number): void;
}

export function makeIsoClock(nowMs?: () => number): DeviceClock {
  let last = -1;

  // Read the wall clock through a late-bound call rather than capturing
  // `Date.now` as a default parameter. A captured reference is taken when this
  // module is evaluated, which is before a test installs fake timers or a
  // browser extension patches `Date` — so the clock would quietly keep using
  // the original and could not be driven at all.
  const tickMs = (): number => (nowMs ? nowMs() : Date.now());

  const clock = (() => {
    const tick = tickMs();
    // Borrowing from the future is bounded by how fast entries are recorded and
    // repays itself the moment the wall clock catches up. Ten entries inside one
    // millisecond puts the last nine milliseconds ahead, which no ledger can
    // perceive.
    last = tick > last ? tick : last + 1;
    return new Date(last).toISOString();
  }) as DeviceClock;

  clock.lastMs = () => last;
  clock.seed = (ms: number) => {
    if (Number.isFinite(ms) && ms > last) last = ms;
  };

  return clock;
}

/**
 * The device's clock. One instance, so the guarantee holds across the app.
 *
 * Read by **both** write paths, which is the point — they reach different
 * stores and both order by the instant:
 *
 *   - the event constructors in `events.ts`, for the local log;
 *   - `ledger-source.ts`, for entries POSTed to the development API, which
 *     sorts by `(created_at, entry_id)` and would otherwise hit the mobile
 *     tiebreak where `pay_` sorts before `txn_`.
 *
 * Two deliberate exceptions, neither of which is an ordering key:
 * `commands.ts` stamps a *restored* entry's event with a raw clock (the entry
 * keeps its original `createdAt`, which is what the statement folds by), and an
 * export's `exportedAt` is a file header rather than a ledger fact.
 */
export const nowISO: DeviceClock = makeIsoClock();
