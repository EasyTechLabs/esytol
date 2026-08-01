/**
 * Vyora — success feedback (V2-006.1).
 *
 * ONE place decides what a completed action says. It is a pure function of the
 * command and its result, which is what makes "no duplicate toast
 * implementations" a property rather than a promise: screens cannot invent
 * their own wording, because they never write any.
 *
 * Failures are NOT handled here. Errors already have a home — the workflow
 * machine's `failure` state and the command engine's plain-language messages
 * (ARCH-003/004). Adding a second error path would be the duplication this
 * milestone exists to remove.
 */

import type { Command, CommandResult, DeleteContactResult, LedgerFile } from "./commands";
import type { Party } from "./types";

export interface Feedback {
  readonly message: string;
  /** Distinguishes a destructive confirmation from a routine one. */
  readonly tone: "success" | "warning";
}

function inr(amount: number): string {
  return "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount);
}

/**
 * What to tell the merchant after a command succeeds, or null when the action
 * speaks for itself.
 *
 * Every message names what actually happened — "Saved ₹500 for Ramesh", not
 * "Success". A confirmation the merchant has to decode is not a confirmation.
 */
export function successFeedback(command: Command, result: CommandResult): Feedback | null {
  if (!result.ok) return null;

  switch (command.type) {
    case "RecordCredit": {
      const party = result.value as Party;
      return {
        message: `Credit of ${inr(command.amount)} recorded for ${party.name}`,
        tone: "success",
      };
    }

    case "RecordPayment": {
      const party = result.value as Party;
      const verb = command.kind === "received" ? "received from" : "paid to";
      return { message: `${inr(command.amount)} ${verb} ${party.name}`, tone: "success" };
    }

    case "CreateContact": {
      const party = result.value as Party;
      return { message: `${party.name} added`, tone: "success" };
    }

    case "RecordReminder":
      return { message: "Reminder recorded — send it from your phone", tone: "success" };

    case "DeleteEntry":
      return { message: "Entry deleted", tone: "warning" };

    case "DeleteContact": {
      const deleted = result.value as DeleteContactResult;
      const entries = deleted.removedEntries;
      const suffix = entries > 0 ? ` and ${entries} ${entries === 1 ? "entry" : "entries"}` : "";
      return { message: `Contact deleted${suffix}`, tone: "warning" };
    }

    case "RestoreEntry":
      return { message: "Entry restored", tone: "success" };

    case "ImportLedger": {
      // `ImportLedger` returns `parties`, not `contacts` — reading the wrong
      // field silently produced "Restored undefined contacts" until the test
      // caught it.
      const counts = result.value as { parties: number; entries: number };
      return {
        message: `Restored ${counts.parties} contacts and ${counts.entries} entries`,
        tone: "success",
      };
    }

    case "ExportLedger":
    case "BackupLedger": {
      const file = result.value as LedgerFile;
      return { message: `Saved ${file.fileName} — keep it somewhere safe`, tone: "success" };
    }

    case "CloseDay":
      return { message: `${command.date} closed`, tone: "success" };

    default:
      return null;
  }
}
