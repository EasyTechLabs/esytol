/**
 * Vyora — Workflow state machine tests (ARCH-004).
 *
 * The objective was "no boolean explosion, no impossible states". Both halves
 * are asserted here rather than asserted in prose:
 *
 *  - the **reachability sweep** drives every event from every state and checks
 *    the invariants that make a state impossible — a `valid` draft carrying an
 *    error, an `undo` without something to undo, an edit landing mid-write;
 *  - the **workflow definitions** are checked against the real command engine,
 *    so "valid" means the command would actually be accepted, not that a form
 *    thinks so.
 */

import { describe, it, expect } from "vitest";
import type { CommandError, CommandSuccess } from "@/lib/vyora/commands";
import { executeCommand, validateCommand } from "@/lib/vyora/commands";
import type { CommandContext } from "@/lib/vyora/commands";
import { buildLedger } from "@/lib/vyora/ledger";
import { reduceEvents } from "@/lib/vyora/events";
import type { LedgerEvent } from "@/lib/vyora/events";
import type {
  CreditDraft,
  WorkflowEvent,
  WorkflowRules,
  WorkflowState,
} from "@/lib/vyora/workflow";
import {
  backupWorkflow,
  canSubmit,
  canUndo,
  creditWorkflow,
  importWorkflow,
  paymentWorkflow,
  transition,
  workflowError,
} from "@/lib/vyora/workflow";

const TODAY = "2026-08-01";
const credit = creditWorkflow(TODAY);

function contextFrom(events: readonly LedgerEvent[]): CommandContext {
  return { ledger: buildLedger(reduceEvents(events)), events };
}

/** Rules wired to the real command engine — no stubbed validation. */
function realRules(context: CommandContext): WorkflowRules<CreditDraft> {
  return {
    validate: (draft) => validateCommand(context, credit.toCommand(draft)),
    undoFor: credit.undoFor,
  };
}

const RULES = realRules(contextFrom([]));

/** Open a fresh form on `draft` — what the hook does on mount. */
function startWith<TDraft>(draft: TDraft, rules: WorkflowRules<TDraft>): WorkflowState<TDraft> {
  return transition({ status: "idle" }, { type: "EDIT", draft }, rules);
}

const VALID_DRAFT: CreditDraft = {
  contactName: "Ramesh",
  amount: "1000",
  kind: "given",
  description: "",
  date: TODAY,
  dueDate: "",
};

const ERROR: CommandError = { code: "X", message: "Something went wrong." };

function okResult(events: readonly LedgerEvent[] = []): CommandSuccess<unknown> {
  return { ok: true, value: { id: "pty_1" }, events };
}

// ─── The happy path ──────────────────────────────────────────────────────────

describe("the shape of a workflow", () => {
  it("walks idle → editing → valid → saving → success", () => {
    let state: WorkflowState<CreditDraft> = { status: "idle" };
    state = transition(state, { type: "EDIT", draft: credit.emptyDraft }, RULES);
    expect(state.status).toBe("editing");

    state = transition(state, { type: "EDIT", draft: VALID_DRAFT }, RULES);
    expect(state.status).toBe("valid");

    state = transition(state, { type: "SUBMIT" }, RULES);
    expect(state.status).toBe("saving");

    state = transition(state, { type: "RESOLVED", result: okResult() }, RULES);
    expect(state.status).toBe("success");
  });

  it("lands in failure with the reason, keeping the draft to fix", () => {
    const saving = transition(startWith(VALID_DRAFT, RULES), { type: "SUBMIT" }, RULES);
    const rejected = { type: "RESOLVED", result: { ok: false, error: ERROR } } as const;
    const failed = transition(saving, rejected, RULES);
    expect(failed.status).toBe("failure");
    expect(workflowError(failed)).toEqual(ERROR);
    if (failed.status === "failure") expect(failed.draft).toEqual(VALID_DRAFT);
  });

  it("recovers from failure by editing again", () => {
    const failed: WorkflowState<CreditDraft> = {
      status: "failure",
      draft: VALID_DRAFT,
      error: ERROR,
    };
    const editing = transition(failed, { type: "EDIT", draft: VALID_DRAFT }, RULES);
    expect(editing.status).toBe("valid");
    expect(workflowError(editing)).toBeNull();
  });
});

// ─── Impossible states ───────────────────────────────────────────────────────

/** One representative of every status, for the exhaustive sweep. */
function everyState(): WorkflowState<CreditDraft>[] {
  return [
    { status: "idle" },
    { status: "editing", draft: credit.emptyDraft, error: ERROR },
    { status: "valid", draft: VALID_DRAFT },
    { status: "saving", draft: VALID_DRAFT },
    { status: "success", draft: VALID_DRAFT, value: null, undoCommand: null },
    { status: "failure", draft: VALID_DRAFT, error: ERROR },
    {
      status: "undo",
      draft: VALID_DRAFT,
      value: null,
      undoCommand: { type: "DeleteEntry", entryId: "t1" },
    },
  ];
}

function everyEvent(): WorkflowEvent<CreditDraft>[] {
  return [
    { type: "EDIT", draft: VALID_DRAFT },
    { type: "EDIT", draft: credit.emptyDraft },
    { type: "SUBMIT" },
    { type: "RESOLVED", result: okResult() },
    { type: "RESOLVED", result: { ok: false, error: ERROR } },
    { type: "UNDO" },
    { type: "UNDONE" },
    { type: "UNDO_FAILED", error: ERROR },
    { type: "RESET" },
  ];
}

describe("no impossible state is reachable", () => {
  it("never produces a valid draft that carries an error", () => {
    for (const state of everyState()) {
      for (const event of everyEvent()) {
        const next = transition(state, event, RULES);
        if (next.status === "valid") expect(workflowError(next)).toBeNull();
      }
    }
  });

  it("never produces an editing state without a reason", () => {
    for (const state of everyState()) {
      for (const event of everyEvent()) {
        const next = transition(state, event, RULES);
        if (next.status === "editing") expect(next.error).toBeTruthy();
      }
    }
  });

  it("never enters undo without something to undo", () => {
    for (const state of everyState()) {
      for (const event of everyEvent()) {
        const next = transition(state, event, RULES);
        if (next.status === "undo") expect(next.undoCommand).not.toBeNull();
      }
    }
  });

  it("only ever reaches a declared status", () => {
    const declared = new Set(["idle", "editing", "valid", "saving", "success", "failure", "undo"]);
    for (const state of everyState()) {
      for (const event of everyEvent()) {
        expect(declared.has(transition(state, event, RULES).status)).toBe(true);
      }
    }
  });

  it("refuses edits while a write is in flight", () => {
    for (const state of everyState()) {
      if (state.status !== "saving" && state.status !== "undo") continue;
      const next = transition(state, { type: "EDIT", draft: credit.emptyDraft }, RULES);
      expect(next).toBe(state);
    }
  });

  it("accepts a submit only from valid — the double-submit guard", () => {
    for (const state of everyState()) {
      const next = transition(state, { type: "SUBMIT" }, RULES);
      if (state.status === "valid") expect(next.status).toBe("saving");
      else expect(next).toBe(state);
    }
    // A second submit while saving changes nothing, so nothing runs twice.
    const saving: WorkflowState<CreditDraft> = { status: "saving", draft: VALID_DRAFT };
    expect(transition(saving, { type: "SUBMIT" }, RULES)).toBe(saving);
  });

  it("only resolves a write that was actually started", () => {
    for (const state of everyState()) {
      if (state.status === "saving") continue;
      expect(transition(state, { type: "RESOLVED", result: okResult() }, RULES)).toBe(state);
    }
  });

  it("resets to idle from anywhere, so a screen can never get stuck", () => {
    for (const state of everyState()) {
      expect(transition(state, { type: "RESET" }, RULES).status).toBe("idle");
    }
  });
});

// ─── Undo ────────────────────────────────────────────────────────────────────

describe("undo", () => {
  it("is offered only when the workflow can actually reverse itself", () => {
    const withUndo: WorkflowState<CreditDraft> = {
      status: "success",
      draft: VALID_DRAFT,
      value: null,
      undoCommand: { type: "DeleteEntry", entryId: "t1" },
    };
    const without: WorkflowState<CreditDraft> = {
      status: "success",
      draft: VALID_DRAFT,
      value: null,
      undoCommand: null,
    };
    expect(canUndo(withUndo)).toBe(true);
    expect(canUndo(without)).toBe(false);
    expect(transition(without, { type: "UNDO" }, RULES)).toBe(without);
    expect(transition(withUndo, { type: "UNDO" }, RULES).status).toBe("undo");
  });

  it("returns to idle when it succeeds", () => {
    const undoing = transition(
      {
        status: "success",
        draft: VALID_DRAFT,
        value: null,
        undoCommand: { type: "DeleteEntry", entryId: "t1" },
      },
      { type: "UNDO" },
      RULES
    );
    expect(transition(undoing, { type: "UNDONE" }, RULES).status).toBe("idle");
  });

  it("falls back to a readable failure when it cannot", () => {
    const undoing: WorkflowState<CreditDraft> = {
      status: "undo",
      draft: VALID_DRAFT,
      value: null,
      undoCommand: { type: "DeleteEntry", entryId: "t1" },
    };
    const next = transition(undoing, { type: "UNDO_FAILED", error: ERROR }, RULES);
    expect(next.status).toBe("failure");
    expect(workflowError(next)).toEqual(ERROR);
  });

  it("derives the undo command from the events the write emitted", () => {
    const context = contextFrom([]);
    const result = executeCommand(context, credit.toCommand(VALID_DRAFT));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const recorded = result.events.find((e) => e.type === "CreditRecorded");
    expect(recorded?.type).toBe("CreditRecorded");
    if (recorded?.type !== "CreditRecorded") return;
    expect(credit.undoFor(result)).toEqual({
      type: "DeleteEntry",
      entryId: recorded.transaction.id,
    });
  });
});

// ─── The four workflows, against the real command engine ─────────────────────

describe("workflow definitions agree with the command engine", () => {
  const context = contextFrom([]);

  it("credit: an empty draft is not submittable, a filled one is", () => {
    const rules = realRules(context);
    const empty = startWith(credit.emptyDraft, rules);
    expect(canSubmit(empty)).toBe(false);
    expect(workflowError(empty)?.field).toBe("contactName");

    expect(canSubmit(startWith(VALID_DRAFT, rules))).toBe(true);
  });

  it("credit: rejects a zero amount with the engine's own message", () => {
    const rules = realRules(context);
    const zero = startWith({ ...VALID_DRAFT, amount: "0" }, rules);
    expect(canSubmit(zero)).toBe(false);
    expect(workflowError(zero)?.field).toBe("amount");
  });

  it("payment: empty is blocked, filled is submittable", () => {
    const payment = paymentWorkflow(TODAY);
    const rules: WorkflowRules<typeof payment.emptyDraft> = {
      validate: (d) => validateCommand(context, payment.toCommand(d)),
      undoFor: payment.undoFor,
    };
    expect(canSubmit(startWith(payment.emptyDraft, rules))).toBe(false);
    const filled = { ...payment.emptyDraft, contactName: "Ramesh", amount: "200" };
    expect(canSubmit(startWith(filled, rules))).toBe(true);
  });

  it("import: a blank payload is blocked, a real export is not", () => {
    const workflow = importWorkflow();
    const rules: WorkflowRules<typeof workflow.emptyDraft> = {
      validate: (d) => validateCommand(context, workflow.toCommand(d)),
      undoFor: workflow.undoFor,
    };
    expect(canSubmit(startWith(workflow.emptyDraft, rules))).toBe(false);

    const exported = executeCommand(context, { type: "ExportLedger" });
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const payload = (exported.value as { contents: string }).contents;
    expect(canSubmit(startWith({ payload }, rules))).toBe(true);
  });

  it("backup: takes no input, so it is submittable immediately and not undoable", () => {
    const workflow = backupWorkflow();
    const rules: WorkflowRules<typeof workflow.emptyDraft> = {
      validate: (d) => validateCommand(context, workflow.toCommand(d)),
      undoFor: workflow.undoFor,
    };
    expect(canSubmit(startWith(workflow.emptyDraft, rules))).toBe(true);
    expect(workflow.undoFor(okResult())).toBeNull();
  });
});
