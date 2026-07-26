"use client";

/**
 * Vyora — Import Wizard (P3-005). Move a merchant in from another ledger in under
 * five minutes: choose a CSV/JSON file → preview → map columns → review (invalid
 * rows highlighted, duplicates skipped, a summary) → import. Everything is local;
 * nothing is uploaded. The import MERGES into the current ledger (contacts are
 * reused by name) — it never replaces existing data.
 */

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { useVyora } from "../VyoraProvider";
import { todayISO } from "@/lib/vyora/selectors";
import { formatMoney } from "@/lib/vyora/format";
import {
  parseImportSource,
  guessMapping,
  buildImportPlan,
  type ParsedSource,
  type ColumnMapping,
  type DefaultType,
  type ImportPlan,
  type EntryKindAll,
} from "@/lib/vyora/import";
import { Card, Button } from "../primitives";

const STEPS = ["Choose file", "Preview", "Map columns", "Review"];

const FIELDS: { key: keyof ColumnMapping; label: string; required?: boolean }[] = [
  { key: "name", label: "Name", required: true },
  { key: "phone", label: "Phone" },
  { key: "amount", label: "Amount", required: true },
  { key: "date", label: "Date" },
  { key: "type", label: "Type" },
  { key: "notes", label: "Notes" },
];

const TYPES: { value: DefaultType; label: string }[] = [
  { value: "given", label: "Credit given (they owe me)" },
  { value: "received", label: "Payment received (they paid me)" },
  { value: "taken", label: "Credit taken (I owe them)" },
  { value: "paid", label: "Payment made (I paid them)" },
];

const KIND_LABEL: Record<EntryKindAll, string> = {
  given: "Credit given",
  taken: "Credit taken",
  received: "Payment received",
  paid: "Payment made",
};

const emptyMapping: ColumnMapping = {
  name: null,
  phone: null,
  amount: null,
  date: null,
  type: null,
  notes: null,
};

export function ImportWizard() {
  const { data, importLedger } = useVyora();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<ParsedSource | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>(emptyMapping);
  const [defaultType, setDefaultType] = useState<DefaultType>("given");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [result, setResult] = useState<{ contacts: number; entries: number } | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    let text = "";
    try {
      text = await file.text();
    } catch {
      setError("Could not read that file.");
      return;
    }
    const parsed = parseImportSource(text, file.name);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    setSource(parsed);
    setMapping(guessMapping(parsed.columns));
    setStep(1);
  };

  const canMap = mapping.name !== null && mapping.amount !== null;
  const goReview = () => {
    if (!source) return;
    setPlan(buildImportPlan(source.rows, mapping, defaultType, data, todayISO()));
    setStep(3);
  };
  const doImport = () => {
    if (!plan) return;
    setResult(importLedger(plan));
    setStep(4);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Import from another app</h1>
        <p className="text-sm text-gray-600">
          Bring your customers and udhaar in from a CSV or JSON export. Nothing is uploaded —
          everything stays on this device.
        </p>
      </div>

      {step < 4 && <Stepper step={step} />}

      {/* Step 0 — choose file */}
      {step === 0 && (
        <Card className="space-y-3">
          <p className="text-sm text-gray-700">
            Choose a <strong>.csv</strong> or <strong>.json</strong> file exported from your current
            app.
          </p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center hover:border-brand-400">
            <span aria-hidden className="text-3xl">
              📄
            </span>
            <span className="text-sm font-medium text-brand-700">Tap to choose a file</span>
            <span className="text-xs text-gray-500">CSV or JSON</span>
            <input
              type="file"
              accept=".csv,.json,text/csv,application/json"
              onChange={onFile}
              className="hidden"
            />
          </label>
          {error && (
            <p className="rounded-xl bg-negative-tint px-3 py-2 text-sm font-medium text-negative-strong">
              {error}
            </p>
          )}
        </Card>
      )}

      {/* Step 1 — preview */}
      {step === 1 && source && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Preview</h2>
            <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-semibold uppercase text-gray-600">
              {source.format} · {source.rows.length} rows
            </span>
          </div>
          <PreviewTable columns={source.columns} rows={source.rows.slice(0, 8)} />
          {source.rows.length > 8 && (
            <p className="text-xs text-gray-500">
              Showing the first 8 of {source.rows.length} rows.
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button variant="primary" onClick={() => setStep(2)} className="flex-1">
              Next: map columns
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2 — column mapping */}
      {step === 2 && source && (
        <Card className="space-y-3">
          <h2 className="font-semibold text-gray-900">Map columns</h2>
          <p className="text-sm text-gray-600">
            Tell Vyora which column is which. <strong>Name</strong> and <strong>Amount</strong> are
            required.
          </p>
          {FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                {f.label}
                {f.required && <span className="text-negative-strong"> *</span>}
              </span>
              <select
                value={mapping[f.key] ?? ""}
                onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value || null })}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                <option value="">— none —</option>
                {source.columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Default entry type</span>
            <select
              value={defaultType}
              onChange={(e) => setDefaultType(e.target.value as DefaultType)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-gray-500">
              Used when a row has no Type column, or its value isn&rsquo;t recognised.
            </span>
          </label>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button variant="primary" onClick={goReview} disabled={!canMap} className="flex-1">
              Next: review
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3 — review / validation */}
      {step === 3 && plan && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Summary label="Ready to import" value={plan.summary.importable} tone="ok" />
            <Summary label="Duplicates skipped" value={plan.summary.duplicates} tone="warn" />
            <Summary label="Invalid rows" value={plan.summary.invalid} tone="bad" />
            <Summary
              label="Contacts"
              value={plan.summary.newContacts}
              hint={`${plan.summary.matchedContacts} matched existing`}
            />
          </div>

          <Card className="space-y-2">
            <h2 className="font-semibold text-gray-900">Rows</h2>
            <p className="text-xs text-gray-500">
              <span className="text-negative-strong">Red</span> = invalid (skipped) ·{" "}
              <span className="text-amber-700">Amber</span> = duplicate (skipped)
            </p>
            <ReviewTable rows={plan.rows.slice(0, 100)} />
            {plan.rows.length > 100 && (
              <p className="text-xs text-gray-500">Showing the first 100 rows.</p>
            )}
          </Card>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              variant="primary"
              onClick={doImport}
              disabled={plan.summary.importable === 0}
              className="flex-1"
            >
              Import {plan.summary.importable} entr{plan.summary.importable === 1 ? "y" : "ies"}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4 — finish */}
      {step === 4 && result && (
        <Card className="space-y-4 text-center">
          <div
            aria-hidden
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-positive-tint text-2xl"
          >
            ✓
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Import complete</h2>
            <p className="mt-1 text-sm text-gray-600">
              Added {result.entries} entr{result.entries === 1 ? "y" : "ies"} and {result.contacts}{" "}
              new contact{result.contacts === 1 ? "" : "s"} to your ledger.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Link
              href="/vyora/parties"
              className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              View contacts
            </Link>
            <Link href="/vyora" className="text-sm font-medium text-brand-700">
              Back to home
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-1 text-[11px] font-medium">
      {STEPS.map((label, i) => (
        <li key={label} className="flex flex-1 items-center gap-1">
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
              i < step
                ? "bg-positive text-white"
                : i === step
                  ? "bg-brand-600 text-white"
                  : "bg-gray-200 text-gray-500"
            )}
          >
            {i < step ? "✓" : i + 1}
          </span>
          <span className={cn("truncate", i === step ? "text-gray-900" : "text-gray-500")}>
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function PreviewTable({ columns, rows }: { columns: string[]; rows: Record<string, string>[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            {columns.map((c) => (
              <th key={c} className="whitespace-nowrap px-3 py-2 font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c} className="whitespace-nowrap px-3 py-1.5 text-gray-700">
                  {r[c]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReviewTable({ rows }: { rows: ImportPlan["rows"] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="px-3 py-2 font-semibold">Name</th>
            <th className="px-3 py-2 font-semibold">Amount</th>
            <th className="px-3 py-2 font-semibold">Type</th>
            <th className="px-3 py-2 font-semibold">Date</th>
            <th className="px-3 py-2 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr
              key={r.index}
              className={cn(
                r.status === "invalid" && "bg-negative-tint",
                r.status === "duplicate" && "bg-amber-50"
              )}
            >
              <td className="whitespace-nowrap px-3 py-1.5 font-medium text-gray-800">
                {r.name || <span className="text-negative-strong">—</span>}
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-gray-700">
                {r.amount != null ? formatMoney(r.amount) : "—"}
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 text-gray-600">
                {r.kind ? KIND_LABEL[r.kind] : "—"}
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 text-gray-600">{r.date ?? "—"}</td>
              <td className="whitespace-nowrap px-3 py-1.5">
                {r.status === "ok" ? (
                  <span className="text-positive-strong">Ready</span>
                ) : (
                  <span
                    className={r.status === "invalid" ? "text-negative-strong" : "text-amber-700"}
                  >
                    {r.reason}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Summary({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "ok" | "warn" | "bad" | "neutral";
}) {
  const color =
    tone === "ok"
      ? "text-positive"
      : tone === "bad"
        ? "text-negative"
        : tone === "warn"
          ? "text-amber-700"
          : "text-gray-900";
  return (
    <Card className="p-3">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={cn("text-2xl font-bold tabular-nums", color)}>{value}</div>
      {hint && <div className="text-[11px] text-gray-500">{hint}</div>}
    </Card>
  );
}
