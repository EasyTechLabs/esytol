import { describe, it, expect } from "vitest";
import { newToolRuntime } from "./fixtures";

/**
 * Determinism / golden-task replay (TestingStrategy.md §2.12, MigrationStrategy.md §8).
 *
 * Two independent runs of the same workflow, each on a fresh deterministic clock + id generator, MUST
 * produce byte-identical audit trails and task histories. This is the property that makes the
 * orchestrator reproducible, replayable, and safe to migrate/resume.
 */

async function runNewTool() {
  const rt = newToolRuntime();
  const [result] = await rt.orchestrator.receiveEvent({
    type: "ToolRequested",
    source: "founder",
    correlationId: "corr-golden",
    payload: { tool: "xml-formatter" },
  });
  return {
    audit: rt.orchestrator.getAudit().map((a) => `${a.at}|${a.action}|${a.detail}`),
    events: rt.orchestrator
      .getPublishedEvents()
      .map((e) => `${e.timestamp}|${e.type}|${e.messageId}`),
    status: result.status,
    tasks: result.tasks.map((t) => ({
      id: t.taskId,
      status: t.status,
      history: t.executionHistory,
    })),
    memory: rt.memoryStore.read("project:esytol", "lastBuilt"),
  };
}

describe("golden-task replay — the orchestrator is deterministic", () => {
  it("produces an identical audit trail across two independent runs", async () => {
    const a = await runNewTool();
    const b = await runNewTool();
    expect(b.audit).toEqual(a.audit);
    expect(b.audit.length).toBeGreaterThan(0);
  });

  it("produces identical events, task histories, and committed memory across runs", async () => {
    const a = await runNewTool();
    const b = await runNewTool();
    expect(b.events).toEqual(a.events);
    expect(b.tasks).toEqual(a.tasks);
    expect(b.memory).toEqual(a.memory);
    expect(a.status).toBe("completed");
  });
});
