/**
 * Execution coordinator (AIOS-004) — runs ONE task through its lifecycle deterministically, realizing
 * ExecutionContract.md + StateMachine.md + FailureRecovery.md + ApprovalMatrix.md.
 *
 * It NEVER performs domain work: it dispatches to a provider (the engine), validates the enumerated
 * outcome, applies declared side-effects only on commit, and drives the state machine — retries,
 * failover, checkpointing, approval pauses, rollback (discard provisional), dead-letter, escalation.
 */

import type { Clock, IdGenerator } from "./kernel";
import { deepEqual } from "./kernel";
import type {
  ApprovalDecision,
  ApprovalGateway,
  ApprovalRequest,
  Capability,
  DeadLetterEntry,
  ErrorClass,
  ExecutionRequest,
  ExecutionResult,
  PlainData,
  Provenance,
  Provider,
  Task,
  TaskState,
} from "./types";
import { assertTransition } from "./stateMachine";
import type { AuditLog } from "./audit";
import type { EventBus } from "./events";
import type { MemoryLoader } from "./memory";
import type { Config } from "./config";
import type { Resolution } from "./resolver";

export class DeadLetterQueue {
  private entries: DeadLetterEntry[] = [];
  push(entry: DeadLetterEntry): void {
    this.entries.push(entry);
  }
  all(): readonly DeadLetterEntry[] {
    return this.entries;
  }
}

type OkResolution = Extract<Resolution, { ok: true }>;
type CommitReadyResult = Extract<ExecutionResult, { kind: "completed" | "needs-approval" }>;

export interface Provisional {
  result: CommitReadyResult;
  resolution: OkResolution;
}

export interface CoordinatorOutcome {
  task: Task;
  status: TaskState;
  result?: ExecutionResult;
  /** Present when the task paused awaiting a human approval decision. */
  pending?: { request: ApprovalRequest; provisional: Provisional };
}

export interface CoordinatorDeps {
  audit: AuditLog;
  events: EventBus;
  memory: MemoryLoader;
  approvals: ApprovalGateway;
  config: Config;
  dlq: DeadLetterQueue;
  clock: Clock;
  ids: IdGenerator;
}

export class ExecutionCoordinator {
  constructor(private readonly deps: CoordinatorDeps) {}

  // ── public entry points ─────────────────────────────────────────────────────

  async run(task: Task, resolution: OkResolution): Promise<CoordinatorOutcome> {
    const { capability } = resolution;
    task.assignedAgent = resolution.agent.id;
    if (task.status === "Created") this.transition(task, "Queued", "admitted", resolution);

    const maxAttempts = Math.max(1, capability.retryPolicy.maxAttempts);
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      this.transition(task, "Executing", `attempt ${attempt}`, resolution);

      const request = this.buildRequest(task, resolution, attempt);
      const { result, provider } = await this.executeWithFailover(
        resolution.providers,
        request,
        task,
        resolution
      );
      task.assignedProvider = provider.id;
      this.deps.audit.record(
        "execute",
        `provider=${provider.id} kind=${result.kind} cost=${result.costUnits}`,
        this.prov(task, resolution, provider.id),
        { attempt, kind: result.kind }
      );

      if (result.kind === "completed" || result.kind === "needs-approval") {
        if (!this.outputValid(task, result.output)) {
          if (
            this.handleRetryable(
              task,
              "Invalid-Output",
              "output failed successCriteria",
              attempt,
              maxAttempts,
              capability,
              resolution
            )
          )
            continue;
          return this.markFailed(
            task,
            "Invalid-Output",
            "output failed successCriteria",
            resolution
          );
        }
        this.checkpoint(task, "pre-commit", { output: result.output });
        return this.decideApprovalOrCommit(task, result, resolution);
      }

      if (result.kind === "retryable") {
        if (
          this.handleRetryable(
            task,
            result.error.class,
            result.error.reason,
            attempt,
            maxAttempts,
            capability,
            resolution
          )
        )
          continue;
        return this.markFailed(task, result.error.class, result.error.reason, resolution);
      }

      if (result.kind === "rejected") {
        this.deps.audit.record("rejected", result.reason, this.prov(task, resolution));
        return this.markFailed(task, "Fatal", `agent rejected: ${result.reason}`, resolution);
      }

      // fatal (all providers exhausted)
      return this.markFailed(task, result.error.class, result.error.reason, resolution);
    }
    return this.markFailed(task, "Fatal", "attempts exhausted", resolution);
  }

  /** Resume a task that paused in Review once a human decision arrives. */
  resume(task: Task, provisional: Provisional, decision: ApprovalDecision): CoordinatorOutcome {
    const { result, resolution } = provisional;
    if (decision.decision === "approved") {
      this.deps.audit.record(
        "approval",
        `approved by ${decision.approver}`,
        this.prov(task, resolution)
      );
      this.transition(task, "Approved", `approved: ${decision.reason ?? ""}`, resolution);
      return this.commit(task, result, resolution);
    }
    this.deps.audit.record(
      "approval",
      `rejected by ${decision.approver}: ${decision.reason ?? ""}`,
      this.prov(task, resolution)
    );
    this.transition(task, "Rejected", `rejected: ${decision.reason ?? ""}`, resolution);
    // Rollback: provisional side-effects are applied only on commit, so there is nothing to undo.
    this.deps.audit.record(
      "rollback",
      "provisional side-effects discarded (never committed)",
      this.prov(task, resolution)
    );
    this.transition(task, "Cancelled", "closed after rejection", resolution);
    return { task, status: task.status, result };
  }

  /** Pause a running task at a durable checkpoint (crash-safety / manual hold). */
  pauseAtCheckpoint(task: Task, resolution: OkResolution): void {
    this.checkpoint(task, "paused", { status: task.status });
    this.transition(task, "Checkpoint", "paused at checkpoint", resolution);
  }

  /** Resume a task from its Checkpoint state (recovery). */
  resumeFromCheckpoint(task: Task, resolution: OkResolution): void {
    this.transition(task, "Executing", "resumed from checkpoint", resolution);
  }

  // ── internals ────────────────────────────────────────────────────────────────

  private decideApprovalOrCommit(
    task: Task,
    result: CommitReadyResult,
    resolution: OkResolution
  ): CoordinatorOutcome {
    const level =
      result.kind === "needs-approval" ? result.level : resolution.capability.requiredApprovals;
    const humanApproval =
      result.kind === "needs-approval" ||
      this.needsHumanApproval(resolution.capability.requiredApprovals);

    if (!humanApproval) return this.commit(task, result, resolution);

    this.transition(task, "Review", `awaiting ${level} approval`, resolution);
    const request: ApprovalRequest = { taskId: task.taskId, level, at: this.deps.clock.now() };
    this.deps.events.publish({
      type: "Approval.Requested",
      source: "chief-orchestrator",
      correlationId: task.correlationId,
      subject: resolution.capability.id,
      priority: "P1",
      payload: { taskId: task.taskId, level },
    });
    const provisional: Provisional = { result, resolution };
    const decision = this.deps.approvals.decide(request);
    if (decision) return this.resume(task, provisional, decision);
    return { task, status: task.status, pending: { request, provisional } };
  }

  private commit(
    task: Task,
    result: CommitReadyResult,
    resolution: OkResolution
  ): CoordinatorOutcome {
    const writeScopes = resolution.agent.permissions.memoryWrite;
    const se = result.sideEffects;
    if (se?.memory?.length) this.deps.memory.applyWrites(se.memory, writeScopes);
    if (se?.knowledge?.length) {
      this.deps.memory.applyWrites(se.knowledge, writeScopes);
      task.knowledgeUpdates.push(...se.knowledge);
      this.deps.events.publish({
        type: "Knowledge.Updated",
        source: "chief-orchestrator",
        correlationId: task.correlationId,
        subject: resolution.capability.id,
        priority: "P2",
        payload: { taskId: task.taskId, count: se.knowledge.length },
      });
    }
    if (se?.analytics?.length) {
      for (const signal of se.analytics) {
        task.analyticsUpdates.push(signal);
        this.deps.events.publish({
          type: "Analytics.Signal",
          source: "chief-orchestrator",
          correlationId: task.correlationId,
          subject: resolution.capability.id,
          priority: "P3",
          payload: signal,
        });
      }
    }
    if (se?.artifacts?.length) task.artifactsProduced.push(...se.artifacts);
    if (result.kind === "completed" && result.checkpoints?.length)
      task.checkpoints.push(...result.checkpoints);

    task.output = result.output;
    this.transition(task, "Completed", "output valid, side-effects committed", resolution);
    this.deps.audit.record("complete", `agent=${resolution.agent.id}`, this.prov(task, resolution));
    return { task, status: task.status, result };
  }

  private handleRetryable(
    task: Task,
    errorClass: ErrorClass,
    reason: string,
    attempt: number,
    maxAttempts: number,
    capability: Capability,
    resolution: OkResolution
  ): boolean {
    this.transition(task, "Retry", `${errorClass}: ${reason}`, resolution);
    task.retryCount++;
    const retryable = capability.retryPolicy.retryableClasses.includes(errorClass);
    if (retryable && attempt < maxAttempts) {
      const backoff = capability.retryPolicy.backoffBaseTicks * Math.pow(2, attempt - 1);
      this.deps.audit.record(
        "retry",
        `class=${errorClass} attempt=${attempt} backoffTicks=${backoff}`,
        this.prov(task, resolution),
        { attempt, backoff }
      );
      this.transition(task, "Queued", "re-queued for retry", resolution);
      return true;
    }
    return false;
  }

  private markFailed(
    task: Task,
    errorClass: ErrorClass,
    reason: string,
    resolution: OkResolution
  ): CoordinatorOutcome {
    this.transition(task, "Failed", `${errorClass}: ${reason}`, resolution);
    this.deps.dlq.push({ at: this.deps.clock.now(), taskId: task.taskId, reason, errorClass });
    this.deps.events.publish({
      type: "Incident.Raised",
      source: "chief-orchestrator",
      correlationId: task.correlationId,
      subject: resolution.capability.id,
      priority: "P0",
      payload: { taskId: task.taskId, errorClass, reason },
    });
    this.deps.events.publish({
      type: "Task.Escalated",
      source: "chief-orchestrator",
      correlationId: task.correlationId,
      subject: resolution.capability.id,
      priority: "P1",
      payload: { taskId: task.taskId, reason },
    });
    this.deps.audit.record("failed", `${errorClass}: ${reason}`, this.prov(task, resolution));
    return { task, status: task.status, result: undefined };
  }

  private async executeWithFailover(
    providers: readonly Provider[],
    request: ExecutionRequest,
    task: Task,
    resolution: OkResolution
  ): Promise<{ result: ExecutionResult; provider: Provider }> {
    let last: { result: ExecutionResult; provider: Provider } = {
      result: {
        kind: "fatal",
        error: { class: "Fatal", reason: "no provider", retryable: false },
        costUnits: 0,
      },
      provider: providers[0],
    };
    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i];
      const result = await provider.execute(request);
      if (result.kind === "fatal" && i < providers.length - 1) {
        this.deps.audit.record(
          "failover",
          `provider=${provider.id} fatal (${result.error.reason}); failing over`,
          this.prov(task, resolution, provider.id)
        );
        last = { result, provider };
        continue;
      }
      return { result, provider };
    }
    return last;
  }

  private buildRequest(task: Task, resolution: OkResolution, attempt: number): ExecutionRequest {
    const { agent, capability } = resolution;
    const memory = this.deps.memory.snapshot(agent.permissions.memoryRead);
    const ceiling = this.deps.config.resolveLimit(
      "costCeiling",
      { agent: agent.id },
      agent.permissions.costCeiling
    );
    return {
      taskId: task.taskId,
      capability: capability.id,
      agentId: agent.id,
      promptRef: `${agent.id}.${capability.id}`,
      inputs: task.inputs,
      context: task.context,
      memory,
      limits: {
        costCeiling: ceiling,
        ...(task.deadlineTick !== null ? { deadlineTick: task.deadlineTick } : {}),
      },
      attempt,
      trustLevel: task.trustLevel,
    };
  }

  private outputValid(task: Task, output: PlainData): boolean {
    if (!task.successCriteria) return true;
    return deepEqual(output[task.successCriteria.outputKey], task.successCriteria.equals);
  }

  private needsHumanApproval(level: Capability["requiredApprovals"]): boolean {
    return level === "department" || level === "chief" || level === "founder";
  }

  private checkpoint(task: Task, label: string, state: PlainData): void {
    task.checkpoints.push({
      id: this.deps.ids.next("cp"),
      at: this.deps.clock.now(),
      label,
      state,
    });
    this.deps.audit.record("checkpoint", label, this.prov(task));
  }

  private transition(task: Task, to: TaskState, note: string, resolution?: OkResolution): void {
    assertTransition(task.status, to);
    const from = task.status;
    task.executionHistory.push({ at: this.deps.clock.now(), from, to, note });
    task.status = to;
    task.updatedAt = this.deps.clock.now();
    this.deps.audit.record("transition", `${from} → ${to}: ${note}`, this.prov(task, resolution), {
      from,
      to,
    });
    this.deps.events.publish({
      type: `Task.${to}`,
      source: "chief-orchestrator",
      correlationId: task.correlationId,
      subject: task.capabilityRequested,
      priority: task.priority,
      payload: { taskId: task.taskId, from, to },
    });
  }

  private prov(task: Task, resolution?: OkResolution, providerId?: string): Provenance {
    return {
      taskId: task.taskId,
      ...(task.workflowId ? { workflowId: task.workflowId } : {}),
      correlationId: task.correlationId,
      capability: task.capabilityRequested,
      ...(resolution
        ? {
            capabilityVersion: resolution.capability.version,
            agent: resolution.agent.id,
            agentVersion: resolution.agent.version,
          }
        : {}),
      ...(providerId
        ? { provider: providerId }
        : task.assignedProvider
          ? { provider: task.assignedProvider }
          : {}),
    };
  }
}
