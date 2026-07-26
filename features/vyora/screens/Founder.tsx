"use client";

/**
 * Vyora Alpha — Founder Mode. A hidden, local-only diagnostics screen (reached by
 * tapping the "Alpha" badge 5×). Purely local: no tracking, no telemetry, no
 * network. Just what's on this device, for the founder running a pilot — including
 * the Data Integrity report (ENG-005).
 */

import { useVyora } from "../VyoraProvider";
import { storageSizeBytes, APP_VERSION } from "@/lib/vyora/store";
import { formatDate } from "@/lib/vyora/format";
import { Card, Button } from "../primitives";

export function Founder() {
  const { ready, data, integrity, checkIntegrity } = useVyora();
  if (!ready) return <div className="py-20 text-center text-gray-500">Loading…</div>;

  const bytes = storageSizeBytes();
  const rows: Array<[string, string]> = [
    ["Total contacts", String(data.parties.length)],
    ["Total credits", String(data.transactions.length)],
    ["Total payments", String(data.payments.length)],
    ["Recently deleted", String((data.trash ?? []).length)],
    ["Local storage size", bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`],
    ["App version", `v${APP_VERSION} (schema v${data.version})`],
    ["Last backup", data.meta.lastBackupAt ? formatDate(data.meta.lastBackupAt) : "never"],
    ["Export count", String(data.meta.exportCount)],
    ["Import count", String(data.meta.importCount)],
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Founder Mode</h1>
        <p className="text-sm text-gray-600">Local diagnostics only — no tracking, no network.</p>
      </div>

      <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-gray-600">{label}</span>
            <span className="text-sm font-semibold tabular-nums text-gray-900">{value}</span>
          </div>
        ))}
      </div>

      {/* Data Integrity report (ENG-005) */}
      <Card as="section" className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">Data integrity</h2>
            <p className="text-sm text-gray-600">
              Checked at startup, and after every import/restore.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => checkIntegrity()}
            className="shrink-0"
          >
            Run check
          </Button>
        </div>

        {!integrity ? (
          <p className="text-sm text-gray-500">Not checked yet this session.</p>
        ) : (
          <>
            <div
              className={`rounded-xl px-3 py-2 text-sm font-medium ${
                integrity.ok
                  ? "bg-positive-tint text-positive-strong"
                  : "bg-negative-tint text-negative-strong"
              }`}
            >
              {integrity.ok
                ? integrity.repaired
                  ? "✓ Ledger consistent — minor issues were auto-repaired."
                  : "✓ Ledger consistent — no issues found."
                : "⚠ Major issues found — review below (nothing was deleted)."}
            </div>

            {integrity.issues.length > 0 && (
              <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
                {integrity.issues.map((issue) => (
                  <li key={issue.code} className="flex items-start gap-2 px-3 py-2.5 text-sm">
                    <span
                      className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        issue.severity === "warning"
                          ? "bg-negative-tint text-negative-strong"
                          : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      {issue.severity === "warning" ? "Warn" : "Fixed"}
                    </span>
                    <span className="min-w-0 text-gray-700">
                      {issue.message}{" "}
                      <span className="tabular-nums text-gray-500">×{issue.count}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-[11px] text-gray-500">
              Checked {formatDate(integrity.checkedAt)} · {integrity.totals.parties} contacts ·{" "}
              {integrity.totals.transactions + integrity.totals.payments} entries ·{" "}
              {integrity.totals.trash} in Recently Deleted
            </p>
          </>
        )}
      </Card>

      <p className="px-1 text-xs text-gray-500">
        These numbers come only from this browser. Vyora sends nothing anywhere.
      </p>
    </div>
  );
}
