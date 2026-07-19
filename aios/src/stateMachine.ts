/**
 * Task state machine (AIOS-004) — a faithful, executable encoding of StateMachine.md.
 *
 * The orchestrator moves tasks ONLY through the legal transitions below; any other move is refused
 * (thrown), which is what keeps orchestration deterministic and terminal states truly terminal.
 */

import type { TaskState } from "./types";

export const TASK_STATES: readonly TaskState[] = [
  "Created",
  "Queued",
  "Waiting",
  "Executing",
  "Checkpoint",
  "Blocked",
  "Review",
  "Approved",
  "Rejected",
  "Retry",
  "Completed",
  "Cancelled",
  "Failed",
  "Archived",
];

/** Legal transitions (StateMachine.md §3). Anything not listed here is forbidden (§4). */
export const LEGAL_TRANSITIONS: Readonly<Record<TaskState, readonly TaskState[]>> = {
  Created: ["Queued", "Waiting", "Cancelled"],
  Queued: ["Executing", "Waiting", "Cancelled"],
  Waiting: ["Queued", "Cancelled"],
  Executing: ["Checkpoint", "Review", "Retry", "Blocked", "Completed", "Failed", "Cancelled"],
  Checkpoint: ["Executing", "Review", "Blocked", "Cancelled"],
  Blocked: ["Queued", "Failed", "Cancelled"],
  Review: ["Approved", "Rejected", "Cancelled"],
  Approved: ["Executing", "Completed"],
  Rejected: ["Cancelled", "Queued"],
  Retry: ["Queued", "Failed"],
  Completed: ["Archived"],
  Cancelled: ["Archived"],
  Failed: ["Archived"],
  Archived: [],
};

/** Terminal success/failure/cancel states — never resurrected (a redo is a NEW task). */
export const TERMINAL_STATES: readonly TaskState[] = [
  "Completed",
  "Cancelled",
  "Failed",
  "Archived",
];

export function isTerminal(state: TaskState): boolean {
  return TERMINAL_STATES.includes(state);
}

export function canTransition(from: TaskState, to: TaskState): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

/** Error raised on an illegal state transition. */
export class IllegalTransitionError extends Error {
  constructor(
    readonly from: TaskState,
    readonly to: TaskState
  ) {
    super(`Illegal task transition: ${from} → ${to}`);
    this.name = "IllegalTransitionError";
  }
}

/** Assert a transition is legal, or throw. Callers append to the task's history on success. */
export function assertTransition(from: TaskState, to: TaskState): void {
  if (!canTransition(from, to)) throw new IllegalTransitionError(from, to);
}
