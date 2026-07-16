/**
 * Engineering Agent — reads GitHub + Vercel.
 *
 * Turns delivery signals into engineering tasks: broken builds, Core Web Vitals
 * regressions, and shipping cadence. Performance is treated as an SEO/UX input,
 * not a vanity stat — CWV feed rankings and bounce.
 */

import type { Agent, AgentContext, Recommendation } from "../types";
import { buildRecommendation } from "../scoring";

const STALE_DEPLOY_DAYS = 7;

export const engineeringAgent: Agent = {
  key: "engineering",
  label: "Engineering Agent",
  status: "active",
  watches: "GitHub + Vercel — deployments, build failures, Core Web Vitals",
  run(ctx: AgentContext): Recommendation[] {
    const gh = ctx.growth.github.data;
    const v = ctx.growth.vercel.data;
    const out: Recommendation[] = [];

    // 1 ─ Production deployment not healthy.
    const latestState = v.latest.state.toUpperCase();
    if (latestState !== "READY") {
      out.push(
        buildRecommendation({
          id: "eng-latest-deploy",
          agent: "engineering",
          title: `Production deployment is ${v.latest.state}`,
          reason: `The latest ${v.latest.target} deployment reports "${v.latest.state}". Until it is READY, production may not reflect the current main branch.`,
          expectedImpact: "Restores a known-good production state.",
          effort: "S",
          confidence: 0.95,
          owner: "Engineering",
          evidence: [
            { label: "State", value: v.latest.state },
            { label: "Target", value: v.latest.target },
            { label: "Created", value: v.latest.createdAt.slice(0, 10) },
          ],
          trafficPotential: 0.9,
          businessValue: 1,
          deadlineDays: 1,
          now: ctx.now,
        })
      );
    }

    // 2 ─ Failed builds in recent history.
    const failed = v.builds.filter((b) => {
      const s = b.state.toUpperCase();
      return s.includes("ERROR") || s.includes("FAIL") || s.includes("CANCELED");
    });
    if (failed.length > 0) {
      out.push(
        buildRecommendation({
          id: "eng-build-failures",
          agent: "engineering",
          title: `${failed.length} failed build${failed.length > 1 ? "s" : ""} in recent history`,
          reason: `Recent builds report: ${failed.map((b) => `${b.target}/${b.state}`).join(", ")}. Failed builds mask regressions and slow every later sprint.`,
          expectedImpact: "A green pipeline restores confidence in continuous release.",
          effort: "M",
          confidence: 0.85,
          owner: "Engineering",
          evidence: failed
            .slice(0, 4)
            .map((b) => ({ label: b.target, value: `${b.state} · ${b.commit || b.id}` })),
          trafficPotential: 0.6,
          businessValue: 0.9,
          deadlineDays: 3,
          now: ctx.now,
        })
      );
    }

    // 3 ─ Core Web Vitals regressions.
    const poor = v.performance.filter((m) => m.rating !== "good");
    for (const m of poor) {
      out.push(
        buildRecommendation({
          id: `eng-cwv-${m.metric}`,
          agent: "engineering",
          title: `${m.metric} is "${m.rating.replace("-", " ")}" (${m.value}${m.unit})`,
          reason: `${m.metric} at ${m.value}${m.unit} is outside the "good" band. Core Web Vitals feed both rankings and bounce, so this is an SEO cost as well as a UX one.`,
          expectedImpact: "Returning to the good band protects rankings and reduces bounce.",
          effort: "M",
          confidence: 0.75,
          owner: "Engineering",
          evidence: [
            { label: m.metric, value: `${m.value}${m.unit}` },
            { label: "Rating", value: m.rating },
          ],
          trafficPotential: 0.6,
          businessValue: 0.8,
          deadlineDays: 14,
          now: ctx.now,
        })
      );
    }

    // 4 ─ Shipping cadence.
    const lastProd = v.builds.find((b) => b.target === "production") ?? v.builds[0];
    if (lastProd) {
      const days = Math.floor(
        (ctx.now.getTime() - new Date(lastProd.createdAt).getTime()) / 86_400_000
      );
      if (days >= STALE_DEPLOY_DAYS) {
        out.push(
          buildRecommendation({
            id: "eng-cadence",
            agent: "engineering",
            title: `No production deploy in ${days} days`,
            reason: `The last production build was ${days} days ago. Shipping cadence is the clearest proxy for momentum; long gaps usually mean batching risk.`,
            expectedImpact: "Restoring a regular cadence reduces per-release risk.",
            effort: "S",
            confidence: 0.5,
            owner: "Engineering",
            evidence: [
              { label: "Last production build", value: lastProd.createdAt.slice(0, 10) },
              { label: "Days since", value: String(days) },
              { label: "Repo", value: gh.repo },
            ],
            trafficPotential: 0.3,
            businessValue: 0.6,
            deadlineDays: 7,
            now: ctx.now,
          })
        );
      }
    }

    return out;
  },
};
