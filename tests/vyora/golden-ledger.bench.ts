/**
 * Vyora — Golden Ledger benchmarks (QA-001).
 *
 * Run with `npm run bench`. Everything here measures the ONE canonical ledger
 * (500 contacts / 15,000 credits), so a number is comparable to yesterday's
 * number instead of to a fixture someone invented for that run.
 *
 * Four surfaces, each paired against the pre-v2 implementation where one exists:
 * **integrity** (deriving every number), **recovery** (the aging primitive),
 * **search**, and **insights** (the cash-flow totals).
 *
 * The first group is the one to watch: `reduceEvents` is the cold-start path —
 * it runs on every app open, before anything renders.
 */

import { bench, describe } from "vitest";
import { reduceEvents } from "@/lib/vyora/events";
import {
  buildLedger,
  readDashboardTotals,
  readPartyNet,
  readSearch,
  readStatement,
} from "@/lib/vyora/ledger";
import {
  refDashboardTotals,
  refPartyNet,
  refPartyStatement,
  refSearchParties,
} from "./legacy-selectors";
import {
  GOLDEN_TODAY,
  goldenEvents,
  goldenLedger,
  goldenProjection,
  goldenSample,
} from "./golden-ledger";

// Warm the memoized fixture before timing anything.
const EVENTS = goldenEvents();
const DATA = goldenProjection();
const LEDGER = goldenLedger();
const SAMPLE = goldenSample();

/** Keeps a benchmark's result observable so the engine cannot optimise the loop away. */
let sink = 0;
export { sink };

describe("cold start — what a merchant waits for on app open", () => {
  bench("replay the event log (reduceEvents)", () => {
    reduceEvents(EVENTS);
  });

  bench("build every index from the projection (buildLedger)", () => {
    buildLedger(DATA);
  });
});

describe("integrity — deriving one contact's position", () => {
  bench("one contact net — legacy O(N)", () => {
    refPartyNet(DATA, SAMPLE.contact.id);
  });
  bench("one contact net — engine O(1)", () => {
    readPartyNet(LEDGER, SAMPLE.contact.id);
  });

  bench("one full statement — legacy O(N×P)", () => {
    refPartyStatement(DATA, SAMPLE.contact.id);
  });
  bench("one full statement — engine O(1)", () => {
    readStatement(LEDGER, SAMPLE.contact.id);
  });
});

describe("search — the party picker, on every keystroke", () => {
  bench("search — legacy O(P×N)", () => {
    refSearchParties(DATA, "contact 1");
  });
  bench("search — engine O(P)", () => {
    readSearch(LEDGER, "contact 1");
  });
});

describe("insights — the cash-flow totals behind Epic B", () => {
  bench("dashboard totals — legacy O(P×N)", () => {
    refDashboardTotals(DATA, GOLDEN_TODAY);
  });
  bench("dashboard totals — engine O(1)", () => {
    readDashboardTotals(LEDGER, GOLDEN_TODAY);
  });
});

describe("recovery — the aging primitive behind Epic A", () => {
  // Epic A is not built. What exists is DueIndex, so what is measured is the
  // primitive its selectors will read, not a Recovery feature.
  bench("scan every credit for an overdue date — no index", () => {
    let overdue = 0;
    for (const t of DATA.transactions) {
      if (t.dueDate && t.dueDate < GOLDEN_TODAY) overdue += t.amount;
    }
    sink = overdue;
  });

  bench("walk the due index instead", () => {
    let overdue = 0;
    for (const date of LEDGER.due.dueDatesAscending) {
      if (date >= GOLDEN_TODAY) break;
      for (const t of LEDGER.due.transactionsByDueDate.get(date) ?? []) overdue += t.amount;
    }
    sink = overdue;
  });

  bench("earliest due date per contact — index lookup", () => {
    LEDGER.due.earliestDueDateByParty.get(SAMPLE.contact.id);
  });
});
