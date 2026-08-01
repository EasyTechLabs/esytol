/**
 * Vyora — Command Engine tests (ARCH-003).
 *
 * Two things are being defended here.
 *
 *  1. **Every command validates before it executes**, and a rejected command
 *     emits nothing at all. Half-applied writes are how a ledger silently stops
 *     adding up, so "no events on failure" is asserted for every command rather
 *     than assumed.
 *  2. **No component can reach around the engine.** The last block reads the
 *     actual source files and fails if a screen touches `localStorage` or
 *     imports the store — the objective of ARCH-003 stated as a test instead of
 *     a convention nobody enforces.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type {
  Command,
  CommandContext,
  DeleteContactResult,
  LedgerFile,
} from "@/lib/vyora/commands";
import { executeCommand, validateCommand } from "@/lib/vyora/commands";
import type { LedgerEvent } from "@/lib/vyora/events";
import { reduceEvents } from "@/lib/vyora/events";
import { buildLedger, readPartyNet } from "@/lib/vyora/ledger";
import type { Party } from "@/lib/vyora/types";

function contextFrom(events: readonly LedgerEvent[]): CommandContext {
  return { ledger: buildLedger(reduceEvents(events)), events };
}

const EMPTY = contextFrom([]);

/** Execute and fold the result back into a new context, as the provider does. */
function run(context: CommandContext, command: Command) {
  const result = executeCommand(context, command);
  const next = result.ok ? contextFrom([...context.events, ...result.events]) : context;
  return { result, next };
}

/** A ledger with one contact holding a ₹1000 credit and a ₹200 payment. */
function seeded() {
  const a = run(EMPTY, {
    type: "RecordCredit",
    contactName: "Ramesh",
    amount: 1000,
    kind: "given",
    date: "2026-07-10",
  });
  const b = run(a.next, {
    type: "RecordPayment",
    contactName: "Ramesh",
    amount: 200,
    kind: "received",
    date: "2026-07-21",
  });
  const party = b.next.ledger.data.parties[0];
  return { context: b.next, party };
}

// ─── Validation ──────────────────────────────────────────────────────────────

describe("validation rejects before anything is emitted", () => {
  const bad: Array<[string, Command]> = [
    ["a blank contact name", { type: "CreateContact", name: "   " }],
    ["a zero amount", { type: "RecordCredit", contactName: "Ramesh", amount: 0, kind: "given" }],
    [
      "a negative amount",
      { type: "RecordCredit", contactName: "Ramesh", amount: -50, kind: "given" },
    ],
    [
      "a non-numeric amount",
      { type: "RecordCredit", contactName: "Ramesh", amount: Number.NaN, kind: "given" },
    ],
    [
      "a missing contact name on capture",
      { type: "RecordCredit", contactName: "", amount: 100, kind: "given" },
    ],
    [
      "a malformed date",
      { type: "RecordCredit", contactName: "R", amount: 100, kind: "given", date: "21-07-2026" },
    ],
    [
      "a malformed due date",
      { type: "RecordCredit", contactName: "R", amount: 100, kind: "given", dueDate: "soon" },
    ],
    [
      "a payment with no amount",
      { type: "RecordPayment", contactName: "R", amount: 0, kind: "received" },
    ],
    ["an unknown entry", { type: "DeleteEntry", entryId: "nope" }],
    ["an unknown contact", { type: "DeleteContact", contactId: "nope" }],
    ["a file that is not JSON", { type: "ImportLedger", payload: "{oops" }],
    ["a file with no contacts", { type: "ImportLedger", payload: '{"data":{}}' }],
    ["an empty file", { type: "ImportLedger", payload: "" }],
  ];

  for (const [label, command] of bad) {
    it(`rejects ${label}, and emits nothing`, () => {
      expect(validateCommand(EMPTY, command)).not.toBeNull();
      const result = executeCommand(EMPTY, command);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toBeTruthy();
      expect((result as { events?: unknown }).events).toBeUndefined();
    });
  }

  it("states every rejection in plain language, never a code", () => {
    for (const [, command] of bad) {
      const error = validateCommand(EMPTY, command);
      expect(error?.message).toMatch(/^[A-Z₹]/);
      expect(error?.message).not.toMatch(/_/); // no SCREAMING_SNAKE leaking through
    }
  });
});

// ─── Capture ─────────────────────────────────────────────────────────────────

describe("RecordCredit / RecordPayment", () => {
  it("creates the contact when the name is new, in one command", () => {
    const { result, next } = run(EMPTY, {
      type: "RecordCredit",
      contactName: "Ramesh",
      amount: 1000,
      kind: "given",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events.map((e) => e.type)).toEqual(["ContactCreated", "CreditRecorded"]);
    expect((result.value as Party).name).toBe("Ramesh");
    expect(next.ledger.data.parties).toHaveLength(1);
  });

  it("reuses a known contact instead of minting a duplicate ledger", () => {
    const { context, party } = seeded();
    const { result, next } = run(context, {
      type: "RecordCredit",
      contactName: "  ramesh ",
      amount: 300,
      kind: "given",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events.map((e) => e.type)).toEqual(["CreditRecorded"]);
    expect(next.ledger.data.parties).toHaveLength(1);
    expect(readPartyNet(next.ledger, party.id)).toBe(1100); // 1000 − 200 + 300
  });

  it("drives the balance in both directions", () => {
    const { context, party } = seeded();
    expect(readPartyNet(context.ledger, party.id)).toBe(800);
  });
});

// ─── Delete and restore ──────────────────────────────────────────────────────

describe("DeleteEntry / RestoreEntry", () => {
  it("removes an entry and puts the original back, unchanged", () => {
    const { context, party } = seeded();
    const entry = context.ledger.data.transactions[0];

    const deleted = run(context, { type: "DeleteEntry", entryId: entry.id });
    expect(deleted.result.ok).toBe(true);
    expect(readPartyNet(deleted.next.ledger, party.id)).toBe(-200);

    const restored = run(deleted.next, { type: "RestoreEntry", entryId: entry.id });
    expect(restored.result.ok).toBe(true);
    expect(readPartyNet(restored.next.ledger, party.id)).toBe(800);
    // The row that comes back is the row that was lost, not a retyped one.
    expect(restored.next.ledger.data.transactions[0]).toEqual(entry);
  });

  it("refuses to restore something that is already here", () => {
    const { context } = seeded();
    const entry = context.ledger.data.transactions[0];
    expect(validateCommand(context, { type: "RestoreEntry", entryId: entry.id })?.code).toBe(
      "ENTRY_PRESENT"
    );
  });

  it("refuses to restore something this device never recorded", () => {
    const { context } = seeded();
    expect(validateCommand(context, { type: "RestoreEntry", entryId: "ghost" })?.code).toBe(
      "ENTRY_NOT_IN_HISTORY"
    );
  });

  it("refuses to restore an entry whose contact is gone", () => {
    const { context, party } = seeded();
    const entry = context.ledger.data.transactions[0];
    const gone = run(context, { type: "DeleteContact", contactId: party.id });
    expect(validateCommand(gone.next, { type: "RestoreEntry", entryId: entry.id })?.code).toBe(
      "CONTACT_NOT_FOUND"
    );
  });

  it("gives a fresh event id each time, so history is never ambiguous", () => {
    const { context } = seeded();
    const entry = context.ledger.data.transactions[0];
    const deleted = run(context, { type: "DeleteEntry", entryId: entry.id });
    const restored = run(deleted.next, { type: "RestoreEntry", entryId: entry.id });
    const ids = restored.next.events.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("DeleteContact", () => {
  it("reports how many entries went with it", () => {
    const { context, party } = seeded();
    const { result, next } = run(context, { type: "DeleteContact", contactId: party.id });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.value as DeleteContactResult).removedEntries).toBe(2);
    expect(next.ledger.data.parties).toHaveLength(0);
    expect(next.ledger.data.transactions).toHaveLength(0);
  });
});

// ─── Export / backup / import ────────────────────────────────────────────────

describe("ExportLedger / BackupLedger / ImportLedger", () => {
  it("export is a read: it emits nothing", () => {
    const { context } = seeded();
    const { result } = run(context, { type: "ExportLedger" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events).toEqual([]);
    expect((result.value as LedgerFile).fileName).toMatch(/^vyora-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it("backup records that a backup happened", () => {
    const { context } = seeded();
    const { result } = run(context, { type: "BackupLedger" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events.map((e) => e.type)).toEqual(["BackupCreated"]);
  });

  it("round-trips: export then import reproduces the same balances", () => {
    const { context, party } = seeded();
    const exported = executeCommand(context, { type: "ExportLedger" });
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const imported = run(EMPTY, {
      type: "ImportLedger",
      payload: (exported.value as LedgerFile).contents,
    });
    expect(imported.result.ok).toBe(true);
    const restoredParty = imported.next.ledger.data.parties[0];
    expect(restoredParty.id).toBe(party.id);
    expect(readPartyNet(imported.next.ledger, party.id)).toBe(800);
  });

  it("accepts a bare data object as well as a wrapped export", () => {
    const { context } = seeded();
    const bare = JSON.stringify(context.ledger.data);
    const { result } = run(EMPTY, { type: "ImportLedger", payload: bare });
    expect(result.ok).toBe(true);
  });
});

// ─── The architectural rule, enforced ────────────────────────────────────────

/** Vitest runs from the app root, where vitest.config.ts lives. */
const ROOT = process.cwd();
const UI_DIRS = [join(ROOT, "features", "vyora"), join(ROOT, "app", "vyora")];
/** The single write boundary: the only UI-layer file allowed to touch the store. */
const STORE_BOUNDARY = join("features", "vyora", "VyoraProvider.tsx");

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name)) found.push(full);
  }
  return found;
}

describe("no component reaches around the command engine", () => {
  const files = UI_DIRS.flatMap(sourceFiles);

  it("finds the UI files it is supposed to be checking", () => {
    expect(files.length).toBeGreaterThan(8);
  });

  it("never touches localStorage outside the store", () => {
    for (const file of files) {
      expect(readFileSync(file, "utf8")).not.toMatch(/localStorage/);
    }
  });

  it("imports the store only at the single write boundary", () => {
    for (const file of files) {
      const importsStore = /from\s+["']@\/lib\/vyora\/store["']/.test(readFileSync(file, "utf8"));
      const isBoundary = relative(ROOT, file).split(sep).join(sep) === STORE_BOUNDARY;
      expect(importsStore && !isBoundary).toBe(false);
    }
  });

  it("never reaches the event layer from a screen — commands do that", () => {
    // Checking the IMPORT, not function-name spelling: a screen that cannot
    // reach `events.ts` cannot mint an event, whatever it calls things.
    for (const file of files) {
      if (relative(ROOT, file).split(sep).join(sep) === STORE_BOUNDARY) continue;
      const source = readFileSync(file, "utf8");
      const importsEvents = /from\s+["']@\/lib\/vyora\/events["']/.test(source);
      expect({ file: relative(ROOT, file), importsEvents }).toEqual({
        file: relative(ROOT, file),
        importsEvents: false,
      });
    }
  });
});
