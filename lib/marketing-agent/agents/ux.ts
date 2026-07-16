/**
 * UX Agent — reads Microsoft Clarity.
 *
 * Clarity measures frustration, not traffic. Rage clicks and dead clicks are the
 * clearest machine-detectable signal that a UI is lying to the user about what is
 * interactive; quick-backs mean the page didn't match the intent that arrived.
 */

import type { Agent, AgentContext, Recommendation } from "../types";
import { buildRecommendation, businessValueForPage, trafficPotentialFromClicks } from "../scoring";

const RAGE_THRESHOLD = 3;
const DEAD_THRESHOLD = 10;
const LOW_SCROLL = 0.5;
const QUICKBACK_SHARE = 0.25;
const PER_RULE_LIMIT = 5;

export const uxAgent: Agent = {
  key: "ux",
  label: "UX Agent",
  status: "active",
  watches: "Clarity — rage clicks, dead clicks, scroll depth, quick-backs",
  run(ctx: AgentContext): Recommendation[] {
    const c = ctx.growth.clarity.data;
    const out: Recommendation[] = [];

    // 1 ─ Friction: rage + dead clicks per page.
    const friction = c.topPagesByActivity
      .filter((p) => p.rageClicks >= RAGE_THRESHOLD || p.deadClicks >= DEAD_THRESHOLD)
      .map((p) => ({ p, friction: p.rageClicks * 3 + p.deadClicks }))
      .sort((a, b) => b.friction - a.friction)
      .slice(0, PER_RULE_LIMIT);

    for (const { p, friction: f } of friction) {
      const affected = Math.round(p.sessions * 0.15);
      out.push(
        buildRecommendation({
          id: `ux-friction-${p.page}`,
          agent: "ux",
          title: `Fix click friction — ${p.page}`,
          reason: `${p.rageClicks} rage clicks and ${p.deadClicks} dead clicks across ${fmt(p.sessions)} sessions. Users are clicking things that don't respond, or repeat-clicking in frustration.`,
          expectedImpact: `Removing the dead/unclear targets recovers ≈ ${fmt(Math.max(1, affected))} frustrated sessions/month.`,
          impactClicks: Math.max(1, affected),
          effort: "S",
          confidence: 0.7,
          owner: "UX",
          page: p.page,
          evidence: [
            { label: "Rage clicks", value: String(p.rageClicks) },
            { label: "Dead clicks", value: String(p.deadClicks) },
            { label: "Sessions", value: fmt(p.sessions) },
            { label: "Friction index", value: String(f) },
          ],
          trafficPotential: trafficPotentialFromClicks(Math.max(1, affected)),
          businessValue: businessValueForPage(p.page, ctx.tools),
          deadlineDays: 10,
          now: ctx.now,
        })
      );
    }

    // 2 ─ Shallow scroll: content below the fold is never seen.
    const shallow = c.scrollByPage
      .filter((p) => p.scrollDepth < LOW_SCROLL)
      .sort((a, b) => a.scrollDepth - b.scrollDepth)
      .slice(0, PER_RULE_LIMIT);

    for (const p of shallow) {
      out.push(
        buildRecommendation({
          id: `ux-scroll-${p.page}`,
          agent: "ux",
          title: `Content below the fold is unseen — ${p.page}`,
          reason: `Average scroll depth is only ${pct(p.scrollDepth)}. Trust signals, related tools and CTAs further down are effectively invisible.`,
          expectedImpact:
            "Raising key content above the fold lifts engagement and internal-link click-through.",
          effort: "M",
          confidence: 0.55,
          owner: "UX",
          page: p.page,
          evidence: [{ label: "Avg scroll depth", value: pct(p.scrollDepth) }],
          trafficPotential: 0.4,
          businessValue: businessValueForPage(p.page, ctx.tools),
          deadlineDays: 21,
          now: ctx.now,
        })
      );
    }

    // 3 ─ Quick-backs: intent mismatch at site level.
    if (c.sessions > 0) {
      const share = c.quickBacks / c.sessions;
      if (share >= QUICKBACK_SHARE) {
        out.push(
          buildRecommendation({
            id: "ux-quickbacks",
            agent: "ux",
            title: `${pct(share)} of sessions bounce straight back`,
            reason: `${fmt(c.quickBacks)} quick-backs across ${fmt(c.sessions)} sessions. Users hit the page and immediately return to search — the promise in the SERP isn't matched above the fold.`,
            expectedImpact:
              "Aligning titles/meta with the page's first screen reduces wasted acquisition.",
            effort: "M",
            confidence: 0.65,
            owner: "UX",
            evidence: [
              { label: "Quick-backs", value: fmt(c.quickBacks) },
              { label: "Sessions", value: fmt(c.sessions) },
              { label: "Share", value: pct(share) },
            ],
            trafficPotential: 0.6,
            businessValue: 0.8,
            deadlineDays: 14,
            now: ctx.now,
          })
        );
      }
    }

    return out;
  },
};

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IN").format(Math.round(n));
}
function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
