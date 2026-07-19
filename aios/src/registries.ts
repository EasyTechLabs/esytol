/**
 * Registries (AIOS-004) — the systems of record the orchestrator resolves against
 * (CapabilityRegistry.md, AgentRegistry.md, WorkflowEngine.md). No entry ⇒ it cannot run.
 * In-memory reference implementations behind small interfaces (a DB/git backend slots in later).
 */

import type { AgentDescriptor, Capability, WorkflowDefinition } from "./types";

export class CapabilityRegistry {
  private byId = new Map<string, Capability>();

  register(capability: Capability): void {
    this.byId.set(capability.id, capability);
  }

  get(id: string): Capability | undefined {
    return this.byId.get(id);
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  all(): readonly Capability[] {
    return Array.from(this.byId.values());
  }
}

export class AgentRegistry {
  private byId = new Map<string, AgentDescriptor>();

  register(agent: AgentDescriptor): void {
    this.byId.set(agent.id, agent);
  }

  get(id: string): AgentDescriptor | undefined {
    return this.byId.get(id);
  }

  /** Suspend/clear an agent instantly (the kill switch at the registry level, AgentRegistry.md §7). */
  setStatus(id: string, status: AgentDescriptor["status"]): void {
    const agent = this.byId.get(id);
    if (agent) this.byId.set(id, { ...agent, status });
  }

  /** Active, non-suspended agents that advertise the capability (deterministic order = registration). */
  providersOf(capabilityId: string): AgentDescriptor[] {
    return Array.from(this.byId.values()).filter(
      (a) => a.status === "active" && a.providesCapabilities.includes(capabilityId)
    );
  }
}

export class WorkflowRegistry {
  private byId = new Map<string, WorkflowDefinition>();

  register(workflow: WorkflowDefinition): void {
    this.byId.set(workflow.id, workflow);
  }

  get(id: string): WorkflowDefinition | undefined {
    return this.byId.get(id);
  }

  /** Workflows started by a given event type — how new events become supported with zero orchestrator change. */
  byTrigger(eventType: string): WorkflowDefinition[] {
    return Array.from(this.byId.values()).filter((w) => w.trigger === eventType);
  }
}
