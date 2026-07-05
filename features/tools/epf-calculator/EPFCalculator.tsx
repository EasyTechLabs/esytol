"use client";

import { useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import {
  calculateEPF,
  validateEPFInputs,
  resultToCSV,
  downloadCSV,
  formatINR,
  DEFAULT_EPF_RATE,
  DEFAULT_RETIREMENT_AGE,
} from "@/lib/epf";
import { cn } from "@/lib/cn";

const EPFCharts = dynamic(() => import("./EPFCharts").then((m) => ({ default: m.EPFCharts })), {
  ssr: false,
  loading: () => (
    <div className="flex h-44 items-center justify-center rounded-xl border border-gray-200 bg-white">
      <p className="text-sm text-gray-400">Loading charts…</p>
    </div>
  ),
});

const num = (v: string) => (v.trim() === "" ? 0 : parseFloat(v) || 0);

export function EPFCalculator() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [wages, setWages] = useState(searchParams.get("wages") ?? "25000");
  const [age, setAge] = useState(searchParams.get("age") ?? "30");
  const [retireAge, setRetireAge] = useState(
    searchParams.get("retire") ?? String(DEFAULT_RETIREMENT_AGE)
  );
  const [balance, setBalance] = useState(searchParams.get("balance") ?? "0");
  const [increment, setIncrement] = useState(searchParams.get("inc") ?? "5");
  const [rate, setRate] = useState(searchParams.get("rate") ?? String(DEFAULT_EPF_RATE));
  const [resultCopied, setResultCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const input = useMemo(
    () => ({
      monthlyWages: num(wages),
      currentAge: num(age),
      retirementAge: num(retireAge),
      currentBalance: num(balance),
      annualIncrement: num(increment),
      interestRate: num(rate),
    }),
    [wages, age, retireAge, balance, increment, rate]
  );

  const errors = useMemo(() => validateEPFInputs(input), [input]);
  const isValid = Object.keys(errors).length === 0;
  const result = useMemo(() => (isValid ? calculateEPF(input) : null), [isValid, input]);

  const handleReset = useCallback(() => {
    setWages("25000");
    setAge("30");
    setRetireAge(String(DEFAULT_RETIREMENT_AGE));
    setBalance("0");
    setIncrement("5");
    setRate(String(DEFAULT_EPF_RATE));
  }, []);

  const handleDownload = useCallback(() => {
    if (!result) return;
    downloadCSV(resultToCSV(result), "epf-projection.csv");
  }, [result]);

  const handleCopyResult = useCallback(async () => {
    if (!result) return;
    const lines = [
      "EPF Projection",
      `Monthly to EPF: ${formatINR(result.monthlyTotalToEPF)} (employee ${formatINR(result.monthlyEmployee)} + employer ${formatINR(result.monthlyEmployerEPF)})`,
      `Monthly EPS (pension): ${formatINR(result.monthlyEPS)}`,
      `Years to retirement: ${result.years}`,
      `Maturity Balance: ${formatINR(result.maturityBalance)}`,
      `Total Employee Contribution: ${formatINR(result.totalEmployeeContribution)}`,
      `Total Employer EPF Contribution: ${formatINR(result.totalEmployerContribution)}`,
      `Total Interest Earned: ${formatINR(result.totalInterest)}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setResultCopied(true);
      setTimeout(() => setResultCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }, [result]);

  const handleShareUrl = useCallback(async () => {
    const params = new URLSearchParams({
      wages,
      age,
      retire: retireAge,
      balance,
      inc: increment,
      rate,
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
  }, [wages, age, retireAge, balance, increment, rate, pathname, router]);

  return (
    <div className="flex flex-col gap-8">
      {/* ── Inputs ──────────────────────────────────────────────────────────── */}
      <section aria-label="EPF inputs">
        <div className="mb-2 flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-gray-700">Your Details</p>
          <span className="text-xs text-gray-400">Employee & employer both contribute 12%</span>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            id="epf-wages"
            label="Monthly Basic + DA (₹)"
            hint="Wages for PF"
            value={wages}
            onChange={setWages}
            placeholder="e.g. 25000"
            error={errors.monthlyWages}
          />
          <Field
            id="epf-age"
            label="Current Age (years)"
            value={age}
            onChange={setAge}
            placeholder="e.g. 30"
            error={errors.currentAge}
          />
          <Field
            id="epf-retire"
            label="Retirement Age (years)"
            hint="Usually 58"
            value={retireAge}
            onChange={setRetireAge}
            placeholder="e.g. 58"
            error={errors.retirementAge}
          />
          <Field
            id="epf-balance"
            label="Current EPF Balance (₹)"
            hint="Optional"
            value={balance}
            onChange={setBalance}
            placeholder="e.g. 0"
            error={errors.currentBalance}
          />
          <Field
            id="epf-inc"
            label="Annual Salary Increase (%)"
            value={increment}
            onChange={setIncrement}
            placeholder="e.g. 5"
            error={errors.annualIncrement}
          />
          <Field
            id="epf-rate"
            label="EPF Interest Rate (%)"
            hint="EPFO rate (8.25%)"
            value={rate}
            onChange={setRate}
            placeholder="e.g. 8.25"
            error={errors.interestRate}
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
        <section aria-labelledby="epf-results-heading">
          <h2 id="epf-results-heading" className="mb-4 text-lg font-semibold text-gray-900">
            EPF at Age {input.retirementAge}
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <ResultCard label="Maturity Balance" value={formatINR(result.maturityBalance)} accent />
            <ResultCard label="Total Interest Earned" value={formatINR(result.totalInterest)} />
            <ResultCard label="Total Contribution" value={formatINR(result.totalContribution)} />
          </div>

          <div className="mt-4 grid gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm sm:grid-cols-2">
            <Insight
              label="Monthly Contribution to EPF"
              value={formatINR(result.monthlyTotalToEPF)}
            />
            <Insight label="Monthly EPS (Pension)" value={formatINR(result.monthlyEPS)} />
            <Insight
              label="Employee Contribution (12%)"
              value={formatINR(result.monthlyEmployee)}
            />
            <Insight
              label="Employer EPF Contribution"
              value={formatINR(result.monthlyEmployerEPF)}
            />
            <Insight
              label="Total Employee Contribution"
              value={formatINR(result.totalEmployeeContribution)}
            />
            <Insight
              label="Total Employer EPF Contribution"
              value={formatINR(result.totalEmployerContribution)}
            />
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
      {result && <EPFCharts result={result} currentBalance={input.currentBalance} />}

      {/* ── Year-wise projection ────────────────────────────────────────────── */}
      {result && result.yearWise.length > 0 && (
        <section aria-labelledby="epf-schedule-heading">
          <h2 id="epf-schedule-heading" className="mb-3 text-lg font-semibold text-gray-900">
            Year-wise Projection
          </h2>
          <div className="max-h-96 overflow-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full text-sm" aria-label="Year-wise EPF projection">
              <thead className="sticky top-0">
                <tr className="border-b border-gray-200 bg-gray-50">
                  {["Year", "Age", "Opening", "Employee", "Employer", "Interest", "Closing"].map(
                    (c) => (
                      <th
                        key={c}
                        scope="col"
                        className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                      >
                        {c}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {result.yearWise.map((r) => (
                  <tr key={r.year} className="hover:bg-gray-50">
                    <td className="px-3 py-2 tabular-nums text-gray-500">{r.year}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-600">{r.age}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-700">
                      {formatINR(r.openingBalance)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-gray-700">
                      {formatINR(r.employeeContribution)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-gray-700">
                      {formatINR(r.employerContribution)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-emerald-700">
                      {formatINR(r.interest)}
                    </td>
                    <td className="px-3 py-2 font-medium tabular-nums text-brand-700">
                      {formatINR(r.closingBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
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
