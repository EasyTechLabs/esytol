/**
 * Vyora — Data Integrity (ENG-005). The ledger must never become inconsistent:
 * no negative amounts, no orphan entries, no invalid contact refs, no duplicate
 * ids, no corrupted imports. Repairs are safe and non-destructive — unusable
 * entries are quarantined (recoverable), never silently dropped.
 */

import { describe, it, expect } from "vitest";
import { emptyData } from "@/lib/vyora/store";
import { runIntegrity } from "@/lib/vyora/integrity";
import type { VyoraData, Party, Transaction, Payment } from "@/lib/vyora/types";

const AT = "2026-07-26T00:00:00.000Z";
const party = (id: string): Party => ({ id, name: `P-${id}`, createdAt: AT });
const txn = (id: string, partyId: string, amount = 100): Transaction => ({
  id,
  partyId,
  amount,
  kind: "given",
  date: "2026-07-01",
  createdAt: AT,
});
const pay = (id: string, partyId: string, amount = 50): Payment => ({
  id,
  partyId,
  amount,
  kind: "received",
  date: "2026-07-01",
  createdAt: AT,
});
const make = (over: Partial<VyoraData>): VyoraData => ({ ...emptyData(), ...over });

describe("integrity — clean data", () => {
  it("reports consistent with no repairs on a valid ledger", () => {
    const d = make({
      parties: [party("p1")],
      transactions: [txn("t1", "p1")],
      payments: [pay("y1", "p1")],
    });
    const { data, report } = runIntegrity(d, AT);
    expect(report.ok).toBe(true);
    expect(report.repaired).toBe(false);
    expect(report.issues).toHaveLength(0);
    expect(data.transactions).toHaveLength(1);
    expect(data.parties).toHaveLength(1);
  });
});

describe("integrity — repairs (safe, minor)", () => {
  it("corrects a negative amount to its magnitude", () => {
    const d = make({ parties: [party("p1")], transactions: [txn("t1", "p1", -500)] });
    const { data, report } = runIntegrity(d, AT);
    expect(data.transactions[0]!.amount).toBe(500);
    expect(report.repaired).toBe(true);
    expect(report.ok).toBe(true); // a repair, not a warning
    expect(report.issues.some((i) => i.code === "amount-negative")).toBe(true);
  });

  it("reattaches an orphan entry to a Recovered entries contact", () => {
    const d = make({ parties: [party("p1")], transactions: [txn("t1", "ghost")] });
    const { data, report } = runIntegrity(d, AT);
    const rec = data.parties.find((p) => p.name === "Recovered entries");
    expect(rec).toBeDefined();
    expect(data.transactions[0]!.partyId).toBe(rec!.id);
    expect(report.ok).toBe(true);
    expect(report.issues.some((i) => i.code === "orphan-entry")).toBe(true);
  });

  it("regenerates a duplicate entry id (both entries survive, ids distinct)", () => {
    const d = make({
      parties: [party("p1")],
      transactions: [txn("dup", "p1"), txn("dup", "p1", 200)],
    });
    const { data, report } = runIntegrity(d, AT);
    expect(data.transactions).toHaveLength(2);
    expect(new Set(data.transactions.map((t) => t.id)).size).toBe(2);
    expect(report.issues.some((i) => i.code === "entry-id-duplicate")).toBe(true);
  });
});

describe("integrity — quarantine & warnings (major)", () => {
  it("quarantines an unusable amount into the trash rather than dropping it", () => {
    const d = make({
      parties: [party("p1")],
      transactions: [txn("t1", "p1", Number.NaN), txn("t2", "p1", 100)],
    });
    const { data, report } = runIntegrity(d, AT);
    expect(data.transactions).toHaveLength(1);
    expect(data.transactions[0]!.id).toBe("t2");
    expect(data.trash).toHaveLength(1);
    expect(data.trash![0]!.transactions[0]!.id).toBe("t1"); // recoverable, not lost
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.code === "amount-invalid" && i.severity === "warning")).toBe(
      true
    );
  });

  it("separates duplicate contact ids and warns (histories may have merged)", () => {
    const d = make({ parties: [party("dup"), party("dup")] });
    const { data, report } = runIntegrity(d, AT);
    expect(new Set(data.parties.map((p) => p.id)).size).toBe(2);
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.code === "party-id-duplicate")).toBe(true);
  });

  it("resets missing structure to empty arrays and warns", () => {
    const broken = {
      version: 2,
      meta: { lastBackupAt: null, exportCount: 0, importCount: 0 },
    } as unknown as VyoraData;
    const { data, report } = runIntegrity(broken, AT);
    expect(Array.isArray(data.parties)).toBe(true);
    expect(data.parties).toHaveLength(0);
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.code === "structure")).toBe(true);
  });
});

describe("integrity — idempotent", () => {
  it("a second run over repaired data finds nothing to fix", () => {
    const d = make({ parties: [party("p1")], transactions: [txn("t1", "ghost", -5)] });
    const first = runIntegrity(d, AT);
    const second = runIntegrity(first.data, AT);
    expect(second.report.repaired).toBe(false);
    expect(second.report.ok).toBe(true);
    expect(second.report.issues).toHaveLength(0);
  });
});
