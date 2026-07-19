import { describe, it, expect } from "vitest";
import { createChiefOrchestrator } from "../src/index";
import { AutoApproveGateway, AutoRejectGateway } from "../src/approvals";
import { ReferenceProvider } from "../src/provider";
import { CapabilityResolver } from "../src/resolver";
import { ExecutionCoordinator } from "../src/coordinator";
import { MemoryLoader } from "../src/memory";
import { createTask } from "../src/taskContract";
import { capability, agent, completed, retryable } from "./fixtures";
import type { ExecutionResult, TaskInput } from "../src/types";

function base() {
  const rt = createChiefOrchestrator();
  rt.capabilities.register(capability("build.tool"));
  rt.agents.register(agent("engineering/tool-builder", ["build.tool"]));
  return rt;
}

const task: TaskInput = {
  capabilityRequested: "build.tool",
  objective: "build",
  requester: "founder",
  inputs: { tool: "t" },
};

describe("failure recovery (FailureRecovery.md)", () => {
  it("retries a transient failure then succeeds", async () => {
    const rt = base();
    let calls = 0;
    rt.referenceProvider.bind("build.tool", (): ExecutionResult => {
      calls += 1;
      return calls < 2 ? retryable("blip") : completed({ built: true });
    });
    const outcome = await rt.orchestrator.receiveTask(task);
    expect(outcome.status).toBe("Completed");
    expect(outcome.task.retryCount).toBe(1);
    // history shows the Retry → Queued → Executing loop.
    const states = outcome.task.executionHistory.map((h) => h.to);
    expect(states).toContain("Retry");
  });

  it("exhausts retries → Failed, dead-letters, and escalates", async () => {
    const rt = base();
    rt.referenceProvider.bind("build.tool", () => retryable("always fails"));
    const outcome = await rt.orchestrator.receiveTask(task);
    expect(outcome.status).toBe("Failed");
    expect(outcome.task.retryCount).toBe(3); // maxAttempts
    expect(rt.dlq.all()).toHaveLength(1);
    const types = rt.orchestrator.getPublishedEvents().map((e) => e.type);
    expect(types).toContain("Incident.Raised");
    expect(types).toContain("Task.Escalated");
  });

  it("fails over to the next provider when the first is fatal", async () => {
    const rt = createChiefOrchestrator();
    rt.capabilities.register(capability("build.tool"));
    rt.agents.register(agent("engineering/tool-builder", ["build.tool"]));
    // primary reference provider (from factory) has no executor bound → Fatal.
    const backup = new ReferenceProvider({
      id: "backup-local",
      engineCapabilities: ["deterministic"],
    }).bind("build.tool", () => completed({ built: true, by: "backup" }));
    rt.providers.register(backup);
    const outcome = await rt.orchestrator.receiveTask(task);
    expect(outcome.status).toBe("Completed");
    expect(outcome.task.assignedProvider).toBe("backup-local");
    expect(rt.orchestrator.getAudit().some((a) => a.action === "failover")).toBe(true);
  });

  it("pauses for approval and commits on approve", async () => {
    const rt = createChiefOrchestrator({ approvals: new AutoApproveGateway() });
    rt.capabilities.register(capability("system.deletion", { requiredApprovals: "founder" }));
    rt.agents.register(agent("standards/deleter", ["system.deletion"], { authorityTier: 3 }));
    rt.referenceProvider.bind("system.deletion", () => completed({ deleted: true }));
    const outcome = await rt.orchestrator.receiveTask({
      capabilityRequested: "system.deletion",
      objective: "delete",
      requester: "founder",
      inputs: {},
    });
    expect(outcome.status).toBe("Completed");
    const states = outcome.task.executionHistory.map((h) => h.to);
    expect(states).toContain("Review");
    expect(states).toContain("Approved");
  });

  it("rolls back (discards provisional side-effects) on approval rejection", async () => {
    const rt = createChiefOrchestrator({ approvals: new AutoRejectGateway() });
    rt.capabilities.register(capability("system.deletion", { requiredApprovals: "founder" }));
    rt.agents.register(
      agent("standards/deleter", ["system.deletion"], {
        authorityTier: 3,
        permissions: {
          memoryRead: [],
          memoryWrite: ["project:esytol"],
          sideEffects: [],
          costCeiling: 1000,
        },
      })
    );
    rt.referenceProvider.bind("system.deletion", () =>
      completed(
        { deleted: true },
        { sideEffects: { memory: [{ scope: "project:esytol", key: "gone", value: true }] } }
      )
    );
    const outcome = await rt.orchestrator.receiveTask({
      capabilityRequested: "system.deletion",
      objective: "delete",
      requester: "founder",
      inputs: {},
    });
    expect(outcome.status).toBe("Cancelled");
    // The provisional memory write was NEVER committed (rollback).
    expect(rt.memoryStore.read("project:esytol", "gone")).toBeUndefined();
    expect(rt.orchestrator.getAudit().some((a) => a.action === "rollback")).toBe(true);
  });

  it("pauses for asynchronous approval, then resumes on a human decision", async () => {
    const rt = createChiefOrchestrator(); // default gateway pauses
    rt.capabilities.register(capability("marketing.campaign", { requiredApprovals: "chief" }));
    rt.agents.register(agent("marketing/campaign", ["marketing.campaign"], { authorityTier: 2 }));
    rt.referenceProvider.bind("marketing.campaign", () => completed({ campaign: "ready" }));
    const outcome = await rt.orchestrator.receiveTask({
      capabilityRequested: "marketing.campaign",
      objective: "campaign",
      requester: "founder",
      inputs: {},
    });
    expect(outcome.status).toBe("Review");
    expect(rt.orchestrator.pendingApprovals()).toContain(outcome.task.taskId);

    const resumed = await rt.orchestrator.provideApproval(outcome.task.taskId, {
      decision: "approved",
      approver: "founder",
    });
    expect("status" in resumed && resumed.status).toBe("Completed");
    expect(rt.orchestrator.pendingApprovals()).toHaveLength(0);
  });

  it("checkpoint pause + resume drives the Checkpoint state (recovery)", () => {
    const rt = base();
    const t = createTask(task, { ids: rt.ids, clock: rt.clock });
    const resolution = new CapabilityResolver(rt.capabilities, rt.agents, rt.providers).resolve(
      "build.tool"
    );
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;

    const coord = new ExecutionCoordinator({
      audit: rt.audit,
      events: rt.events,
      memory: new MemoryLoader(rt.memoryStore),
      approvals: new AutoApproveGateway(),
      config: rt.config,
      dlq: rt.dlq,
      clock: rt.clock,
      ids: rt.ids,
    });

    // Reach Executing legally (Created → Queued → Executing), then pause at a checkpoint and resume.
    t.executionHistory.push({ at: rt.clock.now(), from: "Created", to: "Queued", note: "seed" });
    t.status = "Queued";
    t.executionHistory.push({ at: rt.clock.now(), from: "Queued", to: "Executing", note: "seed" });
    t.status = "Executing";

    coord.pauseAtCheckpoint(t, resolution);
    expect(t.status).toBe("Checkpoint");
    expect(t.checkpoints.length).toBeGreaterThan(0);

    coord.resumeFromCheckpoint(t, resolution);
    expect(t.status).toBe("Executing");
  });
});
