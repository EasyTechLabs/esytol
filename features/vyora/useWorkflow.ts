"use client";

/**
 * Vyora — the React binding for a workflow state machine (ARCH-004).
 *
 * The machine in `lib/vyora/workflow.ts` is pure; this hook is the only place
 * it meets React and the command engine. A screen gets a `draft`, a `status`,
 * an `error` and four verbs — it never tracks `isSaving` or `hasFailed` itself,
 * because those are not separate facts, they are the status.
 *
 * `submit` runs SUBMIT and RESOLVED back to back and commits only the final
 * state. `saving` therefore never paints — dispatch is synchronous, because
 * Vyora is local-first and there is no network to wait for. The state is still
 * modelled rather than skipped: it is what makes a double submit impossible,
 * and it is the seam a future async write would use without touching a screen.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import type { CommandError, CommandResult } from "@/lib/vyora/commands";
import type { WorkflowDefinition, WorkflowRules, WorkflowState } from "@/lib/vyora/workflow";
import { canSubmit, canUndo, transition, workflowError } from "@/lib/vyora/workflow";
import { useVyora } from "./VyoraProvider";

export interface Workflow<TDraft> {
  readonly status: WorkflowState<TDraft>["status"];
  readonly draft: TDraft;
  /** The reason the workflow is blocked or failed, or null. */
  readonly error: CommandError | null;
  readonly canSubmit: boolean;
  readonly canUndo: boolean;
  /** Replace the draft. Ignored while a write is in flight. */
  readonly edit: (patch: Partial<TDraft>) => void;
  /** Run the command. Returns its result, or null if the draft was not submittable. */
  readonly submit: () => CommandResult | null;
  /** Reverse the last successful run, when the workflow supports it. */
  readonly undo: () => void;
  /** Back to a fresh, empty draft. */
  readonly reset: () => void;
}

export function useWorkflow<TDraft>(definition: WorkflowDefinition<TDraft>): Workflow<TDraft> {
  const { dispatch, check } = useVyora();

  const rules = useMemo<WorkflowRules<TDraft>>(
    () => ({
      validate: (draft) => check(definition.toCommand(draft)),
      undoFor: definition.undoFor,
    }),
    [check, definition]
  );

  // Start on the empty draft so the machine lands in `editing` or `valid`
  // immediately — `idle` is the state before a form exists, not while it does.
  const [state, setState] = useState<WorkflowState<TDraft>>(() =>
    transition({ status: "idle" }, { type: "EDIT", draft: definition.emptyDraft }, rules)
  );

  const draft = "draft" in state ? state.draft : definition.emptyDraft;

  const edit = useCallback(
    (patch: Partial<TDraft>) => {
      setState((prev) => {
        const current = "draft" in prev ? prev.draft : definition.emptyDraft;
        return transition(prev, { type: "EDIT", draft: { ...current, ...patch } }, rules);
      });
    },
    [definition, rules]
  );

  /**
   * The machine refuses a second SUBMIT once it is `saving` — but `state` here
   * is a render-time value, so two calls in the SAME tick would both read
   * `valid` and both dispatch. This latch closes that window; the machine
   * handles every later one.
   */
  const inFlight = useRef(false);

  const submit = useCallback((): CommandResult | null => {
    if (inFlight.current) return null;
    const saving = transition(state, { type: "SUBMIT" }, rules);
    // Not valid, or already in flight — the machine refused, so nothing runs.
    if (saving.status !== "saving") return null;
    inFlight.current = true;
    try {
      const result = dispatch(definition.toCommand(saving.draft));
      setState(transition(saving, { type: "RESOLVED", result }, rules));
      return result;
    } finally {
      inFlight.current = false;
    }
  }, [state, rules, dispatch, definition]);

  const undo = useCallback(() => {
    const undoing = transition(state, { type: "UNDO" }, rules);
    if (undoing.status !== "undo") return;
    const result = dispatch(undoing.undoCommand);
    setState(
      transition(
        undoing,
        result.ok ? { type: "UNDONE" } : { type: "UNDO_FAILED", error: result.error },
        rules
      )
    );
  }, [state, rules, dispatch]);

  const reset = useCallback(() => {
    setState(transition({ status: "idle" }, { type: "EDIT", draft: definition.emptyDraft }, rules));
  }, [definition, rules]);

  return {
    status: state.status,
    draft,
    error: workflowError(state),
    canSubmit: canSubmit(state),
    canUndo: canUndo(state),
    edit,
    submit,
    undo,
    reset,
  };
}
