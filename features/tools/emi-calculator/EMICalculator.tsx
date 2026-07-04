"use client";

import { useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { generateEMISchedule, validateEMIInputs, formatINR } from "@/lib/emi";
import { AmortizationTable } from "./AmortizationTable";
import { cn } from "@/lib/cn";

const EMICharts = dynamic(() => import("./EMICharts").then((m) => ({ default: m.EMICharts })), {
  ssr: false,
  loading: () => (
    <div className="flex h-56 items-center justify-center rounded-xl border border-gray-200 bg-white">
      <p className="text-sm text-gray-400">Loading charts…</p>
    </div>
  ),
});

type TenureUnit = "months" | "years";

export function EMICalculator() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [amount, setAmount] = useState(searchParams.get("amount") ?? "500000");
  const [rate, setRate] = useState(searchParams.get("rate") ?? "8.5");
  const [tenure, setTenure] = useState(searchParams.get("tenure") ?? "24");
  const [tenureUnit, setTenureUnit] = useState<TenureUnit>(
    searchParams.get("unit") === "years" ? "years" : "months"
  );
  const [resultCopied, setResultCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const numAmount = parseFloat(amount) || 0;
  const numRate = parseFloat(rate) || 0;
  const numTenure = parseInt(tenure, 10) || 0;

  const errors = useMemo(
    () => validateEMIInputs(numAmount, numRate, numTenure, tenureUnit),
    [numAmount, numRate, numTenure, tenureUnit]
  );

  const isValid =
    numAmount > 0 && numTenure > 0 && numRate >= 0 && Object.keys(errors).length === 0;

  const months = useMemo(
    () => (tenureUnit === "years" ? numTenure * 12 : numTenure),
    [numTenure, tenureUnit]
  );

  // Single pass: generates both display schedule and summary derived from it.
  // summary is the single source of truth for result cards — not formula outputs.
  const scheduleResult = useMemo(() => {
    if (!isValid) return null;
    return generateEMISchedule({ principal: numAmount, annualRate: numRate, months });
  }, [isValid, numAmount, numRate, months]);

  const schedule = scheduleResult?.displaySchedule ?? [];

  const handleReset = useCallback(() => {
    setAmount("500000");
    setRate("8.5");
    setTenure("24");
    setTenureUnit("months");
  }, []);

  const handleCopyResult = useCallback(async () => {
    if (!scheduleResult) return;
    const { summary } = scheduleResult;
    const text = [
      `Monthly EMI: ${formatINR(summary.monthlyEMI)}`,
      `Total Interest: ${formatINR(summary.totalInterest)}`,
      `Total Payment: ${formatINR(summary.totalPayment)}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setResultCopied(true);
      setTimeout(() => setResultCopied(false), 2000);
    } catch {
      // clipboard API unavailable
    }
  }, [scheduleResult]);

  const handleShareUrl = useCallback(async () => {
    const params = new URLSearchParams({ amount, rate, tenure, unit: tenureUnit });
    const url = `${window.location.origin}${pathname}?${params.toString()}`;
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    try {
      await navigator.clipboard.writeText(url);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    } catch {
      // clipboard API unavailable
    }
  }, [amount, rate, tenure, tenureUnit, pathname, router]);

  return (
    <div className="flex flex-col gap-8">
      {/* ── Inputs ─────────────────────────────────────────────────────────── */}
      <section aria-label="Loan inputs">
        <div className="grid gap-5 sm:grid-cols-2">
          {/* Loan Amount */}
          <div>
            <label htmlFor="emi-amount" className="mb-1.5 block text-sm font-medium text-gray-700">
              Loan Amount (₹)
            </label>
            <input
              id="emi-amount"
              type="number"
              min="1"
              step="1000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 500000"
              aria-describedby={errors.amount ? "emi-amount-error" : undefined}
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
              <p id="emi-amount-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.amount}
              </p>
            )}
          </div>

          {/* Interest Rate */}
          <div>
            <label htmlFor="emi-rate" className="mb-1.5 block text-sm font-medium text-gray-700">
              Interest Rate (% per annum)
            </label>
            <input
              id="emi-rate"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="e.g. 8.5"
              aria-describedby={errors.rate ? "emi-rate-error" : undefined}
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
              <p id="emi-rate-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.rate}
              </p>
            )}
          </div>

          {/* Tenure */}
          <div className="sm:col-span-2">
            <label htmlFor="emi-tenure" className="mb-1.5 block text-sm font-medium text-gray-700">
              Loan Tenure
            </label>
            <div className="flex gap-3">
              <input
                id="emi-tenure"
                type="number"
                min="1"
                step="1"
                value={tenure}
                onChange={(e) => setTenure(e.target.value)}
                placeholder={tenureUnit === "years" ? "e.g. 5" : "e.g. 24"}
                aria-describedby={errors.tenure ? "emi-tenure-error" : undefined}
                aria-invalid={!!errors.tenure}
                className={cn(
                  "flex-1 rounded-lg border bg-white px-3 py-2 text-sm shadow-sm",
                  "focus:outline-none focus:ring-2 focus:ring-brand-200",
                  errors.tenure
                    ? "border-red-400 focus:border-red-400"
                    : "border-gray-200 focus:border-brand-400"
                )}
              />
              <div
                role="group"
                aria-label="Tenure unit"
                className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5"
              >
                {(["months", "years"] as TenureUnit[]).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => setTenureUnit(unit)}
                    aria-pressed={tenureUnit === unit}
                    className={cn(
                      "rounded-md px-4 py-1.5 text-sm font-medium capitalize transition",
                      tenureUnit === unit
                        ? "bg-white text-brand-700 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>
            {errors.tenure && (
              <p id="emi-tenure-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.tenure}
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

      {/* ── Results ────────────────────────────────────────────────────────── */}
      {scheduleResult && (
        <section aria-labelledby="emi-results-heading">
          <h2 id="emi-results-heading" className="mb-4 text-lg font-semibold text-gray-900">
            Results
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <ResultCard
              label="Monthly EMI"
              value={formatINR(scheduleResult.summary.monthlyEMI)}
              accent
            />
            <ResultCard
              label="Total Interest"
              value={formatINR(scheduleResult.summary.totalInterest)}
            />
            <ResultCard
              label="Total Payment"
              value={formatINR(scheduleResult.summary.totalPayment)}
            />
          </div>
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

      {/* ── Charts ─────────────────────────────────────────────────────────── */}
      {scheduleResult && (
        <EMICharts
          principal={numAmount}
          totalInterest={scheduleResult.summary.totalInterest}
          schedule={schedule}
        />
      )}

      {/* ── Amortization Table ─────────────────────────────────────────────── */}
      {schedule.length > 0 && <AmortizationTable rows={schedule} />}
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
