"use client";

import { CalculationSync } from "@/features/tool/CalculationSync";
import type { FinanceEvent } from "@/lib/financeEvents";

import { useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { calculateCAGR, validateCAGRInputs, formatINR } from "@/lib/cagr";
import { ProjectionTable } from "./ProjectionTable";
import { cn } from "@/lib/cn";

const CAGRCharts = dynamic(() => import("./CAGRCharts").then((m) => ({ default: m.CAGRCharts })), {
  ssr: false,
  loading: () => (
    <div className="flex h-44 items-center justify-center rounded-xl border border-gray-200 bg-white">
      <p className="text-sm text-gray-400">Loading chart…</p>
    </div>
  ),
});

type PeriodUnit = "years" | "months";

const DEFAULT_BEGINNING = "100000";
const DEFAULT_ENDING = "200000";
const DEFAULT_PERIOD = "5";
const DEFAULT_UNIT: PeriodUnit = "years";

export function CAGRCalculator() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [beginning, setBeginning] = useState(searchParams.get("beginning") ?? DEFAULT_BEGINNING);
  const [ending, setEnding] = useState(searchParams.get("ending") ?? DEFAULT_ENDING);
  const [period, setPeriod] = useState(searchParams.get("period") ?? DEFAULT_PERIOD);
  const [unit, setUnit] = useState<PeriodUnit>(
    searchParams.get("unit") === "months" ? "months" : DEFAULT_UNIT
  );
  const [resultCopied, setResultCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const numBeginning = parseFloat(beginning);
  // Ending may legitimately be 0 (total loss), so parse without a `|| 0` fallback.
  const numEnding = parseFloat(ending);
  const numPeriod = parseInt(period, 10) || 0;
  const months = unit === "years" ? numPeriod * 12 : numPeriod;

  const errors = useMemo(
    () => validateCAGRInputs(numBeginning, numEnding, months),
    [numBeginning, numEnding, months]
  );

  const isValid = Object.keys(errors).length === 0;

  const result = useMemo(() => {
    if (!isValid) return null;
    return calculateCAGR({ beginningValue: numBeginning, endingValue: numEnding, months });
  }, [isValid, numBeginning, numEnding, months]);

  const financeEvent = useMemo<FinanceEvent | null>(() => {
    if (!result) return null;
    return {
      type: "GrowthProjected",
      slug: "cagr-calculator",
      name: "CAGR Calculator",
      invested: numBeginning,
      maturityValue: numEnding,
      months,
    };
  }, [result, numBeginning, numEnding, months]);

  const handleReset = useCallback(() => {
    setBeginning(DEFAULT_BEGINNING);
    setEnding(DEFAULT_ENDING);
    setPeriod(DEFAULT_PERIOD);
    setUnit(DEFAULT_UNIT);
  }, []);

  const handleCopyResult = useCallback(async () => {
    if (!result) return;
    const { summary } = result;
    const lines = [
      `CAGR — Beginning: ${formatINR(numBeginning)}  →  Ending: ${formatINR(numEnding)}`,
      `Period: ${summary.years} year${summary.years !== 1 ? "s" : ""}`,
      `CAGR:                ${summary.cagrPct.toFixed(2)}% p.a.`,
      `Absolute Return:     ${summary.absoluteReturnPct.toFixed(2)}%`,
      `Total Profit/Loss:   ${formatINR(summary.totalProfitLoss)}`,
      `Annualised Growth:   ${formatINR(summary.annualizedGrowth)} / yr`,
      `Investment Multiple: ${summary.investmentMultiple.toFixed(2)}×`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setResultCopied(true);
      setTimeout(() => setResultCopied(false), 2000);
    } catch {
      // clipboard API unavailable
    }
  }, [result, numBeginning, numEnding]);

  const handleShareUrl = useCallback(async () => {
    const params = new URLSearchParams({ beginning, ending, period, unit });
    const url = `${window.location.origin}${pathname}?${params.toString()}`;
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    try {
      await navigator.clipboard.writeText(url);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    } catch {
      // clipboard API unavailable
    }
  }, [beginning, ending, period, unit, pathname, router]);

  return (
    <div className="flex flex-col gap-8">
      {/* ── Inputs ──────────────────────────────────────────────────────────── */}
      <section aria-label="CAGR inputs">
        <div className="grid gap-5 sm:grid-cols-3">
          {/* Beginning Value */}
          <div>
            <label
              htmlFor="cagr-beginning"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Beginning Value (₹)
            </label>
            <input
              id="cagr-beginning"
              type="number"
              min="0.01"
              step="1"
              value={beginning}
              onChange={(e) => setBeginning(e.target.value)}
              placeholder="e.g. 100000"
              aria-describedby={errors.beginning ? "cagr-beginning-error" : undefined}
              aria-invalid={!!errors.beginning}
              className={cn(
                "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm",
                "focus:outline-none focus:ring-2 focus:ring-brand-200",
                errors.beginning
                  ? "border-red-400 focus:border-red-400"
                  : "border-gray-200 focus:border-brand-400"
              )}
            />
            {errors.beginning && (
              <p id="cagr-beginning-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.beginning}
              </p>
            )}
          </div>

          {/* Ending Value */}
          <div>
            <label htmlFor="cagr-ending" className="mb-1.5 block text-sm font-medium text-gray-700">
              Ending Value (₹)
            </label>
            <input
              id="cagr-ending"
              type="number"
              min="0"
              step="1"
              value={ending}
              onChange={(e) => setEnding(e.target.value)}
              placeholder="e.g. 200000"
              aria-describedby={errors.ending ? "cagr-ending-error" : undefined}
              aria-invalid={!!errors.ending}
              className={cn(
                "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm",
                "focus:outline-none focus:ring-2 focus:ring-brand-200",
                errors.ending
                  ? "border-red-400 focus:border-red-400"
                  : "border-gray-200 focus:border-brand-400"
              )}
            />
            {errors.ending && (
              <p id="cagr-ending-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.ending}
              </p>
            )}
          </div>

          {/* Investment Period */}
          <div>
            <label htmlFor="cagr-period" className="mb-1.5 block text-sm font-medium text-gray-700">
              Investment Period
            </label>
            <div className="flex gap-2">
              <input
                id="cagr-period"
                type="number"
                min="1"
                step="1"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder={unit === "years" ? "e.g. 5" : "e.g. 60"}
                aria-describedby={errors.period ? "cagr-period-error" : undefined}
                aria-invalid={!!errors.period}
                className={cn(
                  "min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-sm shadow-sm",
                  "focus:outline-none focus:ring-2 focus:ring-brand-200",
                  errors.period
                    ? "border-red-400 focus:border-red-400"
                    : "border-gray-200 focus:border-brand-400"
                )}
              />
              <div
                role="group"
                aria-label="Period unit"
                className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5"
              >
                {(["years", "months"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    aria-pressed={unit === u}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition",
                      unit === u
                        ? "bg-white text-brand-700 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            {errors.period && (
              <p id="cagr-period-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.period}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 transition hover:border-gray-300 hover:text-gray-800"
          >
            Reset
          </button>
        </div>
      </section>

      {/* ── Results ─────────────────────────────────────────────────────────── */}
      {result && (
        <section aria-labelledby="cagr-results-heading">
          <h2 id="cagr-results-heading" className="mb-4 text-lg font-semibold text-gray-900">
            Results
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <ResultCard
              label="CAGR"
              value={`${result.summary.cagrPct.toFixed(2)}%`}
              accent
              tone={result.summary.cagrPct >= 0 ? "pos" : "neg"}
            />
            <ResultCard
              label="Absolute Return"
              value={`${result.summary.absoluteReturnPct.toFixed(2)}%`}
              tone={result.summary.absoluteReturnPct >= 0 ? "pos" : "neg"}
            />
            <ResultCard
              label="Investment Multiple"
              value={`${result.summary.investmentMultiple.toFixed(2)}×`}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ResultCard
              label="Total Profit / Loss"
              value={formatINR(result.summary.totalProfitLoss)}
              tone={result.summary.totalProfitLoss >= 0 ? "pos" : "neg"}
            />
            <ResultCard
              label="Annualized Growth"
              value={`${formatINR(result.summary.annualizedGrowth)} / yr`}
              tone={result.summary.annualizedGrowth >= 0 ? "pos" : "neg"}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm">
            <span className="text-gray-600">
              CAGR is the geometric annual growth rate; Absolute Return is the total return over the
              whole period.
            </span>
            <span className="ml-auto text-xs text-gray-400">
              over {result.summary.years} year{result.summary.years !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Action buttons */}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCopyResult}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              {resultCopied ? "Copied!" : "Copy result"}
            </button>
            <button
              type="button"
              onClick={handleShareUrl}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              {urlCopied ? "URL copied!" : "Share URL"}
            </button>
          </div>
        </section>
      )}

      <CalculationSync event={financeEvent} />

      {/* ── Charts ──────────────────────────────────────────────────────────── */}
      {result && (
        <CAGRCharts
          beginningValue={numBeginning}
          endingValue={numEnding}
          projection={result.projection}
        />
      )}

      {/* ── Year-wise Projection Table ───────────────────────────────────────── */}
      {result && result.projection.length > 0 && <ProjectionTable rows={result.projection} />}
    </div>
  );
}

function ResultCard({
  label,
  value,
  accent = false,
  tone,
}: {
  label: string;
  value: string;
  accent?: boolean;
  tone?: "pos" | "neg";
}) {
  const toneClass =
    tone === "neg" ? "text-red-600" : tone === "pos" ? "text-green-700" : "text-gray-900";
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        accent ? "border-brand-200 bg-brand-50" : "border-gray-200 bg-white"
      )}
    >
      <p className="text-xs font-medium uppercase tracking-widest text-gray-400">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-bold tabular-nums",
          accent && !tone ? "text-brand-700" : toneClass
        )}
      >
        {value}
      </p>
    </div>
  );
}
