"use client";

/**
 * Vyora Alpha — Data & backup. The merchant owns their data: back it up on the
 * device, export a file to keep it safe off-device, and import/restore to
 * recover. Every destructive action confirms first. No cloud, no accounts.
 */

import { useRef } from "react";
import { useVyora } from "../VyoraProvider";
import { formatDate } from "@/lib/vyora/format";
import { Card, Button } from "../primitives";

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
      <Card as="section" className="space-y-3">
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
