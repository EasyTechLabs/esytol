/**
 * Capability resolver (AIOS-004) — turns a requested capability into a concrete {capability, agent,
 * provider chain} the coordinator can execute (CapabilityRegistry.md §4). The orchestrator routes by
 * CAPABILITY, never by agent name; the resolver is the only place that binds a capability to a provider.
 */

import type { AgentDescriptor, Capability, Provider } from "./types";
import type { CapabilityRegistry, AgentRegistry } from "./registries";
import type { ProviderRegistry } from "./provider";

export type Resolution =
  | {
      ok: true;
      capability: Capability;
      agent: AgentDescriptor;
      /** Failover-ordered providers, all satisfying the required engine capabilities. */
      providers: Provider[];
    }
  | {
      ok: false;
      reason: "unknown-capability" | "no-agent" | "no-provider";
      capabilityId: string;
      fallbackCapability?: string;
    };

export class CapabilityResolver {
  constructor(
    private readonly capabilities: CapabilityRegistry,
    private readonly agents: AgentRegistry,
    private readonly providers: ProviderRegistry
  ) {}

  resolve(capabilityId: string): Resolution {
    const capability = this.capabilities.get(capabilityId);
    if (!capability) return { ok: false, reason: "unknown-capability", capabilityId };

    const candidates = this.agents.providersOf(capabilityId);
    if (candidates.length === 0)
      return {
        ok: false,
        reason: "no-agent",
        capabilityId,
        ...(capability.fallbackCapability
          ? { fallbackCapability: capability.fallbackCapability }
          : {}),
      };

    // Deterministic selection: first active provider (registration order). A richer policy (cost,
    // latency, success-rate) is a config-driven refinement that does not change this contract.
    const agent = candidates[0];

    const requiredEngineCaps = Array.from(
      new Set([...capability.requiredEngineCapabilities, ...agent.requiresEngineCapabilities])
    );
    const providers = this.providers.select(requiredEngineCaps);
    if (providers.length === 0)
      return {
        ok: false,
        reason: "no-provider",
        capabilityId,
        ...(capability.fallbackCapability
          ? { fallbackCapability: capability.fallbackCapability }
          : {}),
      };

    return { ok: true, capability, agent, providers };
  }
}
