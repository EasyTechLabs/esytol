/**
 * AIOS — Chief Orchestrator (AIOS-004): public API + a factory that wires a working runtime.
 *
 * `createChiefOrchestrator()` returns a fully-connected orchestrator with in-memory reference stores and
 * a deterministic reference provider. Callers register capabilities, agents, workflows, and (on the
 * reference provider) deterministic executors — the orchestrator then coordinates everything. Swapping
 * the reference provider for a Claude/GPT/Gemini adapter requires NO orchestrator change.
 */

import { LogicalClock, IdGenerator } from "./kernel";
import type { Clock } from "./kernel";
import { EventBus } from "./events";
import { InMemoryAuditSink, AuditLog } from "./audit";
import { InMemoryMemoryStore, MemoryLoader } from "./memory";
import { CapabilityRegistry, AgentRegistry, WorkflowRegistry } from "./registries";
import { ProviderRegistry, ReferenceProvider } from "./provider";
import { CapabilityResolver } from "./resolver";
import { ExecutionCoordinator, DeadLetterQueue } from "./coordinator";
import { ChiefOrchestrator } from "./orchestrator";
import { Config } from "./config";
import { PendingApprovalGateway } from "./approvals";
import type { ApprovalGateway } from "./types";

export interface AiosRuntime {
  orchestrator: ChiefOrchestrator;
  capabilities: CapabilityRegistry;
  agents: AgentRegistry;
  workflows: WorkflowRegistry;
  providers: ProviderRegistry;
  referenceProvider: ReferenceProvider;
  memoryStore: InMemoryMemoryStore;
  audit: AuditLog;
  events: EventBus;
  config: Config;
  dlq: DeadLetterQueue;
  clock: Clock;
  ids: IdGenerator;
}

export interface CreateOptions {
  clock?: Clock;
  ids?: IdGenerator;
  /** Approval gateway (default pauses everything requiring a human decision). */
  approvals?: ApprovalGateway;
  /** Engine capabilities the bundled reference provider advertises (default: ["deterministic"]). */
  referenceEngineCapabilities?: readonly string[];
}

export function createChiefOrchestrator(options: CreateOptions = {}): AiosRuntime {
  const clock = options.clock ?? new LogicalClock();
  const ids = options.ids ?? new IdGenerator();
  const events = new EventBus(clock, ids);
  const audit = new AuditLog(new InMemoryAuditSink(), clock, ids);
  const memoryStore = new InMemoryMemoryStore();
  const memoryLoader = new MemoryLoader(memoryStore);
  const capabilities = new CapabilityRegistry();
  const agents = new AgentRegistry();
  const workflows = new WorkflowRegistry();
  const providers = new ProviderRegistry();
  const referenceProvider = new ReferenceProvider({
    ...(options.referenceEngineCapabilities
      ? { engineCapabilities: options.referenceEngineCapabilities }
      : {}),
  });
  providers.register(referenceProvider);
  const resolver = new CapabilityResolver(capabilities, agents, providers);
  const dlq = new DeadLetterQueue();
  const config = new Config();
  const approvals = options.approvals ?? new PendingApprovalGateway();
  const coordinator = new ExecutionCoordinator({
    audit,
    events,
    memory: memoryLoader,
    approvals,
    config,
    dlq,
    clock,
    ids,
  });
  const orchestrator = new ChiefOrchestrator({
    clock,
    ids,
    events,
    audit,
    capabilities,
    agents,
    workflows,
    resolver,
    coordinator,
    dlq,
  });

  return {
    orchestrator,
    capabilities,
    agents,
    workflows,
    providers,
    referenceProvider,
    memoryStore,
    audit,
    events,
    config,
    dlq,
    clock,
    ids,
  };
}

// ─── Public surface ──────────────────────────────────────────────────────────

export * from "./types";
export {
  AIOS_VERSION,
  TASK_CONTRACT_VERSION,
  LogicalClock,
  IdGenerator,
  deepClone,
  deepEqual,
  deepFreeze,
} from "./kernel";
export type { Clock } from "./kernel";
export { AIOS_EVENTS } from "./events.constants";
export type { AiosEventType } from "./events.constants";
export {
  TASK_STATES,
  LEGAL_TRANSITIONS,
  TERMINAL_STATES,
  isTerminal,
  canTransition,
  assertTransition,
  IllegalTransitionError,
} from "./stateMachine";
export { validateTaskInput, createTask } from "./taskContract";
export type { ValidationResult } from "./taskContract";
export { EventBus } from "./events";
export type { PublishInput, EventHandler, DeadLetteredEvent } from "./events";
export { AuditLog, InMemoryAuditSink } from "./audit";
export type { AuditSink } from "./audit";
export { InMemoryMemoryStore, MemoryLoader, MemoryPermissionError } from "./memory";
export type { MemoryStore } from "./memory";
export { CapabilityRegistry, AgentRegistry, WorkflowRegistry } from "./registries";
export { ProviderRegistry, ReferenceProvider } from "./provider";
export type { CapabilityExecutor, ReferenceProviderOptions } from "./provider";
export { CapabilityResolver } from "./resolver";
export type { Resolution } from "./resolver";
export { ExecutionCoordinator, DeadLetterQueue } from "./coordinator";
export type { CoordinatorOutcome, CoordinatorDeps, Provisional } from "./coordinator";
export { ChiefOrchestrator } from "./orchestrator";
export type { ChiefOrchestratorDeps, WorkflowRunResult } from "./orchestrator";
export { Config } from "./config";
export type { ConfigScope, ConfigContext } from "./config";
export { PendingApprovalGateway, AutoApproveGateway, AutoRejectGateway } from "./approvals";
