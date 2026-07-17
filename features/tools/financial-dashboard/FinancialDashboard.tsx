"use client";

/**
 * Personal Financial Dashboard — PROJECT-003.
 *
 * One place that shows the household's position from data already on this
 * device: the profile saved by the Financial Roadmap, plus tool recency.
 * Everything derives through lib/financialRoadmap (one rule engine — the
 * insights here are the engine's pillars and actions, re-worded, never a
 * second opinion), and everything stays in this browser.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { buildRoadmap, formatINR, EMERGENCY_MONTHS_TARGET } from "@/lib/financialRoadmap";
import {
  clearStore,
  daysUntilReview,
  markReviewed,
  readStore,
  reviewDue,
  FINANCE_STORAGE_KEY,
  type FinanceStore,
} from "@/lib/localFinance";
import { cn } from "@/lib/cn";

const GOAL_LABEL: Record<string, string> = {
  stability: "Financial stability",
  "buy-house": "Buying a home",
  "children-education": "Children's education",
  "early-retirement": "Early retirement",
  wealth: "Long-term wealth",
};

export function FinancialDashboard() {
  const [store, setStore] = useState<FinanceStore | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const refresh = useCallback(() => setStore(readStore()), []);

  useEffect(() => {
    refresh();
    // Cross-tab sync: a calculator or the roadmap saving in another tab
    // updates this dashboard live.
    const onStorage = (e: StorageEvent) => {
      if (e.key === FINANCE_STORAGE_KEY || e.key === null) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  if (store === null) {
    return <p className="py-16 text-center text-sm text-gray-400">Loading your dashboard…</p>;
  }

  if (!store.profile) {
    return <EmptyState recent={store.recentTools} />;
  }

  const profile = store.profile;
  const result = buildRoadmap(profile);
  const emergencyMonths =
    profile.monthlyExpenses > 0 ? profile.emergencyFund / profile.monthlyExpenses : 0;
  const savingsRate =
    profile.monthlyIncome > 0 ? profile.monthlyInvesting / profile.monthlyIncome : 0;
  const trackedNetWorth =
    profile.emergencyFund + profile.retirementCorpus - profile.highInterestDebt;
  const emiRatio = profile.monthlyIncome > 0 ? profile.monthlyEmi / profile.monthlyIncome : 0;
  const due = reviewDue(store);
  const reviewDays = daysUntilReview(store);
  const currentAction = result.actions.find((a) => a.id === result.currentActionId);

  const insights = buildInsights(result, emergencyMonths, emiRatio, profile);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Review prompt (every 90 days) ─────────────────────────────── */}
      {due && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
          <p className="text-sm text-brand-900">
            <strong>Time for your financial review.</strong> Re-check your numbers and recalculate
            your roadmap — rules, salaries and prices move every quarter.
          </p>
          <span className="flex gap-2">
            <Link
              href="/tools/financial-roadmap"
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Review roadmap
            </Link>
            <button
              type="button"
              onClick={() => {
                markReviewed();
                refresh();
              }}
              className="rounded-lg border border-brand-300 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
            >
              Mark reviewed
            </button>
          </span>
        </div>
      )}

      {/* ── Headline tiles ────────────────────────────────────────────── */}
      <section aria-label="Overview" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Financial Health Score"
          value={`${result.healthScore}/100`}
          sub={`${result.riskLevel} risk`}
          tone={result.riskLevel === "low" ? "good" : result.riskLevel === "high" ? "bad" : "warn"}
        />
        <Tile
          label="Roadmap progress"
          value={`${result.completionPct}%`}
          sub={
            currentAction
              ? `Current: ${currentAction.title.slice(0, 34)}${currentAction.title.length > 34 ? "…" : ""}`
              : "All steps complete"
          }
          tone={result.completionPct >= 60 ? "good" : "neutral"}
        />
        <Tile
          label="Tracked net worth"
          value={formatINR(trackedNetWorth)}
          sub="emergency fund + retirement − high-interest debt"
          tone={trackedNetWorth >= 0 ? "neutral" : "bad"}
        />
        <Tile
          label="Next review"
          value={due ? "due now" : reviewDays === null ? "not started" : `${reviewDays} days`}
          sub={store.lastReviewAt ? `last: ${store.lastReviewAt.slice(0, 10)}` : "90-day cycle"}
          tone={due ? "warn" : "neutral"}
        />
      </section>

      {/* ── Position tiles ────────────────────────────────────────────── */}
      <section aria-label="Your position" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Emergency fund"
          value={`${emergencyMonths.toFixed(1)} mo`}
          sub={`${formatINR(profile.emergencyFund)} · target ${EMERGENCY_MONTHS_TARGET} months`}
          tone={emergencyMonths >= EMERGENCY_MONTHS_TARGET ? "good" : "warn"}
        />
        <Tile
          label="Monthly savings"
          value={`${Math.round(savingsRate * 100)}%`}
          sub={`${formatINR(profile.monthlyInvesting)}/month invested`}
          tone={savingsRate >= 0.2 ? "good" : "warn"}
        />
        <Tile
          label="Debt"
          value={
            profile.highInterestDebt > 0 ? formatINR(profile.highInterestDebt) : "no high-interest"
          }
          sub={`EMIs ${Math.round(emiRatio * 100)}% of income`}
          tone={profile.highInterestDebt > 0 ? "bad" : emiRatio > 0.4 ? "warn" : "good"}
        />
        <Tile
          label="Insurance"
          value={
            profile.hasHealthInsurance && (profile.hasTermInsurance || profile.dependants === 0)
              ? "covered"
              : "gaps"
          }
          sub={`health ${profile.hasHealthInsurance ? `₹${profile.healthCoverLakh}L` : "—"} · term ${profile.hasTermInsurance ? `₹${profile.termCoverLakh}L` : "—"}`}
          tone={profile.hasHealthInsurance ? "good" : "bad"}
        />
      </section>

      {/* ── Insights (deterministic, from the engine) ─────────────────── */}
      <section aria-label="Insights" className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Insights</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {insights.map((insight) => (
            <li key={insight.text} className="flex items-start gap-2 text-sm">
              <span
                className={cn(
                  "mt-0.5 h-2 w-2 shrink-0 rounded-full",
                  insight.tone === "good" && "bg-green-500",
                  insight.tone === "warn" && "bg-amber-500",
                  insight.tone === "bad" && "bg-red-500"
                )}
                aria-hidden="true"
              />
              <span className="text-gray-700">{insight.text}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Milestone timeline ────────────────────────────────────────── */}
      <section aria-label="Milestones" className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Milestones</h2>
          <p className="text-xs text-gray-500">
            Estimated completion of pending steps: <strong>{result.estimatedTimeline}</strong>{" "}
            (effort, not a market forecast)
          </p>
        </div>
        <ol className="mt-3 flex flex-wrap gap-2">
          {result.actions.map((action) => (
            <li
              key={action.id}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                action.status === "done" && "border-green-200 bg-green-50 text-green-700",
                action.status === "pending" &&
                  action.id === result.currentActionId &&
                  "text-brand-800 border-brand-400 bg-brand-50",
                action.status === "pending" &&
                  action.id !== result.currentActionId &&
                  "border-gray-200 bg-white text-gray-500",
                action.status === "not-applicable" && "border-gray-100 bg-gray-50 text-gray-300"
              )}
              title={action.title}
            >
              {action.status === "done" ? "✓ " : ""}
              {action.id === result.currentActionId ? "▶ " : ""}
              {action.id.replace(/-/g, " ")}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-gray-500">
          Goal: <strong>{GOAL_LABEL[profile.primaryGoal] ?? profile.primaryGoal}</strong> · edit
          everything in the{" "}
          <Link href="/tools/financial-roadmap" className="text-brand-700 underline">
            Financial Roadmap
          </Link>
        </p>
      </section>

      {/* ── Recent tools ──────────────────────────────────────────────── */}
      <RecentTools recent={store.recentTools} />

      {/* ── Privacy + reset ───────────────────────────────────────────── */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
        <p className="text-xs text-gray-500">
          All of this lives in <strong>this browser only</strong> — no account, no cloud, no
          tracking. Profile saved {store.profileSavedAt ? store.profileSavedAt.slice(0, 10) : "—"}.
        </p>
        {confirmReset ? (
          <span className="flex items-center gap-2 text-xs">
            <span className="text-red-700">Erase everything on this device?</span>
            <button
              type="button"
              onClick={() => {
                clearStore();
                setConfirmReset(false);
                refresh();
              }}
              className="rounded-lg bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700"
            >
              Yes, erase
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 font-medium text-gray-600"
            >
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-red-300 hover:text-red-700"
          >
            Clear my data
          </button>
        )}
      </section>
    </div>
  );
}

// ── Deterministic insights: re-worded engine facts, never a second engine ──

interface Insight {
  text: string;
  tone: "good" | "warn" | "bad";
}

function buildInsights(
  result: ReturnType<typeof buildRoadmap>,
  emergencyMonths: number,
  emiRatio: number,
  profile: NonNullable<FinanceStore["profile"]>
): Insight[] {
  const insights: Insight[] = [];
  const byId = new Map(result.actions.map((a) => [a.id, a]));

  insights.push(
    emergencyMonths >= EMERGENCY_MONTHS_TARGET
      ? { text: "Emergency fund complete.", tone: "good" }
      : {
          text: `Emergency fund at ${emergencyMonths.toFixed(1)} of ${EMERGENCY_MONTHS_TARGET} months — ${formatINR(byId.get("emergency-fund")?.gapAmount ?? 0)} to go.`,
          tone: "warn",
        }
  );

  if (!profile.hasHealthInsurance) {
    insights.push({ text: "Health insurance missing — the largest single risk.", tone: "bad" });
  }
  const term = byId.get("life-insurance");
  if (term?.status === "pending") {
    insights.push({
      text: "Term life cover missing while others depend on your income.",
      tone: "bad",
    });
  }

  insights.push(
    profile.highInterestDebt > 0
      ? {
          text: `High-interest debt of ${formatINR(profile.highInterestDebt)} outstanding.`,
          tone: "bad",
        }
      : emiRatio > 0.4
        ? {
            text: `EMIs at ${Math.round(emiRatio * 100)}% of income — above the 40% ceiling.`,
            tone: "warn",
          }
        : { text: "Debt ratio healthy.", tone: "good" }
  );

  const retirement = byId.get("retirement");
  insights.push(
    retirement?.status === "done"
      ? { text: "Retirement savings on the age-ladder target.", tone: "good" }
      : {
          text: `Retirement savings below target — ${formatINR(retirement?.gapAmount ?? 0)} behind the age marker.`,
          tone: "warn",
        }
  );

  const investing = byId.get("investing");
  if (investing?.status === "done") {
    insights.push({ text: "Savings rate at or above the 20% benchmark.", tone: "good" });
  }
  return insights;
}

// ── Pieces ─────────────────────────────────────────────────────────────────

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "good" | "warn" | "bad" | "neutral";
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-bold",
          tone === "good" && "text-green-700",
          tone === "warn" && "text-amber-700",
          tone === "bad" && "text-red-700",
          tone === "neutral" && "text-gray-900"
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-gray-500">{sub}</p>
    </div>
  );
}

function RecentTools({ recent }: { recent: FinanceStore["recentTools"] }) {
  if (recent.length === 0) return null;
  return (
    <section aria-label="Recent tools" className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900">Recently used</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {recent.map((tool) => (
          <li key={tool.slug}>
            <Link
              href={`/tools/${tool.slug}`}
              className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              {tool.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EmptyState({ recent }: { recent: FinanceStore["recentTools"] }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <h2 className="text-lg font-semibold text-gray-900">Your dashboard is empty — for now</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
          Fill in the <strong>Financial Roadmap</strong> once and this page becomes your
          household&rsquo;s financial position: health score, progress, gaps and next steps — stored
          only in this browser, never uploaded anywhere.
        </p>
        <Link
          href="/tools/financial-roadmap"
          className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Build my roadmap →
        </Link>
      </div>
      <RecentTools recent={recent} />
    </div>
  );
}
