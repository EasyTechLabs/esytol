"use client";

/**
 * Vyora Alpha — Data & backup. The merchant owns their data: back it up on the
 * device, export a file to keep it safe off-device, and import/restore to
 * recover. Every destructive action confirms first. No cloud, no accounts.
 */

import { useRef } from "react";
import { useVyora } from "../VyoraProvider";
import { formatDate } from "@/lib/vyora/format";

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
    reset,
  } = useVyora();
  const fileRef = useRef<HTMLInputElement>(null);

  if (!ready) return <div className="py-20 text-center text-gray-500">Loading…</div>;

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
    if (
      confirm(
        "Erase ALL Vyora data on this device? This cannot be undone. Export a backup first if you want to keep it."
      )
    )
      reset();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-900">Data &amp; backup</h1>

      {/* Backup on device */}
      <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
        <div>
          <h2 className="font-semibold text-gray-900">On-device backup</h2>
          <p className="text-sm text-gray-600">
            A safety copy on this phone — protects against an accidental change.{" "}
            {data.meta.lastBackupAt
              ? `Last backup: ${formatDate(data.meta.lastBackupAt)}.`
              : "No backup yet."}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={backup}
            className="rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
          >
            Back up now
          </button>
          <button
            type="button"
            onClick={onRestore}
            disabled={!hasBackup}
            className="rounded-xl border-2 border-gray-200 py-3 font-semibold text-gray-700 disabled:opacity-50"
          >
            Restore backup
          </button>
        </div>
      </section>

      {/* Export / Import file */}
      <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
        <div>
          <h2 className="font-semibold text-gray-900">Export &amp; import a file</h2>
          <p className="text-sm text-gray-600">
            Export keeps your data safe <em>off</em> this device (share it to yourself, or save it).
            Import restores from a file.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={exportData}
            className="rounded-xl bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            Export data
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-xl border-2 border-gray-200 py-3 font-semibold text-gray-700"
          >
            Import file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={onImportFile}
            className="hidden"
          />
        </div>
      </section>

      {/* Danger */}
      <section className="space-y-2 rounded-2xl border border-red-200 bg-red-50 p-4">
        <h2 className="font-semibold text-red-800">Clear everything</h2>
        <p className="text-sm text-red-700">
          Permanently erase all data on this device. Export a backup first if you want to keep it.
        </p>
        <button
          type="button"
          onClick={onReset}
          className="rounded-xl border-2 border-red-300 bg-white px-4 py-2.5 font-semibold text-red-700 hover:bg-red-100"
        >
          Clear all data
        </button>
      </section>

      <p className="px-1 text-xs text-gray-500">
        Everything is stored only in this browser. Nothing is sent to any server. On iPhone, add
        Vyora to your Home Screen so the browser doesn&rsquo;t clear your data.
      </p>
    </div>
  );
}
