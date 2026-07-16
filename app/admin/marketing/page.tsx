import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/seo/metadata";
import { analyse, buildContext } from "@/lib/marketing-agent";
import { analyseSeo } from "@/lib/seo-intelligence";
import type { Metric } from "@/lib/marketing-agent/types";
import { StatCard } from "@/features/growth/StatCard";
import { SectionCard, Panel } from "@/features/growth/SectionCard";
import { Sparkline } from "@/features/growth/Sparkline";
import { RecommendationCard } from "@/features/marketing/RecommendationCard";
import { SeoRoadmapSection } from "@/features/marketing/SeoRoadmap";
import { AgentStatusBadge } from "@/features/marketing/PriorityBadge";
import { relativeTime } from "@/lib/growth/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "Marketing Agent",
  description: "Internal AI growth agent — daily founder briefing and ranked recommendations.",
  path: "/admin/marketing",
  noIndex: true,
});

const NAV = [
  { href: "#priorities", label: "Today" },
  { href: "#agents", label: "Agents" },
  { href: "#seo", label: "SEO Roadmap" },
  { href: "#weekly", label: "Weekly" },
  { href: "#roster", label: "Roster" },
];

export default async function MarketingAgentPage() {
  const now = new Date();
  // Both engines read the same context, so build it once — calling each engine's own
  // entry point would fetch every provider twice for one page render.
  const ctx = await buildContext(now);
  const report = analyse(ctx);
  const seo = analyseSeo(ctx);
  const { daily, weekly, agents, recommendations } = report;

  const totalUpside = recommendations.reduce((s, r) => s + (r.impactClicks ?? 0), 0);
  const criticals = recommendations.filter((r) => r.priority === "critical").length;

  return (
    <div className="container-page section-gap">
      {/* ── Header ── */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Marketing Agent</h1>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
            Internal · noindex
          </span>
          <Link
            href="/admin/growth"
            className="ml-auto text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Raw data → Growth Dashboard
          </Link>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Your first AI employee. It reads Search Console, Analytics, Clarity, GitHub and Vercel,
          then tells you what to do — ranked. Briefing for <strong>{daily.date}</strong>, generated{" "}
          {relativeTime(daily.generatedAt, now)}.
        </p>

        {/* The single most important sentence of the day */}
        <p className="mt-4 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-900">
          <span className="mr-2 font-semibold uppercase tracking-wide">Headline</span>
          {daily.headline}
        </p>

        {daily.allSample && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            All providers are on <strong>sample data</strong> — recommendations are structurally
            real but the numbers are synthetic. Connect credentials (see the Growth Dashboard
            Connections section) for live decisions.
          </p>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="sticky top-16 z-10 -mx-4 mb-8 border-b border-gray-200 bg-white/80 px-4 py-2 backdrop-blur">
        <ul className="flex flex-wrap gap-1 text-sm">
          {NAV.map((n) => (
            <li key={n.href}>
              <a
                href={n.href}
                className="rounded-md px-2.5 py-1 font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
              >
                {n.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex flex-col gap-14">
        {/* ── Yesterday ── */}
        <SectionCard id="yesterday" icon="📅" title="Yesterday">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {daily.yesterday.map((m) => (
              <MetricCard key={m.label} metric={m} />
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Wins">
              <ul className="flex flex-col gap-1.5 text-sm text-gray-700">
                {daily.wins.map((w) => (
                  <li key={w} className="flex gap-2">
                    <span className="text-green-600" aria-hidden="true">
                      ▲
                    </span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Needs attention">
              <ul className="flex flex-col gap-1.5 text-sm text-gray-700">
                {daily.problems.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="text-amber-600" aria-hidden="true">
                      !
                    </span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </SectionCard>

        {/* ── Today's priorities ── */}
        <SectionCard id="priorities" icon="🎯" title="Today's Top Priorities">
          <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Open recommendations" value={String(recommendations.length)} />
            <StatCard label="Critical" value={String(criticals)} />
            <StatCard
              label="Identified upside"
              value={`${new Intl.NumberFormat("en-IN").format(totalUpside)}/mo`}
              hint="clicks + sessions"
            />
            <StatCard
              label="Agents reporting"
              value={`${agents.filter((a) => a.recommendations.length > 0).length}/${agents.length}`}
            />
          </div>

          {daily.topPriorities.length === 0 ? (
            <p className="text-sm text-gray-400">
              No recommendations — everything is within thresholds.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {daily.topPriorities.map((rec, i) => (
                <RecommendationCard key={rec.id} rec={rec} rank={i + 1} />
              ))}
            </div>
          )}
        </SectionCard>

        {/* ── Per-agent sections ── */}
        <SectionCard id="agents" icon="🤖" title="By Agent">
          <div className="flex flex-col gap-8">
            {daily.sections.map((section) => {
              const agent = agents.find((a) => a.key === section.key);
              return (
                <div key={section.key}>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{section.label}</h3>
                    {agent && <AgentStatusBadge status={agent.status} />}
                    <span className="text-xs text-gray-400">{agent?.watches}</span>
                  </div>

                  {section.metrics.length > 0 && (
                    <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                      {section.metrics.map((m) => (
                        <MetricCard key={m.label} metric={m} />
                      ))}
                    </div>
                  )}

                  {section.recommendations.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      {section.recommendations.map((rec) => (
                        <RecommendationCard key={rec.id} rec={rec} />
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-xs text-gray-400">
                      {agent?.status === "planned"
                        ? "Planned agent — wired into the engine, no signal source connected yet."
                        : "Nothing to report — all signals within thresholds."}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* ── SEO Intelligence Engine (GROWTH-013) ── */}
        <SeoRoadmapSection seo={seo} />

        {/* ── Weekly executive report ── */}
        <SectionCard id="weekly" icon="📈" title={`Weekly Executive Report — ${weekly.period}`}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {weekly.kpis.map((m) => (
              <MetricCard key={m.label} metric={m} />
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {weekly.graphs.map((g) => (
              <Panel key={g.label} title={g.label}>
                <Sparkline values={g.series} width={220} height={48} className="text-brand-500" />
                <p className="mt-1 text-xs text-gray-400">
                  {g.series[0]} → {g.series[g.series.length - 1]}
                </p>
              </Panel>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Insights">
              <ListBlock items={weekly.insights} marker="·" tone="text-gray-400" />
            </Panel>
            <Panel title="Progress">
              <ListBlock items={weekly.progress} marker="✓" tone="text-green-600" />
            </Panel>
            <Panel title="Biggest risks">
              <ListBlock items={weekly.biggestRisks} marker="⚠" tone="text-amber-600" />
            </Panel>
            <Panel title="Biggest opportunities">
              <ListBlock items={weekly.biggestOpportunities} marker="↑" tone="text-brand-600" />
            </Panel>
          </div>
        </SectionCard>

        {/* ── Roster + future work ── */}
        <SectionCard id="roster" icon="🧩" title="Agent Roster">
          <p className="mb-4 text-sm text-gray-500">
            Every agent implements the same contract and shares the scoring + reporting engine. New
            agents plug in with one registry entry.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((a) => (
              <div key={a.key} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{a.label}</span>
                  <span className="ml-auto">
                    <AgentStatusBadge status={a.status} />
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-gray-500">{a.watches}</p>
                <p className="mt-2 text-xs font-medium text-gray-700">
                  {a.recommendations.length} recommendation
                  {a.recommendations.length === 1 ? "" : "s"}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <Panel title="Future work">
              <ListBlock items={daily.futureWork} marker="→" tone="text-gray-400" />
            </Panel>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ── local presentation helpers ──

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <StatCard
      label={metric.label}
      value={metric.value}
      delta={metric.deltaPct}
      deltaLowerIsBetter={metric.lowerIsBetter}
      trend={metric.trend}
    />
  );
}

function ListBlock({ items, marker, tone }: { items: string[]; marker: string; tone: string }) {
  if (items.length === 0) return <p className="text-sm text-gray-400">Nothing to report.</p>;
  return (
    <ul className="flex flex-col gap-1.5 text-sm text-gray-700">
      {items.map((t) => (
        <li key={t} className="flex gap-2">
          <span className={tone} aria-hidden="true">
            {marker}
          </span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}
