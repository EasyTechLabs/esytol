"use client";

/**
 * Interactive API playground — EXPOSE-001.
 *
 * A self-contained, CSP-safe "try it out" for the Income Tax API. It POSTs to
 * the same-origin `/api/v1/income-tax/calculate` (allowed by `connect-src
 * 'self'`), shows the live JSON response, and generates the matching curl. This
 * is the "Swagger UI or equivalent" surface — no CDN, no heavy dependency, and
 * the full machine-readable OpenAPI 3.1 spec is linked for any real Swagger UI.
 */

import { useMemo, useState } from "react";
import { CopyButton } from "@/features/tool/CopyButton";
import { cn } from "@/lib/cn";

const YEARS = ["2026-27", "2025-26", "2024-25"] as const;

export function ApiPlayground() {
  const [assessmentYear, setYear] = useState<(typeof YEARS)[number]>("2026-27");
  const [salary, setSalary] = useState("1800000");
  const [other, setOther] = useState("0");
  const [section80C, set80C] = useState("0");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [response, setResponse] = useState("");

  const requestBody = useMemo(() => {
    const body: Record<string, unknown> = {
      assessmentYear,
      income: { salary: Number(salary) || 0, other: Number(other) || 0 },
    };
    if (Number(section80C) > 0) body.deductions = { section80C: Number(section80C) };
    return body;
  }, [assessmentYear, salary, other, section80C]);

  const curl = useMemo(
    () =>
      `curl -X POST https://www.esytol.com/api/v1/income-tax/calculate \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(requestBody)}'`,
    [requestBody]
  );

  const run = async () => {
    setRunning(true);
    setStatus(null);
    setResponse("");
    try {
      const res = await fetch("/api/v1/income-tax/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      setStatus(res.status);
      const json = await res.json();
      setResponse(JSON.stringify(json, null, 2));
    } catch (e) {
      setStatus(0);
      setResponse(`// Request failed: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Request builder */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-900">
          POST <code className="text-brand-700">/api/v1/income-tax/calculate</code>
        </h3>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium uppercase tracking-widest text-gray-400">
            Assessment year
          </span>
          <select
            value={assessmentYear}
            onChange={(e) => setYear(e.target.value as (typeof YEARS)[number])}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <Field label="Annual salary (₹)" value={salary} onChange={setSalary} />
        <Field label="Other income (₹)" value={other} onChange={setOther} />
        <Field label="Section 80C (₹, old regime)" value={section80C} onChange={set80C} />

        <button
          type="button"
          onClick={run}
          disabled={running}
          className="mt-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {running ? "Running…" : "Send request"}
        </button>

        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-widest text-gray-400">
              curl
            </span>
            <CopyButton value={curl} />
          </div>
          <pre className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800">
            {curl}
          </pre>
        </div>
      </div>

      {/* Response */}
      <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-widest text-gray-400">
            Response
          </span>
          {status !== null && (
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                status >= 200 && status < 300
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-800"
              )}
            >
              HTTP {status}
            </span>
          )}
        </div>
        {response ? (
          <pre className="h-[26rem] overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-800">
            {response}
          </pre>
        ) : (
          <div className="flex h-[26rem] items-center justify-center rounded-lg border border-dashed border-gray-200 text-sm text-gray-400">
            Send a request to see the live JSON response.
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-xs font-medium uppercase tracking-widest text-gray-400">
        {label}
      </span>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm tabular-nums"
      />
    </label>
  );
}
