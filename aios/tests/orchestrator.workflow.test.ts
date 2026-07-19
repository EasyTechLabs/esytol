import { describe, it, expect } from "vitest";
import { newToolRuntime, completed, capability, agent } from "./fixtures";
import type { WorkflowDefinition } from "../src/types";

describe("Chief Orchestrator — event-driven workflow (WorkflowEngine.md §3)", () => {
  it("runs the New Tool workflow end-to-end on ToolRequested", async () => {
    const rt = newToolRuntime();
    const [result] = await rt.orchestrator.receiveEvent({
      type: "ToolRequested",
      source: "founder",
      correlationId: "corr-tool-1",
      payload: { tool: "xml-formatter" },
    });

    expect(result.status).toBe("completed");
    expect(result.tasks).toHaveLength(3);
    expect(result.tasks.every((t) => t.status === "Completed")).toBe(true);
    expect(result.tasks.map((t) => t.capabilityRequested)).toEqual([
      "build.tool",
      "qa.verify",
      "release.product",
    ]);

    // Side-effect committed to memory by the build step.
    expect(rt.memoryStore.read("project:esytol", "lastBuilt")).toBe("xml-formatter");

    // The orchestrator generated lifecycle events and a Workflow.Completed event.
    const types = rt.orchestrator.getPublishedEvents().map((e) => e.type);
    expect(types).toContain("Task.Completed");
    expect(types).toContain("Workflow.Completed");
    expect(types).toContain("Analytics.Signal"); // from the release step
  });

  it("loops back through a gate failure then completes (qa fails once, then passes)", async () => {
    const rt = newToolRuntime();
    let qaCalls = 0;
    rt.referenceProvider.bind("qa.verify", () => {
      qaCalls += 1;
      return completed({ verdict: qaCalls === 1 ? "FAIL" : "PASS" });
    });

    const [result] = await rt.orchestrator.receiveEvent({
      type: "ToolRequested",
      source: "founder",
      correlationId: "corr-tool-2",
      payload: { tool: "csv-json" },
    });

    expect(result.status).toBe("completed");
    // build ran twice (gate onGateFail retried it), qa ran twice.
    expect(result.tasks.filter((t) => t.capabilityRequested === "build.tool")).toHaveLength(2);
    expect(qaCalls).toBe(2);
  });

  it("supports a brand-new event type by registering a workflow — no orchestrator change", async () => {
    const rt = newToolRuntime();
    rt.capabilities.register(
      capability("analytics.search-console", { requiredApprovals: "autonomous" })
    );
    rt.agents.register(agent("analytics/gsc", ["analytics.search-console"]));
    rt.referenceProvider.bind("analytics.search-console", () => completed({ impressions: 42 }));
    const wf: WorkflowDefinition = {
      id: "weekly-gsc",
      version: "1.0.0",
      trigger: "WeeklyMaintenance",
      steps: [{ id: "gsc", capability: "analytics.search-console", inputsFrom: "trigger" }],
    };
    rt.workflows.register(wf);

    const results = await rt.orchestrator.receiveEvent({
      type: "WeeklyMaintenance",
      source: "scheduler",
      correlationId: "corr-week-1",
      payload: {},
    });
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("completed");
  });
});

describe("Chief Orchestrator — standalone tasks (TaskContract.md)", () => {
  it("receives, validates, resolves, and completes a single task", async () => {
    const rt = newToolRuntime();
    const outcome = await rt.orchestrator.receiveTask({
      capabilityRequested: "build.tool",
      objective: "build directly",
      requester: "founder",
      inputs: { tool: "hex-converter" },
    });
    expect(outcome.status).toBe("Completed");
    expect(outcome.task.assignedAgent).toBe("engineering/tool-builder");
    expect(outcome.task.assignedProvider).toBe("reference-local");
  });

  it("rejects an invalid task contract", async () => {
    const rt = newToolRuntime();
    await expect(
      rt.orchestrator.receiveTask({
        capabilityRequested: "",
        objective: "",
        requester: "",
        inputs: {},
      })
    ).rejects.toThrow(/Invalid task contract/);
  });

  it("cancels + escalates a task whose capability cannot be resolved", async () => {
    const rt = newToolRuntime();
    const outcome = await rt.orchestrator.receiveTask({
      capabilityRequested: "unknown.capability",
      objective: "nope",
      requester: "founder",
      inputs: {},
    });
    expect(outcome.status).toBe("Cancelled");
    expect(rt.orchestrator.getDeadLetterQueue()).toHaveLength(1);
    expect(rt.orchestrator.getPublishedEvents().map((e) => e.type)).toContain("Task.Escalated");
  });
});
