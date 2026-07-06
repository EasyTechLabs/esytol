"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  calculateAge,
  ageDifference,
  validateAgeInputs,
  resultToCSV,
  downloadCSV,
  formatCount,
  fmtDate,
  parseDate,
  type DateParts,
} from "@/lib/age";
import { cn } from "@/lib/cn";

type Mode = "single" | "compare";

function todayParts(): DateParts {
  const n = new Date();
  return { year: n.getFullYear(), month: n.getMonth() + 1, day: n.getDate() };
}

export function AgeCalculator() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [mode, setMode] = useState<Mode>(
    searchParams.get("mode") === "compare" ? "compare" : "single"
  );
  const [dob, setDob] = useState(searchParams.get("dob") ?? "2000-01-01");
  const [asof, setAsof] = useState(searchParams.get("asof") ?? "");
  const [dob2, setDob2] = useState(searchParams.get("dob2") ?? "1995-06-15");
  const [resultCopied, setResultCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  // "Today" is only known on the client — gate today-dependent output on mount
  // so the server and client render identically (no hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const birth = useMemo(() => parseDate(dob), [dob]);
  const asOf = useMemo(
    () => (asof.trim() ? parseDate(asof) : mounted ? todayParts() : null),
    [asof, mounted]
  );
  const second = useMemo(() => parseDate(dob2), [dob2]);

  const errors = useMemo(
    () =>
      validateAgeInputs(
        birth,
        asOf ?? { year: 0, month: 0, day: 0 },
        mode === "compare" ? second : undefined
      ),
    [birth, asOf, second, mode]
  );

  const result = useMemo(
    () =>
      mode === "single" && mounted && birth && asOf && !errors.dob && !errors.asOf
        ? calculateAge(birth, asOf)
        : null,
    [mode, mounted, birth, asOf, errors]
  );

  const diff = useMemo(
    () => (mode === "compare" && birth && second ? ageDifference(birth, second) : null),
    [mode, birth, second]
  );

  const handleReset = useCallback(() => {
    setMode("single");
    setDob("2000-01-01");
    setAsof("");
    setDob2("1995-06-15");
  }, []);

  const handleDownload = useCallback(() => {
    if (!result || !birth || !asOf) return;
    downloadCSV(resultToCSV(birth, asOf, result), "age.csv");
  }, [result, birth, asOf]);

  const handleCopyResult = useCallback(async () => {
    if (!result || !birth || !asOf) return;
    const nb = result.nextBirthday;
    const lines = [
      `Age of ${fmtDate(birth)} (as of ${fmtDate(asOf)})`,
      `Age: ${result.years} years, ${result.months} months, ${result.days} days`,
      `Born on a: ${result.dayOfBirth}`,
      `Total: ${formatCount(result.totalMonths)} months · ${formatCount(result.totalWeeks)} weeks · ${formatCount(result.totalDays)} days`,
      `Total: ${formatCount(result.totalHours)} hours · ${formatCount(result.totalSeconds)} seconds`,
      `Next birthday: ${fmtDate(nb.date)} (${nb.dayOfWeek}) — ${nb.isToday ? "today! 🎉" : `${nb.daysUntil} days, turning ${nb.turningAge}`}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setResultCopied(true);
      setTimeout(() => setResultCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }, [result, birth, asOf]);

  const handleShareUrl = useCallback(async () => {
    const params = new URLSearchParams({ mode, dob });
    if (asof.trim()) params.set("asof", asof);
    if (mode === "compare") params.set("dob2", dob2);
    const url = `${window.location.origin}${pathname}?${params.toString()}`;
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    try {
      await navigator.clipboard.writeText(url);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }, [mode, dob, asof, dob2, pathname, router]);

  const nbProgress = result
    ? Math.round((1 - Math.min(result.nextBirthday.daysUntil, 365) / 365) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-8">
      {/* ── Inputs ──────────────────────────────────────────────────────────── */}
      <section aria-label="Age inputs">
        <div className="mb-2 flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-gray-700">Mode</p>
          <span className="text-xs text-gray-400">Leap-year accurate</span>
        </div>
        <div
          role="group"
          aria-label="Calculation mode"
          className="mb-6 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5"
        >
          {(
            [
              { value: "single", label: "Age", sub: "one date" },
              { value: "compare", label: "Compare", sub: "two dates" },
            ] as const
          ).map(({ value, label, sub }) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
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
                className={cn("ml-1 text-xs", mode === value ? "text-brand-400" : "text-gray-400")}
              >
                ({sub})
              </span>
            </button>
          ))}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <DateField
            id="age-dob"
            label={mode === "compare" ? "First date of birth" : "Date of Birth"}
            value={dob}
            onChange={setDob}
            error={errors.dob}
          />
          {mode === "single" ? (
            <DateField
              id="age-asof"
              label="Age as of"
              hint="Defaults to today"
              value={asof}
              onChange={setAsof}
              error={errors.asOf}
            />
          ) : (
            <DateField
              id="age-dob2"
              label="Second date of birth"
              value={dob2}
              onChange={setDob2}
              error={errors.dob2}
            />
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

      {/* ── Single-mode results ─────────────────────────────────────────────── */}
      {result && birth && asOf && (
        <section aria-labelledby="age-results-heading">
          <h2 id="age-results-heading" className="mb-4 text-lg font-semibold text-gray-900">
            Your Age
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <ResultCard
              label="Age"
              value={`${result.years} yr ${result.months} mo ${result.days} d`}
              accent
            />
            <ResultCard label="Born on a" value={result.dayOfBirth} />
            <ResultCard
              label="Next birthday"
              value={
                result.nextBirthday.isToday ? "Today! 🎉" : `${result.nextBirthday.daysUntil} days`
              }
            />
          </div>

          <div className="mt-4 grid gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm sm:grid-cols-3">
            <Insight label="Total months" value={formatCount(result.totalMonths)} />
            <Insight label="Total weeks" value={formatCount(result.totalWeeks)} />
            <Insight label="Total days" value={formatCount(result.totalDays)} />
            <Insight label="Total hours" value={formatCount(result.totalHours)} />
            <Insight label="Total minutes" value={formatCount(result.totalMinutes)} />
            <Insight label="Total seconds" value={formatCount(result.totalSeconds)} />
          </div>

          {/* Next birthday panel */}
          <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-brand-800 text-sm font-semibold">
                {result.nextBirthday.isToday ? (
                  <>Happy birthday! You turn {result.nextBirthday.turningAge} today 🎉</>
                ) : (
                  <>
                    Turning {result.nextBirthday.turningAge} on {fmtDate(result.nextBirthday.date)}{" "}
                    ({result.nextBirthday.dayOfWeek})
                  </>
                )}
              </p>
              {!result.nextBirthday.isToday && (
                <span className="text-sm font-medium tabular-nums text-brand-700">
                  {result.nextBirthday.daysUntil} days to go
                </span>
              )}
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${Math.max(2, nbProgress)}%` }}
              />
            </div>
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

      {/* ── Compare-mode results ────────────────────────────────────────────── */}
      {mode === "compare" && diff && birth && second && (
        <section aria-labelledby="age-diff-heading">
          <h2 id="age-diff-heading" className="mb-4 text-lg font-semibold text-gray-900">
            Age Difference
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <ResultCard
              label="Difference"
              value={`${diff.years} yr ${diff.months} mo ${diff.days} d`}
              accent
            />
            <ResultCard label="In total days" value={formatCount(diff.totalDays)} />
          </div>
          <p className="text-brand-800 mt-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm">
            {diff.older === "same" ? (
              <>Both dates are the same — there is no age difference.</>
            ) : (
              <>
                The <strong>{diff.older === "first" ? "first" : "second"} date</strong> (
                {fmtDate(diff.older === "first" ? birth : second)}) is older by{" "}
                <strong>
                  {diff.years} years, {diff.months} months and {diff.days} days
                </strong>{" "}
                ({formatCount(diff.totalDays)} days).
              </>
            )}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
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
    </div>
  );
}

function DateField({
  id,
  label,
  value,
  onChange,
  hint,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
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
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
