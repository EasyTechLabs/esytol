"use client";

/**
 * Vyora Alpha — Founder Mode. A hidden, local-only diagnostics screen (reached by
 * tapping the "Alpha" badge 5×). Purely local: no tracking, no telemetry, no
 * network. Just what's on this device, for the founder running a pilot.
 */

import { useVyora } from "../VyoraProvider";
import { storageSizeBytes, APP_VERSION } from "@/lib/vyora/store";
import { formatDate } from "@/lib/vyora/format";

export function Founder() {
  const { ready, data } = useVyora();
  if (!ready) return <div className="py-20 text-center text-gray-500">Loading…</div>;

  const bytes = storageSizeBytes();
  const rows: Array<[string, string]> = [
    ["Total contacts", String(data.parties.length)],
    ["Total credits", String(data.transactions.length)],
    ["Total payments", String(data.payments.length)],
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
      <p className="px-1 text-xs text-gray-500">
        These numbers come only from this browser. Vyora sends nothing anywhere.
      </p>
    </div>
  );
}
