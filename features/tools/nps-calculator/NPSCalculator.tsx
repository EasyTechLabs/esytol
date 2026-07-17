"use client";

import { CalculationSync } from "@/features/tool/CalculationSync";
import type { FinanceEvent } from "@/lib/financeEvents";

import { useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import {
  calculateNPS,
  validateNPSInputs,
  resultToCSV,
  downloadCSV,
  formatINR,
  DEFAULT_RETIREMENT_AGE,
} from "@/lib/nps";
import { cn } from "@/lib/cn";

const NPSCharts = dynamic(() => import("./NPSCharts").then((m) => ({ default: m.NPSCharts })), {
  ssr: false,
  loading: () => (
    <div className="flex h-44 items-center justify-center rounded-xl border border-gray-200 bg-white">
      <p className="text-sm text-gray-400">Loading charts…</p>
    </div>
  ),
});

const num = (v: string) => (v.trim() === "" ? 0 : parseFloat(v) || 0);

export function NPSCalculator() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [age, setAge] = useState(searchParams.get("age") ?? "30");
  const [retireAge, setRetireAge] = useState(
    searchParams.get("retire") ?? String(DEFAULT_RETIREMENT_AGE)
  );
  const [contribution, setContribution] = useState(searchParams.get("contrib") ?? "5000");
  const [expectedReturn, setExpectedReturn] = useState(searchParams.get("return") ?? "10");
  const [annuityReturn, setAnnuityReturn] = useState(searchParams.get("annuity") ?? "6");
  const [lumpSum, setLumpSum] = useState(searchParams.get("lump") ?? "60");
  const [resultCopied, setResultCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const input = useMemo(
    () => ({
      currentAge: num(age),
      retirementAge: num(retireAge),
      monthlyContribution: num(contribution),
      expectedReturn: num(expectedReturn),
      annuityReturn: num(annuityReturn),
      lumpSumPct: num(lumpSum),
    }),
    [age, retireAge, contribution, expectedReturn, annuityReturn, lumpSum]
  );

  const errors = useMemo(() => validateNPSInputs(input), [input]);
  const isValid = Object.keys(errors).length === 0;
  const result = useMemo(() => (isValid ? calculateNPS(input) : null), [isValid, input]);

  const financeEvent = useMemo<FinanceEvent | null>(() => {
    if (!result) return null;
    return {
      type: "RetirementPlanned",
      slug: "nps-calculator",
      name: "NPS Calculator",
      projectedCorpus: result.corpus,
      monthlyPension: result.monthlyPension,
    };
  }, [result]);

  const handleReset = useCallback(() => {
    setAge("30");
    setRetireAge(String(DEFAULT_RETIREMENT_AGE));
    setContribution("5000");
    setExpectedReturn("10");
    setAnnuityReturn("6");
    setLumpSum("60");
  }, []);

  const handleDownload = useCallback(() => {
    if (!result) return;
    downloadCSV(resultToCSV(result), "nps-projection.csv");
  }, [result]);

  const handleCopyResult = useCallback(async () => {
    if (!result) return;
    const lines = [
      "NPS Projection",
      `Contribution: ${formatINR(input.monthlyContribution)}/month for ${result.years} years`,
      `Corpus at Retirement: ${formatINR(result.corpus)}`,
      `Total Contributions: ${formatINR(result.totalContributions)}`,
      `Estimated Returns: ${formatINR(result.estimatedReturns)}`,
      `Lump Sum (${result.lumpSumPct}%): ${formatINR(result.lumpSumAmount)}`,
      `Annuity Corpus (${result.annuityPct}%): ${formatINR(result.annuityCorpus)}`,
      `Monthly Pension: ${formatINR(result.monthlyPension)}`,
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
      age,
      retire: retireAge,
      contrib: contribution,
      return: expectedReturn,
      annuity: annuityReturn,
      lump: lumpSum,
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
  }, [age, retireAge, contribution, expectedReturn, annuityReturn, lumpSum, pathname, router]);

  return (
    <div className="flex flex-col gap-8">
      {/* ── Inputs ──────────────────────────────────────────────────────────── */}
      <section aria-label="NPS inputs">
        <div className="mb-2 flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-gray-700">Your Plan</p>
          <span className="text-xs text-gray-400">Min 40% of corpus buys an annuity</span>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            id="nps-age"
            label="Current Age (years)"
            value={age}
            onChange={setAge}
            placeholder="e.g. 30"
            error={errors.currentAge}
          />
          <Field
            id="nps-retire"
            label="Retirement Age (years)"
            hint="Usually 60"
            value={retireAge}
            onChange={setRetireAge}
            placeholder="e.g. 60"
            error={errors.retirementAge}
          />
          <Field
            id="nps-contrib"
            label="Monthly Contribution (₹)"
            value={contribution}
            onChange={setContribution}
            placeholder="e.g. 5000"
            error={errors.monthlyContribution}
          />
          <Field
            id="nps-return"
            label="Expected Annual Return (%)"
            hint="Market-linked (8–12%)"
            value={expectedReturn}
            onChange={setExpectedReturn}
            placeholder="e.g. 10"
            error={errors.expectedReturn}
          />
          <Field
            id="nps-annuity"
            label="Expected Annuity Rate (%)"
            hint="Pension return (~6%)"
            value={annuityReturn}
            onChange={setAnnuityReturn}
            placeholder="e.g. 6"
            error={errors.annuityReturn}
          />
          <Field
            id="nps-lump"
            label="Lump Sum Withdrawal (%)"
            hint="0–60% (rest annuitised)"
            value={lumpSum}
            onChange={setLumpSum}
            placeholder="e.g. 60"
            error={errors.lumpSumPct}
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
        <section aria-labelledby="nps-results-heading">
          <h2 id="nps-results-heading" className="mb-4 text-lg font-semibold text-gray-900">
            NPS at Age {input.retirementAge}
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <ResultCard label="Corpus at Retirement" value={formatINR(result.corpus)} accent />
            <ResultCard label="Monthly Pension" value={formatINR(result.monthlyPension)} />
            <ResultCard label="Lump Sum Available" value={formatINR(result.lumpSumAmount)} />
          </div>

          <div className="mt-4 grid gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm sm:grid-cols-2">
            <Insight label="Total Contributions" value={formatINR(result.totalContributions)} />
            <Insight label="Estimated Returns" value={formatINR(result.estimatedReturns)} />
            <Insight
              label={`Annuity Corpus (${result.annuityPct}%)`}
              value={formatINR(result.annuityCorpus)}
            />
            <Insight label="Investment Period" value={`${result.years} years`} />
          </div>

          {/* Tax benefits */}
          <div className="text-brand-800 mt-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm">
            <p className="mb-1 font-semibold">Tax Benefits</p>
            <ul className="list-inside list-disc space-y-1">
              <li>
                <strong>Section 80CCD(1):</strong> your contribution qualifies within the ₹1.5 lakh
                Section 80C limit.
              </li>
              <li>
                <strong>Section 80CCD(1B):</strong> an additional deduction of up to{" "}
                <strong>₹50,000</strong>, over and above the ₹1.5 lakh limit.
              </li>
              <li>
                <strong>Section 80CCD(2):</strong> employer contributions are deductible (up to 10%,
                or 14% for government employees, of Basic + DA).
              </li>
              <li>
                At retirement, the <strong>60% lump sum is tax-free</strong>; the annuity/pension is
                taxable as per your slab in the year of receipt.
              </li>
            </ul>
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

      <CalculationSync event={financeEvent} />

      {/* ── Charts ──────────────────────────────────────────────────────────── */}
      {result && <NPSCharts result={result} />}

      {/* ── Year-wise projection ────────────────────────────────────────────── */}
      {result && result.yearWise.length > 0 && (
        <section aria-labelledby="nps-schedule-heading">
          <h2 id="nps-schedule-heading" className="mb-3 text-lg font-semibold text-gray-900">
            Growth Projection
          </h2>
          <div className="max-h-96 overflow-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full text-sm" aria-label="Year-wise NPS projection">
              <thead className="sticky top-0">
                <tr className="border-b border-gray-200 bg-gray-50">
                  {["Year", "Age", "Opening", "Contribution", "Returns", "Closing"].map((c) => (
                    <th
                      key={c}
                      scope="col"
                      className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                    >
                      {c}
                    </th>
                  ))}
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
                      {formatINR(r.contribution)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-emerald-700">
                      {formatINR(r.returns)}
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
