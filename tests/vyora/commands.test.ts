/**
 * Vyora — Command Engine (ARCH-003). Every ledger mutation goes through one path:
 * Validate → Execute → Emit Event → Return Result. These lock in validation, the
 * emitted events, the return values, and — tying ARCH-002 together — that the state
 * a command produces is derivable from the events it emits.
 */

import { describe, it, expect } from "vitest";
import { emptyData } from "@/lib/vyora/store";
import {
  createContact,
  recordCredit,
  recordPayment,
  deleteEntry,
  deleteContact,
  restoreEntry,
  backupLedger,
  exportLedger,
  type CommandCtx,
  type CommandResult,
} from "@/lib/vyora/commands";
import { reduceEvents } from "@/lib/vyora/events";

let n = 0;
const ctx: CommandCtx = { newId: () => `evt${n++}`, now: () => "2026-07-30T00:00:00.000Z" };
const ok = <V>(r: CommandResult<V>): Extract<CommandResult<V>, { ok: true }> => {
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`);
  return r;
};

describe("command engine — validate", () => {
  it("rejects an empty contact name", () => {
    expect(createContact(emptyData(), { name: "  " }, ctx).ok).toBe(false);
  });
  it("rejects a non-positive credit/payment amount", () => {
    const inp = { party: { kind: "new" as const, name: "X" }, amount: 0 };
    expect(recordCredit(emptyData(), { ...inp, kind: "given" }, ctx).ok).toBe(false);
    expect(recordPayment(emptyData(), { ...inp, kind: "received" }, ctx).ok).toBe(false);
  });
  it("rejects deleting/restoring something that isn't there", () => {
    expect(deleteEntry(emptyData(), "nope", ctx).ok).toBe(false);
    expect(deleteContact(emptyData(), "nope", ctx).ok).toBe(false);
    expect(restoreEntry(emptyData(), "nope", ctx).ok).toBe(false);
  });
});

describe("command engine — execute + emit + return", () => {
  it("createContact adds the party and emits ContactCreated", () => {
    const r = ok(createContact(emptyData(), { name: "Alice", phone: "999" }, ctx));
    expect(r.value.name).toBe("Alice");
    expect(r.data.parties.map((p) => p.name)).toEqual(["Alice"]);
    expect(r.data.events!.map((e) => e.type)).toEqual(["ContactCreated"]);
  });

  it("recordCredit for a new contact emits ContactCreated + CreditRecorded and returns the id", () => {
    const r = ok(
      recordCredit(
        emptyData(),
        { party: { kind: "new", name: "Bob" }, amount: 500, kind: "given" },
        ctx
      )
    );
    expect(r.data.parties.map((p) => p.name)).toEqual(["Bob"]);
    expect(r.data.transactions).toHaveLength(1);
    expect(r.value).toBe(r.data.parties[0]!.id);
    expect(r.data.events!.map((e) => e.type)).toEqual(["ContactCreated", "CreditRecorded"]);
  });

  it("backupLedger emits BackupCreated + stamps the backup time; exportLedger returns a file", () => {
    const b = ok(backupLedger(emptyData(), ctx));
    expect(b.data.meta.lastBackupAt).not.toBeNull();
    expect(b.data.events!.at(-1)!.type).toBe("BackupCreated");
    const e = ok(exportLedger(emptyData()));
    expect(e.value.filename).toMatch(/\.json$/);
    expect(e.data.meta.exportCount).toBe(1);
  });

  it("deleteEntry / deleteContact remove records and emit the right events", () => {
    let d = ok(createContact(emptyData(), { name: "Carol" }, ctx)).data;
    const cid = d.parties[0]!.id;
    d = ok(
      recordCredit(d, { party: { kind: "existing", id: cid }, amount: 100, kind: "given" }, ctx)
    ).data;
    const txnId = d.transactions[0]!.id;
    const del = ok(deleteEntry(d, txnId, ctx));
    expect(del.data.transactions.find((t) => t.id === txnId)).toBeUndefined();
    expect(del.data.events!.at(-1)!.type).toBe("EntryDeleted");
    const dc = ok(deleteContact(d, cid, ctx));
    expect(dc.data.parties).toHaveLength(0);
    expect(dc.data.events!.at(-1)!.type).toBe("ContactDeleted");
  });
});

describe("command engine — state derives from emitted events (ARCH-002 ↔ ARCH-003)", () => {
  it("after a sequence of commands, reduceEvents(events) === the produced ledger", () => {
    let d = ok(createContact(emptyData(), { name: "Alice", phone: "111" }, ctx)).data;
    const id = d.parties[0]!.id;
    d = ok(
      recordCredit(d, { party: { kind: "existing", id }, amount: 800, kind: "given" }, ctx)
    ).data;
    d = ok(
      recordPayment(d, { party: { kind: "existing", id }, amount: 300, kind: "received" }, ctx)
    ).data;
    const s = reduceEvents(d.events!);
    expect(s.parties).toEqual(d.parties);
    expect(s.transactions).toEqual(d.transactions);
    expect(s.payments).toEqual(d.payments);
  });
});
