"use client";

import { useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { calculateSIP, validateSIPInputs, formatINR } from "@/lib/sip";
import { ProjectionTable } from "./ProjectionTable";
import { cn } from "@/lib/cn";

const SIPCharts = dynamic(() => import("./SIPCharts").then((m) => ({ default: m.SIPCharts })), {
  ssr: false,
  loading: () => (
    <div className="flex h-44 items-center justify-center rounded-xl border border-gray-200 bg-white">
      <p className="text-sm text-gray-400">Loading chart…</p>
    </div>
  ),
});

type PeriodUnit = "years" | "months";

const DEFAULT_AMOUNT = "1000";
const DEFAULT_RATE = "12";
const DEFAULT_PERIOD = "10";
const DEFAULT_UNIT: PeriodUnit = "years";

export function SIPCalculator() {
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

  const numAmount = parseFloat(amount) || 0;
  const numRate = parseFloat(rate);
  const numPeriod = parseInt(period, 10) || 0;
  const months = unit === "years" ? numPeriod * 12 : numPeriod;

  const errors = useMemo(
    () => validateSIPInputs(numAmount, numRate, months),
    [numAmount, numRate, months]
  );

  const isValid =
    numAmount > 0 &&
    !isNaN(numRate) &&
    numRate >= 0 &&
    months >= 1 &&
    Object.keys(errors).length === 0;

  const result = useMemo(() => {
    if (!isValid) return null;
    return calculateSIP({ monthlyAmount: numAmount, annualRate: numRate, months });
  }, [isValid, numAmount, numRate, months]);

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
      `SIP — Monthly Investment: ${formatINR(numAmount)}`,
      `Annual Return: ${numRate}%  |  Period: ${months} months`,
      `Total Invested:   ${formatINR(summary.totalInvested)}`,
      `Estimated Return: ${formatINR(summary.estimatedReturn)}`,
      `Total Value:      ${formatINR(summary.totalValue)}`,
      `Wealth Gained:    ${summary.wealthGainedPct.toFixed(2)}%`,
    ];
    if (summary.cagr !== null) {
      lines.push(`CAGR:             ${summary.cagr.toFixed(2)}% p.a.`);
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setResultCopied(true);
      setTimeout(() => setResultCopied(false), 2000);
    } catch {
      // clipboard API unavailable
    }
  }, [result, numAmount, numRate, months]);

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
      <section aria-label="SIP inputs">
        <div className="grid gap-5 sm:grid-cols-3">
          {/* Monthly Investment */}
          <div>
            <label htmlFor="sip-amount" className="mb-1.5 block text-sm font-medium text-gray-700">
              Monthly Investment (₹)
            </label>
            <input
              id="sip-amount"
              type="number"
              min="0.01"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 1000"
              aria-describedby={errors.amount ? "sip-amount-error" : undefined}
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
              <p id="sip-amount-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.amount}
              </p>
            )}
          </div>

          {/* Annual Return */}
          <div>
            <label htmlFor="sip-rate" className="mb-1.5 block text-sm font-medium text-gray-700">
              Expected Annual Return (%)
            </label>
            <input
              id="sip-rate"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="e.g. 12"
              aria-describedby={errors.rate ? "sip-rate-error" : undefined}
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
              <p id="sip-rate-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.rate}
              </p>
            )}
          </div>

          {/* Investment Period */}
          <div>
            <label htmlFor="sip-period" className="mb-1.5 block text-sm font-medium text-gray-700">
              Investment Period
            </label>
            <div className="flex gap-2">
              <input
                id="sip-period"
                type="number"
                min="1"
                step="1"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder={unit === "years" ? "e.g. 10" : "e.g. 120"}
                aria-describedby={errors.period ? "sip-period-error" : undefined}
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
              <p id="sip-period-error" role="alert" className="mt-1 text-xs text-red-600">
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
        <section aria-labelledby="sip-results-heading">
          <h2 id="sip-results-heading" className="mb-4 text-lg font-semibold text-gray-900">
            Results
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <ResultCard label="Total Invested" value={formatINR(result.summary.totalInvested)} />
            <ResultCard
              label="Estimated Returns"
              value={formatINR(result.summary.estimatedReturn)}
              accent
            />
            <ResultCard label="Total Value" value={formatINR(result.summary.totalValue)} />
          </div>

          {/* Wealth Gained & CAGR */}
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm">
            <span className="text-gray-600">
              Wealth Gained:{" "}
              <strong className="font-semibold text-gray-900">
                {result.summary.wealthGainedPct.toFixed(2)}%
              </strong>
            </span>
            {result.summary.cagr !== null && (
              <>
                <span className="text-gray-300" aria-hidden="true">
                  |
                </span>
                <span className="text-gray-600">
                  CAGR:{" "}
                  <strong className="font-semibold text-gray-900">
                    {result.summary.cagr.toFixed(2)}% p.a.
                  </strong>
                </span>
              </>
            )}
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
      {result && result.summary.estimatedReturn > 0 && (
        <SIPCharts
          totalInvested={result.summary.totalInvested}
          estimatedReturn={result.summary.estimatedReturn}
          projection={result.projection}
        />
      )}

      {/* ── Month-wise Projection Table ──────────────────────────────────────── */}
      {result && <ProjectionTable rows={result.projection} monthlyAmount={numAmount} />}
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
