/**
 * Vyora — Trust Review (ENG-007). The two values that were previously calculated
 * in more than one place now have a single source: recovery ranking (`rankOverdue`)
 * and backup freshness (`backupStatus`). These lock that in.
 */

import { describe, it, expect } from "vitest";
import { emptyData, backupStatus, BACKUP_STALE_DAYS } from "@/lib/vyora/store";
import { rankOverdue, type OverdueRow } from "@/lib/vyora/aging";
import type { VyoraData, Transaction } from "@/lib/vyora/types";

const AT = "2026-07-26";
const txn = (id: string, partyId: string, amount: number): Transaction => ({
  id,
  partyId,
  amount,
  kind: "given",
  date: "2026-06-01",
  createdAt: `${AT}T00:00:00.000Z`,
});
const row = (partyId: string, overdueAmount: number, daysOverdue: number): OverdueRow => ({
  partyId,
  overdueAmount,
  daysOverdue,
  openReceivable: overdueAmount,
  net: overdueAmount,
});

describe("rankOverdue — single recovery ranking (ENG-007)", () => {
  const data: VyoraData = {
    ...emptyData(),
    transactions: [txn("t1", "big", 9000), txn("t2", "small", 300)],
  };
  const rows = [row("small", 300, 5), row("big", 9000, 40)];

  it("scores every row and orders highest-priority first", () => {
    const ranked = rankOverdue(data, rows);
    expect(ranked[0]!.partyId).toBe("big");
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score!);
    expect(ranked[0]!.priority).toBeDefined();
  });

  it("is order-independent — the same input set yields the same ranking", () => {
    const a = rankOverdue(data, [rows[0]!, rows[1]!]).map((r) => r.partyId);
    const b = rankOverdue(data, [rows[1]!, rows[0]!]).map((r) => r.partyId);
    expect(a).toEqual(b);
  });
});

describe("backupStatus — single backup freshness source (ENG-007)", () => {
  const day = 86_400_000;
  const now = new Date(`${AT}T12:00:00.000Z`).getTime();

  it("is stale and unlabelled when never backed up", () => {
    const s = backupStatus(null, now);
    expect(s.ageDays).toBeNull();
    expect(s.stale).toBe(true);
    expect(s.ago).toBe("");
  });

  it("is fresh and labelled 'today' when backed up today", () => {
    const s = backupStatus(new Date(now - 2 * 3600_000).toISOString(), now);
    expect(s.ageDays).toBe(0);
    expect(s.stale).toBe(false);
    expect(s.ago).toBe("today");
  });

  it(`turns stale after ${BACKUP_STALE_DAYS} days`, () => {
    expect(backupStatus(new Date(now - 5 * day).toISOString(), now).stale).toBe(false);
    const old = backupStatus(new Date(now - (BACKUP_STALE_DAYS + 1) * day).toISOString(), now);
    expect(old.stale).toBe(true);
    expect(old.ago).toBe(`${BACKUP_STALE_DAYS + 1} days ago`);
  });
});
