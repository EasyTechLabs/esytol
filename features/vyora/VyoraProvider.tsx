"use client";

/**
 * Vyora Alpha — the one client store the whole app reads and writes through. v0.2.
 *
 * Loads the merchant's data from localStorage on mount, exposes it plus a small
 * set of actions, and persists after every change. Every action reassures the
 * merchant with a toast; the three undoable actions (credit, payment, delete)
 * carry an inline Undo. Entries bind to a party by immutable id (never by typed
 * name), so a duplicate ledger can never be created by accident.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type {
  VyoraData,
  Party,
  EntryKind,
  PaymentKind,
  PaymentMode,
  PartyRef,
  VyoraSettings,
} from "@/lib/vyora/types";
import { partyNet, todayISO } from "@/lib/vyora/selectors";
import { formatMoney, configureFormat } from "@/lib/vyora/format";
import { runIntegrity, type IntegrityReport } from "@/lib/vyora/integrity";
import { applyImportPlan, type ImportPlan } from "@/lib/vyora/import";
import { buildLedgerEngine, type LedgerEngine } from "@/lib/vyora/engine";
import {
  appendEvent,
  compactEvents,
  EVENT_LOG_CAP,
  type LedgerEventSpec,
  type LedgerEvent,
} from "@/lib/vyora/events";
import { useToast } from "./Toast";

const nowISO = () => new Date().toISOString();

/** Append a ledger event (ARCH-002), compacting to a checkpoint past the cap. */
function logEvent(d: VyoraData, spec: LedgerEventSpec): VyoraData {
  const withEvt = appendEvent(d, spec, newId("evt"), nowISO());
  return (withEvt.events?.length ?? 0) > EVENT_LOG_CAP
    ? compactEvents(withEvt, newId("evt"), nowISO())
    : withEvt;
}

/** Reset the log to a single checkpoint carrying the current active ledger (bulk ops). */
function checkpoint(
  d: VyoraData,
  spec:
    | { type: "RestoreCompleted" | "Checkpoint" }
    | { type: "ImportCompleted"; summary: { contacts: number; entries: number } }
): VyoraData {
  const snapshot = { parties: d.parties, transactions: d.transactions, payments: d.payments };
  const event = { ...spec, snapshot, id: newId("evt"), at: nowISO() } as LedgerEvent;
  return { ...d, events: [event] };
}
import {
  emptyData,
  loadData,
  saveData,
  newId,
  defaultSettings,
  updateSettings as updateSettingsMut,
  addParty as addPartyMut,
  editParty as editPartyMut,
  resolvePartyRef,
  addTransaction as addTxnMut,
  addPayment as addPayMut,
  deleteEntry as deleteEntryMut,
  deleteContact as deleteContactMut,
  restoreFromTrash as restoreFromTrashMut,
  seedDemoData as seedDemoDataMut,
  clearDemoData as clearDemoDataMut,
  backupNow as backupNowMut,
  restoreBackup as restoreBackupStore,
  hasBackup,
  exportToFile,
  parseImportFile,
  type ImportResult,
  clearData,
} from "@/lib/vyora/store";

interface CreditInput {
  party: PartyRef;
  amount: number;
  kind: EntryKind;
  description?: string;
  reference?: string;
  date?: string;
  dueDate?: string;
}
interface PaymentInput {
  party: PartyRef;
  amount: number;
  kind: PaymentKind;
  mode?: PaymentMode;
  reference?: string;
  note?: string;
  date?: string;
}

interface VyoraContextValue {
  ready: boolean;
  data: VyoraData;
  hasBackup: boolean;
  settings: VyoraSettings;
  resolvedDark: boolean;
  /** The one normalized ledger index every screen reads from (ARCH-001). */
  engine: LedgerEngine;
  updateSettings: (patch: Partial<VyoraSettings>) => void;
  integrity: IntegrityReport | null;
  checkIntegrity: () => IntegrityReport;
  importLedger: (plan: ImportPlan) => { contacts: number; entries: number };
  seedDemo: () => void;
  resetDemo: () => void;
  recordCredit: (input: CreditInput) => string;
  recordPayment: (input: PaymentInput) => string;
  createParty: (input: { name: string; phone?: string; note?: string }) => Party;
  editParty: (id: string, patch: { name?: string; phone?: string; note?: string }) => void;
  deleteEntry: (id: string) => void;
  deleteContact: (id: string) => void;
  restoreDeleted: (trashId: string) => void;
  backup: () => void;
  restore: () => void;
  exportData: () => void;
  validateImport: (text: string) => ImportResult;
  applyImport: (data: VyoraData) => void;
  reset: () => void;
}

const VyoraContext = createContext<VyoraContextValue | null>(null);

function download(text: string, filename: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function VyoraProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const [data, setData] = useState<VyoraData>(emptyData);
  const [ready, setReady] = useState(false);
  const [backupExists, setBackupExists] = useState(false);
  const [systemDark, setSystemDark] = useState(false);
  const [integrity, setIntegrity] = useState<IntegrityReport | null>(null);

  useEffect(() => {
    const loaded = loadData();
    // Data Integrity (ENG-005): verify + safely repair at startup before anything reads it.
    const { data: checked, report } = runIntegrity(loaded, nowISO());
    // Event log (ARCH-002): seed a checkpoint for pre-event data so the log is
    // self-sufficient (state derivable) from the first load.
    const hasRecords =
      checked.parties.length > 0 || checked.transactions.length > 0 || checked.payments.length > 0;
    const seeded =
      (checked.events?.length ?? 0) === 0 && hasRecords
        ? compactEvents(checked, newId("evt"), nowISO())
        : checked;
    if (report.repaired || seeded !== checked) saveData(seeded); // persist repairs / seed
    configureFormat(seeded.settings ?? defaultSettings()); // apply currency/number/date prefs
    setData(seeded);
    setIntegrity(report);
    setBackupExists(hasBackup());
    setReady(true);
    if (!report.ok)
      toast.show({ message: "⚠ Data check found issues — see Founder Mode", tone: "warn" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track the OS colour scheme so a "System" appearance choice resolves correctly.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const commit = useCallback((next: VyoraData) => {
    setData(next);
    saveData(next);
  }, []);

  /** Restore a pre-action snapshot (session Undo). */
  const undoTo = useCallback(
    (prev: VyoraData) => {
      commit(prev);
      toast.info("Undone");
    },
    [commit, toast]
  );

  const recordCredit = useCallback(
    (input: CreditInput): string => {
      const prev = data;
      const { data: withParty, partyId } = resolvePartyRef(data, input.party);
      const { data: next, transaction } = addTxnMut(withParty, {
        partyId,
        amount: input.amount,
        kind: input.kind,
        description: input.description,
        reference: input.reference,
        date: input.date,
        dueDate: input.dueDate,
      });
      let logged = next;
      if (input.party.kind === "new") {
        const created = withParty.parties.find((p) => p.id === partyId);
        if (created) logged = logEvent(logged, { type: "ContactCreated", party: created });
      }
      logged = logEvent(logged, { type: "CreditRecorded", transaction });
      commit(logged);
      const net = partyNet(logged, partyId);
      toast.success(
        `✓ Credit recorded · Outstanding ${net >= 0 ? formatMoney(net) : `−${formatMoney(net)}`}`,
        { label: "Undo", onAction: () => undoTo(prev) }
      );
      return partyId;
    },
    [data, commit, toast, undoTo]
  );

  const recordPayment = useCallback(
    (input: PaymentInput): string => {
      const prev = data;
      const { data: withParty, partyId } = resolvePartyRef(data, input.party);
      const { data: next, payment } = addPayMut(withParty, {
        partyId,
        amount: input.amount,
        kind: input.kind,
        mode: input.mode,
        reference: input.reference,
        note: input.note,
        date: input.date,
      });
      let logged = next;
      if (input.party.kind === "new") {
        const created = withParty.parties.find((p) => p.id === partyId);
        if (created) logged = logEvent(logged, { type: "ContactCreated", party: created });
      }
      logged = logEvent(logged, { type: "PaymentRecorded", payment });
      commit(logged);
      const net = partyNet(logged, partyId);
      toast.success(
        net === 0
          ? "✓ Payment recorded · Account settled"
          : `✓ Payment recorded · Balance ${formatMoney(net)}`,
        { label: "Undo", onAction: () => undoTo(prev) }
      );
      return partyId;
    },
    [data, commit, toast, undoTo]
  );

  const createParty = useCallback(
    (input: { name: string; phone?: string; note?: string }): Party => {
      const { data: next, party } = addPartyMut(data, input);
      commit(logEvent(next, { type: "ContactCreated", party }));
      toast.success(`✓ Contact added · ${party.name}`);
      return party;
    },
    [data, commit, toast]
  );

  const editParty = useCallback(
    (id: string, patch: { name?: string; phone?: string; note?: string }) => {
      const next = editPartyMut(data, id, patch);
      const updated = next.parties.find((p) => p.id === id);
      commit(
        updated
          ? logEvent(next, {
              type: "ContactUpdated",
              partyId: id,
              patch: { name: updated.name, phone: updated.phone, note: updated.note },
            })
          : next
      );
      toast.success("✓ Contact updated");
    },
    [data, commit, toast]
  );

  const deleteEntry = useCallback(
    (id: string) => {
      const prev = data;
      commit(logEvent(deleteEntryMut(data, id), { type: "EntryDeleted", entryId: id }));
      toast.success("Entry deleted", { label: "Undo", onAction: () => undoTo(prev) });
    },
    [data, commit, toast, undoTo]
  );

  const deleteContact = useCallback(
    (id: string) => {
      const prev = data;
      const name = data.parties.find((p) => p.id === id)?.name ?? "Contact";
      commit(logEvent(deleteContactMut(data, id), { type: "ContactDeleted", partyId: id }));
      toast.success(`${name} deleted`, { label: "Undo", onAction: () => undoTo(prev) });
    },
    [data, commit, toast, undoTo]
  );

  const restoreDeleted = useCallback(
    (trashId: string) => {
      const entry = (data.trash ?? []).find((t) => t.id === trashId);
      let next = restoreFromTrashMut(data, trashId);
      if (entry) {
        for (const p of entry.parties) next = logEvent(next, { type: "ContactCreated", party: p });
        for (const t of entry.transactions)
          next = logEvent(next, { type: "CreditRecorded", transaction: t });
        for (const p of entry.payments)
          next = logEvent(next, { type: "PaymentRecorded", payment: p });
      }
      commit(next);
      toast.success("✓ Restored to your ledger");
    },
    [data, commit, toast]
  );

  const updateSettings = useCallback(
    (patch: Partial<VyoraSettings>) => {
      const next = updateSettingsMut(data, patch);
      configureFormat(next.settings ?? defaultSettings());
      commit(next);
      toast.success("✓ Settings saved");
    },
    [data, commit, toast]
  );

  // Integrity gate (ENG-005): any dataset entering from outside (import / restore)
  // is verified + safely repaired before it becomes the live ledger.
  const ingest = useCallback(
    (
      candidate: VyoraData,
      successMsg: string,
      eventType: "RestoreCompleted" | "ImportCompleted"
    ) => {
      const { data: checked, report } = runIntegrity(candidate, nowISO());
      configureFormat(checked.settings ?? defaultSettings());
      // Stamp when data last came in from outside (Last Restore, V1-003).
      const stamped = { ...checked, meta: { ...checked.meta, lastRestoreAt: nowISO() } };
      // A wholesale replace/merge is a checkpoint — the event carries the snapshot (ARCH-002).
      commit(
        eventType === "ImportCompleted"
          ? checkpoint(stamped, {
              type: "ImportCompleted",
              summary: {
                contacts: stamped.parties.length,
                entries: stamped.transactions.length + stamped.payments.length,
              },
            })
          : checkpoint(stamped, { type: "RestoreCompleted" })
      );
      setIntegrity(report);
      if (report.ok) toast.success(successMsg);
      else toast.show({ message: "⚠ Data check found issues — see Founder Mode", tone: "warn" });
    },
    [commit, toast]
  );

  const backup = useCallback(() => {
    const next = backupNowMut(data);
    commit(logEvent(next, { type: "BackupCreated" }));
    setBackupExists(true);
    toast.success("✓ Backup saved on this device");
  }, [data, commit, toast]);

  const restore = useCallback(() => {
    const restored = restoreBackupStore();
    if (!restored) {
      toast.info("No backup found on this device");
      return;
    }
    ingest(restored, "✓ Restored from your last backup", "RestoreCompleted");
  }, [ingest, toast]);

  const exportData = useCallback(() => {
    const { data: withCount, text, filename } = exportToFile(data);
    commit(withCount);
    download(text, filename);
    toast.success("✓ Exported — keep the file somewhere safe");
  }, [data, commit, toast]);

  const validateImport = useCallback((text: string) => parseImportFile(text, data), [data]);

  const applyImport = useCallback(
    (next: VyoraData) =>
      ingest(next, `✓ Imported · ${next.parties.length} contacts restored`, "ImportCompleted"),
    [ingest]
  );

  // Import Wizard (P3-005) — MERGE another app's ledger in, then verify integrity.
  const importLedger = useCallback(
    (plan: ImportPlan) => {
      const { data: merged, contacts, entries } = applyImportPlan(data, plan);
      const { data: checked } = runIntegrity(merged, nowISO());
      const stamped = { ...checked, meta: { ...checked.meta, lastRestoreAt: nowISO() } };
      commit(checkpoint(stamped, { type: "ImportCompleted", summary: { contacts, entries } }));
      toast.success(
        `✓ Imported · ${entries} entr${entries === 1 ? "y" : "ies"} · ${contacts} new contact${
          contacts === 1 ? "" : "s"
        }`
      );
      return { contacts, entries };
    },
    [data, commit, toast]
  );

  // Manual integrity check (Founder Mode) — verify + repair the current ledger.
  const checkIntegrity = useCallback((): IntegrityReport => {
    const { data: checked, report } = runIntegrity(data, nowISO());
    // A repair rewrites records → checkpoint so the event log stays consistent.
    if (report.repaired) commit(checkpoint(checked, { type: "Checkpoint" }));
    setIntegrity(report);
    return report;
  }, [data, commit]);

  // Founder Mode demo data (V1-003) — merge a demo book, or remove exactly it.
  // Both are bulk ledger changes → checkpoint (ARCH-002).
  const seedDemo = useCallback(() => {
    commit(checkpoint(seedDemoDataMut(data, todayISO()), { type: "Checkpoint" }));
    toast.success("✓ Demo data added");
  }, [data, commit, toast]);
  const resetDemo = useCallback(() => {
    commit(checkpoint(clearDemoDataMut(data), { type: "Checkpoint" }));
    toast.info("Demo data removed");
  }, [data, commit, toast]);

  const reset = useCallback(() => {
    clearData();
    setData(emptyData());
    toast.info("All data cleared from this device");
  }, [toast]);

  const settings = data.settings ?? defaultSettings();
  const resolvedDark = settings.theme === "dark" || (settings.theme === "system" && systemDark);

  // The Ledger Engine (ARCH-001) — rebuilt once per data change, in O(N). Every
  // screen reads its indexes instead of rescanning the ledger.
  const engine = useMemo(() => buildLedgerEngine(data, todayISO()), [data]);

  const value = useMemo<VyoraContextValue>(
    () => ({
      ready,
      data,
      hasBackup: backupExists,
      settings,
      resolvedDark,
      engine,
      updateSettings,
      integrity,
      checkIntegrity,
      importLedger,
      seedDemo,
      resetDemo,
      recordCredit,
      recordPayment,
      createParty,
      editParty,
      deleteEntry,
      deleteContact,
      restoreDeleted,
      backup,
      restore,
      exportData,
      validateImport,
      applyImport,
      reset,
    }),
    [
      ready,
      data,
      backupExists,
      settings,
      resolvedDark,
      engine,
      updateSettings,
      integrity,
      checkIntegrity,
      importLedger,
      seedDemo,
      resetDemo,
      recordCredit,
      recordPayment,
      createParty,
      editParty,
      deleteEntry,
      deleteContact,
      restoreDeleted,
      backup,
      restore,
      exportData,
      validateImport,
      applyImport,
      reset,
    ]
  );

  return <VyoraContext.Provider value={value}>{children}</VyoraContext.Provider>;
}

export function useVyora(): VyoraContextValue {
  const ctx = useContext(VyoraContext);
  if (!ctx) throw new Error("useVyora must be used within <VyoraProvider>");
  return ctx;
}

/** The shared Ledger Engine (ARCH-001) — the one index every screen reads from. */
export function useLedger(): LedgerEngine {
  return useVyora().engine;
}
