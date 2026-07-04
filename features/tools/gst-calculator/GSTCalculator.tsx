"use client";

import { useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { calculateGST, validateGSTInputs, formatINR, GST_RATES, type GSTMode } from "@/lib/gst";
import { cn } from "@/lib/cn";

const GSTCharts = dynamic(() => import("./GSTCharts").then((m) => ({ default: m.GSTCharts })), {
  ssr: false,
  loading: () => (
    <div className="flex h-44 items-center justify-center rounded-xl border border-gray-200 bg-white">
      <p className="text-sm text-gray-400">Loading chart…</p>
    </div>
  ),
});

export function GSTCalculator() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Restore rate selection from URL: if the URL rate is not a standard slab,
  // start in custom-rate mode with that rate pre-filled.
  const urlRate = searchParams.get("rate") ?? "18";
  const urlRateNum = parseFloat(urlRate);
  const urlRateIsStandard = (GST_RATES as readonly number[]).includes(urlRateNum);

  const [amount, setAmount] = useState(searchParams.get("amount") ?? "1000");
  const [mode, setMode] = useState<GSTMode>(
    searchParams.get("mode") === "inclusive" ? "inclusive" : "exclusive"
  );
  const [selectedRate, setSelectedRate] = useState(urlRateIsStandard ? urlRateNum : 18);
  const [customRateStr, setCustomRateStr] = useState(!urlRateIsStandard ? urlRate : "");
  const [isCustomRate, setIsCustomRate] = useState(!urlRateIsStandard);
  const [resultCopied, setResultCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const numAmount = parseFloat(amount) || 0;
  const numRate = isCustomRate ? parseFloat(customRateStr) : selectedRate;

  const errors = useMemo(() => validateGSTInputs(numAmount, numRate), [numAmount, numRate]);

  const isValid =
    numAmount > 0 && !isNaN(numRate) && numRate >= 0 && Object.keys(errors).length === 0;

  // Single-pass calculation. result is the single source of truth for all displayed values.
  const result = useMemo(() => {
    if (!isValid) return null;
    return calculateGST({ amount: numAmount, rate: numRate, mode });
  }, [isValid, numAmount, numRate, mode]);

  const handleModeChange = useCallback((newMode: GSTMode) => {
    setMode(newMode);
  }, []);

  const handleRateSelect = useCallback((rate: number) => {
    setSelectedRate(rate);
    setIsCustomRate(false);
    setCustomRateStr("");
  }, []);

  const handleCustomToggle = useCallback(() => {
    setIsCustomRate(true);
  }, []);

  const handleReset = useCallback(() => {
    setAmount("1000");
    setMode("exclusive");
    setSelectedRate(18);
    setCustomRateStr("");
    setIsCustomRate(false);
  }, []);

  const handleCopyResult = useCallback(async () => {
    if (!result) return;
    const halfRate = numRate / 2;
    const text = [
      `Mode: ${mode === "exclusive" ? "GST Exclusive (Add GST)" : "GST Inclusive (Remove GST)"}`,
      `GST Rate: ${numRate}%`,
      `Original Amount: ${formatINR(result.originalAmount)}`,
      `GST Amount (${numRate}%): ${formatINR(result.gstAmount)}`,
      `Total Amount: ${formatINR(result.totalAmount)}`,
      `  CGST @ ${halfRate}%: ${formatINR(result.cgst)}`,
      `  SGST @ ${halfRate}%: ${formatINR(result.sgst)}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setResultCopied(true);
      setTimeout(() => setResultCopied(false), 2000);
    } catch {
      // clipboard API unavailable
    }
  }, [result, numRate, mode]);

  const handleShareUrl = useCallback(async () => {
    const params = new URLSearchParams({ amount, rate: String(numRate), mode });
    const url = `${window.location.origin}${pathname}?${params.toString()}`;
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    try {
      await navigator.clipboard.writeText(url);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    } catch {
      // clipboard API unavailable
    }
  }, [amount, numRate, mode, pathname, router]);

  const amountLabel = mode === "exclusive" ? "Base Amount (before GST)" : "Amount (includes GST)";

  return (
    <div className="flex flex-col gap-8">
      {/* ── Inputs ──────────────────────────────────────────────────────────── */}
      <section aria-label="GST inputs">
        {/* Mode toggle */}
        <div className="mb-6">
          <p className="mb-2 text-sm font-medium text-gray-700">Calculation Mode</p>
          <div
            role="group"
            aria-label="Calculation mode"
            className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5"
          >
            {(
              [
                { value: "exclusive" as GSTMode, label: "Add GST", sub: "price + tax" },
                { value: "inclusive" as GSTMode, label: "Remove GST", sub: "price incl. tax" },
              ] as const
            ).map(({ value, label, sub }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleModeChange(value)}
                aria-pressed={mode === value}
                className={cn(
                  "rounded-md px-4 py-2 text-sm font-medium transition",
                  mode === value
                    ? "bg-white text-brand-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {label}
                <span
                  className={cn(
                    "ml-1 text-xs",
                    mode === value ? "text-brand-400" : "text-gray-400"
                  )}
                >
                  ({sub})
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Amount */}
          <div>
            <label htmlFor="gst-amount" className="mb-1.5 block text-sm font-medium text-gray-700">
              {amountLabel} (₹)
            </label>
            <input
              id="gst-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 1000"
              aria-describedby={errors.amount ? "gst-amount-error" : undefined}
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
              <p id="gst-amount-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.amount}
              </p>
            )}
          </div>

          {/* GST Rate */}
          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-700">GST Rate</p>
            <div className="flex flex-wrap gap-2">
              {GST_RATES.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => handleRateSelect(rate)}
                  aria-pressed={!isCustomRate && selectedRate === rate}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm font-medium transition",
                    !isCustomRate && selectedRate === rate
                      ? "border-brand-400 bg-brand-50 text-brand-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-600"
                  )}
                >
                  {rate}%
                </button>
              ))}
              <button
                type="button"
                onClick={handleCustomToggle}
                aria-pressed={isCustomRate}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-medium transition",
                  isCustomRate
                    ? "border-brand-400 bg-brand-50 text-brand-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-600"
                )}
              >
                Custom
              </button>
            </div>

            {isCustomRate && (
              <div className="mt-2">
                <label htmlFor="gst-custom-rate" className="sr-only">
                  Custom GST rate (%)
                </label>
                <input
                  id="gst-custom-rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={customRateStr}
                  onChange={(e) => setCustomRateStr(e.target.value)}
                  placeholder="Enter rate, e.g. 7.5"
                  aria-describedby={errors.rate ? "gst-rate-error" : undefined}
                  aria-invalid={!!errors.rate}
                  className={cn(
                    "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm",
                    "focus:outline-none focus:ring-2 focus:ring-brand-200",
                    errors.rate
                      ? "border-red-400 focus:border-red-400"
                      : "border-gray-200 focus:border-brand-400"
                  )}
                />
              </div>
            )}
            {errors.rate && (
              <p id="gst-rate-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.rate}
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
        <section aria-labelledby="gst-results-heading">
          <h2 id="gst-results-heading" className="mb-4 text-lg font-semibold text-gray-900">
            Results
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <ResultCard
              label="Original Amount"
              value={formatINR(result.originalAmount)}
              accent={mode === "inclusive"}
            />
            <ResultCard
              label={`GST Amount (${numRate}%)`}
              value={formatINR(result.gstAmount)}
              accent={mode === "exclusive"}
            />
            <ResultCard label="Total Amount" value={formatINR(result.totalAmount)} />
          </div>

          {/* CGST / SGST / IGST breakdown */}
          <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Tax Components
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="text-gray-700">
                CGST ({numRate / 2}%):{" "}
                <strong className="font-semibold text-gray-900">{formatINR(result.cgst)}</strong>
              </span>
              <span className="text-gray-300" aria-hidden="true">
                +
              </span>
              <span className="text-gray-700">
                SGST ({numRate / 2}%):{" "}
                <strong className="font-semibold text-gray-900">{formatINR(result.sgst)}</strong>
              </span>
              <span className="text-gray-300" aria-hidden="true">
                =
              </span>
              <span className="text-gray-700">
                IGST ({numRate}%):{" "}
                <strong className="font-semibold text-gray-900">{formatINR(result.igst)}</strong>
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              CGST + SGST applies for intra-state supplies. IGST applies for inter-state supplies.
            </p>
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

      {/* ── Chart ───────────────────────────────────────────────────────────── */}
      {result && result.gstAmount > 0 && (
        <GSTCharts
          originalAmount={result.originalAmount}
          gstAmount={result.gstAmount}
          cgst={result.cgst}
          sgst={result.sgst}
          rate={numRate}
        />
      )}

      {/* ── Step-by-step Breakdown ───────────────────────────────────────────── */}
      {result && (
        <section aria-labelledby="gst-breakdown-heading">
          <h2 id="gst-breakdown-heading" className="mb-3 text-lg font-semibold text-gray-900">
            Calculation Breakdown
          </h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm" aria-label="Step-by-step GST calculation">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400"
                  >
                    Description
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400"
                  >
                    Formula
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400"
                  >
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {result.steps.map((step, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 font-medium text-gray-700">{step.label}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{step.formula}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-900">
                      {formatINR(step.result)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            {mode === "exclusive"
              ? `${formatINR(result.originalAmount)} + ${numRate}% GST = ${formatINR(result.totalAmount)} (inclusive of GST)`
              : `${formatINR(result.totalAmount)} inclusive @ ${numRate}% GST = ${formatINR(result.originalAmount)} (original price)`}
          </p>
        </section>
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
      <p className={cn("mt-1 text-2xl font-bold", accent ? "text-brand-700" : "text-gray-900")}>
        {value}
      </p>
    </div>
  );
}
