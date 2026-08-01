/**
 * Vyora — Command Engine (ARCH-003).
 *
 * The only way to change a merchant's ledger. Every command runs the same four
 * steps — **validate → execute → emit events → return a result** — and the
 * layering underneath is untouched:
 *
 *     Command ──execute──► LedgerEvent[] ──applyEvent──► VyoraData ──► Ledger
 *
 * Why this layer exists: before ARCH-003 the rules lived in the screens.
 * `CreditEntry.tsx` decided that an amount had to be positive and a name
 * non-empty; nothing else did. That put a business rule in a component, made it
 * unenforceable from anywhere else, and meant every new screen had to remember
 * it. Now `validateCommand` is the single statement of what is allowed, used
 * both to enable the save button and to guard execution — one rule, two uses.
 *
 * `executeCommand` performs **no I/O**. It reads a context and returns events
 * plus a value; persisting them is the provider's job. That is what makes the
 * whole rule set testable without a browser.
 *
 * Errors carry plain language. A merchant reads "Enter an amount greater than
 * ₹0", never a code.
 */

import type { VyoraData, Party, EntryKind, PaymentKind } from "./types";
import type { DaySummary } from "./closing";
import type { Ledger } from "./ledger";
import { readParty, readPartyByName } from "./ledger";
import type { CreditRecordedEvent, LedgerEvent, PaymentRecordedEvent } from "./events";
import {
  newId,
  createBackupCreated,
  createContactCreated,
  createContactDeleted,
  createContactReminded,
  createDayClosed,
  createCreditRecorded,
  createEntryDeleted,
  createImportCompleted,
  createPaymentRecorded,
} from "./events";

// ─── Commands ────────────────────────────────────────────────────────────────

export type Command =
  | { type: "CreateContact"; name: string; phone?: string; note?: string }
  | {
      type: "RecordCredit";
      contactName: string;
      amount: number;
      kind: EntryKind;
      description?: string;
      date?: string;
      dueDate?: string;
    }
  | {
      type: "RecordPayment";
      contactName: string;
      amount: number;
      kind: PaymentKind;
      note?: string;
      date?: string;
    }
  | { type: "DeleteEntry"; entryId: string }
  | { type: "DeleteContact"; contactId: string }
  /** The merchant followed up themselves. Vyora sends nothing. */
  | { type: "RecordReminder"; contactId: string; tone: "gentle" | "normal" | "firm" }
  /** The merchant signed off a trading day. Audit only — no balance moves. */
  | { type: "CloseDay"; date: string; summary: DaySummary; notes: string }
  | { type: "RestoreEntry"; entryId: string }
  | { type: "ImportLedger"; payload: string }
  | { type: "ExportLedger" }
  | { type: "BackupLedger" };

export type CommandType = Command["type"];

// ─── Results ─────────────────────────────────────────────────────────────────

export interface CommandError {
  /** Stable machine code. Never shown to a merchant. */
  readonly code: string;
  /** Plain-language, merchant-facing. */
  readonly message: string;
  /** Which input to point at, when there is one. */
  readonly field?: string;
}

export interface CommandSuccess<T> {
  readonly ok: true;
  readonly value: T;
  /** Events to append to the log. Empty for a read-only command. */
  readonly events: readonly LedgerEvent[];
}

export interface CommandFailure {
  readonly ok: false;
  readonly error: CommandError;
}

export type CommandResult<T = unknown> = CommandSuccess<T> | CommandFailure;

/** A portable snapshot of the ledger, ready to be written to a file. */
export interface LedgerFile {
  readonly fileName: string;
  readonly contents: string;
}

export interface DeleteContactResult {
  readonly contactId: string;
  readonly removedEntries: number;
}

/** Everything a command needs to read in order to decide. */
export interface CommandContext {
  readonly ledger: Ledger;
  readonly events: readonly LedgerEvent[];
}

function fail(code: string, message: string, field?: string): CommandFailure {
  return { ok: false, error: { code, message, field } };
}

function succeed<T>(value: T, events: readonly LedgerEvent[] = []): CommandSuccess<T> {
  return { ok: true, value, events };
}

// ─── Shared validation ───────────────────────────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function checkName(name: string, field: string): CommandError | null {
  if (!name || !name.trim()) {
    return { code: "NAME_REQUIRED", message: "Enter a name.", field };
  }
  return null;
}

function checkAmount(amount: number): CommandError | null {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { code: "AMOUNT_INVALID", message: "Enter an amount greater than ₹0.", field: "amount" };
  }
  return null;
}

function checkDate(date: string | undefined, field: string): CommandError | null {
  if (date === undefined || date === "") return null;
  if (!ISO_DATE.test(date)) {
    return { code: "DATE_INVALID", message: "Pick a valid date.", field };
  }
  return null;
}

function findEntry(data: VyoraData, entryId: string) {
  const transaction = data.transactions.find((t) => t.id === entryId);
  if (transaction) return { kind: "transaction" as const, transaction };
  const payment = data.payments.find((p) => p.id === entryId);
  if (payment) return { kind: "payment" as const, payment };
  return null;
}

/**
 * The original record of an entry, recovered from the log.
 *
 * This is only possible because ARCH-002 keeps history: a deleted entry's
 * `CreditRecorded` / `PaymentRecorded` event is still there, so restoring it
 * means re-emitting the original row — same id, same date, same amount — rather
 * than asking the merchant to retype what they lost.
 */
function findOriginalEntryEvent(
  events: readonly LedgerEvent[],
  entryId: string
): CreditRecordedEvent | PaymentRecordedEvent | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.type === "CreditRecorded" && event.transaction.id === entryId) return event;
    if (event.type === "PaymentRecorded" && event.payment.id === entryId) return event;
  }
  return null;
}

/** The contact an entry-recording event belongs to. */
function ownerOf(event: CreditRecordedEvent | PaymentRecordedEvent): string {
  return event.type === "CreditRecorded" ? event.transaction.partyId : event.payment.partyId;
}

/**
 * Re-emit an original recording event as a NEW entry in history.
 *
 * The row it carries is untouched — same id, date and amount — so the restored
 * entry is the one that was lost, not a retyped approximation. Only the event's
 * own identity and timestamp are fresh, because the restore genuinely happened
 * now and the audit trail should say so.
 */
function replayEvent(
  original: CreditRecordedEvent | PaymentRecordedEvent
): CreditRecordedEvent | PaymentRecordedEvent {
  const identity = { id: newId("evt"), at: new Date().toISOString() };
  return original.type === "CreditRecorded"
    ? { ...original, ...identity }
    : { ...original, ...identity };
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Can this command run right now? Returns the reason it cannot, or null.
 *
 * Screens call this to decide whether the save button is live, and
 * `executeCommand` calls it before doing anything — so the button and the guard
 * can never disagree.
 */
export function validateCommand(context: CommandContext, command: Command): CommandError | null {
  const data = context.ledger.data;

  switch (command.type) {
    case "CreateContact":
      return checkName(command.name, "name");

    case "RecordCredit":
      return (
        checkName(command.contactName, "contactName") ??
        checkAmount(command.amount) ??
        checkDate(command.date, "date") ??
        checkDate(command.dueDate, "dueDate")
      );

    case "RecordPayment":
      return (
        checkName(command.contactName, "contactName") ??
        checkAmount(command.amount) ??
        checkDate(command.date, "date")
      );

    case "DeleteEntry":
      return findEntry(data, command.entryId)
        ? null
        : { code: "ENTRY_NOT_FOUND", message: "That entry is no longer here." };

    case "DeleteContact":
    case "RecordReminder":
      return readParty(context.ledger, command.contactId)
        ? null
        : { code: "CONTACT_NOT_FOUND", message: "That contact is no longer here." };

    case "RestoreEntry": {
      if (findEntry(data, command.entryId)) {
        return { code: "ENTRY_PRESENT", message: "That entry is already here." };
      }
      const original = findOriginalEntryEvent(context.events, command.entryId);
      if (!original) {
        return {
          code: "ENTRY_NOT_IN_HISTORY",
          message: "That entry is not in this device's history.",
        };
      }
      if (!readParty(context.ledger, ownerOf(original))) {
        return {
          code: "CONTACT_NOT_FOUND",
          message: "Add the contact back before restoring this entry.",
        };
      }
      return null;
    }

    case "ImportLedger":
      return parseLedgerFile(command.payload).error;

    case "CloseDay":
      return ISO_DATE.test(command.date)
        ? null
        : { code: "DATE_INVALID", message: "Pick a valid date.", field: "date" };

    case "ExportLedger":
    case "BackupLedger":
      return null;

    default:
      return { code: "UNKNOWN_COMMAND", message: "That action is not available." };
  }
}

// ─── Import / export payloads ────────────────────────────────────────────────

const FILE_VERSION = 2;

function serializeLedger(data: VyoraData): LedgerFile {
  const contents = JSON.stringify(
    {
      app: "vyora",
      fileVersion: FILE_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        parties: data.parties,
        transactions: data.transactions,
        payments: data.payments,
      },
    },
    null,
    2
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return { fileName: `vyora-${stamp}.json`, contents };
}

const INVALID_FILE: CommandError = {
  code: "FILE_INVALID",
  message: "That file is not a Vyora backup.",
  field: "payload",
};

function parseLedgerFile(payload: string): { data?: VyoraData; error: CommandError | null } {
  const invalid = INVALID_FILE;
  if (!payload || !payload.trim()) return { error: invalid };
  try {
    const parsed = JSON.parse(payload) as {
      data?: Partial<VyoraData>;
      parties?: unknown;
    };
    // Accept both the wrapped export shape and a bare data object.
    const body = (parsed?.data ?? parsed) as Partial<VyoraData>;
    if (!body || !Array.isArray(body.parties)) return { error: invalid };
    return {
      data: {
        version: FILE_VERSION,
        parties: body.parties,
        transactions: Array.isArray(body.transactions) ? body.transactions : [],
        payments: Array.isArray(body.payments) ? body.payments : [],
      },
      error: null,
    };
  } catch {
    return { error: invalid };
  }
}

export interface ImportPreview {
  readonly contacts: number;
  readonly transactions: number;
  readonly payments: number;
}

/**
 * What a file would restore, WITHOUT restoring it.
 *
 * Reuses the same parser `ImportLedger` validates with, so the counts a
 * merchant confirms are exactly the rows they will get — no second, drifting
 * implementation of "what's in this file".
 */
export function previewImport(payload: string): CommandResult<ImportPreview> {
  const parsed = parseLedgerFile(payload);
  if (parsed.error || !parsed.data) return { ok: false, error: parsed.error ?? INVALID_FILE };
  return succeed({
    contacts: parsed.data.parties.length,
    transactions: parsed.data.transactions.length,
    payments: parsed.data.payments.length,
  });
}

// ─── Execution ───────────────────────────────────────────────────────────────

/**
 * Validate, execute, emit. Never writes anything — the caller persists the
 * returned events. A failed command produces no events at all.
 */
export function executeCommand(context: CommandContext, command: Command): CommandResult {
  const invalid = validateCommand(context, command);
  if (invalid) return { ok: false, error: invalid };

  const data = context.ledger.data;

  switch (command.type) {
    case "CreateContact": {
      const created = createContactCreated({
        name: command.name,
        phone: command.phone,
        note: command.note,
      });
      return succeed<Party>(created.party, [created]);
    }

    case "RecordCredit": {
      const { party, events } = resolveContact(context, command.contactName);
      const credit = createCreditRecorded({
        partyId: party.id,
        amount: command.amount,
        kind: command.kind,
        description: command.description,
        date: command.date,
        dueDate: command.dueDate,
      });
      return succeed<Party>(party, [...events, credit]);
    }

    case "RecordPayment": {
      const { party, events } = resolveContact(context, command.contactName);
      const payment = createPaymentRecorded({
        partyId: party.id,
        amount: command.amount,
        kind: command.kind,
        note: command.note,
        date: command.date,
      });
      return succeed<Party>(party, [...events, payment]);
    }

    case "DeleteEntry":
      return succeed({ entryId: command.entryId }, [createEntryDeleted(command.entryId)]);

    case "RecordReminder":
      // Records that the MERCHANT followed up. No message is sent from here —
      // sharing happens through their own phone, one way, never automated.
      return succeed({ contactId: command.contactId }, [
        createContactReminded(command.contactId, command.tone),
      ]);

    case "CloseDay":
      // Signs off a day. Audit only: no balance moves, nothing is recomputed.
      return succeed({ date: command.date }, [
        createDayClosed(command.date, command.summary, command.notes),
      ]);

    case "DeleteContact": {
      const removedEntries =
        data.transactions.filter((t) => t.partyId === command.contactId).length +
        data.payments.filter((p) => p.partyId === command.contactId).length;
      return succeed<DeleteContactResult>({ contactId: command.contactId, removedEntries }, [
        createContactDeleted(command.contactId),
      ]);
    }

    case "RestoreEntry": {
      // Validation already proved the original is in history and restorable.
      const original = findOriginalEntryEvent(context.events, command.entryId);
      if (!original) return fail("ENTRY_NOT_IN_HISTORY", "That entry could not be restored.");
      return succeed({ entryId: command.entryId }, [replayEvent(original)]);
    }

    case "ImportLedger": {
      const snapshot = parseLedgerFile(command.payload).data as VyoraData;
      const entries = snapshot.transactions.length + snapshot.payments.length;
      return succeed({ parties: snapshot.parties.length, entries }, [
        createImportCompleted(snapshot),
      ]);
    }

    case "ExportLedger":
      // A read, not a change: it emits nothing. Recording an event every time a
      // merchant looks at their own data would grow the log without adding
      // history. "I took a backup" is BackupLedger's job.
      return succeed<LedgerFile>(serializeLedger(data));

    case "BackupLedger": {
      const entryCount = data.transactions.length + data.payments.length;
      return succeed<LedgerFile>(serializeLedger(data), [createBackupCreated(entryCount)]);
    }

    default:
      return fail("UNKNOWN_COMMAND", "That action is not available.");
  }
}

/**
 * Create-or-reuse a contact by name, the behaviour the capture path has always
 * had: typing a known name records against that contact instead of minting a
 * duplicate ledger for the same person.
 */
function resolveContact(
  context: CommandContext,
  name: string
): { party: Party; events: LedgerEvent[] } {
  const existing = readPartyByName(context.ledger, name);
  if (existing) return { party: existing, events: [] };
  const created = createContactCreated({ name });
  return { party: created.party, events: [created] };
}
