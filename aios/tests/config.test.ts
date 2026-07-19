import { describe, it, expect } from "vitest";
import { Config } from "../src/config";

describe("configuration (ConfigurationManagement.md)", () => {
  it("resolves the most-specific layer (precedence global → … → agent)", () => {
    const config = new Config();
    config.set("logLevel", "global", "info");
    config.set("logLevel", "agent", "debug", "engineering/tool-builder");
    expect(config.resolve("logLevel", {}, "warn")).toBe("info");
    expect(config.resolve("logLevel", { agent: "engineering/tool-builder" }, "warn")).toBe("debug");
    expect(config.resolve("missing", {}, "fallback")).toBe("fallback");
  });

  it("ratchets a safety limit TIGHTER down the stack (min of all layers)", () => {
    const config = new Config();
    config.set("costCeiling", "global", 1000);
    config.set("costCeiling", "agent", 200, "engineering/tool-builder");
    // A more specific layer may lower the ceiling, never raise it.
    expect(config.resolveLimit("costCeiling", { agent: "engineering/tool-builder" }, 5000)).toBe(
      200
    );
    expect(config.resolveLimit("costCeiling", {}, 5000)).toBe(1000);
    expect(config.resolveLimit("unset", {}, 42)).toBe(42);
  });
});
