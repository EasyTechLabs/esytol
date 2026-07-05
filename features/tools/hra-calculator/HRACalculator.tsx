"use client";

import { useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { calculateHRA, validateHRAInputs, resultToCSV, downloadCSV, formatINR } from "@/lib/hra";
import { cn } from "@/lib/cn";

const HRACharts = dynamic(() => import("./HRACharts").then((m) => ({ default: m.HRACharts })), {
  ssr: false,
  loading: () => (
    <div className="flex h-44 items-center justify-center rounded-xl border border-gray-200 bg-white">
      <p className="text-sm text-gray-400">Loading charts…</p>
    </div>
  ),
});

const num = (v: string) => (v.trim() === "" ? 0 : parseFloat(v) || 0);

export function HRACalculator() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [salary, setSalary] = useState(searchParams.get("salary") ?? "1200000");
  const [basic, setBasic] = useState(searchParams.get("basic") ?? "600000");
  const [hra, setHra] = useState(searchParams.get("hra") ?? "240000");
  const [rent, setRent] = useState(searchParams.get("rent") ?? "300000");
  const [isMetro, setIsMetro] = useState(searchParams.get("metro") !== "0");
  const [resultCopied, setResultCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const input = useMemo(
    () => ({
      annualSalary: num(salary),
      basicSalary: num(basic),
      hraReceived: num(hra),
      rentPaid: num(rent),
      isMetro,
    }),
    [salary, basic, hra, rent, isMetro]
  );

  const errors = useMemo(
    () =>
      validateHRAInputs({
        annualSalary: input.annualSalary,
        basicSalary: input.basicSalary,
        hraReceived: input.hraReceived,
        rentPaid: input.rentPaid,
      }),
    [input]
  );
  const isValid = Object.keys(errors).length === 0;

  const result = useMemo(() => (isValid ? calculateHRA(input) : null), [isValid, input]);

  const winner = result?.rules.find((r) => r.isWinner);

  const handleReset = useCallback(() => {
    setSalary("1200000");
    setBasic("600000");
    setHra("240000");
    setRent("300000");
    setIsMetro(true);
  }, []);

  const handleDownload = useCallback(() => {
    if (!result) return;
    downloadCSV(resultToCSV(input, result), "hra-exemption.csv");
  }, [input, result]);

  const handleCopyResult = useCallback(async () => {
    if (!result) return;
    const lines = [
      "HRA Exemption — Section 10(13A), Rule 2A",
      `City: ${isMetro ? "Metro (50%)" : "Non-Metro (40%)"}`,
      `Rule 1 — Actual HRA received: ${formatINR(result.actualHRA)}`,
      `Rule 2 — Rent − 10% of Basic: ${formatINR(result.rentExcess)}`,
      `Rule 3 — ${Math.round(result.metroRate * 100)}% of Basic: ${formatINR(result.percentOfBasic)}`,
      `HRA Exemption (least): ${formatINR(result.hraExemption)}`,
      `Taxable HRA: ${formatINR(result.taxableHRA)}`,
      `Remaining Taxable Salary: ${formatINR(result.remainingTaxableSalary)}`,
      `Monthly HRA Exemption: ${formatINR(result.monthlyExemption)}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setResultCopied(true);
      setTimeout(() => setResultCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }, [result, isMetro]);

  const handleShareUrl = useCallback(async () => {
    const params = new URLSearchParams({
      salary,
      basic,
      hra,
      rent,
      metro: isMetro ? "1" : "0",
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
  }, [salary, basic, hra, rent, isMetro, pathname, router]);

  return (
    <div className="flex flex-col gap-8">
      {/* ── Inputs ──────────────────────────────────────────────────────────── */}
      <section aria-label="HRA inputs">
        <div className="mb-2 flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-gray-700">City Type</p>
          <span className="text-xs text-gray-400">All amounts are annual (₹)</span>
        </div>
        <div
          role="group"
          aria-label="City type"
          className="mb-6 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5"
        >
          {(
            [
              { value: true, label: "Metro", sub: "50%" },
              { value: false, label: "Non-Metro", sub: "40%" },
            ] as const
          ).map(({ value, label, sub }) => (
            <button
              key={label}
              type="button"
              onClick={() => setIsMetro(value)}
              aria-pressed={isMetro === value}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition",
                isMetro === value
                  ? "bg-white text-brand-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {label}
              <span
                className={cn(
                  "ml-1 text-xs",
                  isMetro === value ? "text-brand-400" : "text-gray-400"
                )}
              >
                ({sub})
              </span>
            </button>
          ))}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="hra-salary"
            label="Annual Salary (₹)"
            hint="Gross annual salary"
            value={salary}
            onChange={setSalary}
            placeholder="e.g. 1200000"
            error={errors.annualSalary}
          />
          <Field
            id="hra-basic"
            label="Basic Salary (₹)"
            hint="Basic + DA (retirement)"
            value={basic}
            onChange={setBasic}
            placeholder="e.g. 600000"
            error={errors.basicSalary}
          />
          <Field
            id="hra-received"
            label="HRA Received (₹)"
            hint="HRA component from employer"
            value={hra}
            onChange={setHra}
            placeholder="e.g. 240000"
            error={errors.hraReceived}
          />
          <Field
            id="hra-rent"
            label="Rent Paid (₹)"
            hint="Total annual rent paid"
            value={rent}
            onChange={setRent}
            placeholder="e.g. 300000"
            error={errors.rentPaid}
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
        <section aria-labelledby="hra-results-heading">
          <h2 id="hra-results-heading" className="mb-4 text-lg font-semibold text-gray-900">
            Your HRA Exemption
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <ResultCard label="HRA Exemption" value={formatINR(result.hraExemption)} accent />
            <ResultCard label="Taxable HRA" value={formatINR(result.taxableHRA)} />
            <ResultCard
              label="Remaining Taxable Salary"
              value={formatINR(result.remainingTaxableSalary)}
            />
          </div>

          <div className="mt-4 grid gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm sm:grid-cols-2">
            <Insight label="Monthly HRA Exemption" value={formatINR(result.monthlyExemption)} />
            <Insight label="Annual HRA Exemption" value={formatINR(result.annualExemption)} />
            <Insight label="City Type" value={isMetro ? "Metro (50%)" : "Non-Metro (40%)"} />
            <Insight label="Exempt % of HRA" value={`${result.exemptPercentOfHRA.toFixed(2)}%`} />
          </div>

          {/* Step-by-step: the three rules */}
          <h3 className="mb-3 mt-6 text-sm font-semibold text-gray-700">
            Step-by-step — the three HRA rules (Rule 2A)
          </h3>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full text-sm" aria-label="HRA exemption rules">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {["#", "Rule", "How it is computed", "Amount"].map((c) => (
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
                {result.rules.map((r, i) => (
                  <tr key={r.key} className={cn(r.isWinner ? "bg-green-50" : "hover:bg-gray-50")}>
                    <td className="px-4 py-2.5 tabular-nums text-gray-500">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      {r.label}
                      {r.isWinner && (
                        <span className="ml-2 rounded-full bg-green-600 px-2 py-0.5 text-xs font-semibold text-white">
                          Exempt
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{r.description}</td>
                    <td
                      className={cn(
                        "px-4 py-2.5 font-medium tabular-nums",
                        r.isWinner ? "text-green-700" : "text-gray-700"
                      )}
                    >
                      {formatINR(r.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {winner && (
            <p className="text-brand-800 mt-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm">
              Your HRA exemption is <strong>{formatINR(result.hraExemption)}</strong> — the{" "}
              <strong>lowest</strong> of the three amounts (<strong>{winner.label}</strong>). Under
              Rule 2A, the least of the three is exempt, and the balance of your HRA (
              <strong>{formatINR(result.taxableHRA)}</strong>) is added to your taxable salary.
            </p>
          )}

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
      {result && <HRACharts input={input} result={result} />}
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

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-600">{label}</span>
      <strong className="font-semibold tabular-nums text-gray-900">{value}</strong>
    </div>
  );
}
