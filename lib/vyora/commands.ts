/**
 * Vyora — Command Engine (ARCH-003). The single, pure path for every ledger
 * mutation. No component mutates the store or localStorage directly: components call
 * provider actions, which DISPATCH these commands. Every command follows one shape —
 * Validate → Execute → Emit Event → Return Result — and is a pure function
 * (data + input → result), so it's deterministic and trivially testable.
 *
 * The result carries the next `VyoraData` (which the provider commits) plus a typed
 * return value; a failed validation returns `{ ok: false, error }` and never mutates.
 */

import type { VyoraData, Party, PartyRef, EntryKind, PaymentKind, PaymentMode } from "./types";
import {
  addParty,
  addTransaction,
  addPayment,
  deleteEntry as deleteEntryMut,
  deleteContact as deleteContactMut,
  restoreFromTrash,
  backupNow,
  exportToFile,
  resolvePartyRef,
} from "./store";
import {
  appendEvent,
  compactEvents,
  EVENT_LOG_CAP,
  type LedgerEventSpec,
  type LedgerEvent,
} from "./events";
import { applyImportPlan, type ImportPlan } from "./import";
import { runIntegrity } from "./integrity";

export type CommandResult<V = void> =
  { ok: true; data: VyoraData; value: V } | { ok: false; error: string };

/** Supplies event id/timestamp — injectable so commands stay deterministic under test. */
export interface CommandCtx {
  newId: () => string;
  now: () => string;
}

/** Append an event, compacting to a checkpoint past the cap (bounded log). */
function emit(data: VyoraData, spec: LedgerEventSpec, ctx: CommandCtx): VyoraData {
  const withEvt = appendEvent(data, spec, ctx.newId(), ctx.now());
  return (withEvt.events?.length ?? 0) > EVENT_LOG_CAP
    ? compactEvents(withEvt, ctx.newId(), ctx.now())
    : withEvt;
}

/** Reset the log to one checkpoint carrying the current active ledger (bulk ops). */
function checkpoint(
  data: VyoraData,
  spec:
    | { type: "RestoreCompleted" | "Checkpoint" }
    | { type: "ImportCompleted"; summary: { contacts: number; entries: number } },
  ctx: CommandCtx
): VyoraData {
  const snapshot = {
    parties: data.parties,
    transactions: data.transactions,
    payments: data.payments,
  };
  const event = { ...spec, snapshot, id: ctx.newId(), at: ctx.now() } as LedgerEvent;
  return { ...data, events: [event] };
}

// ── Commands ─────────────────────────────────────────────────────────────────

export function createContact(
  data: VyoraData,
  input: { name: string; phone?: string; note?: string },
  ctx: CommandCtx
): CommandResult<Party> {
  if (!input.name.trim()) return { ok: false, error: "Contact name is required." };
  const { data: next, party } = addParty(data, input);
  return { ok: true, data: emit(next, { type: "ContactCreated", party }, ctx), value: party };
}

export interface RecordCreditInput {
  party: PartyRef;
  amount: number;
  kind: EntryKind;
  description?: string;
  reference?: string;
  date?: string;
  dueDate?: string;
}

export function recordCredit(
  data: VyoraData,
  input: RecordCreditInput,
  ctx: CommandCtx
): CommandResult<string> {
  if (!(input.amount > 0)) return { ok: false, error: "Enter an amount greater than zero." };
  const { data: withParty, partyId } = resolvePartyRef(data, input.party);
  const { data: next, transaction } = addTransaction(withParty, {
    partyId,
    amount: input.amount,
    kind: input.kind,
    description: input.description,
    reference: input.reference,
    date: input.date,
    dueDate: input.dueDate,
  });
  let d = next;
  if (input.party.kind === "new") {
    const created = withParty.parties.find((p) => p.id === partyId);
    if (created) d = emit(d, { type: "ContactCreated", party: created }, ctx);
  }
  d = emit(d, { type: "CreditRecorded", transaction }, ctx);
  return { ok: true, data: d, value: partyId };
}

export interface RecordPaymentInput {
  party: PartyRef;
  amount: number;
  kind: PaymentKind;
  mode?: PaymentMode;
  reference?: string;
  note?: string;
  date?: string;
}

export function recordPayment(
  data: VyoraData,
  input: RecordPaymentInput,
  ctx: CommandCtx
): CommandResult<string> {
  if (!(input.amount > 0)) return { ok: false, error: "Enter an amount greater than zero." };
  const { data: withParty, partyId } = resolvePartyRef(data, input.party);
  const { data: next, payment } = addPayment(withParty, {
    partyId,
    amount: input.amount,
    kind: input.kind,
    mode: input.mode,
    reference: input.reference,
    note: input.note,
    date: input.date,
  });
  let d = next;
  if (input.party.kind === "new") {
    const created = withParty.parties.find((p) => p.id === partyId);
    if (created) d = emit(d, { type: "ContactCreated", party: created }, ctx);
  }
  d = emit(d, { type: "PaymentRecorded", payment }, ctx);
  return { ok: true, data: d, value: partyId };
}

export function deleteEntry(data: VyoraData, entryId: string, ctx: CommandCtx): CommandResult {
  const exists =
    data.transactions.some((t) => t.id === entryId) || data.payments.some((p) => p.id === entryId);
  if (!exists) return { ok: false, error: "Entry not found." };
  const next = deleteEntryMut(data, entryId);
  return { ok: true, data: emit(next, { type: "EntryDeleted", entryId }, ctx), value: undefined };
}

export function deleteContact(data: VyoraData, partyId: string, ctx: CommandCtx): CommandResult {
  if (!data.parties.some((p) => p.id === partyId))
    return { ok: false, error: "Contact not found." };
  const next = deleteContactMut(data, partyId);
  return {
    ok: true,
    data: emit(next, { type: "ContactDeleted", partyId }, ctx),
    value: undefined,
  };
}

/** Restore a soft-deleted record from the trash (emits re-add events per record). */
export function restoreEntry(data: VyoraData, trashId: string, ctx: CommandCtx): CommandResult {
  const entry = (data.trash ?? []).find((t) => t.id === trashId);
  if (!entry) return { ok: false, error: "Nothing to restore." };
  let d = restoreFromTrash(data, trashId);
  for (const p of entry.parties) d = emit(d, { type: "ContactCreated", party: p }, ctx);
  for (const t of entry.transactions) d = emit(d, { type: "CreditRecorded", transaction: t }, ctx);
  for (const p of entry.payments) d = emit(d, { type: "PaymentRecorded", payment: p }, ctx);
  return { ok: true, data: d, value: undefined };
}

/** Merge another app's ledger (Import Wizard) → integrity-check → checkpoint. */
export function importLedger(
  data: VyoraData,
  plan: ImportPlan,
  ctx: CommandCtx
): CommandResult<{ contacts: number; entries: number }> {
  const { data: merged, contacts, entries } = applyImportPlan(data, plan);
  const { data: checked } = runIntegrity(merged, ctx.now());
  const stamped = { ...checked, meta: { ...checked.meta, lastRestoreAt: ctx.now() } };
  const next = checkpoint(
    stamped,
    { type: "ImportCompleted", summary: { contacts, entries } },
    ctx
  );
  return { ok: true, data: next, value: { contacts, entries } };
}

/** Export the ledger to a file. Bumps the export counter; the ledger is unchanged. */
export function exportLedger(data: VyoraData): CommandResult<{ text: string; filename: string }> {
  const { data: withCount, text, filename } = exportToFile(data);
  return { ok: true, data: withCount, value: { text, filename } };
}

export function backupLedger(data: VyoraData, ctx: CommandCtx): CommandResult {
  const next = backupNow(data);
  return { ok: true, data: emit(next, { type: "BackupCreated" }, ctx), value: undefined };
}
