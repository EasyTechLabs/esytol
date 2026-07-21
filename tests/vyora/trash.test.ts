/**
 * Vyora — Undo & Recovery Safety (P3-001). A merchant must never lose data by
 * pressing Delete: an entry or a contact soft-deletes into a 30-day trash, is
 * restorable, and a double-restore can never duplicate a ledger.
 */

import { describe, it, expect } from "vitest";
import {
  emptyData,
  addParty,
  addTransaction,
  addPayment,
  deleteEntry,
  deleteContact,
  restoreFromTrash,
  pruneTrash,
  TRASH_RETENTION_DAYS,
} from "@/lib/vyora/store";

const AT = "2026-07-21T00:00:00.000Z";

function seed() {
  let d = emptyData();
  const a = addParty(d, { name: "Rajesh" });
  d = a.data;
  const pid = a.party.id;
  const t = addTransaction(d, { partyId: pid, amount: 8000, kind: "given" });
  d = t.data;
  const p = addPayment(d, { partyId: pid, amount: 3000, kind: "received" });
  d = p.data;
  return { d, pid, txnId: t.transaction.id, payId: d.payments[0]!.id };
}

describe("trash — entry delete/restore (P3-001)", () => {
  it("deleteEntry soft-deletes to trash; the record leaves the active ledger", () => {
    const { d, txnId } = seed();
    const del = deleteEntry(d, txnId, AT);
    expect(del.transactions.find((t) => t.id === txnId)).toBeUndefined();
    expect(del.trash).toHaveLength(1);
    expect(del.trash![0]!.kind).toBe("entry");
    expect(del.trash![0]!.transactions[0]!.id).toBe(txnId);
    expect(del.trash![0]!.parties).toHaveLength(0); // the contact stays put
  });

  it("restoreFromTrash brings the entry back and empties that trash slot", () => {
    const { d, txnId } = seed();
    const del = deleteEntry(d, txnId, AT);
    const back = restoreFromTrash(del, del.trash![0]!.id);
    expect(back.transactions.find((t) => t.id === txnId)).toBeDefined();
    expect(back.trash).toHaveLength(0);
  });

  it("deleteEntry on an unknown id is a no-op (no phantom trash)", () => {
    const { d } = seed();
    const del = deleteEntry(d, "nope", AT);
    expect(del.trash ?? []).toHaveLength(0);
    expect(del.transactions).toHaveLength(1);
  });
});

describe("trash — contact delete/restore (P3-001)", () => {
  it("deleteContact removes the contact AND its whole history into one trash entry", () => {
    const { d, pid } = seed();
    const del = deleteContact(d, pid, AT);
    expect(del.parties).toHaveLength(0);
    expect(del.transactions).toHaveLength(0);
    expect(del.payments).toHaveLength(0);
    expect(del.trash).toHaveLength(1);
    const entry = del.trash![0]!;
    expect(entry.kind).toBe("contact");
    expect(entry.parties[0]!.id).toBe(pid);
    expect(entry.transactions).toHaveLength(1);
    expect(entry.payments).toHaveLength(1);
  });

  it("restoring a deleted contact brings the ledger back intact", () => {
    const { d, pid } = seed();
    const del = deleteContact(d, pid, AT);
    const back = restoreFromTrash(del, del.trash![0]!.id);
    expect(back.parties.find((p) => p.id === pid)).toBeDefined();
    expect(back.transactions).toHaveLength(1);
    expect(back.payments).toHaveLength(1);
    expect(back.trash).toHaveLength(0);
  });

  it("a double-restore never duplicates the ledger", () => {
    const { d, pid } = seed();
    const del = deleteContact(d, pid, AT);
    const trashId = del.trash![0]!.id;
    const once = restoreFromTrash(del, trashId);
    const twice = restoreFromTrash(once, trashId); // trash slot already gone → no-op
    expect(twice.parties.filter((p) => p.id === pid)).toHaveLength(1);
    expect(twice.transactions).toHaveLength(1);
    expect(twice.payments).toHaveLength(1);
  });
});

describe("trash — 30-day retention (P3-001)", () => {
  it("pruneTrash drops entries past 30 days and keeps recent ones", () => {
    const { d, txnId } = seed();
    const now = new Date(AT).getTime();
    const del = deleteEntry(d, txnId, AT);
    // Still inside the window → kept.
    expect(pruneTrash(del, now).trash).toHaveLength(1);
    // 31 days later → pruned.
    const later = now + (TRASH_RETENTION_DAYS + 1) * 86_400_000;
    expect(pruneTrash(del, later).trash).toHaveLength(0);
  });

  it("keeps an entry with an unparseable timestamp (never loses data silently)", () => {
    const { d, txnId } = seed();
    const del = deleteEntry(d, txnId, "not-a-date");
    const far = new Date(AT).getTime() + 999 * 86_400_000;
    expect(pruneTrash(del, far).trash).toHaveLength(1);
  });
});
