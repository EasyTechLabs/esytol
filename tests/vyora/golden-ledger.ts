/**
 * Vyora — the Golden Ledger (QA-001).
 *
 * One canonical merchant, big enough to be honest about: **500 contacts and
 * 15,000 credit entries**, plus payments, deletions, restores and a contact
 * removal. Every regression suite and every benchmark reads it from here rather
 * than inventing its own data, so "it passed on my fixture" stops being a thing
 * anyone can say.
 *
 * It is built as an **event log**, not as raw state. That matters: since
 * ARCH-002 the log is the source of truth, so a fixture made of events
 * exercises the whole stack — events → projection → indexes — and lets deleted,
 * restored and undone entries exist as real history rather than as data that
 * was quietly never written.
 *
 * **Fully deterministic.** A seeded LCG drives every choice and ids are derived
 * from counters, never `crypto.randomUUID` or a clock. The same build produces
 * the same bytes on every machine, which is what makes a benchmark comparable
 * to yesterday's and a failure reproducible.
 *
 * Building it costs real time, so every accessor is memoized per process.
 */

import type { VyoraData, Party, Transaction, Payment } from "@/lib/vyora/types";
import type { LedgerEvent } from "@/lib/vyora/events";
import { reduceEvents } from "@/lib/vyora/events";
import type { Ledger } from "@/lib/vyora/ledger";
import { buildLedger } from "@/lib/vyora/ledger";
import type { Command } from "@/lib/vyora/commands";
import { makeRng } from "./legacy-selectors";

// ─── Shape ───────────────────────────────────────────────────────────────────

export const GOLDEN_CONTACTS = 500;
export const GOLDEN_TRANSACTIONS = 15_000;
/** Roughly a quarter of entries are payments — most credit is settled in parts. */
export const GOLDEN_PAYMENTS = 4_000;
export const GOLDEN_DELETED = 200;
export const GOLDEN_RESTORED = 50;
/** Contacts seeded by the opening import, before the merchant's own history. */
export const GOLDEN_IMPORTED_CONTACTS = 20;

const SEED = 20260801;
const BASE_MS = Date.parse("2024-01-01T00:00:00.000Z");
const DAY_MS = 86_400_000;

/** Ledger "today" — fixed, so overdue ages never drift with the wall clock. */
export const GOLDEN_TODAY = "2026-08-01";

const stamp = (n: number) => new Date(BASE_MS + n * 1000).toISOString();
const day = (n: number) => new Date(BASE_MS + n * DAY_MS).toISOString().slice(0, 10);

// ─── Builder ─────────────────────────────────────────────────────────────────

interface Cursor {
  tick: number;
}

/**
 * A distributive omit: applied to the union it produces a union of Omits, so
 * each event shape keeps its own payload. A plain `Omit<LedgerEvent, …>`
 * collapses the discriminated union and loses every payload field.
 */
type EventBody<T> = T extends LedgerEvent ? Omit<T, "id" | "at"> : never;

function nextEvent(cursor: Cursor, body: EventBody<LedgerEvent>): LedgerEvent {
  cursor.tick += 1;
  return { ...body, id: "evt_" + cursor.tick, at: stamp(cursor.tick) } as LedgerEvent;
}

/**
 * Every fifth contact is a supplier — someone the merchant BUYS from, so their
 * balance runs negative and they must never appear in a collection list.
 * Deterministic from the id, so the same contacts are suppliers on every run.
 */
export function isSupplierContact(partyId: string): boolean {
  const index = Number(partyId.replace(/^\D+/, ""));
  return Number.isFinite(index) && index % 5 === 0;
}

function makeContact(index: number, rng: () => number): Party {
  return {
    id: "pty_" + index,
    // A handful of deliberate name collisions — real ledgers have two Rameshes.
    name: index % 97 === 0 ? "Ramesh" : "Contact " + index,
    phone: index % 3 === 0 ? "98" + String(1_000_000 + index) : undefined,
    note: rng() < 0.1 ? "regular" : undefined,
    createdAt: stamp(index),
  };
}

/** The snapshot the ledger opens with — a merchant restoring an earlier backup. */
export function goldenImportSnapshot(): VyoraData {
  const rng = makeRng(SEED ^ 0x5eed);
  const parties: Party[] = [];
  const transactions: Transaction[] = [];
  for (let i = 0; i < GOLDEN_IMPORTED_CONTACTS; i++) {
    parties.push({
      id: "imp_" + i,
      name: "Imported " + i,
      phone: undefined,
      note: undefined,
      createdAt: stamp(i),
    });
    transactions.push({
      id: "imp_txn_" + i,
      partyId: "imp_" + i,
      amount: 100 + Math.floor(rng() * 900),
      kind: "given",
      description: undefined,
      date: day(i),
      dueDate: undefined,
      createdAt: stamp(i),
    });
  }
  return { version: 2, parties, transactions, payments: [] };
}

function buildGoldenEvents(): LedgerEvent[] {
  const rng = makeRng(SEED);
  const cursor: Cursor = { tick: 0 };
  const events: LedgerEvent[] = [];

  // 0 — the merchant restores a backup, then carries on. Everything after this
  //     is layered on top of imported state, exactly as it would be in life.
  events.push(nextEvent(cursor, { type: "ImportCompleted", snapshot: goldenImportSnapshot() }));

  // 1 — contacts
  const contacts: Party[] = [];
  for (let i = 0; i < GOLDEN_CONTACTS; i++) {
    const party = makeContact(i, rng);
    contacts.push(party);
    events.push(nextEvent(cursor, { type: "ContactCreated", party }));
  }

  // 2 — credit. A fifth are SUPPLIERS (goods taken on credit → the merchant
  //     owes them), which is what keeps `payable` and negative nets exercised.
  const transactions: Transaction[] = [];
  for (let i = 0; i < GOLDEN_TRANSACTIONS; i++) {
    const party = contacts[Math.floor(rng() * contacts.length)];
    // Suppliers are PARTIES, not individual entries. Rolling `taken` per
    // transaction spread both directions across everyone, so no contact ever
    // ended up net-negative and the fixture contained no payable at all —
    // exactly the edge case it claims to cover. Every fifth contact is now a
    // supplier, and only ever takes credit.
    const supplier = isSupplierContact(party.id);
    const roll = rng();
    // LONG OVERDUE: due dates well before GOLDEN_TODAY. Some recent, some ancient.
    const dueDate =
      roll < 0.25 ? day(Math.floor(rng() * 500)) : roll < 0.4 ? day(1000 + (i % 200)) : undefined;
    const transaction: Transaction = {
      id: "txn_" + i,
      partyId: party.id,
      amount: 50 + Math.floor(rng() * 20_000),
      kind: supplier ? "taken" : "given",
      description: rng() < 0.4 ? "item " + (i % 50) : undefined,
      date: day(i % 900),
      dueDate,
      createdAt: stamp(cursor.tick + 1),
    };
    transactions.push(transaction);
    events.push(nextEvent(cursor, { type: "CreditRecorded", transaction }));
  }

  // 3 — payments, mostly PARTIAL: a fraction of one credit, so balances stay
  //     open and aging stays meaningful. Supplier credits get "paid" back.
  const payments: Payment[] = [];
  for (let i = 0; i < GOLDEN_PAYMENTS; i++) {
    const against = transactions[Math.floor(rng() * transactions.length)];
    // Partial, so balances stay open — a supplier settled in full would stop
    // being a payable and the fixture would lose the case again.
    const partial = Math.max(1, Math.floor(against.amount * (0.1 + rng() * 0.5)));
    const payment: Payment = {
      id: "pay_" + i,
      partyId: against.partyId,
      amount: partial,
      kind: against.kind === "taken" ? "paid" : "received",
      note: rng() < 0.3 ? "upi" : undefined,
      date: day(i % 900),
      createdAt: stamp(cursor.tick + 1),
    };
    payments.push(payment);
    events.push(nextEvent(cursor, { type: "PaymentRecorded", payment }));
  }

  // 4 — mistakes, deleted
  const deleted: Transaction[] = [];
  for (let i = 0; i < GOLDEN_DELETED; i++) {
    const victim = transactions[Math.floor(rng() * transactions.length)];
    if (deleted.some((t) => t.id === victim.id)) continue;
    deleted.push(victim);
    events.push(nextEvent(cursor, { type: "EntryDeleted", entryId: victim.id }));
  }

  // 5 — some of those deletions undone. A restore re-emits the ORIGINAL row, so
  //     its createdAt is older than everything after it — which deliberately
  //     drives the index engine down its out-of-order fallback path.
  for (let i = 0; i < Math.min(GOLDEN_RESTORED, deleted.length); i++) {
    events.push(nextEvent(cursor, { type: "CreditRecorded", transaction: deleted[i] }));
  }

  // 6 — a contact removed outright, taking its entries with it
  events.push(
    nextEvent(cursor, { type: "ContactDeleted", partyId: contacts[contacts.length - 1].id })
  );

  // 7 — the merchant takes a backup at the end
  events.push(
    nextEvent(cursor, { type: "BackupCreated", entryCount: transactions.length + payments.length })
  );

  return events;
}

// ─── Memoized accessors ──────────────────────────────────────────────────────

let eventsCache: LedgerEvent[] | null = null;
let projectionCache: VyoraData | null = null;
let ledgerCache: Ledger | null = null;

/** The canonical event log. Same bytes every run. */
export function goldenEvents(): readonly LedgerEvent[] {
  if (!eventsCache) eventsCache = buildGoldenEvents();
  return eventsCache;
}

/** The projection the log folds to. */
export function goldenProjection(): VyoraData {
  if (!projectionCache) projectionCache = reduceEvents(goldenEvents());
  return projectionCache;
}

/** The indexes derived from it. */
export function goldenLedger(): Ledger {
  if (!ledgerCache) ledgerCache = buildLedger(goldenProjection());
  return ledgerCache;
}

/** The ids the fixture guarantees exist, for tests that need a real handle. */
export function goldenSample() {
  const data = goldenProjection();
  return {
    contact: data.parties[Math.floor(data.parties.length / 2)],
    transaction: data.transactions[Math.floor(data.transactions.length / 2)],
    payment: data.payments[Math.floor(data.payments.length / 2)],
  };
}

// ─── Negative attempts ───────────────────────────────────────────────────────

/**
 * Commands that MUST be rejected, whatever the ledger contains.
 *
 * Kept beside the fixture on purpose: a golden ledger that only proves the
 * happy path is half a fixture. Every one of these is asserted to fail *and* to
 * emit nothing.
 */
export const GOLDEN_REJECTED: ReadonlyArray<{ why: string; command: Command }> = [
  {
    why: "zero amount",
    command: { type: "RecordCredit", contactName: "A", amount: 0, kind: "given" },
  },
  {
    why: "negative amount",
    command: { type: "RecordCredit", contactName: "A", amount: -1, kind: "given" },
  },
  {
    why: "not a number",
    command: { type: "RecordCredit", contactName: "A", amount: Number.NaN, kind: "given" },
  },
  {
    why: "infinite amount",
    command: {
      type: "RecordCredit",
      contactName: "A",
      amount: Number.POSITIVE_INFINITY,
      kind: "given",
    },
  },
  {
    why: "no contact name",
    command: { type: "RecordCredit", contactName: "  ", amount: 5, kind: "given" },
  },
  {
    why: "negative payment",
    command: { type: "RecordPayment", contactName: "A", amount: -5, kind: "received" },
  },
  { why: "blank contact", command: { type: "CreateContact", name: "" } },
  { why: "unknown entry", command: { type: "DeleteEntry", entryId: "does-not-exist" } },
  { why: "unknown contact", command: { type: "DeleteContact", contactId: "does-not-exist" } },
  { why: "entry not in history", command: { type: "RestoreEntry", entryId: "never-existed" } },
  { why: "malformed file", command: { type: "ImportLedger", payload: "{not json" } },
  { why: "empty file", command: { type: "ImportLedger", payload: "" } },
  {
    why: "malformed date",
    command: {
      type: "RecordCredit",
      contactName: "A",
      amount: 5,
      kind: "given",
      date: "01-08-2026",
    },
  },
];
