"use client";

/**
 * Vyora — Founder / Developer Mode (V1-003). A hidden, local-only diagnostics
 * screen reached by tapping the "Alpha" badge 5× — never visible otherwise. Shows
 * versions, storage, record counts, integrity, build/PWA state, and backup/restore
 * times, plus developer buttons (integrity check · export logs · performance report
 * · seed/reset demo data). Purely local: no tracking, no telemetry, no network.
 */

import { useEffect, useMemo, useState } from "react";
import { useVyora } from "../VyoraProvider";
import { useToast } from "../Toast";
import { storageSizeBytes, APP_VERSION, VERSION } from "@/lib/vyora/store";
import { recoverySummary } from "@/lib/vyora/aging";
import { todayISO } from "@/lib/vyora/selectors";
import { formatDateTime } from "@/lib/vyora/format";
import type { VyoraData } from "@/lib/vyora/types";
import { Card, Button } from "../primitives";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/** Walk the whole dataset the way Global Search would, for a real timing sample. */
function scanIndex(data: VyoraData): number {
  const nameById = new Map(data.parties.map((p) => [p.id, p.name]));
  let n = 0;
  for (const p of data.parties) {
    void [p.name, p.phone, p.note].filter(Boolean).join(" ").toLowerCase();
    n += 1;
  }
  for (const t of data.transactions) {
    void [nameById.get(t.partyId), t.reference, String(t.amount)].filter(Boolean).join(" ");
    n += 1;
  }
  for (const p of data.payments) {
    void [nameById.get(p.partyId), p.reference, String(p.amount)].filter(Boolean).join(" ");
    n += 1;
  }
  return n;
}

export function Founder() {
  const { ready, data, integrity, checkIntegrity, seedDemo, resetDemo } = useVyora();
  const toast = useToast();
  const [pwa, setPwa] = useState("—");
  const [perf, setPerf] = useState<{ sweepMs: number; scanMs: number; entries: number } | null>(
    null
  );

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      setPwa("Unsupported");
      return;
    }
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches;
    setPwa(
      standalone
        ? "Installed (standalone)"
        : navigator.serviceWorker.controller
          ? "Active (offline-ready)"
          : "Browser (not cached yet)"
    );
  }, []);

  const integrityLabel = !integrity
    ? "Not checked"
    : !integrity.ok
      ? `${integrity.issues.length} issue${integrity.issues.length === 1 ? "" : "s"}`
      : integrity.repaired
        ? "Repaired"
        : "Healthy";

  const rows = useMemo<Array<[string, string]>>(
    () => [
      ["Database version", `v${data.version}`],
      ["Migration (code) version", `v${VERSION}`],
      ["Storage", formatBytes(storageSizeBytes())],
      ["Contacts", String(data.parties.length)],
      ["Transactions", String(data.transactions.length + data.payments.length)],
      ["Deleted records", String((data.trash ?? []).length)],
      ["Integrity", integrityLabel],
      ["Build", `v${APP_VERSION}`],
      ["PWA", pwa],
      ["Last backup", data.meta.lastBackupAt ? formatDateTime(data.meta.lastBackupAt) : "never"],
      ["Last restore", data.meta.lastRestoreAt ? formatDateTime(data.meta.lastRestoreAt) : "never"],
    ],
    [data, pwa, integrityLabel]
  );

  if (!ready) return <div className="py-20 text-center text-gray-500">Loading…</div>;

  const runPerf = () => {
    const t = todayISO();
    const a = performance.now();
    recoverySummary(data, t);
    const sweepMs = performance.now() - a;
    const b = performance.now();
    scanIndex(data);
    const scanMs = performance.now() - b;
    setPerf({
      sweepMs: Math.round(sweepMs * 100) / 100,
      scanMs: Math.round(scanMs * 100) / 100,
      entries: data.transactions.length + data.payments.length,
    });
  };

  const exportLogs = () => {
    const logs = {
      generatedAt: new Date().toISOString(),
      app: { build: APP_VERSION, schemaCode: VERSION, dataVersion: data.version },
      counts: {
        contacts: data.parties.length,
        transactions: data.transactions.length,
        payments: data.payments.length,
        deleted: (data.trash ?? []).length,
      },
      storageBytes: storageSizeBytes(),
      integrity: integrity ?? "not-run",
      performance: perf ?? "not-run",
      meta: data.meta,
      pwa,
      device: { userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "" },
    };
    try {
      const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a");
      el.href = url;
      el.download = `vyora-logs-${todayISO()}.json`;
      document.body.appendChild(el);
      el.click();
      el.remove();
      URL.revokeObjectURL(url);
      toast.info("Logs exported");
    } catch {
      toast.info("Could not export logs on this device");
    }
  };

  const onSeed = () => {
    if (
      confirm(
        "Load a demo shop?\n\n120 customers and ~2,200 entries are added, labelled 'demo' and removable via Reset Demo. Your real data is untouched."
      )
    )
      seedDemo();
  };
  const onResetDemo = () => {
    if (confirm("Remove all demo data?\n\nYour real contacts and entries are untouched."))
      resetDemo();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Founder / Developer Mode</h1>
        <p className="text-sm text-gray-600">Local diagnostics only — no tracking, no network.</p>
      </div>

      {/* Diagnostics */}
      <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="text-sm text-gray-600">{label}</span>
            <span className="text-sm font-semibold tabular-nums text-gray-900">{value}</span>
          </div>
        ))}
      </div>

      {/* Developer buttons */}
      <Card as="section" className="space-y-3">
        <h2 className="font-semibold text-gray-900">Developer actions</h2>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => checkIntegrity()}>
            Integrity check
          </Button>
          <Button variant="secondary" onClick={runPerf}>
            Performance report
          </Button>
          <Button variant="secondary" onClick={exportLogs}>
            Export logs
          </Button>
          <Button variant="secondary" onClick={onSeed}>
            Load demo shop
          </Button>
          <Button variant="danger" onClick={onResetDemo} className="col-span-2">
            Reset demo data
          </Button>
        </div>
      </Card>

      {/* Performance report result */}
      {perf && (
        <Card as="section" className="space-y-1">
          <h2 className="mb-1 font-semibold text-gray-900">Performance report</h2>
          <Row label="Recovery sweep" value={`${perf.sweepMs} ms`} />
          <Row label="Full data scan" value={`${perf.scanMs} ms`} />
          <Row label="Entries measured" value={String(perf.entries)} />
          <p className="pt-1 text-[11px] text-gray-500">
            Measured on this device against the current dataset.
          </p>
        </Card>
      )}

      {/* Integrity report (ENG-005) */}
      {integrity && (
        <Card as="section" className="space-y-2">
          <h2 className="font-semibold text-gray-900">Data integrity</h2>
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
        </Card>
      )}

      <p className="px-1 text-xs text-gray-500">
        These numbers come only from this browser. Vyora sends nothing anywhere.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold tabular-nums text-gray-900">{value}</span>
    </div>
  );
}
