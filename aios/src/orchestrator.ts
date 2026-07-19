/**
 * Chief Orchestrator (AIOS-004) — the brain of AIOS. It coordinates work and NEVER performs domain
 * work: it receives tasks and events, validates the Task Contract, loads workflows, resolves
 * capabilities → agents → providers, dispatches through the coordinator, tracks execution, generates
 * events, drives workflow DAGs, handles approvals, and completes workflows.
 *
 * Implements the task flow of ImplementationRoadmap.md / WorkflowEngine.md exactly. New event types are
 * supported by registering a workflow with that trigger — with ZERO change to this class.
 */

import type { Clock, IdGenerator } from "./kernel";
import { deepEqual } from "./kernel";
import type { ApprovalDecision, PlainData, Task, TaskInput, WorkflowDefinition } from "./types";
import { validateTaskInput, createTask } from "./taskContract";
import type { AuditLog } from "./audit";
import type { EventBus, PublishInput } from "./events";
import type { CapabilityResolver, Resolution } from "./resolver";
import type {
  CoordinatorOutcome,
  Provisional,
  ExecutionCoordinator,
  DeadLetterQueue,
} from "./coordinator";
import type { CapabilityRegistry, AgentRegistry, WorkflowRegistry } from "./registries";

const MAX_WORKFLOW_ITERATIONS_PER_STEP = 10;
const MAX_GATE_RETRIES = 3;

export interface ChiefOrchestratorDeps {
  clock: Clock;
  ids: IdGenerator;
  events: EventBus;
  audit: AuditLog;
  capabilities: CapabilityRegistry;
  agents: AgentRegistry;
  workflows: WorkflowRegistry;
  resolver: CapabilityResolver;
  coordinator: ExecutionCoordinator;
  dlq: DeadLetterQueue;
}

export interface WorkflowRunResult {
  workflowId: string;
  instanceId: string;
  correlationId: string;
  status: "completed" | "failed" | "paused";
  tasks: Task[];
  failedStep?: string;
  failureReason?: string;
  pausedTaskId?: string;
}

interface WorkflowRunState {
  workflow: WorkflowDefinition;
  instanceId: string;
  correlationId: string;
  requester: string;
  triggerPayload: PlainData;
  stepOutputs: Record<string, PlainData>;
  completed: Set<string>;
  runCounts: Record<string, number>;
  gateRetries: Record<string, number>;
  tasks: Task[];
}

interface PendingApproval {
  state: WorkflowRunState | null;
  stepId: string | null;
  provisional: Provisional;
}

export class ChiefOrchestrator {
  private readonly d: ChiefOrchestratorDeps;
  private readonly pending = new Map<string, PendingApproval>();
  /** Standalone (non-workflow) tasks awaiting approval, tracked for resume. */
  private readonly standaloneTasks = new Map<string, Task>();

  constructor(deps: ChiefOrchestratorDeps) {
    this.d = deps;
  }

  // ── inbound: tasks & events ─────────────────────────────────────────────────

  /** Receive a single task, validate its contract, and run it to a terminal (or paused) state. */
  async receiveTask(input: TaskInput): Promise<CoordinatorOutcome> {
    const validation = validateTaskInput(input);
    if (!validation.ok) {
      this.d.audit.record("reject-task", validation.errors.join("; "), { aiosVersion: "" });
      throw new Error(`Invalid task contract: ${validation.errors.join("; ")}`);
    }
    const task = createTask(input, { ids: this.d.ids, clock: this.d.clock });
    this.d.audit.record("receive-task", `capability=${task.capabilityRequested}`, {
      aiosVersion: "",
      taskId: task.taskId,
      correlationId: task.correlationId,
      capability: task.capabilityRequested,
    });

    const resolution = this.resolveOrFallback(task.capabilityRequested);
    if (!resolution.ok) return this.failUnresolved(task, resolution.reason);

    const outcome = await this.d.coordinator.run(task, resolution);
    if (outcome.pending) {
      this.standaloneTasks.set(task.taskId, task);
      this.pending.set(task.taskId, {
        state: null,
        stepId: null,
        provisional: outcome.pending.provisional,
      });
    }
    return outcome;
  }

  /**
   * Receive an external event (ToolRequested, BugReported, …). Publishes it and starts every workflow
   * registered for its trigger. Adding a new event type requires only registering a workflow — no code
   * change here.
   */
  async receiveEvent(input: PublishInput): Promise<WorkflowRunResult[]> {
    const event = this.d.events.publish(input);
    const workflows = this.d.workflows.byTrigger(event.type);
    const results: WorkflowRunResult[] = [];
    for (const workflow of workflows) {
      results.push(
        await this.startWorkflow(workflow, event.payload, event.correlationId, input.source)
      );
    }
    return results;
  }

  /** Start a workflow instance and drive its DAG to completion (or a pause/failure). */
  async startWorkflow(
    workflow: WorkflowDefinition,
    triggerPayload: PlainData,
    correlationId?: string,
    requester = "chief-orchestrator"
  ): Promise<WorkflowRunResult> {
    const state: WorkflowRunState = {
      workflow,
      instanceId: this.d.ids.next("wf"),
      correlationId: correlationId ?? this.d.ids.next("corr"),
      requester,
      triggerPayload,
      stepOutputs: {},
      completed: new Set(),
      runCounts: {},
      gateRetries: {},
      tasks: [],
    };
    this.d.audit.record("workflow-start", `${workflow.id}@${workflow.version}`, {
      aiosVersion: "",
      workflowId: workflow.id,
      correlationId: state.correlationId,
    });
    return this.driveWorkflow(state);
  }

  /** Deliver a human approval decision, resume the paused task, and continue its workflow. */
  async provideApproval(
    taskId: string,
    decision: Omit<ApprovalDecision, "taskId">
  ): Promise<CoordinatorOutcome | WorkflowRunResult> {
    const pending = this.pending.get(taskId);
    if (!pending) throw new Error(`No task pending approval: ${taskId}`);
    this.pending.delete(taskId);
    const task = this.findTask(taskId, pending);
    if (!task) throw new Error(`Pending task not found: ${taskId}`);

    const outcome = this.d.coordinator.resume(task, pending.provisional, { taskId, ...decision });

    if (!pending.state || !pending.stepId) {
      this.standaloneTasks.delete(taskId);
      return outcome; // standalone task
    }
    // resumed within a workflow → record the step result and continue driving.
    if (task.status === "Completed") {
      pending.state.stepOutputs[pending.stepId] = task.output ?? {};
      pending.state.completed.add(pending.stepId);
    } else {
      return this.finishWorkflow(pending.state, "failed", pending.stepId, "approval rejected");
    }
    return this.driveWorkflow(pending.state);
  }

  // ── workflow DAG driver ──────────────────────────────────────────────────────

  private async driveWorkflow(state: WorkflowRunState): Promise<WorkflowRunResult> {
    const { workflow } = state;
    let iterations = 0;
    const maxIterations =
      workflow.steps.length * MAX_WORKFLOW_ITERATIONS_PER_STEP + MAX_WORKFLOW_ITERATIONS_PER_STEP;

    while (state.completed.size < workflow.steps.length) {
      if (++iterations > maxIterations)
        return this.finishWorkflow(state, "failed", undefined, "workflow iteration cap exceeded");

      const step = workflow.steps.find(
        (s) =>
          !state.completed.has(s.id) && (s.dependsOn ?? []).every((d) => state.completed.has(d))
      );
      if (!step)
        return this.finishWorkflow(
          state,
          "failed",
          undefined,
          "no runnable step (dependency deadlock)"
        );

      const inputs =
        step.inputsFrom && step.inputsFrom !== "trigger"
          ? (state.stepOutputs[step.inputsFrom.step] ?? {})
          : state.triggerPayload;

      const resolution = this.resolveOrFallback(step.capability);
      if (!resolution.ok)
        return this.finishWorkflow(state, "failed", step.id, `resolution: ${resolution.reason}`);

      const task = createTask(
        {
          workflowId: `${workflow.id}#${state.instanceId}`,
          correlationId: state.correlationId,
          capabilityRequested: step.capability,
          objective: `${workflow.id}:${step.id}`,
          requester: state.requester,
          inputs,
        },
        { ids: this.d.ids, clock: this.d.clock }
      );
      state.tasks.push(task);
      state.runCounts[step.id] = (state.runCounts[step.id] ?? 0) + 1;

      const outcome = await this.d.coordinator.run(task, resolution);

      if (outcome.pending) {
        this.pending.set(task.taskId, {
          state,
          stepId: step.id,
          provisional: outcome.pending.provisional,
        });
        return {
          workflowId: workflow.id,
          instanceId: state.instanceId,
          correlationId: state.correlationId,
          status: "paused",
          tasks: state.tasks,
          pausedTaskId: task.taskId,
        };
      }

      if (task.status !== "Completed") {
        return this.finishWorkflow(state, "failed", step.id, `step ${task.status}`);
      }

      const output = task.output ?? {};
      if (step.gate && !deepEqual(output[step.gate.outputKey], step.gate.equals)) {
        const routed = this.routeGateFailure(state, step.id, step.onGateFail);
        if (routed === "fail") return this.finishWorkflow(state, "failed", step.id, "gate failed");
        // routed === "retry-scheduled": the retry target was un-completed; continue the loop.
        continue;
      }

      state.stepOutputs[step.id] = output;
      state.completed.add(step.id);
    }

    return this.finishWorkflow(state, "completed");
  }

  private routeGateFailure(
    state: WorkflowRunState,
    stepId: string,
    onGateFail: WorkflowDefinition["steps"][number]["onGateFail"]
  ): "fail" | "retry-scheduled" {
    if (!onGateFail || onGateFail === "reject") return "fail";
    if (onGateFail === "escalate") {
      this.d.events.publish({
        type: "Task.Escalated",
        source: "chief-orchestrator",
        correlationId: state.correlationId,
        subject: state.workflow.id,
        priority: "P1",
        payload: { workflowId: state.workflow.id, step: stepId, reason: "gate failed" },
      });
      return "fail";
    }
    // { retryStep }
    const target = onGateFail.retryStep;
    const count = (state.gateRetries[target] ?? 0) + 1;
    state.gateRetries[target] = count;
    if (count > MAX_GATE_RETRIES) return "fail";
    // Un-complete the retry target (and this gate step) so both re-run.
    state.completed.delete(target);
    state.completed.delete(stepId);
    this.d.audit.record(
      "gate-retry",
      `step=${stepId} → retry ${target} (${count}/${MAX_GATE_RETRIES})`,
      {
        aiosVersion: "",
        workflowId: state.workflow.id,
        correlationId: state.correlationId,
      }
    );
    return "retry-scheduled";
  }

  private finishWorkflow(
    state: WorkflowRunState,
    status: "completed" | "failed",
    failedStep?: string,
    reason?: string
  ): WorkflowRunResult {
    this.d.events.publish({
      type: status === "completed" ? "Workflow.Completed" : "Workflow.Failed",
      source: "chief-orchestrator",
      correlationId: state.correlationId,
      subject: state.workflow.id,
      priority: status === "completed" ? "P2" : "P1",
      payload: {
        workflowId: state.workflow.id,
        instanceId: state.instanceId,
        ...(failedStep ? { failedStep } : {}),
        ...(reason ? { reason } : {}),
      },
    });
    this.d.audit.record(
      `workflow-${status}`,
      `${state.workflow.id}${reason ? `: ${reason}` : ""}`,
      {
        aiosVersion: "",
        workflowId: state.workflow.id,
        correlationId: state.correlationId,
      }
    );
    return {
      workflowId: state.workflow.id,
      instanceId: state.instanceId,
      correlationId: state.correlationId,
      status,
      tasks: state.tasks,
      ...(failedStep ? { failedStep } : {}),
      ...(reason ? { failureReason: reason } : {}),
    };
  }

  // ── resolution + failure helpers ─────────────────────────────────────────────

  private resolveOrFallback(capabilityId: string): Resolution {
    const first = this.d.resolver.resolve(capabilityId);
    if (first.ok) return first;
    if (first.fallbackCapability) {
      this.d.audit.record(
        "fallback",
        `${capabilityId} → ${first.fallbackCapability} (${first.reason})`,
        {
          aiosVersion: "",
          capability: capabilityId,
        }
      );
      return this.d.resolver.resolve(first.fallbackCapability);
    }
    return first;
  }

  private failUnresolved(task: Task, reason: string): CoordinatorOutcome {
    this.d.dlq.push({
      at: this.d.clock.now(),
      taskId: task.taskId,
      reason: `unresolved: ${reason}`,
      errorClass: "Missing-Dependency",
    });
    this.d.events.publish({
      type: "Task.Escalated",
      source: "chief-orchestrator",
      correlationId: task.correlationId,
      subject: task.capabilityRequested,
      priority: "P1",
      payload: { taskId: task.taskId, reason: `unresolved: ${reason}` },
    });
    this.d.audit.record("unresolved", reason, {
      aiosVersion: "",
      taskId: task.taskId,
      capability: task.capabilityRequested,
    });
    // The task never left Created; mark it Cancelled (it cannot run).
    task.executionHistory.push({
      at: this.d.clock.now(),
      from: task.status,
      to: "Cancelled",
      note: `unresolved: ${reason}`,
    });
    task.status = "Cancelled";
    task.updatedAt = this.d.clock.now();
    return { task, status: task.status };
  }

  private findTask(taskId: string, pending: PendingApproval): Task | undefined {
    if (pending.state) return pending.state.tasks.find((t) => t.taskId === taskId);
    return this.standaloneTasks.get(taskId);
  }

  // ── inspection ───────────────────────────────────────────────────────────────

  getDeadLetterQueue() {
    return this.d.dlq.all();
  }
  getAudit() {
    return this.d.audit.all();
  }
  getPublishedEvents() {
    return this.d.events.publishedEvents();
  }
  pendingApprovals(): string[] {
    return Array.from(this.pending.keys());
  }
}
