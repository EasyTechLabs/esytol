/**
 * The backup envelope: what a merchant's file contains, and what it refuses.
 *
 * The format changed for a reason worth restating. The previous file serialised
 * the **projection** — `{parties, transactions, payments}` — but closed days
 * live only in the event log; `closing.ts` reads them straight from `DayClosed`
 * events and `VyoraData` has no field for them. Exporting and restoring a v2
 * backup therefore destroyed every day-closing sign-off. A closing is the one
 * figure a merchant signs, and losing it inside the feature that exists to keep
 * their data safe is the worst place to lose it.
 *
 * Schema 3 carries the event log, so a restore rebuilds the same book.
 */

import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  CHECKSUM_ALGORITHM,
  buildBackup,
  canonicalJson,
  checksumOf,
  latestInstantMs,
  parseBackup,
  summarise,
} from "@/lib/vyora/backup";
import { reduceEvents, type LedgerEvent } from "@/lib/vyora/events";
import { buildLedger, readStatement } from "@/lib/vyora/ledger";

const APP = { name: "vyora", version: "test" };
const AT = "2026-08-10T10:00:00.000Z";
const PARTY = "pty_book";

/** A populated book: a contact, two entries and a signed-off day. */
const BOOK: LedgerEvent[] = [
  {
    id: "evt_1",
    at: "2026-08-01T09:00:00.000Z",
    type: "ContactCreated",
    party: { id: PARTY, name: "Ramesh Traders", createdAt: "2026-08-01T09:00:00.000Z" },
  },
  {
    id: "evt_2",
    at: "2026-08-01T09:00:01.000Z",
    type: "CreditRecorded",
    transaction: {
      id: "txn_1",
      partyId: PARTY,
      amount: 2000,
      kind: "given",
      date: "2026-08-01",
      createdAt: "2026-08-01T09:00:01.000Z",
    },
  },
  {
    id: "evt_3",
    at: "2026-08-02T09:00:02.000Z",
    type: "PaymentRecorded",
    payment: {
      id: "pay_1",
      partyId: PARTY,
      amount: 500,
      kind: "received",
      date: "2026-08-02",
      createdAt: "2026-08-02T09:00:02.000Z",
    },
  },
  {
    id: "evt_4",
    at: "2026-08-02T18:00:00.000Z",
    type: "DayClosed",
    date: "2026-08-02",
    notes: "signed",
    // The figures the merchant signed. Frozen: a later entry must never rewrite
    // them, which is exactly why they travel in the backup as an event.
    summary: {
      date: "2026-08-02",
      collected: 500,
      creditGiven: 2000,
      paidOut: 0,
      netCash: 500,
      outstandingChange: 1500,
      entryCount: 2,
    },
  },
];

const statementOf = (events: readonly LedgerEvent[]) =>
  readStatement(buildLedger(reduceEvents(events)), PARTY);

describe("the checksum", () => {
  it("is deterministic for the same log", () => {
    expect(checksumOf(BOOK)).toBe(checksumOf(BOOK));
  });

  it("does not depend on the order keys happen to be written in", () => {
    const reordered = JSON.parse(
      JSON.stringify(BOOK, ["type", "id", "at", "party", "transaction", "payment", "date"])
    ) as LedgerEvent[];
    expect(canonicalJson(reordered)).toBe(canonicalJson(JSON.parse(JSON.stringify(reordered))));
  });

  it("changes when a single rupee changes", () => {
    const altered = JSON.parse(JSON.stringify(BOOK)) as LedgerEvent[];
    (altered[1] as { transaction: { amount: number } }).transaction.amount = 2001;
    expect(checksumOf(altered)).not.toBe(checksumOf(BOOK));
  });

  it("changes when two entries swap places", () => {
    const swapped = [BOOK[0], BOOK[2], BOOK[1], BOOK[3]];
    expect(checksumOf(swapped)).not.toBe(checksumOf(BOOK));
  });
});

describe("an exported backup", () => {
  const file = buildBackup(BOOK, APP, AT);
  const parsed = JSON.parse(file.contents) as Record<string, unknown>;

  it("declares its format, version and integrity check", () => {
    expect(parsed.format).toBe(BACKUP_FORMAT);
    expect(parsed.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(parsed.exportedAt).toBe(AT);
    expect(parsed.checksum).toEqual({
      algorithm: CHECKSUM_ALGORITHM,
      value: checksumOf(BOOK),
    });
  });

  it("carries the whole event log, including the closed day", () => {
    expect((parsed.events as LedgerEvent[]).length).toBe(BOOK.length);
    expect((parsed.events as LedgerEvent[]).some((e) => e.type === "DayClosed")).toBe(true);
  });

  it("carries no credential, identity, API URL or browser data", () => {
    const text = file.contents.toLowerCase();
    for (const forbidden of [
      "token",
      "secret",
      "password",
      "cookie",
      "identity",
      "apibaseurl",
      "authorization",
      "bearer",
      "localhost",
      "http://",
      "https://",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("names the file by its export date", () => {
    expect(file.fileName).toBe("vyora-backup-2026-08-10.json");
  });

  it("does not mutate the log it was built from", () => {
    const before = JSON.stringify(BOOK);
    buildBackup(BOOK, APP, AT);
    expect(JSON.stringify(BOOK)).toBe(before);
  });
});

describe("restoring a backup", () => {
  it("round-trips a populated book exactly", () => {
    const file = buildBackup(BOOK, APP, AT);
    const parsed = parseBackup(file.contents);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.events).toEqual(BOOK);

    // Parties, entries, balances and running order all survive.
    const before = statementOf(BOOK);
    const after = statementOf(parsed.events);
    expect(after.map((r) => r.id)).toEqual(before.map((r) => r.id));
    expect(after.map((r) => r.runningNet)).toEqual([2000, 1500]);
  });

  it("reports what the file holds before anything is replaced", () => {
    const parsed = parseBackup(buildBackup(BOOK, APP, AT).contents);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.summary).toMatchObject({
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: AT,
      parties: 1,
      entries: 2,
      closedDays: 1,
      firstEntryDate: "2026-08-01",
      lastEntryDate: "2026-08-02",
    });
    expect(parsed.summary.warnings).toEqual([]);
  });

  it("keeps the frozen closing figures as they were signed", () => {
    const parsed = parseBackup(buildBackup(BOOK, APP, AT).contents);
    if (!parsed.ok) throw new Error("expected a valid backup");
    const closed = parsed.events.find((e) => e.type === "DayClosed");
    expect(closed).toEqual(BOOK[3]);
  });
});

describe("a file that cannot be trusted is refused", () => {
  const valid = buildBackup(BOOK, APP, AT).contents;

  it("refuses an altered amount, because the checksum no longer matches", () => {
    const tampered = JSON.parse(valid) as { events: LedgerEvent[] };
    (tampered.events[1] as { transaction: { amount: number } }).transaction.amount = 999999;
    const parsed = parseBackup(JSON.stringify(tampered));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reason).toMatch(/integrity check/i);
  });

  it("refuses a truncated file", () => {
    const parsed = parseBackup(valid.slice(0, Math.floor(valid.length / 2)));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reason).toMatch(/not readable JSON/i);
  });

  it("refuses a newer schema rather than guessing", () => {
    const future = { ...(JSON.parse(valid) as object), schemaVersion: BACKUP_SCHEMA_VERSION + 1 };
    const parsed = parseBackup(JSON.stringify(future));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reason).toMatch(/newer Vyora/i);
  });

  it("refuses an event type it does not understand", () => {
    const events = [...BOOK, { id: "evt_x", at: AT, type: "SomethingNewer" }];
    const parsed = parseBackup(
      JSON.stringify({
        format: BACKUP_FORMAT,
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportedAt: AT,
        app: APP,
        eventCount: events.length,
        checksum: { algorithm: CHECKSUM_ALGORITHM, value: checksumOf(events as LedgerEvent[]) },
        events,
      })
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reason).toMatch(/does not understand/i);
  });

  it("refuses duplicated event ids", () => {
    const events = [...BOOK, BOOK[0]];
    const parsed = parseBackup(
      JSON.stringify({
        format: BACKUP_FORMAT,
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportedAt: AT,
        app: APP,
        eventCount: events.length,
        checksum: { algorithm: CHECKSUM_ALGORITHM, value: checksumOf(events) },
        events,
      })
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reason).toMatch(/repeats an id/i);
  });

  it("refuses an empty file and a non-Vyora file", () => {
    expect(parseBackup("")).toMatchObject({ ok: false });
    expect(parseBackup(JSON.stringify({ hello: "world" }))).toMatchObject({ ok: false });
  });
});

describe("the older projection-only backup", () => {
  const legacy = JSON.stringify({
    app: "vyora",
    fileVersion: 2,
    exportedAt: "2026-07-01T00:00:00.000Z",
    data: {
      parties: [{ id: PARTY, name: "Ramesh Traders", createdAt: "2026-07-01T09:00:00.000Z" }],
      transactions: [
        {
          id: "txn_old",
          partyId: PARTY,
          amount: 800,
          kind: "given",
          date: "2026-07-01",
          createdAt: "2026-07-01T09:00:01.000Z",
        },
      ],
      payments: [],
    },
  });

  it("is still restorable, because refusing a merchant's only backup is worse", () => {
    const parsed = parseBackup(legacy);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.summary.parties).toBe(1);
    expect(parsed.summary.entries).toBe(1);
    expect(statementOf(parsed.events).map((r) => r.runningNet)).toEqual([800]);
  });

  it("says plainly what it cannot bring back", () => {
    const parsed = parseBackup(legacy);
    if (!parsed.ok) throw new Error("expected legacy to parse");
    expect(parsed.summary.closedDays).toBe(0);
    expect(parsed.summary.warnings.join(" ")).toMatch(/closed-day sign-offs/i);
    expect(parsed.summary.warnings.join(" ")).toMatch(/no integrity check/i);
  });
});

describe("the audit history a v2 backup used to destroy", () => {
  /**
   * These three event types change no balance, which is exactly why the old
   * projection-only file dropped them without anyone noticing. They are the
   * merchant's record of what happened.
   */
  const AUDITED: LedgerEvent[] = [
    ...BOOK,
    {
      id: "evt_r1",
      at: "2026-08-03T10:00:00.000Z",
      type: "ContactReminded",
      partyId: PARTY,
      tone: "gentle",
    },
    { id: "evt_d1", at: "2026-08-04T10:00:00.000Z", type: "EntryDeleted", entryId: "txn_1" },
    { id: "evt_b1", at: "2026-08-05T10:00:00.000Z", type: "BackupCreated", entryCount: 2 },
  ];

  it("survives a round trip intact", () => {
    const parsed = parseBackup(buildBackup(AUDITED, APP, AT).contents);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.events).toEqual(AUDITED);
    for (const type of ["DayClosed", "ContactReminded", "EntryDeleted", "BackupCreated"]) {
      expect(parsed.events.some((e) => e.type === type)).toBe(true);
    }
  });

  it("keeps a closing's signed figures byte-identical", () => {
    const parsed = parseBackup(buildBackup(AUDITED, APP, AT).contents);
    if (!parsed.ok) throw new Error("expected a valid backup");
    const closed = parsed.events.find((e) => e.type === "DayClosed");
    expect(closed).toEqual(BOOK[3]);
  });

  it("replays to the same projection, deletion included", () => {
    const parsed = parseBackup(buildBackup(AUDITED, APP, AT).contents);
    if (!parsed.ok) throw new Error("expected a valid backup");
    // txn_1 was deleted, so only the payment remains.
    expect(statementOf(parsed.events).map((r) => r.id)).toEqual(["pay_1"]);
    expect(statementOf(parsed.events)).toEqual(statementOf(AUDITED));
  });
});

describe("latestInstantMs", () => {
  it("finds the latest instant a restore has to clear", () => {
    expect(latestInstantMs(BOOK)).toBe(Date.parse("2026-08-02T18:00:00.000Z"));
  });

  it("looks at entry createdAt, not only the event's own timestamp", () => {
    const later = "2027-01-01T00:00:00.000Z";
    const events: LedgerEvent[] = [
      {
        id: "evt_late",
        at: "2026-01-01T00:00:00.000Z",
        type: "CreditRecorded",
        transaction: {
          id: "txn_late",
          partyId: PARTY,
          amount: 5,
          kind: "given",
          date: "2027-01-01",
          createdAt: later,
        },
      },
    ];
    expect(latestInstantMs(events)).toBe(Date.parse(later));
  });

  it("reports -1 for a book with nothing in it", () => {
    expect(latestInstantMs([])).toBe(-1);
  });
});

describe("summarise", () => {
  it("does not count an entry that was later deleted", () => {
    const withDelete: LedgerEvent[] = [
      ...BOOK,
      { id: "evt_del", at: AT, type: "EntryDeleted", entryId: "txn_1" },
    ];
    expect(
      summarise(withDelete, { schemaVersion: 3, exportedAt: null, appVersion: null }).entries
    ).toBe(1);
  });
});
