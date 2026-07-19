/**
 * AIOS shared contracts (AIOS-004 — Chief Orchestrator implementation).
 *
 * Faithful, engine-independent projections of the approved specs:
 *   - Task        → TaskContract.md
 *   - TaskState   → StateMachine.md
 *   - Capability  → CapabilityRegistry.md
 *   - Agent       → AgentSDK.md / AgentRegistry.md
 *   - Event       → EventBus.md / InterAgentCommunication.md
 *   - Execution*  → ExecutionContract.md
 *   - Workflow    → WorkflowEngine.md
 *   - Approval    → ApprovalMatrix.md
 *
 * These are contracts, not domain logic. Payloads are opaque plain data (`Record<string, unknown>`) so
 * the orchestrator never inspects domain content — it only coordinates.
 */

// ─── Primitive unions ────────────────────────────────────────────────────────

export type Priority = "P0" | "P1" | "P2" | "P3";
export type AuthorityTier = 0 | 1 | 2 | 3;
export type TrustLevel = "trusted" | "untrusted";

/** The 14 task states (StateMachine.md §1). */
export type TaskState =
  | "Created"
  | "Queued"
  | "Waiting"
  | "Executing"
  | "Checkpoint"
  | "Blocked"
  | "Review"
  | "Approved"
  | "Rejected"
  | "Retry"
  | "Completed"
  | "Cancelled"
  | "Failed"
  | "Archived";

/** Typed error classes (ExecutionContract.md §5). */
export type ErrorClass =
  | "Transient"
  | "Invalid-Output"
  | "Missing-Dependency"
  | "Permission-Denied"
  | "Safety-Refusal"
  | "Fatal";

/** Approval levels (ApprovalMatrix.md §1). */
export type ApprovalLevel = "autonomous" | "peer" | "department" | "chief" | "founder";

export type ApprovalDecisionKind = "approved" | "rejected";

export type PlainData = Record<string, unknown>;

// ─── Provenance & audit (AIOS.md §7–8) ───────────────────────────────────────

export interface Provenance {
  /** Set by the audit log to the running AIOS version; callers may omit it. */
  aiosVersion?: string;
  capability?: string;
  capabilityVersion?: string;
  agent?: string;
  agentVersion?: string;
  provider?: string;
  taskId?: string;
  workflowId?: string;
  correlationId?: string;
}

export interface AuditRecord {
  id: string;
  at: number;
  /** What happened: a state transition, a dispatch, a decision, an approval, a failure, etc. */
  action: string;
  detail: string;
  provenance: Provenance;
  /** Optional structured extra (e.g. { from, to } for a transition). */
  data?: PlainData;
}

// ─── Events (EventBus.md / InterAgentCommunication.md) ────────────────────────

export interface EventEnvelope {
  messageId: string;
  type: string;
  version: string;
  correlationId: string;
  causationId?: string;
  source: string;
  /** A capability id or a topic — never a specific agent (InterAgentCommunication.md §2). */
  subject?: string;
  priority: Priority;
  trustLevel: TrustLevel;
  timestamp: number;
  payload: PlainData;
}

// ─── Capabilities (CapabilityRegistry.md) ────────────────────────────────────

export interface RetryPolicy {
  maxAttempts: number;
  /** Base backoff in logical ticks (recorded, not slept — the Scheduler enforces real delay). */
  backoffBaseTicks: number;
  retryableClasses: ErrorClass[];
}

export interface Capability {
  id: string;
  version: string;
  authorityLevel: AuthorityTier;
  requiredApprovals: ApprovalLevel;
  /** Engine capabilities a provider must satisfy to run this (e.g. "deterministic", "tool-use"). */
  requiredEngineCapabilities: readonly string[];
  fallbackCapability?: string;
  priority: Priority;
  retryPolicy: RetryPolicy;
}

// ─── Agents (AgentSDK.md / AgentRegistry.md) ─────────────────────────────────

export type AgentStatus =
  "draft" | "registered" | "active" | "deprecated" | "retired" | "suspended";

export interface AgentPermissions {
  memoryRead: readonly string[];
  memoryWrite: readonly string[];
  sideEffects: readonly string[];
  costCeiling: number;
}

export interface AgentDescriptor {
  id: string;
  version: string;
  role: string;
  department: string;
  authorityTier: AuthorityTier;
  providesCapabilities: readonly string[];
  requiresEngineCapabilities: readonly string[];
  status: AgentStatus;
  permissions: AgentPermissions;
}

// ─── Memory (MemoryArchitecture.md) ──────────────────────────────────────────

export type MemoryTier =
  "short-term" | "conversation" | "project" | "tool" | "decision" | "learning" | "architecture";

/** A grant: which scope (tier:namespace) and whether the task may read and/or write it. */
export interface MemoryGrant {
  scope: string;
  read: boolean;
  write: boolean;
}

/** A read-only, deeply-frozen snapshot of the granted memory scopes at dispatch time. */
export type MemorySnapshot = Readonly<Record<string, unknown>>;

export interface MemoryWrite {
  scope: string;
  key: string;
  value: unknown;
}

// ─── Execution contracts (ExecutionContract.md) ──────────────────────────────

export interface ExecutionError {
  class: ErrorClass;
  reason: string;
  retryable: boolean;
}

export interface Checkpoint {
  id: string;
  at: number;
  label: string;
  state: PlainData;
}

export interface SideEffects {
  memory?: MemoryWrite[];
  knowledge?: MemoryWrite[];
  analytics?: EventEnvelope["payload"][];
  artifacts?: { id: string; kind: string; ref: string }[];
}

export interface ExecutionLimits {
  costCeiling: number;
  deadlineTick?: number;
}

/** The envelope an agent receives (ExecutionContract.md §2). Bound by the runtime; never fetched. */
export interface ExecutionRequest {
  taskId: string;
  capability: string;
  agentId: string;
  promptRef: string;
  inputs: PlainData;
  context: PlainData;
  memory: MemorySnapshot;
  limits: ExecutionLimits;
  attempt: number;
  trustLevel: TrustLevel;
}

/** The single, enumerated outcome an agent returns (ExecutionContract.md §1, §4–5, §8). */
export type ExecutionResult =
  | {
      kind: "completed";
      output: PlainData;
      sideEffects?: SideEffects;
      checkpoints?: Checkpoint[];
      costUnits: number;
    }
  | { kind: "rejected"; reason: string; costUnits: number }
  | { kind: "retryable"; error: ExecutionError; costUnits: number }
  | { kind: "fatal"; error: ExecutionError; costUnits: number }
  | {
      kind: "needs-approval";
      level: ApprovalLevel;
      output: PlainData;
      sideEffects?: SideEffects;
      costUnits: number;
    };

// ─── Provider (the Execution Engine Adapter — AIOS.md §3, ProviderIntegration.md) ──

export interface Provider {
  readonly id: string;
  /** Engine capabilities this provider offers (matched against a capability's requirements). */
  readonly engineCapabilities: readonly string[];
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
}

// ─── Tasks (TaskContract.md) ─────────────────────────────────────────────────

export interface ExecutionHistoryEntry {
  at: number;
  from: TaskState;
  to: TaskState;
  note: string;
}

/** The immutable request a caller supplies to create a Task. */
export interface TaskInput {
  workflowId?: string;
  correlationId?: string;
  parentTaskId?: string;
  capabilityRequested: string;
  objective: string;
  priority?: Priority;
  requester: string;
  dependencies?: string[];
  inputs: PlainData;
  context?: PlainData;
  successCriteria?: { outputKey: string; equals: unknown };
  trustLevel?: TrustLevel;
  deadlineTick?: number;
}

/** The universal unit of work (TaskContract.md §2). Immutable request + append-only history. */
export interface Task {
  // identity & routing
  taskId: string;
  workflowId: string | null;
  correlationId: string;
  parentTaskId: string | null;
  capabilityRequested: string;
  version: string;
  // intent
  objective: string;
  priority: Priority;
  deadlineTick: number | null;
  requester: string;
  // assignment
  assignedAgent: string | null;
  assignedProvider: string | null;
  dependencies: string[];
  // data contract
  inputs: PlainData;
  context: PlainData;
  successCriteria: { outputKey: string; equals: unknown } | null;
  trustLevel: TrustLevel;
  // execution state (append-only)
  status: TaskState;
  retryCount: number;
  executionHistory: ExecutionHistoryEntry[];
  checkpoints: Checkpoint[];
  // results & side-effects (declared)
  output: PlainData | null;
  artifactsProduced: { id: string; kind: string; ref: string }[];
  knowledgeUpdates: MemoryWrite[];
  analyticsUpdates: PlainData[];
  // audit
  createdAt: number;
  updatedAt: number;
}

// ─── Workflows (WorkflowEngine.md) ───────────────────────────────────────────

export interface WorkflowStep {
  id: string;
  capability: string;
  dependsOn?: string[];
  /** Where this step's inputs come from: the trigger payload, or a prior step's output. */
  inputsFrom?: "trigger" | { step: string };
  /** A pass/fail gate on the step output (e.g. { outputKey: "verdict", equals: "PASS" }). */
  gate?: { outputKey: string; equals: unknown };
  /** What to do when the gate fails. */
  onGateFail?: "reject" | "escalate" | { retryStep: string };
}

export interface WorkflowDefinition {
  id: string;
  version: string;
  /** The event type that starts this workflow (EventBus.md). */
  trigger: string;
  steps: WorkflowStep[];
}

// ─── Approvals (ApprovalMatrix.md) ───────────────────────────────────────────

export interface ApprovalRequest {
  taskId: string;
  level: ApprovalLevel;
  at: number;
}

export interface ApprovalDecision {
  taskId: string;
  decision: ApprovalDecisionKind;
  approver: string;
  reason?: string;
}

/** Decides an approval for a level: grants autonomously below the human tiers, else defers. */
export interface ApprovalGateway {
  decide(request: ApprovalRequest): ApprovalDecision | null;
}

// ─── Dead letter (EventBus.md §8 / FailureRecovery.md §7) ────────────────────

export interface DeadLetterEntry {
  at: number;
  taskId: string;
  reason: string;
  errorClass: ErrorClass | "exhausted";
}
