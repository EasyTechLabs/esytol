"use client";

import { useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { calculatePPF, validatePPFInputs, formatINR, PPF_CURRENT_RATE } from "@/lib/ppf";
import { ProjectionTable } from "./ProjectionTable";
import { cn } from "@/lib/cn";

const PPFCharts = dynamic(() => import("./PPFCharts").then((m) => ({ default: m.PPFCharts })), {
  ssr: false,
  loading: () => (
    <div className="flex h-44 items-center justify-center rounded-xl border border-gray-200 bg-white">
      <p className="text-sm text-gray-400">Loading chart…</p>
    </div>
  ),
});

const DEFAULT_CONTRIBUTION = "150000";
const DEFAULT_YEARS = "15";
const DEFAULT_RATE = String(PPF_CURRENT_RATE);
const DEFAULT_OPENING = "";

export function PPFCalculator() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [contribution, setContribution] = useState(
    searchParams.get("contribution") ?? DEFAULT_CONTRIBUTION
  );
  const [years, setYears] = useState(searchParams.get("years") ?? DEFAULT_YEARS);
  const [rate, setRate] = useState(searchParams.get("rate") ?? DEFAULT_RATE);
  const [opening, setOpening] = useState(searchParams.get("opening") ?? DEFAULT_OPENING);
  const [resultCopied, setResultCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const numContribution = parseFloat(contribution);
  const numYears = parseInt(years, 10);
  const numRate = parseFloat(rate);
  // Opening balance is optional — an empty field is a valid 0.
  const numOpening = opening.trim() === "" ? 0 : parseFloat(opening);

  const errors = useMemo(
    () => validatePPFInputs(numContribution, numYears, numRate, numOpening),
    [numContribution, numYears, numRate, numOpening]
  );

  const isValid = Object.keys(errors).length === 0;

  const result = useMemo(() => {
    if (!isValid) return null;
    return calculatePPF({
      yearlyContribution: numContribution,
      years: numYears,
      annualRate: numRate,
      openingBalance: numOpening,
    });
  }, [isValid, numContribution, numYears, numRate, numOpening]);

  const handleReset = useCallback(() => {
    setContribution(DEFAULT_CONTRIBUTION);
    setYears(DEFAULT_YEARS);
    setRate(DEFAULT_RATE);
    setOpening(DEFAULT_OPENING);
  }, []);

  const handleCopyResult = useCallback(async () => {
    if (!result) return;
    const { summary } = result;
    const lines = [
      `PPF — Yearly Contribution: ${formatINR(numContribution)}`,
      `Interest Rate: ${numRate}% p.a.  |  Period: ${numYears} years`,
      ...(summary.openingBalance > 0
        ? [`Opening Balance:  ${formatINR(summary.openingBalance)}`]
        : []),
      `Total Contribution: ${formatINR(summary.totalContribution)}`,
      `Total Interest:     ${formatINR(summary.totalInterest)}`,
      `Maturity Value:     ${formatINR(summary.maturityValue)}`,
      `Wealth Gain:        ${summary.wealthGainPct.toFixed(2)}%`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setResultCopied(true);
      setTimeout(() => setResultCopied(false), 2000);
    } catch {
      // clipboard API unavailable
    }
  }, [result, numContribution, numRate, numYears]);

  const handleShareUrl = useCallback(async () => {
    const params = new URLSearchParams({ contribution, years, rate });
    if (opening.trim() !== "") params.set("opening", opening);
    const url = `${window.location.origin}${pathname}?${params.toString()}`;
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    try {
      await navigator.clipboard.writeText(url);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    } catch {
      // clipboard API unavailable
    }
  }, [contribution, years, rate, opening, pathname, router]);

  return (
    <div className="flex flex-col gap-8">
      {/* ── Inputs ──────────────────────────────────────────────────────────── */}
      <section aria-label="PPF inputs">
        <div className="grid gap-5 sm:grid-cols-2">
          {/* Yearly Contribution */}
          <div>
            <label
              htmlFor="ppf-contribution"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Yearly Contribution (₹)
            </label>
            <input
              id="ppf-contribution"
              type="number"
              min="500"
              max="150000"
              step="500"
              value={contribution}
              onChange={(e) => setContribution(e.target.value)}
              placeholder="e.g. 150000"
              aria-describedby={
                errors.contribution ? "ppf-contribution-error" : "ppf-contribution-hint"
              }
              aria-invalid={!!errors.contribution}
              className={cn(
                "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm",
                "focus:outline-none focus:ring-2 focus:ring-brand-200",
                errors.contribution
                  ? "border-red-400 focus:border-red-400"
                  : "border-gray-200 focus:border-brand-400"
              )}
            />
            {errors.contribution ? (
              <p id="ppf-contribution-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.contribution}
              </p>
            ) : (
              <p id="ppf-contribution-hint" className="mt-1 text-xs text-gray-400">
                Min ₹500, max ₹1,50,000 per year (PPF Scheme, 2019).
              </p>
            )}
          </div>

          {/* Investment Period */}
          <div>
            <label htmlFor="ppf-years" className="mb-1.5 block text-sm font-medium text-gray-700">
              Investment Period (years)
            </label>
            <input
              id="ppf-years"
              type="number"
              min="15"
              max="50"
              step="1"
              value={years}
              onChange={(e) => setYears(e.target.value)}
              placeholder="e.g. 15"
              aria-describedby={errors.years ? "ppf-years-error" : "ppf-years-hint"}
              aria-invalid={!!errors.years}
              className={cn(
                "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm",
                "focus:outline-none focus:ring-2 focus:ring-brand-200",
                errors.years
                  ? "border-red-400 focus:border-red-400"
                  : "border-gray-200 focus:border-brand-400"
              )}
            />
            {errors.years ? (
              <p id="ppf-years-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.years}
              </p>
            ) : (
              <p id="ppf-years-hint" className="mt-1 text-xs text-gray-400">
                Matures in 15 years; extendable in 5-year blocks.
              </p>
            )}
          </div>

          {/* Interest Rate */}
          <div>
            <label htmlFor="ppf-rate" className="mb-1.5 block text-sm font-medium text-gray-700">
              Interest Rate (% p.a.)
            </label>
            <input
              id="ppf-rate"
              type="number"
              min="0"
              max="15"
              step="0.1"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="e.g. 7.1"
              aria-describedby={errors.rate ? "ppf-rate-error" : "ppf-rate-hint"}
              aria-invalid={!!errors.rate}
              className={cn(
                "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm",
                "focus:outline-none focus:ring-2 focus:ring-brand-200",
                errors.rate
                  ? "border-red-400 focus:border-red-400"
                  : "border-gray-200 focus:border-brand-400"
              )}
            />
            {errors.rate ? (
              <p id="ppf-rate-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.rate}
              </p>
            ) : (
              <p id="ppf-rate-hint" className="mt-1 text-xs text-gray-400">
                Current PPF rate is {PPF_CURRENT_RATE}% p.a. (Ministry of Finance).
              </p>
            )}
          </div>

          {/* Opening Balance (optional) */}
          <div>
            <label htmlFor="ppf-opening" className="mb-1.5 block text-sm font-medium text-gray-700">
              Opening Balance (₹) <span className="font-normal text-gray-400">— optional</span>
            </label>
            <input
              id="ppf-opening"
              type="number"
              min="0"
              step="1"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              placeholder="0"
              aria-describedby={errors.openingBalance ? "ppf-opening-error" : "ppf-opening-hint"}
              aria-invalid={!!errors.openingBalance}
              className={cn(
                "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm",
                "focus:outline-none focus:ring-2 focus:ring-brand-200",
                errors.openingBalance
                  ? "border-red-400 focus:border-red-400"
                  : "border-gray-200 focus:border-brand-400"
              )}
            />
            {errors.openingBalance ? (
              <p id="ppf-opening-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.openingBalance}
              </p>
            ) : (
              <p id="ppf-opening-hint" className="mt-1 text-xs text-gray-400">
                Existing PPF balance, if continuing or extending an account.
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
        <section aria-labelledby="ppf-results-heading">
          <h2 id="ppf-results-heading" className="mb-4 text-lg font-semibold text-gray-900">
            Results
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <ResultCard
              label="Total Contribution"
              value={formatINR(result.summary.totalContribution)}
            />
            <ResultCard
              label="Total Interest Earned"
              value={formatINR(result.summary.totalInterest)}
              accent
            />
            <ResultCard label="Maturity Value" value={formatINR(result.summary.maturityValue)} />
          </div>

          {/* Wealth gain */}
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm">
            <span className="text-gray-600">
              Wealth Gain:{" "}
              <strong className="font-semibold text-gray-900">
                {result.summary.wealthGainPct.toFixed(2)}%
              </strong>
            </span>
            {result.summary.openingBalance > 0 && (
              <>
                <span className="text-gray-300" aria-hidden="true">
                  |
                </span>
                <span className="text-gray-600">
                  Opening Balance:{" "}
                  <strong className="font-semibold text-gray-900">
                    {formatINR(result.summary.openingBalance)}
                  </strong>
                </span>
              </>
            )}
            <span className="ml-auto text-xs text-gray-400">
              {numYears} years at {numRate}% p.a.
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
      {result && result.summary.totalInterest > 0 && (
        <PPFCharts
          openingBalance={result.summary.openingBalance}
          totalContribution={result.summary.totalContribution}
          totalInterest={result.summary.totalInterest}
          yearlyContribution={numContribution}
          projection={result.projection}
        />
      )}

      {/* ── Year-wise Growth Table ───────────────────────────────────────────── */}
      {result && result.projection.length > 0 && <ProjectionTable rows={result.projection} />}
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
