"use client";

import { CalculationSync } from "@/features/tool/CalculationSync";
import type { FinanceEvent } from "@/lib/financeEvents";

import { useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { calculateHomeLoan, validateHomeLoanInputs, formatINR } from "@/lib/homeLoan";
import { AmortizationTable } from "./AmortizationTable";
import { cn } from "@/lib/cn";

const HomeLoanCharts = dynamic(
  () => import("./HomeLoanCharts").then((m) => ({ default: m.HomeLoanCharts })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-44 items-center justify-center rounded-xl border border-gray-200 bg-white">
        <p className="text-sm text-gray-400">Loading chart…</p>
      </div>
    ),
  }
);

type TenureUnit = "years" | "months";

const DEFAULT_AMOUNT = "5000000";
const DEFAULT_RATE = "8.5";
const DEFAULT_TENURE = "20";
const DEFAULT_UNIT: TenureUnit = "years";
const DEFAULT_FEE = "0.5";
const DEFAULT_DOWN = "";

export function HomeLoanCalculator() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [amount, setAmount] = useState(searchParams.get("amount") ?? DEFAULT_AMOUNT);
  const [rate, setRate] = useState(searchParams.get("rate") ?? DEFAULT_RATE);
  const [tenure, setTenure] = useState(searchParams.get("tenure") ?? DEFAULT_TENURE);
  const [unit, setUnit] = useState<TenureUnit>(
    searchParams.get("unit") === "months" ? "months" : DEFAULT_UNIT
  );
  const [fee, setFee] = useState(searchParams.get("fee") ?? DEFAULT_FEE);
  const [down, setDown] = useState(searchParams.get("down") ?? DEFAULT_DOWN);
  const [resultCopied, setResultCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const numAmount = parseFloat(amount);
  const numRate = parseFloat(rate);
  const numTenure = parseInt(tenure, 10);
  const months = unit === "years" ? numTenure * 12 : numTenure;
  // Fee and down payment are optional — an empty field is a valid 0.
  const numFee = fee.trim() === "" ? 0 : parseFloat(fee);
  const numDown = down.trim() === "" ? 0 : parseFloat(down);

  const errors = useMemo(
    () => validateHomeLoanInputs(numAmount, numRate, numTenure, unit, numFee, numDown),
    [numAmount, numRate, numTenure, unit, numFee, numDown]
  );

  const isValid = Object.keys(errors).length === 0;

  const result = useMemo(() => {
    if (!isValid) return null;
    return calculateHomeLoan({
      loanAmount: numAmount,
      annualRate: numRate,
      months,
      processingFeePct: numFee,
      downPayment: numDown,
    });
  }, [isValid, numAmount, numRate, months, numFee, numDown]);

  const financeEvent = useMemo<FinanceEvent | null>(() => {
    if (!result) return null;
    return {
      type: "LoanCalculated",
      slug: "home-loan-calculator",
      name: "Home Loan Calculator",
      emi: result.summary.monthlyEMI,
      principal: result.summary.loanAmount,
      annualRate: numRate,
      months,
    };
  }, [result, numRate, months]);

  const handleReset = useCallback(() => {
    setAmount(DEFAULT_AMOUNT);
    setRate(DEFAULT_RATE);
    setTenure(DEFAULT_TENURE);
    setUnit(DEFAULT_UNIT);
    setFee(DEFAULT_FEE);
    setDown(DEFAULT_DOWN);
  }, []);

  const handleCopyResult = useCallback(async () => {
    if (!result) return;
    const { summary } = result;
    const lines = [
      `Home Loan — Loan Amount: ${formatINR(summary.loanAmount)}`,
      `Interest Rate: ${numRate}% p.a.  |  Tenure: ${summary.totalYears} years`,
      `Monthly EMI:        ${formatINR(summary.monthlyEMI)}`,
      `Total Interest:     ${formatINR(summary.totalInterest)}`,
      `Total Payment:      ${formatINR(summary.totalPayment)}`,
      `Processing Fee:     ${formatINR(summary.processingFee)}`,
      `Down Payment:       ${formatINR(summary.downPayment)}`,
      `Total Initial Cost: ${formatINR(summary.totalInitialCost)}`,
      `LTV:                ${summary.ltv.toFixed(2)}%`,
      `Effective Cost:     ${summary.effectiveCostPct.toFixed(2)}% of principal`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setResultCopied(true);
      setTimeout(() => setResultCopied(false), 2000);
    } catch {
      // clipboard API unavailable
    }
  }, [result, numRate]);

  const handleShareUrl = useCallback(async () => {
    const params = new URLSearchParams({ amount, rate, tenure, unit });
    if (fee.trim() !== "") params.set("fee", fee);
    if (down.trim() !== "") params.set("down", down);
    const url = `${window.location.origin}${pathname}?${params.toString()}`;
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    try {
      await navigator.clipboard.writeText(url);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    } catch {
      // clipboard API unavailable
    }
  }, [amount, rate, tenure, unit, fee, down, pathname, router]);

  return (
    <div className="flex flex-col gap-8">
      {/* ── Inputs ──────────────────────────────────────────────────────────── */}
      <section aria-label="Home loan inputs">
        <div className="grid gap-5 sm:grid-cols-2">
          {/* Loan Amount */}
          <div>
            <label htmlFor="hl-amount" className="mb-1.5 block text-sm font-medium text-gray-700">
              Loan Amount (₹)
            </label>
            <input
              id="hl-amount"
              type="number"
              min="1"
              step="1000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 5000000"
              aria-describedby={errors.amount ? "hl-amount-error" : undefined}
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
              <p id="hl-amount-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.amount}
              </p>
            )}
          </div>

          {/* Interest Rate */}
          <div>
            <label htmlFor="hl-rate" className="mb-1.5 block text-sm font-medium text-gray-700">
              Interest Rate (% p.a.)
            </label>
            <input
              id="hl-rate"
              type="number"
              min="0"
              max="100"
              step="0.05"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="e.g. 8.5"
              aria-describedby={errors.rate ? "hl-rate-error" : undefined}
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
              <p id="hl-rate-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.rate}
              </p>
            )}
          </div>

          {/* Tenure */}
          <div>
            <label htmlFor="hl-tenure" className="mb-1.5 block text-sm font-medium text-gray-700">
              Loan Tenure
            </label>
            <div className="flex gap-2">
              <input
                id="hl-tenure"
                type="number"
                min="1"
                step="1"
                value={tenure}
                onChange={(e) => setTenure(e.target.value)}
                placeholder={unit === "years" ? "e.g. 20" : "e.g. 240"}
                aria-describedby={errors.tenure ? "hl-tenure-error" : undefined}
                aria-invalid={!!errors.tenure}
                className={cn(
                  "min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-sm shadow-sm",
                  "focus:outline-none focus:ring-2 focus:ring-brand-200",
                  errors.tenure
                    ? "border-red-400 focus:border-red-400"
                    : "border-gray-200 focus:border-brand-400"
                )}
              />
              <div
                role="group"
                aria-label="Tenure unit"
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
            {errors.tenure && (
              <p id="hl-tenure-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.tenure}
              </p>
            )}
          </div>

          {/* Processing Fee & Down Payment */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="hl-fee" className="mb-1.5 block text-sm font-medium text-gray-700">
                Processing Fee (%) <span className="font-normal text-gray-400">— opt.</span>
              </label>
              <input
                id="hl-fee"
                type="number"
                min="0"
                max="5"
                step="0.05"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="0"
                aria-describedby={errors.fee ? "hl-fee-error" : undefined}
                aria-invalid={!!errors.fee}
                className={cn(
                  "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm",
                  "focus:outline-none focus:ring-2 focus:ring-brand-200",
                  errors.fee
                    ? "border-red-400 focus:border-red-400"
                    : "border-gray-200 focus:border-brand-400"
                )}
              />
              {errors.fee && (
                <p id="hl-fee-error" role="alert" className="mt-1 text-xs text-red-600">
                  {errors.fee}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="hl-down" className="mb-1.5 block text-sm font-medium text-gray-700">
                Down Payment (₹) <span className="font-normal text-gray-400">— opt.</span>
              </label>
              <input
                id="hl-down"
                type="number"
                min="0"
                step="1000"
                value={down}
                onChange={(e) => setDown(e.target.value)}
                placeholder="0"
                aria-describedby={errors.downPayment ? "hl-down-error" : undefined}
                aria-invalid={!!errors.downPayment}
                className={cn(
                  "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm",
                  "focus:outline-none focus:ring-2 focus:ring-brand-200",
                  errors.downPayment
                    ? "border-red-400 focus:border-red-400"
                    : "border-gray-200 focus:border-brand-400"
                )}
              />
              {errors.downPayment && (
                <p id="hl-down-error" role="alert" className="mt-1 text-xs text-red-600">
                  {errors.downPayment}
                </p>
              )}
            </div>
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
        <section aria-labelledby="hl-results-heading">
          <h2 id="hl-results-heading" className="mb-4 text-lg font-semibold text-gray-900">
            Results
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <ResultCard label="Monthly EMI" value={formatINR(result.summary.monthlyEMI)} accent />
            <ResultCard label="Total Interest" value={formatINR(result.summary.totalInterest)} />
            <ResultCard label="Total Payment" value={formatINR(result.summary.totalPayment)} />
          </div>

          {/* Cost breakdown */}
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <ResultCard label="Principal" value={formatINR(result.summary.loanAmount)} muted />
            <ResultCard
              label="Processing Fee"
              value={formatINR(result.summary.processingFee)}
              muted
            />
            <ResultCard
              label="Total Initial Cost"
              value={formatINR(result.summary.totalInitialCost)}
              muted
            />
          </div>

          {/* Insights */}
          <div className="mt-4 grid gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm sm:grid-cols-2">
            <Insight label="Loan-to-Value (LTV)" value={`${result.summary.ltv.toFixed(2)}%`} />
            <Insight
              label="Interest as % of Principal"
              value={`${result.summary.interestToPrincipalPct.toFixed(2)}%`}
            />
            <Insight
              label="Effective Cost of Borrowing"
              value={`${result.summary.effectiveCostPct.toFixed(2)}% of principal`}
            />
            <Insight
              label="Total Years"
              value={`${result.summary.totalYears} year${result.summary.totalYears !== 1 ? "s" : ""}`}
            />
          </div>

          {result.summary.downPayment > 0 && (
            <p className="mt-2 text-xs text-gray-400">
              Property value = loan {formatINR(result.summary.loanAmount)} + down payment{" "}
              {formatINR(result.summary.downPayment)} = {formatINR(result.summary.propertyValue)}.
            </p>
          )}

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
      {result && result.schedule.length > 0 && (
        <HomeLoanCharts
          loanAmount={result.summary.loanAmount}
          totalInterest={result.summary.totalInterest}
          schedule={result.schedule}
        />
      )}

      {/* ── Amortization Schedule ────────────────────────────────────────────── */}
      {result && result.schedule.length > 0 && (
        <AmortizationTable rows={result.schedule} loanAmount={result.summary.loanAmount} />
      )}
    </div>
  );
}

function ResultCard({
  label,
  value,
  accent = false,
  muted = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
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
          "mt-1 font-bold tabular-nums",
          muted ? "text-lg text-gray-700" : "text-2xl",
          accent ? "text-brand-700" : muted ? "" : "text-gray-900"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-600">{label}</span>
      <strong className="font-semibold tabular-nums text-gray-900">{value}</strong>
    </div>
  );
}
