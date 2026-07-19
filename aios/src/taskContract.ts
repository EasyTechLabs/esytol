/**
 * Task contract (AIOS-004) — validation + construction of the universal Task object (TaskContract.md).
 * The orchestrator validates every incoming request against this contract before anything runs.
 */

import type { Clock, IdGenerator } from "./kernel";
import { TASK_CONTRACT_VERSION } from "./kernel";
import type { Task, TaskInput } from "./types";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const PRIORITIES = ["P0", "P1", "P2", "P3"] as const;
const TRUST = ["trusted", "untrusted"] as const;

/** Validate an incoming task request against the immutable-request rules of the Task Contract. */
export function validateTaskInput(input: TaskInput): ValidationResult {
  const errors: string[] = [];

  if (typeof input.capabilityRequested !== "string" || input.capabilityRequested.trim() === "")
    errors.push("capabilityRequested is required (a capability id).");
  if (typeof input.objective !== "string" || input.objective.trim() === "")
    errors.push("objective is required.");
  if (typeof input.requester !== "string" || input.requester.trim() === "")
    errors.push("requester is required.");
  if (input.inputs === null || typeof input.inputs !== "object" || Array.isArray(input.inputs))
    errors.push("inputs must be an object.");
  if (input.priority !== undefined && !PRIORITIES.includes(input.priority))
    errors.push(`priority must be one of ${PRIORITIES.join(", ")}.`);
  if (input.trustLevel !== undefined && !TRUST.includes(input.trustLevel))
    errors.push(`trustLevel must be one of ${TRUST.join(", ")}.`);
  if (input.dependencies !== undefined && !Array.isArray(input.dependencies))
    errors.push("dependencies must be an array of task ids.");

  return { ok: errors.length === 0, errors };
}

/** Construct a full Task from a validated request. Identity is immutable; history is append-only. */
export function createTask(input: TaskInput, deps: { ids: IdGenerator; clock: Clock }): Task {
  const at = deps.clock.now();
  const taskId = deps.ids.next("task");
  return {
    taskId,
    workflowId: input.workflowId ?? null,
    correlationId: input.correlationId ?? deps.ids.next("corr"),
    parentTaskId: input.parentTaskId ?? null,
    capabilityRequested: input.capabilityRequested,
    version: TASK_CONTRACT_VERSION,
    objective: input.objective,
    priority: input.priority ?? "P2",
    deadlineTick: input.deadlineTick ?? null,
    requester: input.requester,
    assignedAgent: null,
    assignedProvider: null,
    dependencies: input.dependencies ?? [],
    inputs: { ...input.inputs },
    context: { ...(input.context ?? {}) },
    successCriteria: input.successCriteria ?? null,
    trustLevel: input.trustLevel ?? "trusted",
    status: "Created",
    retryCount: 0,
    executionHistory: [],
    checkpoints: [],
    output: null,
    artifactsProduced: [],
    knowledgeUpdates: [],
    analyticsUpdates: [],
    createdAt: at,
    updatedAt: at,
  };
}
