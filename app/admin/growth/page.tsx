import type { Metadata } from "next";
import { buildMetadata } from "@/seo/metadata";
import { getGrowthData, providerRegistry } from "@/lib/growth";
import {
  formatFull,
  formatNumber,
  formatPercent,
  formatPosition,
  relativeTime,
} from "@/lib/growth/format";
import { StatCard } from "@/features/growth/StatCard";
import { BarList } from "@/features/growth/BarList";
import { DataTable, type Column } from "@/features/growth/DataTable";
import { SectionCard, Panel } from "@/features/growth/SectionCard";
import { InsightCard } from "@/features/growth/InsightCard";
import { StatusBadge } from "@/features/growth/StatusBadge";
import { cn } from "@/lib/cn";
import type {
  QueryRow,
  PageRow,
  GaPageRow,
  CommitRow,
  DeploymentRow,
  VercelBuildRow,
} from "@/lib/growth/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "Growth Dashboard",
  description: "Internal growth analytics — Search Console, Analytics, Clarity, GitHub, Vercel.",
  path: "/admin/growth",
  noIndex: true,
});

function trendDelta(arr: number[]): number | undefined {
  if (arr.length < 2) return undefined;
  const first = arr[0] || 1;
  const last = arr[arr.length - 1];
  return ((last - first) / first) * 100;
}

const NAV = [
  { href: "#insights", label: "Insights" },
  { href: "#search-console", label: "Search Console" },
  { href: "#analytics", label: "Analytics" },
  { href: "#clarity", label: "Clarity" },
  { href: "#github", label: "GitHub" },
  { href: "#vercel", label: "Vercel" },
  { href: "#connections", label: "Connections" },
];

export default async function GrowthDashboardPage() {
  const now = new Date();
  const data = await getGrowthData(now);
  const { searchConsole: gsc, analytics: ga, clarity, github, vercel } = data;

  // ── Search Console tables ──
  const queryCols: Column<QueryRow>[] = [
    {
      key: "q",
      label: "Query",
      align: "left",
      render: (r) => <span className="truncate">{r.query}</span>,
    },
    { key: "c", label: "Clicks", align: "right", render: (r) => formatFull(r.clicks) },
    { key: "i", label: "Impr.", align: "right", render: (r) => formatFull(r.impressions) },
    { key: "ctr", label: "CTR", align: "right", render: (r) => formatPercent(r.ctr) },
    { key: "p", label: "Pos", align: "right", render: (r) => formatPosition(r.position) },
  ];
  const pageCols: Column<PageRow>[] = [
    {
      key: "pg",
      label: "Page",
      align: "left",
      render: (r) => <span className="truncate">{r.page}</span>,
    },
    { key: "c", label: "Clicks", align: "right", render: (r) => formatFull(r.clicks) },
    { key: "i", label: "Impr.", align: "right", render: (r) => formatFull(r.impressions) },
    { key: "ctr", label: "CTR", align: "right", render: (r) => formatPercent(r.ctr) },
    {
      key: "p",
      label: "Pos",
      align: "right",
      render: (r) => (
        <span
          className={cn(
            r.positionDelta < 0 && "text-green-600",
            r.positionDelta > 0 && "text-red-600"
          )}
        >
          {formatPosition(r.position)}
        </span>
      ),
    },
  ];
  const gaPageCols: Column<GaPageRow>[] = [
    {
      key: "pg",
      label: "Page",
      align: "left",
      render: (r) => <span className="truncate">{r.page}</span>,
    },
    { key: "v", label: "Views", align: "right", render: (r) => formatFull(r.views) },
    { key: "u", label: "Users", align: "right", render: (r) => formatFull(r.users) },
    { key: "e", label: "Engage", align: "right", render: (r) => `${r.avgEngagementSec}s` },
    { key: "b", label: "Bounce", align: "right", render: (r) => formatPercent(r.bounceRate) },
  ];
  const commitCols: Column<CommitRow>[] = [
    {
      key: "sha",
      label: "SHA",
      align: "left",
      render: (r) => <code className="text-xs text-brand-700">{r.sha}</code>,
    },
    {
      key: "msg",
      label: "Message",
      align: "left",
      render: (r) => <span className="truncate">{r.message}</span>,
    },
    { key: "a", label: "Author", align: "left", render: (r) => r.author },
    { key: "d", label: "When", align: "right", render: (r) => relativeTime(r.date, now) },
  ];
  const deployCols: Column<DeploymentRow>[] = [
    { key: "env", label: "Environment", align: "left", render: (r) => r.environment },
    {
      key: "ref",
      label: "Ref",
      align: "left",
      render: (r) => <code className="text-xs">{r.ref}</code>,
    },
    { key: "state", label: "State", align: "left", render: (r) => <StatePill state={r.state} /> },
    { key: "d", label: "When", align: "right", render: (r) => relativeTime(r.date, now) },
  ];
  const buildCols: Column<VercelBuildRow>[] = [
    { key: "t", label: "Target", align: "left", render: (r) => r.target },
    {
      key: "c",
      label: "Commit",
      align: "left",
      render: (r) => <code className="text-xs">{r.commit}</code>,
    },
    { key: "state", label: "State", align: "left", render: (r) => <StatePill state={r.state} /> },
    {
      key: "dur",
      label: "Build",
      align: "right",
      render: (r) => (r.durationSec ? `${r.durationSec}s` : "—"),
    },
    { key: "d", label: "When", align: "right", render: (r) => relativeTime(r.createdAt, now) },
  ];

  return (
    <div className="container-page section-gap">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Growth Dashboard</h1>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
            Internal · noindex
          </span>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Search Console · Analytics · Clarity · GitHub · Vercel — one place to drive SEO, UX, and
          revenue decisions. Generated {relativeTime(data.generatedAt, now)}.
        </p>
        {data.allSample && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            All providers are showing <strong>sample data</strong>. Set each provider&rsquo;s
            environment variables (see the Connections section) to load live production data. This
            page is <strong>noindex</strong>; add authentication before exposing live credentials.
          </p>
        )}
      </div>

      {/* Section nav */}
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
        {/* ── Insights ── */}
        <SectionCard id="insights" icon="💡" title="Insights">
          {data.insights.length === 0 ? (
            <p className="text-sm text-gray-400">No insights yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {data.insights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          )}
        </SectionCard>

        {/* ── Search Console ── */}
        <SectionCard
          id="search-console"
          icon="🔍"
          title="Google Search Console"
          status={gsc.status}
          note={gsc.status !== "live" ? gsc.note : undefined}
        >
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Impressions"
              value={formatNumber(gsc.data.totals.impressions)}
              delta={trendDelta(gsc.data.impressionsTrend)}
              trend={gsc.data.impressionsTrend}
            />
            <StatCard
              label="Clicks"
              value={formatNumber(gsc.data.totals.clicks)}
              delta={trendDelta(gsc.data.clicksTrend)}
              trend={gsc.data.clicksTrend}
            />
            <StatCard label="Average CTR" value={formatPercent(gsc.data.totals.ctr)} />
            <StatCard
              label="Avg Position"
              value={formatPosition(gsc.data.totals.position)}
              hint="lower is better"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Top queries">
              <DataTable
                columns={queryCols}
                rows={gsc.data.topQueries}
                getRowKey={(r) => r.query}
              />
            </Panel>
            <Panel title="Top pages">
              <DataTable columns={pageCols} rows={gsc.data.topPages} getRowKey={(r) => r.page} />
            </Panel>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Index coverage">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniStat
                  label="Indexed"
                  value={formatFull(gsc.data.indexCoverage.indexed)}
                  tone="good"
                />
                <MiniStat
                  label="Discovered"
                  value={formatFull(gsc.data.indexCoverage.discovered)}
                />
                <MiniStat label="Excluded" value={formatFull(gsc.data.indexCoverage.excluded)} />
                <MiniStat
                  label="Errors"
                  value={formatFull(gsc.data.indexCoverage.errors)}
                  tone={gsc.data.indexCoverage.errors > 0 ? "bad" : "good"}
                />
              </div>
            </Panel>
            <Panel title="Sitemap status">
              <div className="flex flex-col gap-2 text-sm">
                <Row
                  label="Sitemap"
                  value={<code className="text-xs">{gsc.data.sitemap.path}</code>}
                />
                <Row label="Submitted URLs" value={formatFull(gsc.data.sitemap.submitted)} />
                <Row label="Indexed URLs" value={formatFull(gsc.data.sitemap.indexed)} />
                <Row label="Last read" value={relativeTime(gsc.data.sitemap.lastRead, now)} />
                <Row label="Status" value={<StatePill state={gsc.data.sitemap.status} />} />
              </div>
            </Panel>
          </div>
        </SectionCard>

        {/* ── Analytics ── */}
        <SectionCard
          id="analytics"
          icon="📈"
          title="Google Analytics"
          status={ga.status}
          note={ga.status !== "live" ? ga.note : undefined}
        >
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Users"
              value={formatNumber(ga.data.totals.users)}
              delta={trendDelta(ga.data.usersTrend)}
              trend={ga.data.usersTrend}
            />
            <StatCard label="Sessions" value={formatNumber(ga.data.totals.sessions)} />
            <StatCard
              label="Engagement rate"
              value={formatPercent(ga.data.totals.engagementRate)}
            />
            <StatCard
              label="Returning users"
              value={formatNumber(ga.data.totals.returningUsers)}
              hint={`${ga.data.totals.avgEngagementSec}s avg`}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel title="Traffic sources">
              <BarList items={ga.data.sources} />
            </Panel>
            <Panel title="Countries">
              <BarList items={ga.data.countries} barClassName="bg-indigo-500" />
            </Panel>
            <Panel title="Devices">
              <BarList items={ga.data.devices} barClassName="bg-emerald-500" />
            </Panel>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Panel title="Top pages">
                <DataTable columns={gaPageCols} rows={ga.data.topPages} getRowKey={(r) => r.page} />
              </Panel>
            </div>
            <Panel title="Conversions">
              {ga.data.conversions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center text-xs text-gray-400">
                  Conversion tracking not yet configured.
                  <br />
                  <span className="font-medium text-gray-500">Future-ready</span> — wire GA4
                  conversion events or AdSense revenue here.
                </div>
              ) : (
                <BarList items={ga.data.conversions} barClassName="bg-brand-600" />
              )}
            </Panel>
          </div>
        </SectionCard>

        {/* ── Clarity ── */}
        <SectionCard
          id="clarity"
          icon="🖱️"
          title="Microsoft Clarity"
          status={clarity.status}
          note={clarity.status !== "live" ? clarity.note : undefined}
        >
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Sessions" value={formatNumber(clarity.data.sessions)} />
            <StatCard label="Recordings" value={formatNumber(clarity.data.recordings)} />
            <StatCard label="Dead clicks" value={formatFull(clarity.data.deadClicks)} />
            <StatCard label="Rage clicks" value={formatFull(clarity.data.rageClicks)} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Quick-backs" value={formatFull(clarity.data.quickBacks)} />
            <StatCard label="Excessive scroll" value={formatFull(clarity.data.excessiveScroll)} />
            <StatCard label="Avg scroll depth" value={formatPercent(clarity.data.avgScrollDepth)} />
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-xs text-gray-400">
              <span className="font-medium text-gray-500">Heatmaps &amp; recordings</span> open in
              the Clarity dashboard; connect the API token to embed activity here.
            </div>
          </div>
          <div className="mt-4">
            <Panel title="Scroll depth by page">
              <BarList
                items={clarity.data.scrollByPage.map((p) => ({
                  label: p.page,
                  value: p.scrollDepth,
                }))}
                formatValue={(v) => formatPercent(v)}
                barClassName="bg-amber-500"
              />
            </Panel>
          </div>
        </SectionCard>

        {/* ── GitHub ── */}
        <SectionCard
          id="github"
          icon="🐙"
          title="GitHub"
          status={github.status}
          note={github.status !== "live" ? github.note : undefined}
        >
          <p className="mb-4 text-sm text-gray-500">
            Repository <code className="text-xs text-brand-700">{github.data.repo}</code> · default
            branch <code className="text-xs">{github.data.defaultBranch}</code>
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Latest deployments">
              <DataTable
                columns={deployCols}
                rows={github.data.deployments}
                getRowKey={(r) => r.id}
              />
            </Panel>
            <Panel title="Release history">
              <ul className="flex flex-col divide-y divide-gray-100 text-sm">
                {github.data.releases.map((r) => (
                  <li key={r.tag} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      <code className="text-xs text-brand-700">{r.tag}</code>{" "}
                      <span className="text-gray-700">{r.name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-gray-400">
                      {relativeTime(r.date, now)}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
          <div className="mt-4">
            <Panel title="Commit history">
              <DataTable columns={commitCols} rows={github.data.commits} getRowKey={(r) => r.sha} />
            </Panel>
          </div>
        </SectionCard>

        {/* ── Vercel ── */}
        <SectionCard
          id="vercel"
          icon="▲"
          title="Vercel"
          status={vercel.status}
          note={vercel.status !== "live" ? vercel.note : undefined}
        >
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Deployment status
              </p>
              <div className="mt-1.5">
                <StatePill state={vercel.data.latest.state} />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {vercel.data.latest.target} · {relativeTime(vercel.data.latest.createdAt, now)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Production URL
              </p>
              <a
                href={vercel.data.productionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 block truncate text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                {vercel.data.productionUrl.replace(/^https?:\/\//, "")}
              </a>
            </div>
            {vercel.data.performance.slice(0, 2).map((m) => (
              <PerfCard
                key={m.metric}
                metric={m.metric}
                value={`${m.value}${m.unit}`}
                rating={m.rating}
              />
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {vercel.data.performance.map((m) => (
              <PerfCard
                key={m.metric}
                metric={m.metric}
                value={`${m.value}${m.unit}`}
                rating={m.rating}
              />
            ))}
          </div>

          <div className="mt-4">
            <Panel title="Build history">
              <DataTable columns={buildCols} rows={vercel.data.builds} getRowKey={(r) => r.id} />
            </Panel>
          </div>
        </SectionCard>

        {/* ── Connections ── */}
        <SectionCard id="connections" icon="🔌" title="Connections">
          <p className="mb-4 text-sm text-gray-500">
            Each provider goes live automatically when its environment variables are set. New
            providers (Bing, AdSense, revenue) plug into the same registry.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {providerRegistry().map((p) => (
              <div key={p.key} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <span aria-hidden="true">{p.icon}</span>
                  <span className="font-medium text-gray-900">{p.label}</span>
                  <span className="ml-auto">
                    <StatusBadge
                      status={p.planned ? "planned" : p.configured ? "live" : "sample"}
                    />
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.envVars.map((v) => (
                    <code
                      key={v}
                      className="rounded bg-gray-100 px-1.5 py-0.5 text-[0.7rem] text-gray-600"
                    >
                      {v}
                    </code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ── Small inline helpers ──

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-lg font-bold tabular-nums",
          tone === "good" && "text-green-600",
          tone === "bad" && "text-red-600",
          !tone && "text-gray-900"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function StatePill({ state }: { state: string }) {
  const s = state.toLowerCase();
  const good = s.includes("ready") || s.includes("success");
  const bad = s.includes("error") || s.includes("fail") || s.includes("canceled");
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        good && "bg-green-100 text-green-700",
        bad && "bg-red-100 text-red-700",
        !good && !bad && "bg-amber-100 text-amber-700"
      )}
    >
      {state}
    </span>
  );
}

function PerfCard({
  metric,
  value,
  rating,
}: {
  metric: string;
  value: string;
  rating: "good" | "needs-improvement" | "poor";
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-400">{metric}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums text-gray-900">{value}</p>
      <span
        className={cn(
          "mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
          rating === "good" && "bg-green-100 text-green-700",
          rating === "needs-improvement" && "bg-amber-100 text-amber-700",
          rating === "poor" && "bg-red-100 text-red-700"
        )}
      >
        {rating.replace("-", " ")}
      </span>
    </div>
  );
}
