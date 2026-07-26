/**
 * Vyora — Ledger Event Log (ARCH-002). Every change to the ledger is recorded as an
 * append-only, typed event. The active ledger state (parties / transactions /
 * payments) is DERIVABLE from the event log via `reduceEvents` — proven byte-identical
 * to the materialized snapshot by the regression tests.
 *
 * The materialized arrays on `VyoraData` are kept as a fast working projection (so no
 * UI or workflow changes, and O(1) mutations); the event log is the record of truth
 * and the foundation for a perfect audit trail, richer timeline/undo, and future
 * sync / cloud / conflict resolution (events are the unit you send + merge).
 *
 * Bulk operations (import / restore) and periodic compaction write a CHECKPOINT that
 * carries a full snapshot, so the log stays self-sufficient AND bounded.
 */

import type { Party, Transaction, Payment, VyoraData } from "./types";

/** The active ledger a checkpoint captures / the reducer derives. */
export interface LedgerSnapshot {
  parties: Party[];
  transactions: Transaction[];
  payments: Payment[];
}

interface EventBase {
  id: string;
  /** ISO timestamp the event was recorded. */
  at: string;
}

export type LedgerEvent =
  | (EventBase & { type: "ContactCreated"; party: Party })
  | (EventBase & {
      type: "ContactUpdated";
      partyId: string;
      patch: { name?: string; phone?: string; note?: string };
    })
  | (EventBase & { type: "CreditRecorded"; transaction: Transaction })
  | (EventBase & { type: "PaymentRecorded"; payment: Payment })
  | (EventBase & { type: "DueDateChanged"; transactionId: string; dueDate?: string })
  | (EventBase & { type: "ContactDeleted"; partyId: string })
  | (EventBase & { type: "EntryDeleted"; entryId: string })
  | (EventBase & { type: "BackupCreated" })
  | (EventBase & { type: "RestoreCompleted"; snapshot: LedgerSnapshot })
  | (EventBase & {
      type: "ImportCompleted";
      snapshot: LedgerSnapshot;
      summary?: { contacts: number; entries: number };
    })
  /** Internal compaction / initial snapshot — subsumes all prior events. */
  | (EventBase & { type: "Checkpoint"; snapshot: LedgerSnapshot });

/** An event without its `id`/`at` — supplied when it's appended. */
export type LedgerEventSpec = DistributiveOmit<LedgerEvent, "id" | "at">;
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;

export type LedgerEventType = LedgerEvent["type"];

/** Beyond this many events, the log compacts to a single checkpoint (bounded storage). */
export const EVENT_LOG_CAP = 1000;

const snapshotOf = (data: VyoraData): LedgerSnapshot => ({
  parties: data.parties,
  transactions: data.transactions,
  payments: data.payments,
});

/** Append one event to the log (pure). `id`/`at` are injected for determinism. */
export function appendEvent(
  data: VyoraData,
  spec: LedgerEventSpec,
  id: string,
  at: string
): VyoraData {
  const event = { ...spec, id, at } as LedgerEvent;
  return { ...data, events: [...(data.events ?? []), event] };
}

/** A checkpoint event capturing the current active ledger. */
export function checkpointEvent(data: VyoraData, id: string, at: string): LedgerEvent {
  return { type: "Checkpoint", id, at, snapshot: snapshotOf(data) };
}

/** Replace the whole log with a single checkpoint (compaction / initial seed). */
export function compactEvents(data: VyoraData, id: string, at: string): VyoraData {
  return { ...data, events: [checkpointEvent(data, id, at)] };
}

/**
 * DERIVE the active ledger purely from the event log. A checkpoint (or import/restore)
 * resets state to its snapshot; every other event applies its delta. This is the proof
 * that ledger state is a function of the events.
 */
export function reduceEvents(events: readonly LedgerEvent[]): LedgerSnapshot {
  let parties: Party[] = [];
  let transactions: Transaction[] = [];
  let payments: Payment[] = [];
  for (const e of events) {
    switch (e.type) {
      case "Checkpoint":
      case "RestoreCompleted":
      case "ImportCompleted":
        parties = [...e.snapshot.parties];
        transactions = [...e.snapshot.transactions];
        payments = [...e.snapshot.payments];
        break;
      case "ContactCreated":
        parties = [...parties, e.party];
        break;
      case "ContactUpdated":
        parties = parties.map((p) =>
          p.id === e.partyId
            ? { ...p, name: e.patch.name ?? p.name, phone: e.patch.phone, note: e.patch.note }
            : p
        );
        break;
      case "ContactDeleted":
        parties = parties.filter((p) => p.id !== e.partyId);
        transactions = transactions.filter((t) => t.partyId !== e.partyId);
        payments = payments.filter((p) => p.partyId !== e.partyId);
        break;
      case "CreditRecorded":
        transactions = [...transactions, e.transaction];
        break;
      case "PaymentRecorded":
        payments = [...payments, e.payment];
        break;
      case "EntryDeleted":
        transactions = transactions.filter((t) => t.id !== e.entryId);
        payments = payments.filter((p) => p.id !== e.entryId);
        break;
      case "DueDateChanged":
        transactions = transactions.map((t) =>
          t.id === e.transactionId ? { ...t, dueDate: e.dueDate } : t
        );
        break;
      case "BackupCreated":
        break; // audit only — no state change
    }
  }
  return { parties, transactions, payments };
}
