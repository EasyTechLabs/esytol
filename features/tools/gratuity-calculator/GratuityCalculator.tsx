"use client";

import { useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import {
  calculateGratuity,
  validateGratuityInputs,
  resultToCSV,
  downloadCSV,
  formatINR,
} from "@/lib/gratuity";
import { cn } from "@/lib/cn";

const GratuityCharts = dynamic(
  () => import("./GratuityCharts").then((m) => ({ default: m.GratuityCharts })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-44 items-center justify-center rounded-xl border border-gray-200 bg-white">
        <p className="text-sm text-gray-400">Loading charts…</p>
      </div>
    ),
  }
);

const num = (v: string) => (v.trim() === "" ? 0 : parseFloat(v) || 0);

export function GratuityCalculator() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [salary, setSalary] = useState(searchParams.get("salary") ?? "50000");
  const [years, setYears] = useState(searchParams.get("years") ?? "10");
  const [months, setMonths] = useState(searchParams.get("months") ?? "0");
  const [covered, setCovered] = useState(searchParams.get("covered") !== "0");
  const [resultCopied, setResultCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const input = useMemo(
    () => ({
      monthlyBasic: num(salary),
      years: num(years),
      months: num(months),
      coveredUnderAct: covered,
    }),
    [salary, years, months, covered]
  );

  const errors = useMemo(
    () =>
      validateGratuityInputs({
        monthlyBasic: input.monthlyBasic,
        years: input.years,
        months: input.months,
      }),
    [input]
  );
  const isValid = Object.keys(errors).length === 0;
  const result = useMemo(() => (isValid ? calculateGratuity(input) : null), [isValid, input]);

  const handleReset = useCallback(() => {
    setSalary("50000");
    setYears("10");
    setMonths("0");
    setCovered(true);
  }, []);

  const handleDownload = useCallback(() => {
    if (!result) return;
    downloadCSV(resultToCSV(input, result), "gratuity.csv");
  }, [input, result]);

  const handleCopyResult = useCallback(async () => {
    if (!result) return;
    const lines = [
      "Gratuity — Payment of Gratuity Act, 1972",
      `Last drawn salary (Basic + DA): ${formatINR(result.lastDrawnSalary)}`,
      `Service: ${Math.floor(input.years)}y ${Math.min(11, Math.max(0, Math.floor(input.months)))}m`,
      `Covered under the Act: ${result.coveredUnderAct ? "Yes" : "No"}`,
      `Formula: 15 × ${formatINR(result.lastDrawnSalary)} × ${result.eligibleYears} ÷ ${result.divisor}`,
      `Eligible: ${result.isEligible ? "Yes" : "No (needs 5 years)"}`,
      `Gratuity Amount: ${formatINR(result.gratuityAmount)}`,
      `Tax-Exempt: ${formatINR(result.taxExemptAmount)} | Taxable: ${formatINR(result.taxableAmount)}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setResultCopied(true);
      setTimeout(() => setResultCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }, [result, input]);

  const handleShareUrl = useCallback(async () => {
    const params = new URLSearchParams({
      salary,
      years,
      months,
      covered: covered ? "1" : "0",
    });
    const url = `${window.location.origin}${pathname}?${params.toString()}`;
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    try {
      await navigator.clipboard.writeText(url);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }, [salary, years, months, covered, pathname, router]);

  return (
    <div className="flex flex-col gap-8">
      {/* ── Inputs ──────────────────────────────────────────────────────────── */}
      <section aria-label="Gratuity inputs">
        <div className="mb-2 flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-gray-700">Coverage</p>
          <span className="text-xs text-gray-400">Payment of Gratuity Act, 1972</span>
        </div>
        <div
          role="group"
          aria-label="Covered under the Gratuity Act"
          className="mb-6 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5"
        >
          {(
            [
              { value: true, label: "Covered", sub: "÷26" },
              { value: false, label: "Not Covered", sub: "÷30" },
            ] as const
          ).map(({ value, label, sub }) => (
            <button
              key={label}
              type="button"
              onClick={() => setCovered(value)}
              aria-pressed={covered === value}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition",
                covered === value
                  ? "bg-white text-brand-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {label}
              <span
                className={cn(
                  "ml-1 text-xs",
                  covered === value ? "text-brand-400" : "text-gray-400"
                )}
              >
                ({sub})
              </span>
            </button>
          ))}
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            id="grat-salary"
            label="Monthly Basic + DA (₹)"
            hint="Last drawn salary"
            value={salary}
            onChange={setSalary}
            placeholder="e.g. 50000"
            error={errors.monthlyBasic}
          />
          <Field
            id="grat-years"
            label="Years of Service"
            hint="Completed years"
            value={years}
            onChange={setYears}
            placeholder="e.g. 10"
            error={errors.years}
          />
          <Field
            id="grat-months"
            label="Months of Service"
            hint="0–11 additional months"
            value={months}
            onChange={setMonths}
            placeholder="e.g. 0"
            error={errors.months}
          />
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
        <section aria-labelledby="grat-results-heading">
          <h2 id="grat-results-heading" className="mb-4 text-lg font-semibold text-gray-900">
            Your Gratuity
          </h2>

          {!result.isEligible && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Gratuity generally requires a minimum of <strong>5 years</strong> of continuous
              service. Based on your input ({Math.floor(input.years)}y{" "}
              {Math.min(11, Math.max(0, Math.floor(input.months)))}m) you are not yet eligible, so
              the payable amount is ₹0.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <ResultCard label="Gratuity Amount" value={formatINR(result.gratuityAmount)} accent />
            <ResultCard label="Last Drawn Salary" value={formatINR(result.lastDrawnSalary)} />
            <ResultCard label="Eligible Service" value={`${result.eligibleYears} years`} />
          </div>

          <div className="mt-4 grid gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm sm:grid-cols-2">
            <Insight label="Covered under the Act" value={result.coveredUnderAct ? "Yes" : "No"} />
            <Insight label="Total Service" value={`${result.totalServiceYears} years`} />
            <Insight label="Tax-Exempt Amount" value={formatINR(result.taxExemptAmount)} />
            <Insight label="Taxable Amount" value={formatINR(result.taxableAmount)} />
          </div>

          {/* Step-by-step */}
          <h3 className="mb-3 mt-6 text-sm font-semibold text-gray-700">
            Step-by-step calculation
          </h3>
          <ol className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
            <li>
              <span className="font-medium text-gray-900">1. Formula:</span> Gratuity = (15 × Last
              drawn salary × Years of service) ÷ {result.divisor}{" "}
              <span className="text-gray-400">
                ({result.coveredUnderAct ? "covered — 26 working days" : "not covered — 30 days"})
              </span>
            </li>
            <li>
              <span className="font-medium text-gray-900">2. Years used:</span>{" "}
              {result.eligibleYears} years{" "}
              <span className="text-gray-400">
                (
                {result.coveredUnderAct
                  ? "months over 6 round up to a full year"
                  : "only completed years count"}
                )
              </span>
            </li>
            <li>
              <span className="font-medium text-gray-900">3. Compute:</span> 15 ×{" "}
              {formatINR(result.lastDrawnSalary)} × {result.eligibleYears} ÷ {result.divisor} ={" "}
              {formatINR(result.formulaGratuity)}
            </li>
            <li>
              <span className="font-medium text-gray-900">4. Apply ₹20 lakh cap:</span>{" "}
              {formatINR(result.cappedGratuity)}
              {result.formulaGratuity > result.cap && (
                <span className="text-amber-700"> (cap applied)</span>
              )}
            </li>
            <li>
              <span className="font-medium text-gray-900">5. Eligibility (5 years):</span>{" "}
              {result.isEligible ? (
                <>
                  eligible → payable <strong>{formatINR(result.gratuityAmount)}</strong>
                </>
              ) : (
                <>not eligible → payable ₹0</>
              )}
            </li>
          </ol>

          {/* Taxability */}
          <div className="text-brand-800 mt-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm">
            <p className="mb-1 font-semibold">Taxability</p>
            <p>
              Gratuity is exempt up to <strong>₹20,00,000</strong> under Section 10(10) for
              non-government employees (the exemption is the least of ₹20 lakh, the actual gratuity,
              and the formula amount). Government employees receive fully tax-free gratuity. Any
              amount above the exemption is taxable as salary income. Verify your specific case with
              a tax professional.
            </p>
          </div>

          {/* Actions */}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              Download CSV
            </button>
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
      {result && <GratuityCharts input={input} result={result} />}
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        aria-invalid={!!error}
        className={cn(
          "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm",
          "focus:outline-none focus:ring-2 focus:ring-brand-200",
          error ? "border-red-400 focus:border-red-400" : "border-gray-200 focus:border-brand-400"
        )}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-gray-400">
          {hint}
        </p>
      ) : null}
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

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-600">{label}</span>
      <strong className="font-semibold tabular-nums text-gray-900">{value}</strong>
    </div>
  );
}
