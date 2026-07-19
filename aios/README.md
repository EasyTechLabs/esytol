# AIOS — Chief Orchestrator (developer documentation)

> The first executable component of the Esytol AI Operating System: the **Chief Orchestrator**, the
> runtime coordinator of AIOS. It **only coordinates work** — it never builds tools, writes content,
> performs SEO, or generates videos. Implemented exactly to the approved architecture (AIOS-001/002/003);
> this sprint (AIOS-004) does not redesign anything.

- **Sprint:** AIOS-004 · **Status:** ✅ implemented, tested (41 tests), deterministic.
- **Design specs:** `../../easytech-workspace/ProductFactory/Knowledge/AI/` — AIOS.md, AgentSDK.md,
  WorkflowEngine.md, CapabilityRegistry.md, TaskContract.md, ExecutionContract.md, StateMachine.md,
  EventBus.md, MemoryArchitecture.md, ApprovalMatrix.md, FailureRecovery.md, Scheduling.md,
  ProviderIntegration.md, ImplementationRoadmap.md.

---

## 1. Why it lives here (and imports nothing from the product)

AIOS is a standalone, **zero-runtime-dependency** TypeScript module. It is co-located in the `esytol`
repo during bootstrap purely to reuse the proven toolchain (type-check, lint, test, build); it imports
**nothing** from the product and is fully portable — extracting it to its own repo/runtime later is a
documented migration (see `MigrationStrategy.md`), not a rewrite. `aios/` is not part of the Next.js
build graph (no route imports it); only the test runner and type-checker touch it.

## 2. Architecture (map of `src/`)

```
receive ──▶ validate ──▶ load workflow ──▶ resolve capability ──▶ resolve agent ──▶ resolve provider
                                                                                          │
 complete ◀── determine next ◀── generate events ◀── persist memory/knowledge ◀── validate result ◀── execute
```

| File              | Responsibility                                                                                    | Spec                                     |
| ----------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `kernel.ts`       | deterministic `Clock` + `IdGenerator` + clone/freeze; **no wall-clock, no randomness**            | AIOS.md §5                               |
| `types.ts`        | all contracts (Task, Capability, Agent, Event, Execution*, Workflow, Approval)                    | the execution contracts                  |
| `stateMachine.ts` | the 14 task states, legal transitions, forbidden transitions                                      | StateMachine.md                          |
| `taskContract.ts` | validate a request + construct the universal Task                                                 | TaskContract.md                          |
| `events.ts`       | the mediated event bus (pub/sub, dead-letter)                                                     | EventBus.md / InterAgentCommunication.md |
| `memory.ts`       | versioned store (supersede-not-overwrite) + read-only snapshot loader                             | MemoryArchitecture.md                    |
| `registries.ts`   | Capability / Agent / Workflow registries (systems of record)                                      | *Registry.md                             |
| `provider.ts`     | the **Execution Engine Adapter** interface + registry + a deterministic reference provider        | ProviderIntegration.md                   |
| `resolver.ts`     | capability → agent → provider chain (route by capability, not agent)                              | CapabilityRegistry.md §4                 |
| `config.ts`       | layered config with precedence + safety-ratchet                                                   | ConfigurationManagement.md               |
| `approvals.ts`    | approval gateways (pause / auto-approve / auto-reject)                                            | ApprovalMatrix.md                        |
| `coordinator.ts`  | runs ONE task: dispatch, retry, failover, checkpoint, approval, commit, rollback, DLQ, escalation | ExecutionContract + FailureRecovery      |
| `orchestrator.ts` | the **Chief Orchestrator**: receive → workflow DAG → resolve → dispatch → next → complete         | WorkflowEngine.md                        |
| `index.ts`        | public API + `createChiefOrchestrator()` factory                                                  | —                                        |

## 3. Runtime & execution flow

`createChiefOrchestrator()` wires a working runtime (in-memory reference stores + a deterministic
reference provider). A unit of work flows exactly as the roadmap prescribes:

1. **Receive** — `receiveEvent(event)` (starts every workflow registered for the event type) or
   `receiveTask(input)` (a single task).
2. **Validate** the Task Contract (`validateTaskInput`).
3. **Load Workflow** — resolved by event type (`WorkflowRegistry.byTrigger`).
4. **Resolve Capability → Agent → Provider** (`CapabilityResolver`; fallback capability on miss).
5. **Load Memory** — a deeply-frozen snapshot of the agent's granted read scopes.
6. **Execute** — the coordinator dispatches to the provider; the provider runs the agent (an LLM in
   production; a deterministic executor here).
7. **Validate Result** — one enumerated outcome (`completed | rejected | retryable | fatal |
needs-approval`); output checked against `successCriteria`.
8. **Persist Knowledge / Memory** — declared side-effects are applied **only on commit** (provisional
   until then → rollback = discard).
9. **Generate Events** — every transition and result emits a typed event.
10. **Determine Next Step** — the workflow DAG advances (dependencies + gates); gate failure routes
    (reject / escalate / loop-back).
11. **Complete** — `Workflow.Completed` (or `Workflow.Failed`) with a full audit trail.

Every transition uses the approved state machine; every action is recorded in the append-only audit log.

## 4. Extension points

- **Add a capability:** `capabilities.register({...})` (CapabilityRegistry.md 18-field spec).
- **Add an agent:** `agents.register({...})` advertising `providesCapabilities` (AgentSDK.md).
- **Add a workflow:** `workflows.register({ trigger, steps })` — a new **event type** becomes supported
  with **zero orchestrator change** (the orchestrator routes any event to workflows registered for it).
- **Bind execution:** on the reference provider, `referenceProvider.bind(capabilityId, executor)`.
- **Approval policy:** pass a custom `ApprovalGateway` to `createChiefOrchestrator({ approvals })`.

## 5. Provider integration (no Claude dependency)

The orchestrator depends only on the `Provider` interface (`{ id, engineCapabilities, execute() }`).
A real provider (Claude, GPT, Gemini, Ollama/LM Studio) is one class implementing `Provider` that calls
the LLM with the agent's prompt and maps the response to an `ExecutionResult` — **no orchestrator code
changes**. Providers are selected by required engine capabilities with automatic **failover**. This
sprint ships a deterministic **reference provider** (a local engine running bound executors) so the
runtime is reproducible and testable without a network or an LLM.

## 6. Determinism

The orchestrator is deterministic: time and identity are injected (`LogicalClock`, `IdGenerator`), so
two runs of the same workflow produce **byte-identical audit trails, events, task histories, and
committed memory** (see `tests/goldenReplay.test.ts`). This is what makes execution auditable,
replayable, and safe to migrate/resume.

## 7. Testing

`npx vitest run aios/tests` — 41 tests across: state machine (legal/forbidden), task contract, event
bus + memory + registries, provider abstraction + capability resolution, the end-to-end New Tool
workflow (event-driven, gate loop-back, new-event registration), standalone tasks, failure recovery
(retry / exhaustion → DLQ + escalation / provider failover / approval pause+resume / rollback /
checkpoint recovery), configuration, and golden-task replay (determinism).

## 8. Future expansion (per the roadmap)

- File/git-backed reference stores behind the existing interfaces (Memory/Registry).
- Real provider adapters (Claude first) + the cross-provider conformance/eval suite.
- The Scheduler (Scheduling.md) for cadences, priority queues, and real backoff delays.
- More agents/capabilities/workflows registered to run the Content/SEO/Video factories.

_This module coordinates work; it never performs domain work. No provider-specific logic exists outside
an adapter, and the approved architecture is not redesigned here._
