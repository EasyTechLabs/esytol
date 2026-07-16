/**
 * Agent registry — the single place agents are registered.
 *
 * Adding an agent is one import + one array entry. The engine, scoring, reports
 * and dashboard all iterate this list, so nothing else changes. Planned agents are
 * registered too: they appear in the roster with their status, and simply return
 * no recommendations until their signal source exists.
 */

import type { Agent } from "../types";
import { seoAgent } from "./seo";
import { trafficAgent } from "./traffic";
import { uxAgent } from "./ux";
import { engineeringAgent } from "./engineering";
import { contentAgent } from "./content";
import { competitorAgent } from "./competitor";
import { revenueAgent } from "./revenue";

/** Execution order = report section order. */
export const agents: Agent[] = [
  seoAgent,
  trafficAgent,
  uxAgent,
  engineeringAgent,
  contentAgent,
  competitorAgent,
  revenueAgent,
];

export {
  seoAgent,
  trafficAgent,
  uxAgent,
  engineeringAgent,
  contentAgent,
  competitorAgent,
  revenueAgent,
};
export { COMPETITORS } from "./competitor";
export { revenueSources } from "./revenue";
