"use client";

import { useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import {
  calculateIncomeTax,
  validateIncomeTaxInputs,
  resultToCSV,
  downloadCSV,
  formatINR,
  STANDARD_DEDUCTION,
  CURRENT_FY,
  CURRENT_AY,
  type TaxRegime,
} from "@/lib/incomeTax";
import { cn } from "@/lib/cn";

const IncomeTaxCharts = dynamic(
  () => import("./IncomeTaxCharts").then((m) => ({ default: m.IncomeTaxCharts })),
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

export function IncomeTaxCalculator() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [regime, setRegime] = useState<TaxRegime>(
    searchParams.get("regime") === "old" ? "old" : "new"
  );
  const [salary, setSalary] = useState(searchParams.get("salary") ?? "1200000");
  const [otherIncome, setOtherIncome] = useState(searchParams.get("other") ?? "0");
  const [s80c, setS80c] = useState(searchParams.get("s80c") ?? "150000");
  const [s80d, setS80d] = useState(searchParams.get("s80d") ?? "25000");
  const [hra, setHra] = useState(searchParams.get("hra") ?? "0");
  const [homeLoan, setHomeLoan] = useState(searchParams.get("homeloan") ?? "0");
  const [profTax, setProfTax] = useState(searchParams.get("ptax") ?? "2500");
  const [otherDed, setOtherDed] = useState(searchParams.get("otherded") ?? "0");
  const [resultCopied, setResultCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const input = useMemo(
    () => ({
      annualSalary: num(salary),
      otherIncome: num(otherIncome),
      section80C: num(s80c),
      section80D: num(s80d),
      hraExemption: num(hra),
      homeLoanInterest: num(homeLoan),
      professionalTax: num(profTax),
      otherDeductions: num(otherDed),
    }),
    [salary, otherIncome, s80c, s80d, hra, homeLoan, profTax, otherDed]
  );

  const errors = useMemo(
    () =>
      validateIncomeTaxInputs(
        input.annualSalary,
        input.otherIncome,
        input.section80C +
          input.section80D +
          input.hraExemption +
          input.homeLoanInterest +
          input.professionalTax +
          input.otherDeductions
      ),
    [input]
  );
  const isValid = Object.keys(errors).length === 0;

  const result = useMemo(() => (isValid ? calculateIncomeTax(input) : null), [isValid, input]);
  const selected = result ? result[regime] : null;

  const handleReset = useCallback(() => {
    setRegime("new");
    setSalary("1200000");
    setOtherIncome("0");
    setS80c("150000");
    setS80d("25000");
    setHra("0");
    setHomeLoan("0");
    setProfTax("2500");
    setOtherDed("0");
  }, []);

  const handleDownload = useCallback(() => {
    if (!result) return;
    downloadCSV(resultToCSV(result), "income-tax-comparison.csv");
  }, [result]);

  const handleCopyResult = useCallback(async () => {
    if (!result || !selected) return;
    const lines = [
      `Income Tax — FY ${CURRENT_FY} (AY ${CURRENT_AY})`,
      `Regime: ${regime === "new" ? "New" : "Old"}`,
      `Taxable Income: ${formatINR(selected.taxableIncome)}`,
      `Total Tax: ${formatINR(selected.totalTax)}`,
      `Effective Rate: ${selected.effectiveRate.toFixed(2)}%`,
      `Monthly Tax: ${formatINR(selected.monthlyTax)}`,
      `Old vs New — Old: ${formatINR(result.old.totalTax)}, New: ${formatINR(result.new.totalTax)}`,
      `Recommended: ${result.recommended === "new" ? "New" : "Old"} regime (saves ${formatINR(result.taxSaved)})`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setResultCopied(true);
      setTimeout(() => setResultCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }, [result, selected, regime]);

  const handleShareUrl = useCallback(async () => {
    const params = new URLSearchParams({
      regime,
      salary,
      other: otherIncome,
      s80c,
      s80d,
      hra,
      homeloan: homeLoan,
      ptax: profTax,
      otherded: otherDed,
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
  }, [regime, salary, otherIncome, s80c, s80d, hra, homeLoan, profTax, otherDed, pathname, router]);

  const deductionsDisabled = regime === "new";

  return (
    <div className="flex flex-col gap-8">
      {/* ── Inputs ──────────────────────────────────────────────────────────── */}
      <section aria-label="Income tax inputs">
        <div className="mb-2 flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-gray-700">Tax Regime</p>
          <span className="text-xs text-gray-400">
            FY {CURRENT_FY} · AY {CURRENT_AY}
          </span>
        </div>
        <div
          role="group"
          aria-label="Tax regime"
          className="mb-6 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5"
        >
          {(
            [
              { value: "new" as TaxRegime, label: "New Regime", sub: "default" },
              { value: "old" as TaxRegime, label: "Old Regime", sub: "with deductions" },
            ] as const
          ).map(({ value, label, sub }) => (
            <button
              key={value}
              type="button"
              onClick={() => setRegime(value)}
              aria-pressed={regime === value}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition",
                regime === value
                  ? "bg-white text-brand-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {label}
              <span
                className={cn(
                  "ml-1 text-xs",
                  regime === value ? "text-brand-400" : "text-gray-400"
                )}
              >
                ({sub})
              </span>
            </button>
          ))}
        </div>

        {/* Income */}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="it-salary"
            label="Annual Salary (₹)"
            value={salary}
            onChange={setSalary}
            placeholder="e.g. 1200000"
            error={errors.salary}
          />
          <Field
            id="it-other"
            label="Other Income (₹)"
            value={otherIncome}
            onChange={setOtherIncome}
            placeholder="e.g. 0"
            error={errors.otherIncome}
          />
        </div>

        {/* Deductions */}
        <div className="mt-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-700">Deductions &amp; Exemptions</p>
            <span className="text-xs text-gray-400">
              Standard deduction ({formatINR(STANDARD_DEDUCTION[regime])}) is applied automatically
            </span>
          </div>
          {deductionsDisabled && (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              The New Regime does not allow 80C, 80D, HRA, or home-loan deductions. Enter them
              anyway to compare with the Old Regime.
            </p>
          )}
          <div
            className={cn(
              "grid gap-5 sm:grid-cols-2 lg:grid-cols-3",
              deductionsDisabled && "opacity-70"
            )}
          >
            <Field
              id="it-80c"
              label="Section 80C (₹)"
              hint="Max ₹1,50,000"
              value={s80c}
              onChange={setS80c}
            />
            <Field
              id="it-80d"
              label="Section 80D (₹)"
              hint="Health insurance"
              value={s80d}
              onChange={setS80d}
            />
            <Field
              id="it-hra"
              label="HRA Exemption (₹)"
              hint="Optional"
              value={hra}
              onChange={setHra}
            />
            <Field
              id="it-homeloan"
              label="Home Loan Interest (₹)"
              hint="Max ₹2,00,000 (24b)"
              value={homeLoan}
              onChange={setHomeLoan}
            />
            <Field
              id="it-ptax"
              label="Professional Tax (₹)"
              hint="Max ₹2,500"
              value={profTax}
              onChange={setProfTax}
            />
            <Field
              id="it-otherded"
              label="Other Deductions (₹)"
              hint="80CCD(1B), 80E, 80G…"
              value={otherDed}
              onChange={setOtherDed}
            />
          </div>
          {errors.deductions && (
            <p role="alert" className="mt-1 text-xs text-red-600">
              {errors.deductions}
            </p>
          )}
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
      {result && selected && (
        <section aria-labelledby="it-results-heading">
          <h2 id="it-results-heading" className="mb-4 text-lg font-semibold text-gray-900">
            Results — {regime === "new" ? "New" : "Old"} Regime
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <ResultCard label="Taxable Income" value={formatINR(selected.taxableIncome)} />
            <ResultCard label="Total Tax" value={formatINR(selected.totalTax)} accent />
            <ResultCard label="Monthly Tax" value={formatINR(selected.monthlyTax)} />
          </div>

          <div className="mt-4 grid gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm sm:grid-cols-2">
            <Insight label="Income Tax (after rebate)" value={formatINR(selected.taxAfterRebate)} />
            {selected.surcharge > 0 && (
              <Insight label="Surcharge" value={formatINR(selected.surcharge)} />
            )}
            <Insight label="Health &amp; Education Cess (4%)" value={formatINR(selected.cess)} />
            <Insight label="Effective Tax Rate" value={`${selected.effectiveRate.toFixed(2)}%`} />
          </div>

          {/* Regime comparison + recommendation */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <RegimeCard
              title="Old Regime"
              tax={result.old.totalTax}
              best={result.recommended === "old"}
            />
            <RegimeCard
              title="New Regime"
              tax={result.new.totalTax}
              best={result.recommended === "new"}
            />
          </div>
          <p className="text-brand-800 mt-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm">
            {result.taxSaved > 0 ? (
              <>
                The <strong>{result.recommended === "new" ? "New" : "Old"} Regime</strong> saves you{" "}
                <strong>{formatINR(result.taxSaved)}</strong> for FY {CURRENT_FY}.
              </>
            ) : (
              <>Both regimes result in the same tax for these inputs.</>
            )}
          </p>

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
      {result && <IncomeTaxCharts result={result} regime={regime} />}

      {/* ── Slab breakdown ──────────────────────────────────────────────────── */}
      {selected && selected.slabs.length > 0 && (
        <section aria-labelledby="it-slabs-heading">
          <h2 id="it-slabs-heading" className="mb-3 text-lg font-semibold text-gray-900">
            Slab-wise Breakdown — {regime === "new" ? "New" : "Old"} Regime
          </h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full text-sm" aria-label="Slab-wise tax breakdown">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {["Income Slab", "Rate", "Taxable in Slab", "Tax"].map((c) => (
                    <th
                      key={c}
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {selected.slabs.map((s) => (
                  <tr key={s.label} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{s.label}</td>
                    <td className="px-4 py-2.5 tabular-nums text-gray-600">{s.rate}%</td>
                    <td className="px-4 py-2.5 tabular-nums text-gray-700">
                      {formatINR(s.taxableInSlab)}
                    </td>
                    <td className="px-4 py-2.5 font-medium tabular-nums text-brand-700">
                      {formatINR(s.tax)}
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
        step="1000"
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

function RegimeCard({ title, tax, best }: { title: string; tax: number; best: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-xl border p-4",
        best ? "border-green-300 bg-green-50" : "border-gray-200 bg-white"
      )}
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-gray-400">{title}</p>
        <p className="mt-1 text-xl font-bold tabular-nums text-gray-900">{formatINR(tax)}</p>
      </div>
      {best && (
        <span className="rounded-full bg-green-600 px-2.5 py-1 text-xs font-semibold text-white">
          Best
        </span>
      )}
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
