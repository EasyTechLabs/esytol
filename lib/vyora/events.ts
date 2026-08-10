/**
 * Vyora — Ledger Event Log (ARCH-002).
 *
 * Every change to a merchant's ledger is an **event**. The event log is the
 * source of truth on the device; `VyoraData` is no longer stored — it is a
 * *projection* derived by folding the log, and the ARCH-001 index engine is
 * derived from that projection in turn:
 *
 *     LedgerEvent[]  ──reduceEvents──►  VyoraData  ──buildLedger──►  Ledger
 *       (persisted)                    (projection)                 (indexes)
 *
 * Why this shape:
 *  - **Audit trail.** The log is the history; nothing is silently overwritten.
 *  - **Timeline / undo.** Both are operations over an ordered log rather than
 *    bespoke state juggling (`revertLastEvent`).
 *  - **Future sync.** Two devices that exchange append-only events can converge;
 *    two devices that exchange mutable state cannot. Vyora stays local-first and
 *    ships **no** sync, cloud, or network code — this only stops the data model
 *    being the thing that blocks it.
 *
 * Rules for this module:
 *  - `applyEvent` is **pure and total** — every event type has a case, and an
 *    unknown one leaves state untouched rather than throwing into a merchant's
 *    screen.
 *  - Folding the same log twice must produce the same projection. No clocks, no
 *    randomness, no ambient state inside the fold: every value an event needs is
 *    captured in the event when it is *created*.
 */

import type { VyoraData, Party, Transaction, Payment, EntryKind, PaymentKind } from "./types";
import type { DaySummary } from "./closing";
import { nowISO } from "./clock";

/** Version of the persisted event-log format. */
export const LOG_VERSION = 2;

/** The empty projection — what an empty log folds to. */
export function emptyData(): VyoraData {
  return { version: LOG_VERSION, parties: [], transactions: [], payments: [] };
}

/** Stable unique id. Uses crypto.randomUUID when available. */
export function newId(prefix = "id"): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return `${prefix}_${c.randomUUID()}`;
  // Deterministic-enough fallback (never used on modern browsers / Node ≥ 19).
  return `${prefix}_${Date.now().toString(36)}${Math.round(performance?.now?.() ?? 0).toString(36)}`;
}

// ─── Event shapes ────────────────────────────────────────────────────────────

interface EventBase {
  /** Unique per event — the handle a future sync would deduplicate on. */
  readonly id: string;
  /** When the event was recorded, ISO instant. Ordering is the array's, not this. */
  readonly at: string;
}

/** Fields of a contact that a `ContactUpdated` event may set. */
export type PartyChanges = Partial<Pick<Party, "name" | "phone" | "note">>;

export interface ContactCreatedEvent extends EventBase {
  readonly type: "ContactCreated";
  readonly party: Party;
}

export interface ContactUpdatedEvent extends EventBase {
  readonly type: "ContactUpdated";
  readonly partyId: string;
  readonly changes: PartyChanges;
}

export interface ContactDeletedEvent extends EventBase {
  readonly type: "ContactDeleted";
  readonly partyId: string;
}

export interface CreditRecordedEvent extends EventBase {
  readonly type: "CreditRecorded";
  readonly transaction: Transaction;
}

export interface PaymentRecordedEvent extends EventBase {
  readonly type: "PaymentRecorded";
  readonly payment: Payment;
}

export interface DueDateChangedEvent extends EventBase {
  readonly type: "DueDateChanged";
  readonly transactionId: string;
  /** Absent clears the due date. */
  readonly dueDate?: string;
}

export interface EntryDeletedEvent extends EventBase {
  readonly type: "EntryDeleted";
  /** A transaction id or a payment id — entry ids are unique across both. */
  readonly entryId: string;
}

/**
 * Audit-only: the merchant followed up with a contact themselves.
 *
 * Recording this as an event is what lets "last contacted" exist with **no
 * schema change** — it is derived from history rather than stored on the
 * contact. Vyora sent nothing; this records that the merchant did.
 */
export interface ContactRemindedEvent extends EventBase {
  readonly type: "ContactReminded";
  readonly partyId: string;
  readonly tone: "gentle" | "normal" | "firm";
}

/**
 * Audit-only: the merchant signed off a trading day.
 *
 * Carries the summary they actually reviewed. That is deliberate rather than a
 * cached derived value: a back-dated entry recorded next week must not silently
 * rewrite a day already signed off — which is exactly why a paper book carries
 * a closing entry. Changes no balance.
 */
export interface DayClosedEvent extends EventBase {
  readonly type: "DayClosed";
  /** The business date being closed, YYYY-MM-DD. */
  readonly date: string;
  readonly summary: DaySummary;
  readonly notes: string;
}

/** Audit-only: records that the merchant took a backup. Changes no state. */
export interface BackupCreatedEvent extends EventBase {
  readonly type: "BackupCreated";
  readonly entryCount: number;
}

export interface RestoreCompletedEvent extends EventBase {
  readonly type: "RestoreCompleted";
  readonly snapshot: VyoraData;
}

export interface ImportCompletedEvent extends EventBase {
  readonly type: "ImportCompleted";
  readonly snapshot: VyoraData;
}

export type LedgerEvent =
  | ContactCreatedEvent
  | ContactUpdatedEvent
  | ContactDeletedEvent
  | CreditRecordedEvent
  | PaymentRecordedEvent
  | DueDateChangedEvent
  | EntryDeletedEvent
  | ContactRemindedEvent
  | DayClosedEvent
  | BackupCreatedEvent
  | RestoreCompletedEvent
  | ImportCompletedEvent;

export type LedgerEventType = LedgerEvent["type"];

/** The persisted log. */
export interface EventLog {
  readonly version: number;
  readonly events: readonly LedgerEvent[];
}

// ─── Constructors (the ONLY place an event is minted) ────────────────────────

function base(): EventBase {
  return { id: newId("evt"), at: nowISO() };
}

/** Today's date as YYYY-MM-DD in the device's local timezone. */
function todayLocalISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

export function createContactCreated(input: {
  name: string;
  phone?: string;
  note?: string;
}): ContactCreatedEvent {
  const party: Party = {
    id: newId("pty"),
    name: input.name.trim(),
    phone: input.phone?.trim() || undefined,
    note: input.note?.trim() || undefined,
    createdAt: nowISO(),
  };
  return { ...base(), type: "ContactCreated", party };
}

export function createContactUpdated(partyId: string, changes: PartyChanges): ContactUpdatedEvent {
  const trimmed: PartyChanges = {};
  if (changes.name !== undefined) trimmed.name = changes.name.trim();
  if (changes.phone !== undefined) trimmed.phone = changes.phone.trim() || undefined;
  if (changes.note !== undefined) trimmed.note = changes.note.trim() || undefined;
  return { ...base(), type: "ContactUpdated", partyId, changes: trimmed };
}

export function createContactDeleted(partyId: string): ContactDeletedEvent {
  return { ...base(), type: "ContactDeleted", partyId };
}

export function createCreditRecorded(input: {
  partyId: string;
  amount: number;
  kind: EntryKind;
  description?: string;
  date?: string;
  dueDate?: string;
}): CreditRecordedEvent {
  const transaction: Transaction = {
    id: newId("txn"),
    partyId: input.partyId,
    amount: Math.abs(input.amount),
    kind: input.kind,
    description: input.description?.trim() || undefined,
    date: input.date || todayLocalISO(),
    dueDate: input.dueDate || undefined,
    createdAt: nowISO(),
  };
  return { ...base(), type: "CreditRecorded", transaction };
}

export function createPaymentRecorded(input: {
  partyId: string;
  amount: number;
  kind: PaymentKind;
  note?: string;
  date?: string;
}): PaymentRecordedEvent {
  const payment: Payment = {
    id: newId("pay"),
    partyId: input.partyId,
    amount: Math.abs(input.amount),
    kind: input.kind,
    note: input.note?.trim() || undefined,
    date: input.date || todayLocalISO(),
    createdAt: nowISO(),
  };
  return { ...base(), type: "PaymentRecorded", payment };
}

export function createDueDateChanged(transactionId: string, dueDate?: string): DueDateChangedEvent {
  return { ...base(), type: "DueDateChanged", transactionId, dueDate: dueDate || undefined };
}

export function createEntryDeleted(entryId: string): EntryDeletedEvent {
  return { ...base(), type: "EntryDeleted", entryId };
}

export function createContactReminded(
  partyId: string,
  tone: "gentle" | "normal" | "firm"
): ContactRemindedEvent {
  return { ...base(), type: "ContactReminded", partyId, tone };
}

export function createDayClosed(date: string, summary: DaySummary, notes: string): DayClosedEvent {
  return { ...base(), type: "DayClosed", date, summary, notes: notes.trim() };
}

export function createBackupCreated(entryCount: number): BackupCreatedEvent {
  return { ...base(), type: "BackupCreated", entryCount };
}

export function createRestoreCompleted(snapshot: VyoraData): RestoreCompletedEvent {
  return { ...base(), type: "RestoreCompleted", snapshot };
}

export function createImportCompleted(snapshot: VyoraData): ImportCompletedEvent {
  return { ...base(), type: "ImportCompleted", snapshot };
}

// ─── The fold ────────────────────────────────────────────────────────────────

/** Coerce an externally-supplied snapshot (a file) into a safe projection. */
function normalizeSnapshot(snapshot: VyoraData | undefined): VyoraData {
  if (!snapshot) return emptyData();
  return {
    version: LOG_VERSION,
    parties: Array.isArray(snapshot.parties) ? snapshot.parties : [],
    transactions: Array.isArray(snapshot.transactions) ? snapshot.transactions : [],
    payments: Array.isArray(snapshot.payments) ? snapshot.payments : [],
  };
}

/**
 * A projection under construction.
 *
 * Structurally a `VyoraData` with mutable arrays. It never escapes this module
 * except as the finished projection, and once handed over it is never touched
 * again — which is what lets replay build it in place without weakening the
 * immutability every reader depends on.
 */
interface Draft {
  version: number;
  parties: Party[];
  transactions: Transaction[];
  payments: Payment[];
}

/** Events that record something the merchant did without moving a balance. */
function isAuditOnly(type: LedgerEventType): boolean {
  return type === "ContactReminded" || type === "DayClosed" || type === "BackupCreated";
}

/**
 * The single implementation of what an event does. Mutates the draft it is
 * given — and the ONLY drafts that exist are ones the caller just created, so
 * nothing externally visible is ever mutated.
 *
 * Pure in effect, total, and never throws: a log carrying an unrecognised event
 * from a newer build must still open.
 */
function applyInto(draft: Draft, event: LedgerEvent): void {
  switch (event.type) {
    case "ContactCreated":
      draft.parties.push(event.party);
      return;

    case "ContactUpdated": {
      // Every match, not just the first — identical to the `.map` it replaces.
      for (let i = 0; i < draft.parties.length; i++) {
        if (draft.parties[i].id === event.partyId) {
          draft.parties[i] = { ...draft.parties[i], ...event.changes };
        }
      }
      return;
    }

    // Removing a contact removes its entries too. Leaving them behind would
    // drop their value from the dashboard (totals come from parties) while they
    // stayed visible in the timeline — a balance the merchant cannot reconcile.
    case "ContactDeleted":
      draft.parties = draft.parties.filter((party) => party.id !== event.partyId);
      draft.transactions = draft.transactions.filter((t) => t.partyId !== event.partyId);
      draft.payments = draft.payments.filter((p) => p.partyId !== event.partyId);
      return;

    case "CreditRecorded":
      draft.transactions.push(event.transaction);
      return;

    case "PaymentRecorded":
      draft.payments.push(event.payment);
      return;

    case "DueDateChanged": {
      for (let i = 0; i < draft.transactions.length; i++) {
        if (draft.transactions[i].id === event.transactionId) {
          draft.transactions[i] = { ...draft.transactions[i], dueDate: event.dueDate };
        }
      }
      return;
    }

    case "EntryDeleted":
      draft.transactions = draft.transactions.filter((t) => t.id !== event.entryId);
      draft.payments = draft.payments.filter((p) => p.id !== event.entryId);
      return;

    case "RestoreCompleted":
    case "ImportCompleted": {
      const snapshot = normalizeSnapshot(event.snapshot);
      draft.version = snapshot.version;
      draft.parties = [...snapshot.parties];
      draft.transactions = [...snapshot.transactions];
      draft.payments = [...snapshot.payments];
      return;
    }

    // Audit-only: nothing about the ledger changed. "Last contacted" is read
    // back off the log rather than stored on the contact.
    default:
      return;
  }
}

/**
 * Apply one event to a projection, returning a NEW one. The public, immutable
 * entry point — unchanged in behaviour.
 */
export function applyEvent(data: VyoraData, event: LedgerEvent): VyoraData {
  // Audit-only events returned the same object before; keep that exactly.
  if (isAuditOnly(event.type)) return data;
  const draft: Draft = {
    version: data.version,
    parties: [...data.parties],
    transactions: [...data.transactions],
    payments: [...data.payments],
  };
  applyInto(draft, event);
  return draft;
}

/**
 * Fold a whole log into the projection every screen ultimately reads.
 *
 * This is the cold-start path: it runs on every app open, before anything
 * renders. Folding with `applyEvent` copied all three arrays per event, so a
 * log of E appends cost O(E²) — ~124M element copies at 15,000 entries, which
 * QA-001 found and ENG-010 measured at 537 ms for 20,000.
 *
 * The accumulator is now built in place and handed over once. The draft is
 * created here, never shared, and never touched after it is returned, so this
 * is an implementation detail rather than a change to the immutability
 * guarantee: callers still receive a projection nobody mutates.
 */
export function reduceEvents(events: readonly LedgerEvent[]): VyoraData {
  const draft: Draft = {
    version: LOG_VERSION,
    parties: [],
    transactions: [],
    payments: [],
  };
  for (const event of events) applyInto(draft, event);
  return {
    version: draft.version,
    parties: draft.parties,
    transactions: draft.transactions,
    payments: draft.payments,
  };
}

// ─── Log operations ──────────────────────────────────────────────────────────

/**
 * Drop the most recent event — the primitive behind undo.
 *
 * Correct *because* the log is append-only: state is a function of the log, so
 * removing the last entry and re-folding restores the exact prior projection.
 * No compensating logic, no per-action inverse to keep in sync.
 */
export function revertLastEvent(events: readonly LedgerEvent[]): readonly LedgerEvent[] {
  return events.length ? events.slice(0, -1) : events;
}

/**
 * Fold a log down to the shortest log that produces the same projection.
 *
 * This is the escape hatch for the one cost event sourcing imposes: the log
 * only grows, deletions included, while `localStorage` is a hard ~5 MB. Running
 * it **discards the audit trail** in exchange for space, so it is deliberately
 * NOT automatic — that is a product decision, not an engine one.
 */
export function compactEvents(events: readonly LedgerEvent[]): LedgerEvent[] {
  const data = reduceEvents(events);
  const compacted: LedgerEvent[] = [];
  for (const party of data.parties) {
    compacted.push({ ...base(), type: "ContactCreated", party });
  }
  for (const transaction of data.transactions) {
    compacted.push({ ...base(), type: "CreditRecorded", transaction });
  }
  for (const payment of data.payments) {
    compacted.push({ ...base(), type: "PaymentRecorded", payment });
  }
  return compacted;
}

/** Every event that touched one contact — the audit trail for one relationship. */
export function eventsForParty(
  events: readonly LedgerEvent[],
  partyId: string
): readonly LedgerEvent[] {
  return events.filter((event) => {
    switch (event.type) {
      case "ContactCreated":
        return event.party.id === partyId;
      case "ContactUpdated":
      case "ContactDeleted":
      case "ContactReminded":
        return event.partyId === partyId;
      case "CreditRecorded":
        return event.transaction.partyId === partyId;
      case "PaymentRecorded":
        return event.payment.partyId === partyId;
      default:
        return false;
    }
  });
}
