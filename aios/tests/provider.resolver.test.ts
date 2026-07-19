import { describe, it, expect } from "vitest";
import { ProviderRegistry, ReferenceProvider } from "../src/provider";
import { CapabilityRegistry, AgentRegistry } from "../src/registries";
import { CapabilityResolver } from "../src/resolver";
import { capability, agent, completed } from "./fixtures";
import type { ExecutionRequest } from "../src/types";

const req: ExecutionRequest = {
  taskId: "task-1",
  capability: "build.tool",
  agentId: "engineering/tool-builder",
  promptRef: "engineering/tool-builder.build.tool",
  inputs: {},
  context: {},
  memory: {},
  limits: { costCeiling: 100 },
  attempt: 1,
  trustLevel: "trusted",
};

describe("provider abstraction (ProviderIntegration.md) — no Claude dependency", () => {
  it("selects providers by required engine capabilities (failover chain)", () => {
    const registry = new ProviderRegistry();
    registry.register(
      new ReferenceProvider({ id: "local-a", engineCapabilities: ["deterministic"] })
    );
    registry.register(
      new ReferenceProvider({ id: "local-b", engineCapabilities: ["deterministic", "vision"] })
    );
    expect(registry.select(["deterministic"]).map((p) => p.id)).toEqual(["local-a", "local-b"]);
    expect(registry.select(["vision"]).map((p) => p.id)).toEqual(["local-b"]);
    expect(registry.select(["nonexistent"])).toHaveLength(0);
  });

  it("reference provider runs a bound executor deterministically", async () => {
    const p = new ReferenceProvider().bind("build.tool", () => completed({ built: true }));
    const result = await p.execute(req);
    expect(result.kind).toBe("completed");
  });

  it("reference provider returns Fatal (never a silent success) when no executor is bound", async () => {
    const p = new ReferenceProvider();
    const result = await p.execute(req);
    expect(result.kind).toBe("fatal");
  });
});

describe("capability resolver (CapabilityRegistry.md §4)", () => {
  function setup() {
    const caps = new CapabilityRegistry();
    const agents = new AgentRegistry();
    const providers = new ProviderRegistry();
    providers.register(new ReferenceProvider());
    return { caps, agents, providers, resolver: new CapabilityResolver(caps, agents, providers) };
  }

  it("resolves capability → agent → provider chain", () => {
    const { caps, agents, resolver } = setup();
    caps.register(capability("build.tool"));
    agents.register(agent("engineering/tool-builder", ["build.tool"]));
    const r = resolver.resolve("build.tool");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.agent.id).toBe("engineering/tool-builder");
      expect(r.providers).toHaveLength(1);
    }
  });

  it("reports unknown-capability", () => {
    const { resolver } = setup();
    const r = resolver.resolve("does.not.exist");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("unknown-capability");
  });

  it("reports no-agent and surfaces the fallback capability", () => {
    const { caps, resolver } = setup();
    caps.register(capability("build.tool", { fallbackCapability: "build.tool.simple" }));
    const r = resolver.resolve("build.tool");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("no-agent");
      expect(r.fallbackCapability).toBe("build.tool.simple");
    }
  });
});
