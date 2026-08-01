/**
 * Vyora — Workflow State Machines (ARCH-004).
 *
 * Every workflow that writes to the ledger is one explicit machine:
 *
 *     idle ──edit──► editing ⇄ valid ──submit──► saving ──resolved──► success
 *                       ▲                                    │           │
 *                       └────────── edit ──── failure ◄──────┘        undo
 *                                                                        │
 *                                                            idle ◄── undone
 *
 * **No boolean explosion.** A form like credit entry would otherwise carry
 * `isSaving`, `isValid`, `hasSaved`, `hasFailed`, `isUndoing` — five booleans,
 * 32 combinations, of which 6 are legal. Here the state IS the status, and the
 * data each status needs travels with it.
 *
 * **No impossible states**, by construction:
 *  - an error exists only in `editing` and `failure`; a `valid` draft cannot
 *    carry one,
 *  - `submit` is accepted only from `valid`, which is also the double-submit
 *    guard — a second submit while `saving` is ignored rather than duplicated,
 *  - `undo` cannot be entered without a result to undo, and only when the
 *    workflow actually has an undo command,
 *  - `saving` and `undo` refuse edits, so an in-flight write cannot be mutated
 *    underneath itself.
 *
 * The machine is **pure** — `transition` is a function of (state, event, rules)
 * with no React, no dispatch and no I/O. The rules it needs (is this draft
 * valid? what would undo this?) are injected, so the same machine drives credit,
 * payment, import and backup.
 */

import type { Command, CommandError, CommandResult, CommandSuccess } from "./commands";
import type { EntryKind, PaymentKind } from "./types";

// ─── States ──────────────────────────────────────────────────────────────────

export type WorkflowStatus =
  "idle" | "editing" | "valid" | "saving" | "success" | "failure" | "undo";

export type WorkflowState<TDraft> =
  /** Nothing entered yet — before the form is touched, and after a reset. */
  | { readonly status: "idle" }
  /** A draft that is not yet acceptable. Always carries the reason. */
  | { readonly status: "editing"; readonly draft: TDraft; readonly error: CommandError }
  /** A draft the command engine would accept. Never carries an error. */
  | { readonly status: "valid"; readonly draft: TDraft }
  /** Submitted, awaiting the command result. Refuses edits and further submits. */
  | { readonly status: "saving"; readonly draft: TDraft }
  | {
      readonly status: "success";
      readonly draft: TDraft;
      readonly value: unknown;
      /** null when this workflow has nothing meaningful to undo. */
      readonly undoCommand: Command | null;
    }
  /** The command was rejected. Keeps the draft so the merchant can fix it. */
  | { readonly status: "failure"; readonly draft: TDraft; readonly error: CommandError }
  /** Undo in flight. Cannot exist without a result and an undo command. */
  | {
      readonly status: "undo";
      readonly draft: TDraft;
      readonly value: unknown;
      readonly undoCommand: Command;
    };

// ─── Events ──────────────────────────────────────────────────────────────────

export type WorkflowEvent<TDraft> =
  | { readonly type: "EDIT"; readonly draft: TDraft }
  | { readonly type: "SUBMIT" }
  | { readonly type: "RESOLVED"; readonly result: CommandResult }
  | { readonly type: "UNDO" }
  | { readonly type: "UNDONE" }
  | { readonly type: "UNDO_FAILED"; readonly error: CommandError }
  | { readonly type: "RESET" };

/** What the machine needs to know about the workflow it is driving. */
export interface WorkflowRules<TDraft> {
  readonly validate: (draft: TDraft) => CommandError | null;
  /** The command that reverses a successful run, or null if it cannot be undone. */
  readonly undoFor: (result: CommandSuccess<unknown>) => Command | null;
}

// ─── Transition ──────────────────────────────────────────────────────────────

/** A draft always lands in exactly one of `editing` or `valid`. */
function afterEdit<TDraft>(draft: TDraft, rules: WorkflowRules<TDraft>): WorkflowState<TDraft> {
  const error = rules.validate(draft);
  return error ? { status: "editing", draft, error } : { status: "valid", draft };
}

/** In-flight states refuse edits so a write cannot change underneath itself. */
function isInFlight(status: WorkflowStatus): boolean {
  return status === "saving" || status === "undo";
}

/**
 * The whole machine. Any event that is not legal in the current state returns
 * the state unchanged — an ignored transition, never an invalid one.
 */
export function transition<TDraft>(
  state: WorkflowState<TDraft>,
  event: WorkflowEvent<TDraft>,
  rules: WorkflowRules<TDraft>
): WorkflowState<TDraft> {
  switch (event.type) {
    case "EDIT":
      return isInFlight(state.status) ? state : afterEdit(event.draft, rules);

    case "SUBMIT":
      // Only a valid draft may be submitted. This is also the double-submit
      // guard: a second SUBMIT while saving is simply ignored.
      return state.status === "valid" ? { status: "saving", draft: state.draft } : state;

    case "RESOLVED": {
      if (state.status !== "saving") return state;
      if (!event.result.ok) {
        return { status: "failure", draft: state.draft, error: event.result.error };
      }
      return {
        status: "success",
        draft: state.draft,
        value: event.result.value,
        undoCommand: rules.undoFor(event.result),
      };
    }

    case "UNDO":
      if (state.status !== "success" || state.undoCommand === null) return state;
      return {
        status: "undo",
        draft: state.draft,
        value: state.value,
        undoCommand: state.undoCommand,
      };

    case "UNDONE":
      return state.status === "undo" ? { status: "idle" } : state;

    case "UNDO_FAILED":
      // The entry is still there; drop back to a failure the merchant can read.
      return state.status === "undo"
        ? { status: "failure", draft: state.draft, error: event.error }
        : state;

    case "RESET":
      // Deliberately allowed from anywhere, including in-flight. Blocking it
      // would trade a theoretical bad state for a genuinely stuck screen.
      return { status: "idle" };

    default:
      return state;
  }
}

/** The error to show, if any. Only two states carry one. */
export function workflowError<TDraft>(state: WorkflowState<TDraft>): CommandError | null {
  if (state.status === "editing" || state.status === "failure") return state.error;
  return null;
}

/** Can this state be submitted right now? */
export function canSubmit<TDraft>(state: WorkflowState<TDraft>): boolean {
  return state.status === "valid";
}

/** Can this state be undone right now? */
export function canUndo<TDraft>(state: WorkflowState<TDraft>): boolean {
  return state.status === "success" && state.undoCommand !== null;
}

// ─── Drafts ──────────────────────────────────────────────────────────────────

/** Amounts are typed, so a draft holds the raw string until the command engine parses it. */
export interface CreditDraft {
  contactName: string;
  amount: string;
  kind: EntryKind;
  description: string;
  date: string;
  dueDate: string;
}

export interface PaymentDraft {
  contactName: string;
  amount: string;
  kind: PaymentKind;
  note: string;
  date: string;
}

export interface ImportDraft {
  payload: string;
}

/** Backup takes no input; the empty draft is always valid. */
export type BackupDraft = Record<string, never>;

// ─── Workflow definitions ────────────────────────────────────────────────────

/** Everything a screen needs to run one workflow. */
export interface WorkflowDefinition<TDraft> {
  readonly name: string;
  readonly emptyDraft: TDraft;
  readonly toCommand: (draft: TDraft) => Command;
  readonly undoFor: (result: CommandSuccess<unknown>) => Command | null;
}

/**
 * Undo for a recorded entry: delete the row that was just created.
 *
 * The entry id comes from the events the command emitted, not its return value
 * — capture commands return the contact. This only works because ARCH-002 keeps
 * the events and ARCH-003 hands them back on the result.
 */
function undoRecordedEntry(result: CommandSuccess<unknown>): Command | null {
  for (const event of result.events) {
    if (event.type === "CreditRecorded") {
      return { type: "DeleteEntry", entryId: event.transaction.id };
    }
    if (event.type === "PaymentRecorded") {
      return { type: "DeleteEntry", entryId: event.payment.id };
    }
  }
  return null;
}

/** Workflows whose effect cannot be meaningfully reversed. */
function notUndoable(): Command | null {
  return null;
}

export function creditWorkflow(today: string): WorkflowDefinition<CreditDraft> {
  return {
    name: "Credit entry",
    emptyDraft: {
      contactName: "",
      amount: "",
      kind: "given",
      description: "",
      date: today,
      dueDate: "",
    },
    toCommand: (draft) => ({
      type: "RecordCredit",
      contactName: draft.contactName,
      amount: Number(draft.amount),
      kind: draft.kind,
      description: draft.description || undefined,
      date: draft.date,
      dueDate: draft.dueDate || undefined,
    }),
    undoFor: undoRecordedEntry,
  };
}

export function paymentWorkflow(today: string): WorkflowDefinition<PaymentDraft> {
  return {
    name: "Payment entry",
    emptyDraft: { contactName: "", amount: "", kind: "received", note: "", date: today },
    toCommand: (draft) => ({
      type: "RecordPayment",
      contactName: draft.contactName,
      amount: Number(draft.amount),
      kind: draft.kind,
      note: draft.note || undefined,
      date: draft.date,
    }),
    undoFor: undoRecordedEntry,
  };
}

/**
 * Import replaces the whole ledger. Undoing it would need a pre-import
 * snapshot, which nothing captures today — so it reports itself as not
 * undoable rather than offering an undo that would quietly do nothing.
 */
export function importWorkflow(): WorkflowDefinition<ImportDraft> {
  return {
    name: "Import ledger",
    emptyDraft: { payload: "" },
    toCommand: (draft) => ({ type: "ImportLedger", payload: draft.payload }),
    undoFor: notUndoable,
  };
}

/** Backup writes a file and an audit note. There is nothing to reverse. */
export function backupWorkflow(): WorkflowDefinition<BackupDraft> {
  return {
    name: "Backup ledger",
    emptyDraft: {} as BackupDraft,
    toCommand: () => ({ type: "BackupLedger" }),
    undoFor: notUndoable,
  };
}
