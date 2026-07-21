"use client";

/**
 * Vyora Alpha — Data & backup. The merchant owns their data: back it up on the
 * device, export a file to keep it safe off-device, and import/restore to
 * recover. Every destructive action confirms first. No cloud, no accounts.
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useVyora } from "../VyoraProvider";
import { formatDateTime, formatMoney, CURRENCY_SYMBOLS } from "@/lib/vyora/format";
import type {
  TrashEntry,
  VyoraData,
  PaymentMode,
  ThemePref,
  DateFormatPref,
  NumberFormatPref,
} from "@/lib/vyora/types";
import { APP_VERSION, VERSION, storageSizeBytes } from "@/lib/vyora/store";
import { Card, Button, TextInput } from "../primitives";

const CURRENCIES = Object.keys(CURRENCY_SYMBOLS);
const LANGUAGES: { value: string; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी (Hindi)" },
  { value: "mr", label: "मराठी (Marathi)" },
  { value: "gu", label: "ગુજરાતી (Gujarati)" },
  { value: "ta", label: "தமிழ் (Tamil)" },
  { value: "te", label: "తెలుగు (Telugu)" },
  { value: "bn", label: "বাংলা (Bengali)" },
];
const CREDIT_DAYS: { value: number | null; label: string }[] = [
  { value: null, label: "No due date" },
  { value: 7, label: "7 days" },
  { value: 15, label: "15 days" },
  { value: 30, label: "30 days" },
  { value: 45, label: "45 days" },
  { value: 60, label: "60 days" },
  { value: 90, label: "90 days" },
];
const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank", label: "Bank" },
  { value: "cheque", label: "Cheque" },
];
const DATE_FORMATS: { value: DateFormatPref; label: string }[] = [
  { value: "relative", label: "Relative — Today, Yesterday, 12 Jul 2026" },
  { value: "dmy", label: "Date — 12 Jul 2026" },
  { value: "iso", label: "ISO — 2026-07-12" },
];
const NUMBER_FORMATS: { value: NumberFormatPref; label: string }[] = [
  { value: "indian", label: "Indian — 1,80,000" },
  { value: "international", label: "International — 180,000" },
];
const THEMES: { value: ThemePref; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/** A labelled form row. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

/** A styled native <select> (keeps the whole page working with no extra deps). */
function Select<T extends string | number | null>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={String(value)}
      onChange={(e) => {
        const picked = options.find((o) => String(o.value) === e.target.value);
        if (picked) onChange(picked.value);
      }}
      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** A read-only About row (label · value). */
function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium tabular-nums text-gray-900">{value}</span>
    </div>
  );
}

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
    settings,
    updateSettings,
    reset,
  } = useVyora();
  const fileRef = useRef<HTMLInputElement>(null);
  const trash = data.trash ?? [];

  // Business-profile text fields edit locally, then save in one commit.
  const [biz, setBiz] = useState({
    businessName: "",
    ownerName: "",
    mobile: "",
    address: "",
    gst: "",
  });
  useEffect(() => {
    setBiz({
      businessName: settings.businessName ?? "",
      ownerName: settings.ownerName ?? "",
      mobile: settings.mobile ?? "",
      address: settings.address ?? "",
      gst: settings.gst ?? "",
    });
  }, [settings.businessName, settings.ownerName, settings.mobile, settings.address, settings.gst]);
  const saveProfile = () =>
    updateSettings({
      businessName: biz.businessName.trim() || undefined,
      ownerName: biz.ownerName.trim() || undefined,
      mobile: biz.mobile.trim() || undefined,
      address: biz.address.trim() || undefined,
      gst: biz.gst.trim() || undefined,
    });

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
      <h1 className="text-lg font-semibold text-gray-900">Settings</h1>

      {/* Business profile — brands shared statements (P3-002) */}
      <Card as="section" className="space-y-3">
        <div>
          <h2 className="font-semibold text-gray-900">Business profile</h2>
          <p className="text-sm text-gray-600">
            Appears on the statements you share with customers.
          </p>
        </div>
        <Field label="Business name">
          <TextInput
            value={biz.businessName}
            onChange={(e) => setBiz({ ...biz, businessName: e.target.value })}
            placeholder="e.g. Sharma Traders"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Owner name">
            <TextInput
              value={biz.ownerName}
              onChange={(e) => setBiz({ ...biz, ownerName: e.target.value })}
              placeholder="Owner"
            />
          </Field>
          <Field label="Mobile">
            <TextInput
              value={biz.mobile}
              onChange={(e) => setBiz({ ...biz, mobile: e.target.value })}
              placeholder="Phone"
              inputMode="tel"
            />
          </Field>
        </div>
        <Field label="Address">
          <TextInput
            value={biz.address}
            onChange={(e) => setBiz({ ...biz, address: e.target.value })}
            placeholder="Shop address (optional)"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="GST (optional)">
            <TextInput
              value={biz.gst}
              onChange={(e) => setBiz({ ...biz, gst: e.target.value })}
              placeholder="GSTIN"
            />
          </Field>
          <Field label="Currency">
            <Select
              ariaLabel="Currency"
              value={settings.currency}
              options={CURRENCIES.map((c) => ({
                value: c,
                label: `${c} · ${CURRENCY_SYMBOLS[c]}`,
              }))}
              onChange={(v) => updateSettings({ currency: v })}
            />
          </Field>
        </div>
        <Field label="Language">
          <Select
            ariaLabel="Language"
            value={settings.language}
            options={LANGUAGES}
            onChange={(v) => updateSettings({ language: v })}
          />
        </Field>
        {settings.language !== "en" && (
          <p className="text-xs text-gray-500">
            The interface is in English today — your language choice is saved for upcoming
            translations.
          </p>
        )}
        <Button variant="primary" onClick={saveProfile} className="px-4 py-2.5">
          Save profile
        </Button>
      </Card>

      {/* Ledger preferences — seed new entries & drive display (P3-002) */}
      <Card as="section" className="space-y-3">
        <div>
          <h2 className="font-semibold text-gray-900">Ledger preferences</h2>
          <p className="text-sm text-gray-600">
            Sensible defaults so entries are faster to record.
          </p>
        </div>
        <Field label="Default credit days">
          <Select
            ariaLabel="Default credit days"
            value={settings.defaultCreditDays}
            options={CREDIT_DAYS}
            onChange={(v) => updateSettings({ defaultCreditDays: v })}
          />
        </Field>
        <Field label="Default payment mode">
          <Select
            ariaLabel="Default payment mode"
            value={settings.defaultPaymentMode}
            options={PAYMENT_MODES}
            onChange={(v) => updateSettings({ defaultPaymentMode: v })}
          />
        </Field>
        <Field label="Date format">
          <Select
            ariaLabel="Date format"
            value={settings.dateFormat}
            options={DATE_FORMATS}
            onChange={(v) => updateSettings({ dateFormat: v })}
          />
        </Field>
        <Field label="Number format">
          <Select
            ariaLabel="Number format"
            value={settings.numberFormat}
            options={NUMBER_FORMATS}
            onChange={(v) => updateSettings({ numberFormat: v })}
          />
        </Field>
      </Card>

      {/* Appearance (P3-002) */}
      <Card as="section" className="space-y-3">
        <div>
          <h2 className="font-semibold text-gray-900">Appearance</h2>
          <p className="text-sm text-gray-600">How Vyora looks on this device.</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map((t) => {
            const active = settings.theme === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => updateSettings({ theme: t.value })}
                aria-pressed={active}
                className={cn(
                  "rounded-xl border-2 px-3 py-2.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                  active
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-gray-200 bg-white text-gray-600"
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </Card>

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

      {/* About (P3-002) */}
      <Card as="section" className="space-y-1">
        <h2 className="mb-1 font-semibold text-gray-900">About</h2>
        <AboutRow label="App version" value={APP_VERSION} />
        <AboutRow label="Database version" value={`v${VERSION}`} />
        <AboutRow
          label="Backup status"
          value={lastBackup ? `Last backed up ${ago}` : "Never backed up"}
        />
        <AboutRow label="Storage used" value={formatBytes(storageSizeBytes())} />
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
