/**
 * Vyora — Ledger Engine v2 benchmark (ARCH-001).
 *
 * Run with `npm run bench`. Each pair measures the SAME merchant-visible
 * operation twice: once through `legacy-selectors.ts` (the verbatim pre-v2
 * code) and once through the engine. Comparing against the real old code, not a
 * remembered number, is the only way the "before / after" claim means anything.
 *
 * The suite deliberately includes the case where v2 is at its WORST — a cold
 * read that has to build the indexes first — so the trade-off is visible rather
 * than hidden behind pre-warmed state.
 *
 * Scale note: PILOT is the ten-merchant reality today; PRODUCTION is the scale
 * ARCH-001 was raised for. The gap between the two pairs is the whole point:
 * legacy cost grows with P×N, engine cost does not.
 */

import { bench, describe } from "vitest";
import {
  buildLedger,
  appendToLedger,
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
  generateData,
  makeAppend,
  makeRng,
} from "./legacy-selectors";

const SCALES = [
  { label: "pilot (40 parties / 500 entries)", parties: 40, entries: 500 },
  { label: "production (400 parties / 20k entries)", parties: 400, entries: 20_000 },
];

for (const scale of SCALES) {
  describe(scale.label, () => {
    const data = generateData(101, scale.parties, scale.entries);
    const ledger = buildLedger(data);
    const today = data.payments[0]?.date ?? "2026-07-01";
    const partyId = data.parties[Math.floor(data.parties.length / 2)].id;

    // ── Dashboard open ──────────────────────────────────────────────────────
    bench("dashboard totals — legacy O(P×N)", () => {
      refDashboardTotals(data, today);
    });
    bench("dashboard totals — engine (warm index)", () => {
      readDashboardTotals(ledger, today);
    });
    bench("dashboard totals — engine (cold, includes full build)", () => {
      readDashboardTotals(buildLedger(data), today);
    });

    // ── Party picker keystroke: the hottest path in the app ─────────────────
    bench("search keystroke — legacy O(P×N)", () => {
      refSearchParties(data, "party 1");
    });
    bench("search keystroke — engine", () => {
      readSearch(ledger, "party 1");
    });

    // ── Opening one party's statement ───────────────────────────────────────
    bench("party statement — legacy O(N log N)", () => {
      refPartyStatement(data, partyId);
    });
    bench("party statement — engine", () => {
      readStatement(ledger, partyId);
    });

    // ── A single balance ────────────────────────────────────────────────────
    bench("one party net — legacy O(N)", () => {
      refPartyNet(data, partyId);
    });
    bench("one party net — engine O(1)", () => {
      readPartyNet(ledger, partyId);
    });

    // ── Recording an entry: rebuild vs incremental fold ──────────────────────
    const rng = makeRng(7);
    const step = makeAppend(data, 1, rng);
    bench("record an entry — full rebuild", () => {
      buildLedger(step.next);
    });
    bench("record an entry — incremental fold", () => {
      appendToLedger(ledger, step.next, step.change);
    });
  });
}
