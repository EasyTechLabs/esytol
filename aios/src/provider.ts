/**
 * Provider abstraction (AIOS-004) — the Execution Engine Adapter layer (AIOS.md §3,
 * ProviderIntegration.md). The orchestrator NEVER depends on a specific LLM: it holds a set of
 * providers and selects one whose engine capabilities satisfy the task's requirements, with failover.
 *
 * Claude is simply the first execution provider — it would be one more class implementing `Provider`,
 * with NO orchestrator change. This sprint ships a deterministic reference provider (a local engine)
 * so the runtime is testable and reproducible without a network or an LLM.
 */

import type { ExecutionRequest, ExecutionResult, Provider } from "./types";

/** Registry of execution providers, selected by required engine capabilities (failover-ordered). */
export class ProviderRegistry {
  private providers: Provider[] = [];

  register(provider: Provider): void {
    this.providers.push(provider);
  }

  /** Providers satisfying ALL required engine capabilities, in registration order (failover chain). */
  select(requiredEngineCapabilities: readonly string[]): Provider[] {
    return this.providers.filter((p) =>
      requiredEngineCapabilities.every((c) => p.engineCapabilities.includes(c))
    );
  }

  all(): readonly Provider[] {
    return this.providers;
  }
}

/** A deterministic executor for a capability — the reference engine runs this in place of an LLM call. */
export type CapabilityExecutor = (request: ExecutionRequest) => ExecutionResult;

export interface ReferenceProviderOptions {
  id?: string;
  engineCapabilities?: readonly string[];
}

/**
 * A local, deterministic reference provider. Each capability is bound to a pure executor function; the
 * provider "runs the agent" by invoking it. A real Claude/GPT/Gemini adapter implements the same
 * `Provider` interface and calls the LLM with the agent's prompt instead — the orchestrator cannot tell
 * the difference. Missing executor ⇒ a Fatal error (never a silent success).
 */
export class ReferenceProvider implements Provider {
  readonly id: string;
  readonly engineCapabilities: readonly string[];
  private executors = new Map<string, CapabilityExecutor>();

  constructor(options: ReferenceProviderOptions = {}) {
    this.id = options.id ?? "reference-local";
    this.engineCapabilities = options.engineCapabilities ?? ["deterministic"];
  }

  /** Bind a capability to its deterministic executor. */
  bind(capabilityId: string, executor: CapabilityExecutor): this {
    this.executors.set(capabilityId, executor);
    return this;
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const executor = this.executors.get(request.capability);
    if (!executor) {
      return {
        kind: "fatal",
        error: {
          class: "Fatal",
          reason: `No executor bound for capability "${request.capability}" on provider "${this.id}"`,
          retryable: false,
        },
        costUnits: 0,
      };
    }
    return executor(request);
  }
}
