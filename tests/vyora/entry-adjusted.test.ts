/**
 * A correction to an agreed credit, pulled from the server (vyora-api 8e001f8).
 *
 * It lands as an entry of its own beside the credit it corrects; the original
 * is untouched. The net moves by exactly its amount, and nothing counts it as
 * money collected.
 */

import { describe, expect, it } from "vitest";
import { createContactCreated, createCreditRecorded, reduceEvents } from "@/lib/vyora/events";
import type { LedgerEvent } from "@/lib/vyora/events";
import { buildLedger } from "@/lib/vyora/ledger";

const DAY = "2026-11-10";

function adjusted(
  partyId: string,
  creditId: string,
  kind: "given" | "received",
  amount: number
): LedgerEvent {
  return {
    id: `evt_adj_${kind}_${amount}`,
    at: `${DAY}T10:00:00.000Z`,
    type: "EntryAdjusted",
    adjustment: {
      id: `txn_adj_${kind}_${amount}`,
      partyId,
      adjustsEntryId: creditId,
      kind,
      amount,
      reason: "Two bags of rice came back",
      date: DAY,
      createdAt: `${DAY}T10:00:00.000Z`,
    },
  } as LedgerEvent;
}

function book(extra: (partyId: string, creditId: string) => LedgerEvent[]) {
  const party = createContactCreated({ name: "Meena" });
  const credit = createCreditRecorded({ partyId: party.party.id, amount: 1000, kind: "given" });
  const data = reduceEvents([party, credit, ...extra(party.party.id, credit.transaction.id)]);
  return {
    ledger: buildLedger(data),
    partyId: party.party.id,
    creditId: credit.transaction.id,
    data,
  };
}

describe("a pulled correction", () => {
  it("lowers what is owed by exactly its amount, beside the untouched original", () => {
    const { ledger, partyId, creditId, data } = book((p, c) => [adjusted(p, c, "received", 200)]);
    expect(ledger.balances.netByParty.get(partyId)).toBe(800);
    expect(data.transactions.find((t) => t.id === creditId)?.amount).toBe(1000);
    const labels = ledger.timeline.newestFirst.map((i) => i.label);
    expect(labels).toContain("Adjustment — owes less");
  });

  it("raises it for an increase, and folds once if the same event arrives twice", () => {
    const { ledger, partyId } = book((p, c) => [
      adjusted(p, c, "given", 150),
      adjusted(p, c, "given", 150),
    ]);
    expect(ledger.balances.netByParty.get(partyId)).toBe(1150);
  });

  it("is not counted as money collected", () => {
    const { ledger } = book((p, c) => [adjusted(p, c, "received", 200)]);
    expect(ledger.statistics.collectionsByDate.get(DAY) ?? 0).toBe(0);
  });
});
