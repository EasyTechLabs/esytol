"use client";

import { CalculationSync } from "@/features/tool/CalculationSync";
import type { FinanceEvent } from "@/lib/financeEvents";

import { useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { calculateLumpsum, validateLumpsumInputs, formatINR } from "@/lib/lumpsum";
import { ProjectionTable } from "./ProjectionTable";
import { cn } from "@/lib/cn";

const LumpsumCharts = dynamic(
  () => import("./LumpsumCharts").then((m) => ({ default: m.LumpsumCharts })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-44 items-center justify-center rounded-xl border border-gray-200 bg-white">
        <p className="text-sm text-gray-400">Loading chart…</p>
      </div>
    ),
  }
);

type PeriodUnit = "years" | "months";

const DEFAULT_AMOUNT = "100000";
const DEFAULT_RATE = "12";
const DEFAULT_PERIOD = "10";
const DEFAULT_UNIT: PeriodUnit = "years";

export function LumpsumCalculator() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [amount, setAmount] = useState(searchParams.get("amount") ?? DEFAULT_AMOUNT);
  const [rate, setRate] = useState(searchParams.get("rate") ?? DEFAULT_RATE);
  const [period, setPeriod] = useState(searchParams.get("period") ?? DEFAULT_PERIOD);
  const [unit, setUnit] = useState<PeriodUnit>(
    searchParams.get("unit") === "months" ? "months" : DEFAULT_UNIT
  );
  const [resultCopied, setResultCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const numAmount = parseFloat(amount);
  // Rate may be negative (a loss), so parse without a `|| 0` fallback.
  const numRate = parseFloat(rate);
  const numPeriod = parseInt(period, 10) || 0;
  const months = unit === "years" ? numPeriod * 12 : numPeriod;

  const errors = useMemo(
    () => validateLumpsumInputs(numAmount, numRate, months),
    [numAmount, numRate, months]
  );

  const isValid = Object.keys(errors).length === 0;

  const result = useMemo(() => {
    if (!isValid) return null;
    return calculateLumpsum({ initialInvestment: numAmount, annualRate: numRate, months });
  }, [isValid, numAmount, numRate, months]);

  const financeEvent = useMemo<FinanceEvent | null>(() => {
    if (!result) return null;
    return {
      type: "GrowthProjected",
      slug: "lumpsum-calculator",
      name: "Lumpsum Calculator",
      invested: result.summary.initialInvestment,
      maturityValue: result.summary.maturityValue,
      months,
    };
  }, [result, months]);

  const handleReset = useCallback(() => {
    setAmount(DEFAULT_AMOUNT);
    setRate(DEFAULT_RATE);
    setPeriod(DEFAULT_PERIOD);
    setUnit(DEFAULT_UNIT);
  }, []);

  const handleCopyResult = useCallback(async () => {
    if (!result) return;
    const { summary } = result;
    const lines = [
      `Lumpsum — Initial Investment: ${formatINR(numAmount)}`,
      `Expected Return: ${numRate}% p.a.  |  Period: ${summary.years} year${summary.years !== 1 ? "s" : ""}`,
      `Estimated Returns:   ${formatINR(summary.estimatedReturns)}`,
      `Maturity Value:      ${formatINR(summary.maturityValue)}`,
      `Wealth Gain:         ${summary.wealthGainPct.toFixed(2)}%`,
      `CAGR:                ${summary.cagrPct.toFixed(2)}% p.a.`,
      `Investment Multiple: ${summary.investmentMultiple.toFixed(2)}×`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setResultCopied(true);
      setTimeout(() => setResultCopied(false), 2000);
    } catch {
      // clipboard API unavailable
    }
  }, [result, numAmount, numRate]);

  const handleShareUrl = useCallback(async () => {
    const params = new URLSearchParams({ amount, rate, period, unit });
    const url = `${window.location.origin}${pathname}?${params.toString()}`;
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    try {
      await navigator.clipboard.writeText(url);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    } catch {
      // clipboard API unavailable
    }
  }, [amount, rate, period, unit, pathname, router]);

  return (
    <div className="flex flex-col gap-8">
      {/* ── Inputs ──────────────────────────────────────────────────────────── */}
      <section aria-label="Lumpsum inputs">
        <div className="grid gap-5 sm:grid-cols-3">
          {/* Initial Investment */}
          <div>
            <label
              htmlFor="lumpsum-amount"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Initial Investment (₹)
            </label>
            <input
              id="lumpsum-amount"
              type="number"
              min="0.01"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 100000"
              aria-describedby={errors.amount ? "lumpsum-amount-error" : undefined}
              aria-invalid={!!errors.amount}
              className={cn(
                "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm",
                "focus:outline-none focus:ring-2 focus:ring-brand-200",
                errors.amount
                  ? "border-red-400 focus:border-red-400"
                  : "border-gray-200 focus:border-brand-400"
              )}
            />
            {errors.amount && (
              <p id="lumpsum-amount-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.amount}
              </p>
            )}
          </div>

          {/* Expected Annual Return */}
          <div>
            <label
              htmlFor="lumpsum-rate"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Expected Annual Return (%)
            </label>
            <input
              id="lumpsum-rate"
              type="number"
              min="-100"
              max="100"
              step="0.1"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="e.g. 12"
              aria-describedby={errors.rate ? "lumpsum-rate-error" : undefined}
              aria-invalid={!!errors.rate}
              className={cn(
                "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm",
                "focus:outline-none focus:ring-2 focus:ring-brand-200",
                errors.rate
                  ? "border-red-400 focus:border-red-400"
                  : "border-gray-200 focus:border-brand-400"
              )}
            />
            {errors.rate && (
              <p id="lumpsum-rate-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.rate}
              </p>
            )}
          </div>

          {/* Investment Period */}
          <div>
            <label
              htmlFor="lumpsum-period"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Investment Period
            </label>
            <div className="flex gap-2">
              <input
                id="lumpsum-period"
                type="number"
                min="1"
                step="1"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder={unit === "years" ? "e.g. 10" : "e.g. 120"}
                aria-describedby={errors.period ? "lumpsum-period-error" : undefined}
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
              <p id="lumpsum-period-error" role="alert" className="mt-1 text-xs text-red-600">
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
        <section aria-labelledby="lumpsum-results-heading">
          <h2 id="lumpsum-results-heading" className="mb-4 text-lg font-semibold text-gray-900">
            Results
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <ResultCard
              label="Initial Investment"
              value={formatINR(result.summary.initialInvestment)}
            />
            <ResultCard
              label="Estimated Returns"
              value={formatINR(result.summary.estimatedReturns)}
              accent
              tone={result.summary.estimatedReturns >= 0 ? "pos" : "neg"}
            />
            <ResultCard label="Maturity Value" value={formatINR(result.summary.maturityValue)} />
          </div>

          {/* Wealth gain, CAGR, multiple */}
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm">
            <span className="text-gray-600">
              Wealth Gain:{" "}
              <strong
                className={cn(
                  "font-semibold",
                  result.summary.wealthGainPct >= 0 ? "text-gray-900" : "text-red-600"
                )}
              >
                {result.summary.wealthGainPct.toFixed(2)}%
              </strong>
            </span>
            <span className="text-gray-300" aria-hidden="true">
              |
            </span>
            <span className="text-gray-600">
              CAGR:{" "}
              <strong className="font-semibold text-gray-900">
                {result.summary.cagrPct.toFixed(2)}% p.a.
              </strong>
            </span>
            <span className="text-gray-300" aria-hidden="true">
              |
            </span>
            <span className="text-gray-600">
              Investment Multiple:{" "}
              <strong className="font-semibold text-gray-900">
                {result.summary.investmentMultiple.toFixed(2)}×
              </strong>
            </span>
            <span className="ml-auto text-xs text-gray-400">
              {result.summary.years} year{result.summary.years !== 1 ? "s" : ""} at {numRate}% p.a.
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
        <LumpsumCharts
          initialInvestment={result.summary.initialInvestment}
          estimatedReturns={result.summary.estimatedReturns}
          maturityValue={result.summary.maturityValue}
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
  const toneClass = tone === "neg" ? "text-red-600" : tone === "pos" ? "text-brand-700" : null;
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
          toneClass ?? (accent ? "text-brand-700" : "text-gray-900")
        )}
      >
        {value}
      </p>
    </div>
  );
}
