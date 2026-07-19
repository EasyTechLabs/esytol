/**
 * Configuration (AIOS-004) — layered config with deterministic precedence (ConfigurationManagement.md).
 * Precedence: global ◀ environment ◀ provider ◀ agent ◀ workflow ◀ task (most specific wins).
 * Safety-relevant numeric limits (e.g. cost ceilings) only ratchet TIGHTER down the stack — a more
 * specific layer may lower a ceiling but never raise it above a broader layer's cap.
 */

export type ConfigScope = "global" | "environment" | "provider" | "agent" | "workflow" | "task";

const PRECEDENCE: ConfigScope[] = [
  "global",
  "environment",
  "provider",
  "agent",
  "workflow",
  "task",
];

export interface ConfigContext {
  environment?: string;
  provider?: string;
  agent?: string;
  workflow?: string;
  task?: string;
}

interface LayerValue {
  scope: ConfigScope;
  selector: string | null; // e.g. an agent id, or null for the whole scope
  value: number | string | boolean;
}

export class Config {
  private layers = new Map<string, LayerValue[]>();

  set(
    key: string,
    scope: ConfigScope,
    value: number | string | boolean,
    selector: string | null = null
  ): this {
    const list = this.layers.get(key) ?? [];
    list.push({ scope, selector, value });
    this.layers.set(key, list);
    return this;
  }

  private matching(key: string, ctx: ConfigContext): LayerValue[] {
    const list = this.layers.get(key) ?? [];
    return list.filter((l) => {
      if (l.selector === null) return true;
      switch (l.scope) {
        case "environment":
          return l.selector === ctx.environment;
        case "provider":
          return l.selector === ctx.provider;
        case "agent":
          return l.selector === ctx.agent;
        case "workflow":
          return l.selector === ctx.workflow;
        case "task":
          return l.selector === ctx.task;
        default:
          return true;
      }
    });
  }

  /** Most-specific value wins. Returns `fallback` if no layer defines the key. */
  resolve<T extends number | string | boolean>(key: string, ctx: ConfigContext, fallback: T): T {
    const matches = this.matching(key, ctx);
    let best: LayerValue | undefined;
    let bestRank = -1;
    for (const m of matches) {
      const rank = PRECEDENCE.indexOf(m.scope);
      if (rank >= bestRank) {
        bestRank = rank;
        best = m;
      }
    }
    return best ? (best.value as T) : fallback;
  }

  /** A ratcheting numeric limit: the MINIMUM across all defined layers (safety tightens, never loosens). */
  resolveLimit(key: string, ctx: ConfigContext, fallback: number): number {
    const matches = this.matching(key, ctx)
      .map((m) => m.value)
      .filter((v): v is number => typeof v === "number");
    if (matches.length === 0) return fallback;
    return Math.min(...matches);
  }
}
