import { describe, it, expect } from "vitest";
import { validateTaskInput, createTask } from "../src/taskContract";
import { LogicalClock, IdGenerator, TASK_CONTRACT_VERSION } from "../src/kernel";
import type { TaskInput } from "../src/types";

const good: TaskInput = {
  capabilityRequested: "build.tool",
  objective: "Build the XML formatter",
  requester: "founder",
  inputs: { tool: "xml-formatter" },
};

describe("task contract (TaskContract.md)", () => {
  it("accepts a well-formed request", () => {
    expect(validateTaskInput(good).ok).toBe(true);
  });

  it("rejects missing required fields", () => {
    expect(validateTaskInput({ ...good, capabilityRequested: "" }).ok).toBe(false);
    expect(validateTaskInput({ ...good, objective: "" }).ok).toBe(false);
    expect(validateTaskInput({ ...good, requester: "" }).ok).toBe(false);
  });

  it("rejects a bad priority or trust level", () => {
    expect(validateTaskInput({ ...good, priority: "P9" as never }).ok).toBe(false);
    expect(validateTaskInput({ ...good, trustLevel: "sketchy" as never }).ok).toBe(false);
  });

  it("builds a full Task with immutable identity + Created status", () => {
    const task = createTask(good, { ids: new IdGenerator(), clock: new LogicalClock() });
    expect(task.taskId).toMatch(/^task-\d{6}$/);
    expect(task.status).toBe("Created");
    expect(task.version).toBe(TASK_CONTRACT_VERSION);
    expect(task.priority).toBe("P2"); // default
    expect(task.trustLevel).toBe("trusted"); // default
    expect(task.executionHistory).toEqual([]);
    expect(task.retryCount).toBe(0);
  });

  it("is deterministic given the same clock + id generator", () => {
    const a = createTask(good, { ids: new IdGenerator(), clock: new LogicalClock() });
    const b = createTask(good, { ids: new IdGenerator(), clock: new LogicalClock() });
    expect(a).toEqual(b);
  });
});
