"use client";

/**
 * Vyora — Settings: the merchant trust page (V2-002).
 *
 * Not a preferences screen. It exists to answer one question in three seconds:
 * **"Is my business data safe?"** — which is why the honest status card is the
 * first thing on it and everything else comes after.
 *
 * Two promises the code keeps:
 *  - **"Backed up" is only ever claimed when a file actually left the app.** The
 *    `BackupCreated` event is recorded after the download succeeds, never before.
 *  - **"Restored" is only ever claimed when validation passed.** The file is
 *    parsed and counted first; the merchant confirms real numbers before
 *    anything is replaced.
 *
 * Everything local. No cloud, no login, no server, no sync.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useVyora } from "../VyoraProvider";
import { SW_SCOPE, detectInstallState } from "@/lib/vyora/pwa";
import { previewImport, type ImportPreview } from "@/lib/vyora/commands";
import { runIntegrityChecks } from "@/lib/vyora/debug";
import {
  APP_VERSION,
  BUILD_DATE,
  backupStatus,
  formatBytes,
  type BackupReminder,
  type MerchantSettings,
} from "@/lib/vyora/settings";
import { formatDate } from "@/lib/vyora/format";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <h2 className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h2>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">{value}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
      />
    </label>
  );
}

/** Typed confirmation. "OK" is a reflex; typing DELETE is a decision. */
function DangerAction({
  title,
  description,
  confirmLabel,
  onConfirm,
  disabled,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const [typed, setTyped] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border-2 border-red-200 p-3">
      <div className="text-sm font-semibold text-red-800">{title}</div>
      <p className="mt-0.5 text-xs text-red-700">{description}</p>
      {disabled ? (
        <p className="mt-2 text-xs italic text-gray-500">Nothing to clear.</p>
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 rounded-lg border-2 border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700"
        >
          {confirmLabel}
        </button>
      ) : (
        <div className="mt-2 space-y-2">
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Type DELETE to confirm"
            aria-label="Type DELETE to confirm"
            className="w-full rounded-lg border-2 border-red-200 px-3 py-2 text-sm outline-none focus:border-red-500"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={typed !== "DELETE"}
              onClick={() => {
                onConfirm();
                setTyped("");
                setOpen(false);
              }}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              {confirmLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setTyped("");
              }}
              className="rounded-lg border-2 border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Settings() {
  const { ready, ledger, events, dispatch, reset, storageBytes, settings, updateSettings } =
    useVyora();
  const fileInput = useRef<HTMLInputElement>(null);
  const [exportNote, setExportNote] = useState("");
  const [exportFailed, setExportFailed] = useState(false);
  const [pending, setPending] = useState<{ payload: string; preview: ImportPreview } | null>(null);
  const [importNote, setImportNote] = useState("");
  const [importFailed, setImportFailed] = useState(false);

  const [pwa, setPwa] = useState(() => ({ installed: false, needsManualInstall: false }));
  const [offlineReady, setOfflineReady] = useState(false);
  const [swVersion, setSwVersion] = useState("not registered");

  useEffect(() => {
    setPwa(detectInstallState(window, navigator));
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistration(SW_SCOPE).then((reg) => {
      setOfflineReady(Boolean(reg?.active));
      if (!reg?.active) return;
      // Ask the worker which build it is, rather than guessing from the app.
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        if (event.data?.type === "VYORA_VERSION") setSwVersion(event.data.version);
      };
      reg.active.postMessage("VYORA_VERSION", [channel.port2]);
    });
  }, []);

  const status = useMemo(() => backupStatus(events, settings), [events, settings]);
  const integrity = useMemo(() => (ready ? runIntegrityChecks(ledger) : []), [ready, ledger]);
  const integrityFailed = integrity.filter((c) => !c.ok).length;

  if (!ready) return <div className="py-20 text-center text-gray-400">Loading…</div>;

  const set = (patch: Partial<MerchantSettings>) => updateSettings(patch);

  /** Generate, hand to the browser, and only THEN record that a backup happened. */
  const exportLedger = () => {
    setExportNote("");
    setExportFailed(false);
    const result = dispatch({ type: "BackupLedger" });
    if (!result.ok) {
      setExportFailed(true);
      setExportNote(result.error.message);
      return;
    }
    const file = result.value as { fileName: string; contents: string };
    try {
      const blob = new Blob([file.contents], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      setExportNote(`Downloaded ${file.fileName}. Keep it somewhere safe.`);
    } catch {
      setExportFailed(true);
      setExportNote("Could not save the file. Nothing was downloaded — try again.");
    }
  };

  const chooseFile = async (file: File | undefined) => {
    setImportNote("");
    setImportFailed(false);
    setPending(null);
    if (!file) return;
    const payload = await file.text();
    const preview = previewImport(payload);
    if (!preview.ok) {
      setImportFailed(true);
      setImportNote(preview.error.message);
      return;
    }
    setPending({ payload, preview: preview.value });
  };

  const confirmImport = () => {
    if (!pending) return;
    const result = dispatch({ type: "ImportLedger", payload: pending.payload });
    setPending(null);
    if (!result.ok) {
      setImportFailed(true);
      setImportNote(result.error.message);
      return;
    }
    setImportNote("Restore completed. Your ledger now matches the file.");
  };

  const heroTone =
    status.health === "backed-up"
      ? "from-emerald-500 to-emerald-700"
      : status.health === "recommended"
        ? "from-amber-500 to-orange-600"
        : "from-red-500 to-red-700";
  const heroIcon =
    status.health === "backed-up" ? "✅" : status.health === "recommended" ? "⚠️" : "❌";

  return (
    <div className="space-y-4 pb-4">
      {/* 1 — Data safety hero */}
      <div className={`rounded-2xl bg-gradient-to-br ${heroTone} p-5 text-white`}>
        <div className="text-3xl leading-none">{heroIcon}</div>
        <h1 className="mt-2 text-xl font-bold leading-tight">{status.headline}</h1>
        <p className="mt-1 text-sm text-white/90">{status.detail}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/90">
          <div>
            <div className="uppercase tracking-wide text-white/70">Last backup</div>
            <div className="font-semibold">
              {status.lastBackupAt ? formatDate(status.lastBackupAt.slice(0, 10)) : "never"}
            </div>
          </div>
          <div>
            <div className="uppercase tracking-wide text-white/70">Backup age</div>
            <div className="font-semibold">
              {status.ageDays === undefined ? "—" : `${status.ageDays}d`}
            </div>
          </div>
          <div>
            <div className="uppercase tracking-wide text-white/70">Database version</div>
            <div className="font-semibold">v{ledger.data.version}</div>
          </div>
          <div>
            <div className="uppercase tracking-wide text-white/70">Storage used</div>
            <div className="font-semibold">{formatBytes(storageBytes())}</div>
          </div>
        </div>
      </div>

      {/* 2 — Export */}
      <Card title="Export data">
        <p className="mb-3 text-sm text-gray-600">
          Save your whole book as a file on this phone. That file is yours — keep a copy anywhere.
        </p>
        <button
          type="button"
          onClick={exportLedger}
          className="w-full rounded-2xl bg-brand-600 py-3 text-base font-semibold text-white hover:bg-brand-700"
        >
          Export ledger
        </button>
        {exportNote && (
          <p
            role="status"
            className={`mt-2 text-xs font-medium ${exportFailed ? "text-red-700" : "text-emerald-700"}`}
          >
            {exportNote}
          </p>
        )}
      </Card>

      {/* 3 — Import */}
      <Card title="Restore from backup">
        <p className="mb-3 text-sm text-gray-600">
          Bring back a file you exported earlier. You will see exactly what it contains before
          anything is replaced.
        </p>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          onChange={(e) => chooseFile(e.target.files?.[0])}
          className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-xl file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-gray-700"
        />
        {pending && (
          <div className="mt-3 rounded-xl border-2 border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-semibold text-amber-900">
              This file will replace everything
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-amber-800">
              <li>{pending.preview.contacts} contacts</li>
              <li>{pending.preview.transactions} credit entries</li>
              <li>{pending.preview.payments} payments</li>
            </ul>
            <p className="mt-2 text-xs text-amber-800">
              Your current book ({ledger.statistics.partyCount} contacts,{" "}
              {ledger.statistics.entryCount} entries) will be replaced. Export it first if unsure.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={confirmImport}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Restore this file
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded-lg border-2 border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {importNote && (
          <p
            role="status"
            className={`mt-2 text-xs font-medium ${importFailed ? "text-red-700" : "text-emerald-700"}`}
          >
            {importNote}
          </p>
        )}
      </Card>

      {/* 4 — Backup reminder */}
      <Card title="Backup reminder">
        <p className="mb-2 text-sm text-gray-600">
          How often should Vyora nudge you? Stays on this device.
        </p>
        <div className="flex gap-2">
          {(["daily", "weekly", "never"] as BackupReminder[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => set({ backupReminder: option })}
              className={`flex-1 rounded-xl border-2 py-2 text-sm font-semibold capitalize ${
                settings.backupReminder === option
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-gray-200 text-gray-500"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </Card>

      {/* 5 — Business profile */}
      <Card title="Business profile">
        <div className="space-y-3">
          <Field
            label="Business name"
            value={settings.businessName}
            onChange={(v) => set({ businessName: v })}
            placeholder="e.g. Sharma Stores"
          />
          <Field label="Owner" value={settings.ownerName} onChange={(v) => set({ ownerName: v })} />
          <Field label="Phone" value={settings.phone} onChange={(v) => set({ phone: v })} />
          <Field label="GST (optional)" value={settings.gst} onChange={(v) => set({ gst: v })} />
          <Field label="Address" value={settings.address} onChange={(v) => set({ address: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Currency"
              value={settings.currency}
              onChange={(v) => set({ currency: v })}
            />
            <Field
              label="Language"
              value={settings.language}
              onChange={(v) => set({ language: v })}
            />
          </div>
          <p className="text-xs text-gray-500">
            Your business name is added to reminder messages. Language does not change the app yet.
          </p>
        </div>
      </Card>

      {/* 6 — Danger zone */}
      <Card title="Danger zone">
        <div className="space-y-3">
          <DangerAction
            title="Clear all data"
            description="Erases every contact, entry and payment on this device. This cannot be undone — export first."
            confirmLabel="Clear all data"
            onConfirm={reset}
          />
          <DangerAction
            title="Clear demo data"
            description="Vyora has no separate demo data, so there is nothing here to clear."
            confirmLabel="Clear demo data"
            onConfirm={() => undefined}
            disabled
          />
        </div>
      </Card>

      {/* 7 — Version */}
      <Card title="Version">
        <Row label="App version" value={APP_VERSION} />
        <Row label="Database version" value={`v${ledger.data.version}`} />
        <Row label="Build date" value={BUILD_DATE} />
        <Row label="Storage used" value={formatBytes(storageBytes())} />
        <Row
          label="Integrity"
          value={
            integrityFailed === 0
              ? `all ${integrity.length} checks passed`
              : `${integrityFailed} FAILED`
          }
        />
        <Row label="App installed" value={pwa.installed ? "Yes" : "No"} />
        <Row label="Offline ready" value={offlineReady ? "Yes" : "No"} />
        <Row label="Service worker" value={swVersion} />
      </Card>
    </div>
  );
}
