"use client";

/**
 * Vyora Alpha — Data & backup. The merchant owns their data: back it up on the
 * device, export a file to keep it safe off-device, and import/restore to
 * recover. Every destructive action confirms first. No cloud, no accounts.
 */

import { useRef } from "react";
import { useVyora } from "../VyoraProvider";
import { formatDateTime, formatMoney } from "@/lib/vyora/format";
import type { TrashEntry, VyoraData } from "@/lib/vyora/types";
import { Card, Button } from "../primitives";

/** Human summary of a recently-deleted record (P3-001) for the Restore list. */
function describeTrash(entry: TrashEntry, data: VyoraData): { title: string; sub: string } {
  const nameOf = (id: string) => data.parties.find((x) => x.id === id)?.name ?? "Contact";
  if (entry.kind === "contact") {
    const count = entry.transactions.length + entry.payments.length;
    return {
      title: entry.parties[0]?.name ?? "Contact",
      sub: `Contact · ${count} entr${count === 1 ? "y" : "ies"}`,
    };
  }
  const t = entry.transactions[0];
  if (t) {
    return {
      title: `${t.kind === "given" ? "Credit given" : "Credit taken"} · ${formatMoney(t.amount)}`,
      sub: nameOf(t.partyId),
    };
  }
  const p = entry.payments[0];
  if (p) {
    return {
      title: `${p.kind === "received" ? "Payment received" : "Payment made"} · ${formatMoney(p.amount)}`,
      sub: nameOf(p.partyId),
    };
  }
  return { title: "Deleted entry", sub: "" };
}

export function Settings() {
  const {
    ready,
    data,
    hasBackup,
    backup,
    restore,
    exportData,
    validateImport,
    applyImport,
    restoreDeleted,
    reset,
  } = useVyora();
  const fileRef = useRef<HTMLInputElement>(null);
  const trash = data.trash ?? [];

  if (!ready) return <div className="py-20 text-center text-gray-500">Loading…</div>;

  const lastBackup = data.meta.lastBackupAt;
  const backupAgeDays =
    lastBackup && !Number.isNaN(new Date(lastBackup).getTime())
      ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86_400_000)
      : null;
  const backupStale = backupAgeDays === null || backupAgeDays > 7;
  const ago =
    backupAgeDays === null
      ? ""
      : backupAgeDays === 0
        ? "today"
        : `${backupAgeDays} day${backupAgeDays === 1 ? "" : "s"} ago`;

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file
    if (!file) return;
    let text = "";
    try {
      text = await file.text();
    } catch {
      alert("Could not read that file.");
      return;
    }
    const res = validateImport(text);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    const ok = confirm(
      `Import will REPLACE everything currently on this device with:\n\n` +
        `• ${res.summary.parties} contacts\n• ${res.summary.transactions} credit entries\n• ${res.summary.payments} payments\n\n` +
        `Your current data will be overwritten. Continue?`
    );
    if (ok) applyImport(res.data);
  };

  const onRestore = () => {
    if (confirm("Restore your last on-device backup? This replaces the current data.")) restore();
  };
  const onReset = () => {
    const parties = data.parties.length;
    const entries = data.transactions.length + data.payments.length;
    const note =
      lastBackup && !backupStale
        ? `You last backed up ${ago}.`
        : "⚠️ You have NOT backed up recently. Export a backup first, or this data is gone for good.";
    if (
      confirm(
        `Erase ALL Vyora data on this device?\n\n` +
          `This permanently deletes ${parties} contact${parties === 1 ? "" : "s"} and ` +
          `${entries} entr${entries === 1 ? "y" : "ies"}. It cannot be undone.\n\n` +
          `${note}\n\nContinue?`
      )
    )
      reset();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-900">Data &amp; backup</h1>

      {/* Backup on device */}
      <Card as="section" className="space-y-3">
        <div>
          <h2 className="font-semibold text-gray-900">On-device backup</h2>
          <p className="text-sm text-gray-600">
            A safety copy on this phone — protects against an accidental change.
          </p>
          {lastBackup ? (
            <p
              className={`mt-1 text-sm ${backupStale ? "font-medium text-amber-700" : "text-gray-700"}`}
            >
              <span className={backupStale ? "" : "text-positive-strong"}>●</span> Last backup:{" "}
              <span className="font-medium">{formatDateTime(lastBackup)}</span> · {ago}
              {backupStale && " — back up again to stay safe."}
            </p>
          ) : (
            <p className="mt-1 text-sm font-medium text-red-700">
              ● Never backed up on this device — back up (and export a copy) now.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="primary" block onClick={backup}>
            Back up now
          </Button>
          <Button variant="secondary" block disabled={!hasBackup} onClick={onRestore}>
            Restore backup
          </Button>
        </div>
      </Card>

      {/* Export / Import file */}
      <Card as="section" className="space-y-3">
        <div>
          <h2 className="font-semibold text-gray-900">Export &amp; import a file</h2>
          <p className="text-sm text-gray-600">
            Export keeps your data safe <em>off</em> this device (share it to yourself, or save it).
            Import restores from a file.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="positive" block onClick={exportData}>
            Export data
          </Button>
          <Button variant="secondary" block onClick={() => fileRef.current?.click()}>
            Import file
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={onImportFile}
            className="hidden"
          />
        </div>
      </Card>

      {/* Recently deleted — restore anything removed in the last 30 days (P3-001) */}
      <Card as="section" className="space-y-3">
        <div>
          <h2 className="font-semibold text-gray-900">Recently deleted</h2>
          <p className="text-sm text-gray-600">
            Deleted contacts and entries are kept here for 30 days. Restore anything you removed by
            mistake.
          </p>
        </div>
        {trash.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
            Nothing deleted in the last 30 days.
          </p>
        ) : (
          <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
            {trash.map((entry) => {
              const { title, sub } = describeTrash(entry, data);
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 bg-white px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-800">{title}</div>
                    <div className="truncate text-xs text-gray-500">
                      {sub ? `${sub} · ` : ""}Deleted {formatDateTime(entry.deletedAt)}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={() => restoreDeleted(entry.id)}
                  >
                    Restore
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Danger */}
      <Card as="section" tone="danger" className="space-y-2">
        <h2 className="font-semibold text-red-800">Clear everything</h2>
        <p className="text-sm text-red-700">
          Permanently erase all data on this device. Export a backup first if you want to keep it.
        </p>
        <Button variant="danger" onClick={onReset} className="px-4 py-2.5">
          Clear all data
        </Button>
      </Card>

      <p className="px-1 text-xs text-gray-500">
        Everything is stored only in this browser. Nothing is sent to any server. On iPhone, add
        Vyora to your Home Screen so the browser doesn&rsquo;t clear your data.
      </p>
    </div>
  );
}
