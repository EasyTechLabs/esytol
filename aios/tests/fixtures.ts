/**
 * Shared test fixtures for the Chief Orchestrator (AIOS-004).
 *
 * Builds a deterministic runtime with a small set of capabilities, agents, executors, and workflows
 * modelling the New Tool pipeline (build → qa → release). No LLM, no network — the reference provider
 * runs deterministic executors, so every test is reproducible.
 */

import { createChiefOrchestrator, type AiosRuntime } from "../src/index";
import type {
  AgentDescriptor,
  Capability,
  ExecutionResult,
  WorkflowDefinition,
  ApprovalGateway,
} from "../src/types";

export function capability(id: string, overrides: Partial<Capability> = {}): Capability {
  return {
    id,
    version: "1.0.0",
    authorityLevel: 1,
    requiredApprovals: "autonomous",
    requiredEngineCapabilities: ["deterministic"],
    priority: "P2",
    retryPolicy: {
      maxAttempts: 3,
      backoffBaseTicks: 1,
      retryableClasses: ["Transient", "Invalid-Output"],
    },
    ...overrides,
  };
}

export function agent(
  id: string,
  provides: string[],
  overrides: Partial<AgentDescriptor> = {}
): AgentDescriptor {
  return {
    id,
    version: "1.0.0",
    role: id,
    department: "engineering",
    authorityTier: 1,
    providesCapabilities: provides,
    requiresEngineCapabilities: ["deterministic"],
    status: "active",
    permissions: {
      memoryRead: ["project:esytol"],
      memoryWrite: ["project:esytol"],
      sideEffects: [],
      costCeiling: 1000,
    },
    ...overrides,
  };
}

export const completed = (
  output: Record<string, unknown>,
  extra: Partial<Extract<ExecutionResult, { kind: "completed" }>> = {}
): ExecutionResult => ({
  kind: "completed",
  output,
  costUnits: 1,
  ...extra,
});

export const retryable = (reason = "transient blip"): ExecutionResult => ({
  kind: "retryable",
  error: { class: "Transient", reason, retryable: true },
  costUnits: 1,
});

export const fatal = (reason = "engine down"): ExecutionResult => ({
  kind: "fatal",
  error: { class: "Fatal", reason, retryable: false },
  costUnits: 0,
});

/** A fully-wired runtime with the New Tool workflow (build.tool → qa.verify[gate] → release.product). */
export function newToolRuntime(opts: { approvals?: ApprovalGateway } = {}): AiosRuntime {
  const rt = createChiefOrchestrator(opts.approvals ? { approvals: opts.approvals } : {});

  rt.capabilities.register(capability("build.tool"));
  rt.capabilities.register(capability("qa.verify"));
  rt.capabilities.register(capability("release.product"));

  rt.agents.register(agent("engineering/tool-builder", ["build.tool"]));
  rt.agents.register(agent("engineering/qa-test", ["qa.verify"]));
  rt.agents.register(agent("release/release-manager", ["release.product"]));

  rt.referenceProvider
    .bind("build.tool", (req) =>
      completed(
        { built: true, tool: req.inputs.tool ?? "unknown" },
        {
          sideEffects: {
            knowledge: [
              { scope: "project:esytol", key: "lastBuilt", value: req.inputs.tool ?? "unknown" },
            ],
          },
        }
      )
    )
    .bind("qa.verify", () => completed({ verdict: "PASS", tests: "green" }))
    .bind("release.product", () =>
      completed(
        { released: true, verified: true },
        {
          sideEffects: { analytics: [{ signal: "release", value: 1 }] },
        }
      )
    );

  const workflow: WorkflowDefinition = {
    id: "new-tool",
    version: "1.0.0",
    trigger: "ToolRequested",
    steps: [
      { id: "build", capability: "build.tool", inputsFrom: "trigger" },
      {
        id: "qa",
        capability: "qa.verify",
        dependsOn: ["build"],
        gate: { outputKey: "verdict", equals: "PASS" },
        onGateFail: { retryStep: "build" },
      },
      { id: "release", capability: "release.product", dependsOn: ["qa"] },
    ],
  };
  rt.workflows.register(workflow);

  return rt;
}
