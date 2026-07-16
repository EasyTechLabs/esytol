/**
 * Traffic Agent — reads GA4.
 *
 * Looks past raw pageviews at the things that actually threaten or compound
 * growth: bounce on valuable pages, channel concentration (single-point-of-failure
 * risk), retention, and device/geo mix.
 */

import type { Agent, AgentContext, Recommendation } from "../types";
import { buildRecommendation, businessValueForPage, trafficPotentialFromClicks } from "../scoring";

const HIGH_VIEWS = 400;
const HIGH_BOUNCE = 0.6;
const CHANNEL_CONCENTRATION = 0.55;
const LOW_RETURNING = 0.3;
const PER_RULE_LIMIT = 5;

export const trafficAgent: Agent = {
  key: "traffic",
  label: "Traffic Agent",
  status: "active",
  watches: "GA4 — pages, bounce, retention, sources, devices, countries",
  run(ctx: AgentContext): Recommendation[] {
    const ga = ctx.growth.analytics.data;
    const out: Recommendation[] = [];
    const totalSessions = ga.sources.reduce((s, x) => s + x.value, 0) || ga.totals.sessions;

    // 1 ─ High traffic + high bounce on valuable pages.
    const bouncing = ga.topPages
      .filter((p) => p.views >= HIGH_VIEWS && p.bounceRate >= HIGH_BOUNCE)
      .sort((a, b) => b.views * b.bounceRate - a.views * a.bounceRate)
      .slice(0, PER_RULE_LIMIT);

    for (const p of bouncing) {
      const recoverable = Math.round(p.views * (p.bounceRate - 0.45) * 0.5);
      out.push(
        buildRecommendation({
          id: `traffic-bounce-${p.page}`,
          agent: "traffic",
          title: `Fix bounce — ${p.page}`,
          reason: `${fmt(p.views)} views but ${pct(p.bounceRate)} bounce and only ${p.avgEngagementSec}s engagement. Visitors arrive and leave — intent match, above-the-fold clarity, or speed.`,
          expectedImpact: `Retaining even half the excess bounce ≈ ${fmt(Math.max(1, recoverable))} more engaged sessions/month.`,
          impactClicks: Math.max(1, recoverable),
          effort: "M",
          confidence: 0.6,
          owner: "UX",
          page: p.page,
          evidence: [
            { label: "Views", value: fmt(p.views) },
            { label: "Bounce", value: pct(p.bounceRate) },
            { label: "Engagement", value: `${p.avgEngagementSec}s` },
          ],
          trafficPotential: trafficPotentialFromClicks(Math.max(1, recoverable)),
          businessValue: businessValueForPage(p.page, ctx.tools),
          deadlineDays: 14,
          now: ctx.now,
        })
      );
    }

    // 2 ─ Channel concentration: the single-point-of-failure risk.
    const top = [...ga.sources].sort((a, b) => b.value - a.value)[0];
    if (top && totalSessions > 0) {
      const share = top.value / totalSessions;
      if (share >= CHANNEL_CONCENTRATION) {
        out.push(
          buildRecommendation({
            id: "traffic-channel-concentration",
            agent: "traffic",
            title: `Diversify traffic — ${pct(share)} depends on ${top.label}`,
            reason: `${top.label} drives ${pct(share)} of sessions. A single algorithm change (or AI Overviews) can remove most of the traffic overnight.`,
            expectedImpact: "Reduces existential channel risk; builds direct/AI-citation demand.",
            effort: "L",
            confidence: 0.9,
            owner: "Growth",
            evidence: [
              { label: top.label, value: `${fmt(top.value)} sessions (${pct(share)})` },
              { label: "Total sessions", value: fmt(totalSessions) },
            ],
            trafficPotential: 0.7,
            businessValue: 0.9,
            deadlineDays: 30,
            now: ctx.now,
          })
        );
      }
    }

    // 3 ─ Retention: returning-user share.
    if (ga.totals.users > 0) {
      const returning = ga.totals.returningUsers / ga.totals.users;
      if (returning < LOW_RETURNING) {
        out.push(
          buildRecommendation({
            id: "traffic-retention",
            agent: "traffic",
            title: `Low retention — only ${pct(returning)} of users return`,
            reason: `${fmt(ga.totals.returningUsers)} of ${fmt(ga.totals.users)} users are returning. The product is stateless: nothing is saved, so there is no reason to come back.`,
            expectedImpact:
              "Accounts + saved work convert one-shot visits into a returning base (the biggest product gap).",
            effort: "L",
            confidence: 0.85,
            owner: "Founder",
            evidence: [
              { label: "Returning", value: fmt(ga.totals.returningUsers) },
              { label: "Total users", value: fmt(ga.totals.users) },
              { label: "Returning share", value: pct(returning) },
            ],
            trafficPotential: 0.8,
            businessValue: 1,
            deadlineDays: 30,
            now: ctx.now,
          })
        );
      }
    }

    // 4 ─ Device mix: mobile-first reality check.
    const mobile = ga.devices.find((d) => d.label.toLowerCase() === "mobile");
    const deviceTotal = ga.devices.reduce((s, d) => s + d.value, 0);
    if (mobile && deviceTotal > 0 && mobile.value / deviceTotal >= 0.6) {
      out.push(
        buildRecommendation({
          id: "traffic-mobile-first",
          agent: "traffic",
          title: `Mobile is ${pct(mobile.value / deviceTotal)} of users — audit mobile-first`,
          reason: `Most sessions are mobile. Any above-the-fold, tap-target or input friction is felt by the majority of users first.`,
          expectedImpact: "Protects the majority experience; compounds every other conversion fix.",
          effort: "M",
          confidence: 0.6,
          owner: "UX",
          evidence: [
            { label: "Mobile", value: `${fmt(mobile.value)} (${pct(mobile.value / deviceTotal)})` },
            { label: "All devices", value: fmt(deviceTotal) },
          ],
          trafficPotential: 0.5,
          businessValue: 0.7,
          deadlineDays: 21,
          now: ctx.now,
        })
      );
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
