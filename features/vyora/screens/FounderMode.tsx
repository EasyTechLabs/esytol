"use client";

/**
 * Vyora — Founder Mode (ENG-008).
 *
 * A hidden, **local-only** diagnostics screen. Reached by tapping the "Alpha"
 * badge five times; nothing links to it.
 *
 * Nothing here is sent anywhere. No network call, no telemetry, no analytics —
 * every number is read from the merchant's own device, in memory, on demand.
 * That is the deliberate privacy position recorded in `KnownIssues.md` K7, and
 * this screen is built to keep it rather than to work around it.
 *
 * Diagnostics are **off by default**. Opening this screen turns the debug bus
 * on; leaving it turns the bus off and clears the buffer, so a merchant is
 * never carrying a record of their afternoon around in memory.
 */

import { useEffect, useState } from "react";
import { useVyora } from "../VyoraProvider";
import {
  DEBUG_CAPACITY,
  clearDebug,
  debugRecords,
  runIntegrityChecks,
  setDebugEnabled,
  timingSummary,
  type IntegrityCheck,
} from "@/lib/vyora/debug";
import { Empty } from "../components";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">{value}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <h2 className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h2>
      <div className="divide-y divide-gray-100">{children}</div>
    </section>
  );
}

export function FounderMode() {
  const { ready, ledger, events, storageBytes } = useVyora();
  const [checks, setChecks] = useState<readonly IntegrityCheck[]>([]);
  const [tick, setTick] = useState(0);

  // Diagnostics live exactly as long as this screen does.
  useEffect(() => {
    setDebugEnabled(true);
    return () => setDebugEnabled(false);
  }, []);

  if (!ready) return <div className="py-20 text-center text-gray-400">Loading…</div>;

  const { statistics } = ledger;
  const timings = timingSummary();
  const records = debugRecords();
  const failed = checks.filter((c) => !c.ok).length;
  const backups = events.filter((e) => e.type === "BackupCreated");
  const lastBackup = backups[backups.length - 1]?.at.slice(0, 10) ?? "never";

  return (
    <div className="space-y-4 pb-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
        <h1 className="text-base font-bold text-amber-900">Founder Mode</h1>
        <p className="mt-0.5 text-xs leading-snug text-amber-800">
          Local diagnostics. Nothing on this screen is sent anywhere — no network, no telemetry.
          Recording stops when you leave.
        </p>
      </div>

      <Card title="Ledger">
        <Row label="Contacts" value={String(statistics.partyCount)} />
        <Row label="Credits" value={String(ledger.data.transactions.length)} />
        <Row label="Payments" value={String(ledger.data.payments.length)} />
        <Row label="Entries" value={String(statistics.entryCount)} />
        <Row label="Events in log" value={String(events.length)} />
        <Row label="Receivable" value={`₹${statistics.receivable}`} />
        <Row label="Payable" value={`₹${statistics.payable}`} />
        <Row label="Net" value={`₹${statistics.net}`} />
      </Card>

      <Card title="Device">
        <Row label="Storage used" value={formatBytes(storageBytes())} />
        <Row label="Log format version" value={String(ledger.data.version)} />
        <Row label="Last backup" value={lastBackup} />
        <Row
          label="Imports"
          value={String(events.filter((e) => e.type === "ImportCompleted").length)}
        />
        <Row
          label="Deletions"
          value={String(events.filter((e) => e.type === "EntryDeleted").length)}
        />
      </Card>

      <Card title="Integrity">
        {checks.length === 0 ? (
          <div className="px-4 py-3">
            <button
              type="button"
              onClick={() => setChecks(runIntegrityChecks(ledger))}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Run integrity checks
            </button>
          </div>
        ) : (
          <>
            <Row
              label={failed === 0 ? "All checks passed" : `${failed} FAILED`}
              value={`${checks.length - failed}/${checks.length}`}
            />
            {checks.map((check) => (
              <div key={check.name} className="flex items-baseline justify-between gap-3 px-4 py-2">
                <span
                  className={`text-xs ${check.ok ? "text-gray-600" : "font-bold text-red-700"}`}
                >
                  {check.ok ? "✓" : "✕"} {check.name}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-gray-400">
                  {check.detail}
                </span>
              </div>
            ))}
          </>
        )}
      </Card>

      <Card title={`Performance — last ${DEBUG_CAPACITY} samples`}>
        {timings.length === 0 ? (
          <div className="px-4 py-3 text-xs text-gray-500">
            Nothing recorded yet. Use the app, then come back.
          </div>
        ) : (
          timings.map((t) => (
            <Row
              key={t.channel + t.label}
              label={`${t.channel} · ${t.label} ×${t.count}`}
              value={`${t.meanMs.toFixed(2)} ms avg · ${t.maxMs.toFixed(2)} max`}
            />
          ))
        )}
      </Card>

      <Card title="Timeline">
        {records.length === 0 ? (
          <div className="px-4 py-3 text-xs text-gray-500">Empty.</div>
        ) : (
          records
            .slice(-25)
            .reverse()
            .map((r) => (
              <div key={r.seq} className="flex items-baseline justify-between gap-3 px-4 py-1.5">
                <span className="truncate text-[11px] text-gray-600">
                  {r.channel} · {r.label}
                  {r.ok === false ? " · FAILED" : ""}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-gray-400">
                  {r.durationMs.toFixed(2)} ms
                </span>
              </div>
            ))
        )}
      </Card>

      {records.length === 0 && timings.length === 0 && (
        <Empty title="No samples yet" subtitle="Record an entry, then return to this screen." />
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            clearDebug();
            setTick(tick + 1);
          }}
          className="rounded-xl border-2 border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700"
        >
          Clear samples
        </button>
        <button
          type="button"
          onClick={() => setChecks(runIntegrityChecks(ledger))}
          className="rounded-xl border-2 border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700"
        >
          Re-run checks
        </button>
      </div>
    </div>
  );
}
