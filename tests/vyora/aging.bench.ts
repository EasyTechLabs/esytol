/**
 * Vyora — aging engine benchmarks (Epic A · Mission A1). Aging is FIFO-per-contact,
 * recomputed on read; these guard that it stays fast on a mid-range phone even for
 * a large merchant. Run with `npm run bench` (not part of the normal test suite).
 */

import { bench, describe } from "vitest";
import type { VyoraData, Transaction, Payment } from "@/lib/vyora/types";
import { overdueList, portfolioAging, agingForParty } from "@/lib/vyora/aging";

function makeDataset(parties: number, entriesPer: number): VyoraData {
  const P: VyoraData["parties"] = [];
  const T: Transaction[] = [];
  const Pay: Payment[] = [];
  for (let i = 0; i < parties; i++) {
    const id = `p${i}`;
    P.push({ id, name: `Contact ${i}`, createdAt: "2026-01-01T00:00:00.000Z" });
    for (let j = 0; j < entriesPer; j++) {
      const month = String((j % 12) + 1).padStart(2, "0");
      const day = String((j % 28) + 1).padStart(2, "0");
      const date = `2026-${month}-${day}`;
      T.push({
        id: `t${i}-${j}`,
        partyId: id,
        amount: 100 + ((i * j) % 900),
        kind: "given",
        date,
        dueDate: date,
        createdAt: `${date}T00:00:00.000Z`,
      });
      if (j % 3 === 0) {
        Pay.push({
          id: `r${i}-${j}`,
          partyId: id,
          amount: 50,
          kind: "received",
          date,
          createdAt: `${date}T00:00:00.000Z`,
        });
      }
    }
  }
  return {
    version: 2,
    meta: { lastBackupAt: null, exportCount: 0, importCount: 0 },
    parties: P,
    transactions: T,
    payments: Pay,
  };
}

const TODAY = "2026-12-31";
const typical = makeDataset(100, 10); // ~1,000 entries — a busy small merchant
const large = makeDataset(1000, 20); // ~20,000 entries — a stress ceiling

describe("aging performance", () => {
  bench("agingForParty · single contact (20 entries)", () => {
    agingForParty(large, "p0", TODAY);
  });
  bench("overdueList · 100 contacts × 10 entries", () => {
    overdueList(typical, TODAY);
  });
  bench("overdueList · 1,000 contacts × 20 entries", () => {
    overdueList(large, TODAY);
  });
  bench("portfolioAging · 1,000 contacts × 20 entries", () => {
    portfolioAging(large, TODAY);
  });
});
