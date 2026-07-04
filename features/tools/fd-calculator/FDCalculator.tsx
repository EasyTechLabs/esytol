"use client";

import { useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import {
  calculateFD,
  validateFDInputs,
  formatINR,
  periodLabel,
  COMPOUNDING_OPTIONS,
  type CompoundingFrequency,
} from "@/lib/fd";
import { ProjectionTable } from "./ProjectionTable";
import { cn } from "@/lib/cn";

const FDCharts = dynamic(() => import("./FDCharts").then((m) => ({ default: m.FDCharts })), {
  ssr: false,
  loading: () => (
    <div className="flex h-44 items-center justify-center rounded-xl border border-gray-200 bg-white">
      <p className="text-sm text-gray-400">Loading chart…</p>
    </div>
  ),
});

type PeriodUnit = "years" | "months";

const DEFAULT_PRINCIPAL = "100000";
const DEFAULT_RATE = "7";
const DEFAULT_PERIOD = "5";
const DEFAULT_UNIT: PeriodUnit = "years";
const DEFAULT_FREQ: CompoundingFrequency = "quarterly";

const VALID_FREQS = COMPOUNDING_OPTIONS.map((o) => o.value);

export function FDCalculator() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const urlFreq = searchParams.get("freq");
  const [principal, setPrincipal] = useState(searchParams.get("principal") ?? DEFAULT_PRINCIPAL);
  const [rate, setRate] = useState(searchParams.get("rate") ?? DEFAULT_RATE);
  const [period, setPeriod] = useState(searchParams.get("period") ?? DEFAULT_PERIOD);
  const [unit, setUnit] = useState<PeriodUnit>(
    searchParams.get("unit") === "months" ? "months" : DEFAULT_UNIT
  );
  const [frequency, setFrequency] = useState<CompoundingFrequency>(
    urlFreq && VALID_FREQS.includes(urlFreq as CompoundingFrequency)
      ? (urlFreq as CompoundingFrequency)
      : DEFAULT_FREQ
  );
  const [resultCopied, setResultCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const numPrincipal = parseFloat(principal) || 0;
  const numRate = parseFloat(rate);
  const numPeriod = parseInt(period, 10) || 0;
  const months = unit === "years" ? numPeriod * 12 : numPeriod;

  const errors = useMemo(
    () => validateFDInputs(numPrincipal, numRate, months),
    [numPrincipal, numRate, months]
  );

  const isValid =
    numPrincipal > 0 &&
    !isNaN(numRate) &&
    numRate >= 0 &&
    months >= 1 &&
    Object.keys(errors).length === 0;

  const result = useMemo(() => {
    if (!isValid) return null;
    return calculateFD({ principal: numPrincipal, annualRate: numRate, months, frequency });
  }, [isValid, numPrincipal, numRate, months, frequency]);

  const unitLabel = periodLabel(frequency);

  const handleReset = useCallback(() => {
    setPrincipal(DEFAULT_PRINCIPAL);
    setRate(DEFAULT_RATE);
    setPeriod(DEFAULT_PERIOD);
    setUnit(DEFAULT_UNIT);
    setFrequency(DEFAULT_FREQ);
  }, []);

  const handleCopyResult = useCallback(async () => {
    if (!result) return;
    const { summary } = result;
    const freqLabel = COMPOUNDING_OPTIONS.find((o) => o.value === frequency)?.label ?? frequency;
    const lines = [
      `Fixed Deposit — Principal: ${formatINR(summary.principal)}`,
      `Interest Rate: ${numRate}% p.a.  |  Compounding: ${freqLabel}`,
      `Tenure: ${months} month${months !== 1 ? "s" : ""}`,
      `Interest Earned:  ${formatINR(summary.interestEarned)}`,
      `Maturity Amount:  ${formatINR(summary.maturityAmount)}`,
      `Effective Yield:  ${summary.effectiveAnnualYield.toFixed(2)}% p.a.`,
      `Total Growth:     ${summary.totalGrowthPct.toFixed(2)}%`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setResultCopied(true);
      setTimeout(() => setResultCopied(false), 2000);
    } catch {
      // clipboard API unavailable
    }
  }, [result, numRate, months, frequency]);

  const handleShareUrl = useCallback(async () => {
    const params = new URLSearchParams({ principal, rate, period, unit, freq: frequency });
    const url = `${window.location.origin}${pathname}?${params.toString()}`;
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    try {
      await navigator.clipboard.writeText(url);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    } catch {
      // clipboard API unavailable
    }
  }, [principal, rate, period, unit, frequency, pathname, router]);

  return (
    <div className="flex flex-col gap-8">
      {/* ── Inputs ──────────────────────────────────────────────────────────── */}
      <section aria-label="FD inputs">
        <div className="grid gap-5 sm:grid-cols-2">
          {/* Principal */}
          <div>
            <label
              htmlFor="fd-principal"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Principal Amount (₹)
            </label>
            <input
              id="fd-principal"
              type="number"
              min="0.01"
              step="1"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              placeholder="e.g. 100000"
              aria-describedby={errors.principal ? "fd-principal-error" : undefined}
              aria-invalid={!!errors.principal}
              className={cn(
                "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm",
                "focus:outline-none focus:ring-2 focus:ring-brand-200",
                errors.principal
                  ? "border-red-400 focus:border-red-400"
                  : "border-gray-200 focus:border-brand-400"
              )}
            />
            {errors.principal && (
              <p id="fd-principal-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.principal}
              </p>
            )}
          </div>

          {/* Annual Rate */}
          <div>
            <label htmlFor="fd-rate" className="mb-1.5 block text-sm font-medium text-gray-700">
              Annual Interest Rate (%)
            </label>
            <input
              id="fd-rate"
              type="number"
              min="0"
              max="100"
              step="0.05"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="e.g. 7"
              aria-describedby={errors.rate ? "fd-rate-error" : undefined}
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
              <p id="fd-rate-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.rate}
              </p>
            )}
          </div>

          {/* Investment Period */}
          <div>
            <label htmlFor="fd-period" className="mb-1.5 block text-sm font-medium text-gray-700">
              Investment Period
            </label>
            <div className="flex gap-2">
              <input
                id="fd-period"
                type="number"
                min="1"
                step="1"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder={unit === "years" ? "e.g. 5" : "e.g. 60"}
                aria-describedby={errors.period ? "fd-period-error" : undefined}
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
              <p id="fd-period-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.period}
              </p>
            )}
          </div>

          {/* Compounding Frequency */}
          <div>
            <label
              htmlFor="fd-frequency"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Compounding Frequency
            </label>
            <select
              id="fd-frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as CompoundingFrequency)}
              className={cn(
                "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm",
                "focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
              )}
            >
              {COMPOUNDING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Indian banks compound FD interest quarterly by default (RBI).
            </p>
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
        <section aria-labelledby="fd-results-heading">
          <h2 id="fd-results-heading" className="mb-4 text-lg font-semibold text-gray-900">
            Results
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <ResultCard label="Principal" value={formatINR(result.summary.principal)} />
            <ResultCard
              label="Interest Earned"
              value={formatINR(result.summary.interestEarned)}
              accent
            />
            <ResultCard label="Maturity Amount" value={formatINR(result.summary.maturityAmount)} />
          </div>

          {/* Effective yield & total growth */}
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm">
            <span className="text-gray-600">
              Effective Annual Yield:{" "}
              <strong className="font-semibold text-gray-900">
                {result.summary.effectiveAnnualYield.toFixed(2)}% p.a.
              </strong>
            </span>
            <span className="text-gray-300" aria-hidden="true">
              |
            </span>
            <span className="text-gray-600">
              Total Growth:{" "}
              <strong className="font-semibold text-gray-900">
                {result.summary.totalGrowthPct.toFixed(2)}%
              </strong>
            </span>
            <span className="ml-auto text-xs text-gray-400">
              {months} month{months !== 1 ? "s" : ""} at {numRate}% p.a.
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

      {/* ── Charts ──────────────────────────────────────────────────────────── */}
      {result && result.summary.interestEarned > 0 && (
        <FDCharts
          principal={result.summary.principal}
          interestEarned={result.summary.interestEarned}
          projection={result.projection}
          unitLabel={unitLabel}
        />
      )}

      {/* ── Period-wise Growth Table ─────────────────────────────────────────── */}
      {result && result.projection.length > 0 && (
        <ProjectionTable rows={result.projection} unitLabel={unitLabel} />
      )}
    </div>
  );
}

function ResultCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
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
          accent ? "text-brand-700" : "text-gray-900"
        )}
      >
        {value}
      </p>
    </div>
  );
}
