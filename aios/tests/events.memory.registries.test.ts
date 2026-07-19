import { describe, it, expect } from "vitest";
import { LogicalClock, IdGenerator } from "../src/kernel";
import { EventBus } from "../src/events";
import { InMemoryMemoryStore, MemoryLoader, MemoryPermissionError } from "../src/memory";
import { CapabilityRegistry, AgentRegistry, WorkflowRegistry } from "../src/registries";
import { capability, agent } from "./fixtures";
import type { EventEnvelope, WorkflowDefinition } from "../src/types";

describe("event bus (EventBus.md / InterAgentCommunication.md)", () => {
  it("delivers to matching subscribers and records published events", () => {
    const bus = new EventBus(new LogicalClock(), new IdGenerator());
    const seen: EventEnvelope[] = [];
    bus.subscribe("ToolRequested", (e) => seen.push(e));
    bus.subscribe("*", (e) => seen.push(e));
    bus.publish({
      type: "ToolRequested",
      source: "test",
      correlationId: "corr-1",
      payload: { tool: "x" },
    });
    expect(seen).toHaveLength(2); // typed + wildcard
    expect(bus.publishedEvents()).toHaveLength(1);
    expect(seen[0].messageId).toMatch(/^evt-\d{6}$/);
  });

  it("dead-letters a throwing handler instead of losing the event", () => {
    const bus = new EventBus(new LogicalClock(), new IdGenerator());
    bus.subscribe("Boom", () => {
      throw new Error("handler failed");
    });
    bus.publish({ type: "Boom", source: "test", correlationId: "corr-2" });
    expect(bus.deadLetterQueue()).toHaveLength(1);
    expect(bus.deadLetterQueue()[0].reason).toMatch(/handler failed/);
  });
});

describe("memory (MemoryArchitecture.md)", () => {
  it("versions writes (supersede, not overwrite) and returns the latest", () => {
    const store = new InMemoryMemoryStore();
    expect(store.write("project:esytol", "head", "aaa")).toBe(1);
    expect(store.write("project:esytol", "head", "bbb")).toBe(2);
    expect(store.read("project:esytol", "head")).toBe("bbb");
    expect(store.history("project:esytol", "head")).toHaveLength(2);
  });

  it("builds a deeply-frozen read-only snapshot", () => {
    const store = new InMemoryMemoryStore();
    store.write("project:esytol", "goal", { value: 1 });
    const loader = new MemoryLoader(store);
    const snap = loader.snapshot(["project:esytol"]) as Record<
      string,
      Record<string, { value: number }>
    >;
    expect(snap["project:esytol"].goal.value).toBe(1);
    expect(Object.isFrozen(snap)).toBe(true);
  });

  it("denies a write to an ungranted scope", () => {
    const loader = new MemoryLoader(new InMemoryMemoryStore());
    expect(() =>
      loader.applyWrites([{ scope: "architecture:core", key: "x", value: 1 }], ["project:esytol"])
    ).toThrow(MemoryPermissionError);
  });
});

describe("registries (CapabilityRegistry / AgentRegistry / WorkflowRegistry)", () => {
  it("resolves active providers of a capability and honours suspension (kill switch)", () => {
    const caps = new CapabilityRegistry();
    const agents = new AgentRegistry();
    caps.register(capability("build.tool"));
    agents.register(agent("engineering/tool-builder", ["build.tool"]));
    expect(agents.providersOf("build.tool")).toHaveLength(1);
    agents.setStatus("engineering/tool-builder", "suspended");
    expect(agents.providersOf("build.tool")).toHaveLength(0);
  });

  it("finds workflows by trigger event type", () => {
    const workflows = new WorkflowRegistry();
    const wf: WorkflowDefinition = { id: "w", version: "1", trigger: "ToolRequested", steps: [] };
    workflows.register(wf);
    expect(workflows.byTrigger("ToolRequested")).toHaveLength(1);
    expect(workflows.byTrigger("Nope")).toHaveLength(0);
  });
});
