/**
 * SEO Roadmap — the SEO Intelligence Engine's output, rendered inside the existing
 * Marketing Agent dashboard.
 *
 * Deliberately **not** a new dashboard: GROWTH-013 adds depth, not another surface to
 * check. It reuses the Growth Dashboard widgets (`SectionCard`, `Panel`, `StatCard`)
 * and the Marketing Agent's `RecommendationCard`, so it inherits their look and any
 * future change to them.
 *
 * Presentation only — every number here is computed by the engine.
 */

import { SectionCard, Panel } from "@/features/growth/SectionCard";
import { StatCard } from "@/features/growth/StatCard";
import { RecommendationCard } from "@/features/marketing/RecommendationCard";
import type { ClusterHealth, SeoIntelligenceResult } from "@/lib/seo-intelligence/types";

const fmt = (n: number) => new Intl.NumberFormat("en-IN").format(Math.round(n));
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function SeoRoadmapSection({ seo }: { seo: SeoIntelligenceResult }) {
  const { roadmap, weekly, monthly } = seo;

  return (
    <SectionCard id="seo" icon="🔍" title="SEO Roadmap">
      <p className="mb-4 text-sm text-gray-500">
        The SEO brain — seven modules over the same data the agents read, ranked into one roadmap.
        The Marketing Agent&apos;s SEO and Content agents surface a slice of this engine; nothing
        here is computed twice.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Ranked tasks" value={String(roadmap.tasks.length)} />
        <StatCard label="Critical issues" value={String(roadmap.criticalIssues.length)} />
        <StatCard label="Quick wins" value={String(roadmap.quickWins.length)} hint="effort S" />
        <StatCard
          label="Long-term work"
          value={String(roadmap.longTermWork.length)}
          hint="effort L"
        />
        <StatCard
          label="Click upside"
          value={`+${fmt(roadmap.totalClickUpside)}/mo`}
          hint="if fully executed"
        />
      </div>

      {/* Top opportunities — the "do these first" list, diversified by module. */}
      <h3 className="mb-3 font-semibold text-gray-900">Top Opportunities</h3>
      {roadmap.topOpportunities.length === 0 ? (
        <Empty>No SEO opportunities in the current data.</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {roadmap.topOpportunities.map((rec, i) => (
            <RecommendationCard key={rec.id} rec={rec} rank={i + 1} />
          ))}
        </div>
      )}

      {/* Critical / Quick wins / Long-term — the three action columns. */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title={`Critical Issues (${roadmap.criticalIssues.length})`}>
          <TaskList items={roadmap.criticalIssues} marker="!" tone="text-red-600" />
        </Panel>
        <Panel title={`Quick Wins (${roadmap.quickWins.length})`}>
          <TaskList items={roadmap.quickWins} marker="⚡" tone="text-brand-600" />
        </Panel>
        <Panel title={`Long-term Work (${roadmap.longTermWork.length})`}>
          <TaskList items={roadmap.longTermWork} marker="→" tone="text-gray-400" />
        </Panel>
      </div>

      {/* Cluster health — coverage vs authority is the strategic read. */}
      <h3 className="mb-3 mt-8 font-semibold text-gray-900">Topical Cluster Health</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="pb-2 pr-3 font-medium">Cluster</th>
              <th className="pb-2 pr-3 font-medium">Tools</th>
              <th className="pb-2 pr-3 font-medium">Articles</th>
              <th className="pb-2 pr-3 font-medium">Coverage</th>
              <th className="pb-2 pr-3 font-medium">Authority</th>
              <th className="pb-2 font-medium">Missing topics</th>
            </tr>
          </thead>
          <tbody>
            {weekly.clusterHealth.map((c) => (
              <ClusterRow key={c.key} cluster={c} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Weekly SEO insights">
          <Bullets items={weekly.insights} marker="·" tone="text-gray-400" />
        </Panel>
        <Panel title="Monthly strategy">
          <Bullets items={monthly.strategicNotes} marker="◆" tone="text-brand-600" />
        </Panel>
        <Panel title="Biggest gaps">
          <Bullets items={monthly.biggestGaps} marker="⚠" tone="text-amber-600" />
        </Panel>
        <Panel title="Roadmap summary">
          <Bullets items={monthly.roadmapSummary} marker="→" tone="text-gray-400" />
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Modules reporting">
          <ul className="flex flex-wrap gap-2 text-xs">
            {roadmap.byModule.map((m) => (
              <li
                key={m.key}
                className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-gray-600"
              >
                {m.label} · <strong className="text-gray-900">{m.count}</strong>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </SectionCard>
  );
}

// ── local presentation helpers ──

function ClusterRow({ cluster: c }: { cluster: ClusterHealth }) {
  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-2 pr-3 font-medium text-gray-900">{c.label}</td>
      <td className="py-2 pr-3 tabular-nums text-gray-600">{c.tools}</td>
      <td className="py-2 pr-3 tabular-nums text-gray-600">{c.articles}</td>
      <td className="py-2 pr-3">
        <Bar value={c.coverage} />
      </td>
      <td className="py-2 pr-3">
        <Bar value={c.authority} />
      </td>
      <td className="py-2 text-xs text-gray-500">
        {c.missingTopics.length === 0 ? (
          <span className="text-green-600">Complete</span>
        ) : (
          c.missingTopics.join(", ")
        )}
      </td>
    </tr>
  );
}

/** A 0..1 bar. Colour encodes health so the table scans without reading numbers. */
function Bar({ value }: { value: number }) {
  const tone = value >= 0.7 ? "bg-green-500" : value >= 0.35 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-gray-500">{pct(value)}</span>
    </div>
  );
}

function TaskList({
  items,
  marker,
  tone,
}: {
  items: { id: string; title: string; impactClicks?: number }[];
  marker: string;
  tone: string;
}) {
  if (items.length === 0) return <p className="text-sm text-gray-400">Nothing here.</p>;
  return (
    <ul className="flex flex-col gap-1.5 text-sm text-gray-700">
      {items.slice(0, 8).map((t) => (
        <li key={t.id} className="flex gap-2">
          <span className={tone} aria-hidden="true">
            {marker}
          </span>
          <span>
            {t.title}
            {t.impactClicks ? (
              <span className="ml-1 text-xs text-gray-400">+{fmt(t.impactClicks)}/mo</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Bullets({ items, marker, tone }: { items: string[]; marker: string; tone: string }) {
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

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-xs text-gray-400">
      {children}
    </p>
  );
}
