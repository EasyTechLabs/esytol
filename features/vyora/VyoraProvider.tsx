"use client";

/**
 * Vyora — the one client store the whole app reads and writes through.
 *
 * Since ARCH-003 the provider does not decide anything. It dispatches
 * **commands**, and the command engine validates, executes and emits:
 *
 *     Command ──executeCommand──► LedgerEvent[] ──► VyoraData ──► Ledger
 *
 * The provider's remaining jobs are exactly three: hold the state, apply the
 * events a command returned, and persist the log. Every business rule lives in
 * `lib/vyora/commands.ts`; no rule lives in a component.
 *
 * Both derivations stay incremental on the capture path — a clean single-entry
 * append folds into the previous projection and the previous indexes, so the
 * log is never re-read and the ledger never re-derived just to record an entry.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { VyoraData } from "@/lib/vyora/types";
import type { Ledger, LedgerAppend } from "@/lib/vyora/ledger";
import { appendToLedger } from "@/lib/vyora/ledger";
import { cacheLedger, ledgerFor } from "@/lib/vyora/selectors";
import type { LedgerEvent } from "@/lib/vyora/events";
import { applyEvent, emptyData, reduceEvents } from "@/lib/vyora/events";
import type { Command, CommandContext, CommandError, CommandResult } from "@/lib/vyora/commands";
import { executeCommand, validateCommand } from "@/lib/vyora/commands";
import type { MerchantSettings } from "@/lib/vyora/settings";
import { DEFAULT_SETTINGS } from "@/lib/vyora/settings";
import { touchRecent } from "@/lib/vyora/productivity";
import type { Feedback } from "@/lib/vyora/feedback";
import { successFeedback } from "@/lib/vyora/feedback";
import { Toast } from "./Toast";
import type { PwaFlags } from "@/lib/vyora/pwa";
import { DEFAULT_PWA_FLAGS } from "@/lib/vyora/pwa";
import {
  clearLog,
  loadLog,
  loadPwaFlags,
  loadSettings,
  saveLog,
  savePwaFlags,
  saveSettings,
  storageSizeBytes,
} from "@/lib/vyora/store";
import { time } from "@/lib/vyora/debug";

interface VyoraState {
  events: readonly LedgerEvent[];
  ledger: Ledger;
}

interface VyoraContextValue {
  /** True once the stored log has been read (avoids SSR/hydration flash). */
  ready: boolean;
  /** Every derived index for the current projection — the only read surface. */
  ledger: Ledger;
  /** The current projection. Read indexes instead unless you need the raw rows. */
  data: VyoraData;
  /** The append-only history this device holds. The audit trail. */
  events: readonly LedgerEvent[];
  /** Run a command. The ONLY way to change anything. */
  dispatch: (command: Command) => CommandResult;
  /** Why this command would be rejected, or null. Drives both buttons and messages. */
  check: (command: Command) => CommandError | null;
  /** Erase everything on this device (with confirmation in the UI). */
  reset: () => void;
  /** Bytes this device is holding for Vyora. Founder Mode only. */
  storageBytes: () => number;
  /** The merchant's own profile and preferences. Local only. */
  settings: MerchantSettings;
  /** Persist a change to the profile. */
  updateSettings: (patch: Partial<MerchantSettings>) => void;
  /** Install-banner / tutorial state for THIS browser. Survives "clear all data". */
  pwaFlags: PwaFlags;
  setPwaFlags: (patch: Partial<PwaFlags>) => void;
}

const VyoraContext = createContext<VyoraContextValue | null>(null);

/**
 * The device refused the write. Reported as a command failure so every caller —
 * screens, workflow machines, tests — handles it through the path they already
 * use for rejections, rather than needing a second notion of "it failed".
 */
const STORAGE_FULL: CommandError = {
  code: "STORAGE_FULL",
  message: "This device is out of space, so nothing was saved. Export a backup, then try again.",
};

function initialState(): VyoraState {
  return { events: [], ledger: ledgerFor(emptyData()) };
}

/**
 * Recognise the one shape the index engine can fold incrementally: an entry
 * being recorded, optionally preceded by the contact it was recorded against.
 *
 * Deriving this from the events rather than having each call site remember to
 * pass it means a new command gets the fast path for free when it qualifies,
 * and correctly misses it when it does not. `appendToLedger` re-checks anyway
 * and rebuilds if anything is off — a restored entry, for instance, is not the
 * newest and so correctly falls back.
 */
function toLedgerAppend(events: readonly LedgerEvent[]): LedgerAppend | undefined {
  if (events.length === 0 || events.length > 2) return undefined;
  const first = events.length === 2 ? events[0] : undefined;
  if (first && first.type !== "ContactCreated") return undefined;
  const party = first?.type === "ContactCreated" ? first.party : undefined;
  const last = events[events.length - 1];
  if (last.type === "CreditRecorded") return { party, transaction: last.transaction };
  if (last.type === "PaymentRecorded") return { party, payment: last.payment };
  return undefined;
}

export function VyoraProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<VyoraState>(initialState);
  const [ready, setReady] = useState(false);

  const [settings, setSettings] = useState<MerchantSettings>(DEFAULT_SETTINGS);
  const [pwaFlags, setPwaFlagsState] = useState<PwaFlags>(DEFAULT_PWA_FLAGS);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    const events = loadLog();
    setState({ events, ledger: ledgerFor(reduceEvents(events)) });
    setSettings(loadSettings());
    setPwaFlagsState(loadPwaFlags());
    setReady(true);
  }, []);

  const updateSettings = useCallback((patch: Partial<MerchantSettings>) => {
    setSettings((previous) => {
      const next = { ...previous, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const setPwaFlags = useCallback((patch: Partial<PwaFlags>) => {
    setPwaFlagsState((previous) => {
      const next = { ...previous, ...patch };
      savePwaFlags(next);
      return next;
    });
  }, []);

  const context = useMemo<CommandContext>(
    () => ({ ledger: state.ledger, events: state.events }),
    [state]
  );

  const dispatch = useCallback(
    (command: Command): CommandResult => {
      const result = time("command", command.type, () => executeCommand(context, command));

      // One place decides what every completed action says. Screens never write
      // their own confirmation, so there is exactly one toast in the app.
      // A failed WRITE overrides this below — never confirm an unsaved entry.
      setFeedback(successFeedback(command, result));

      if (!result.ok || result.events.length === 0) return result;

      const events = [...state.events, ...result.events];
      const data = result.events.reduce(applyEvent, state.ledger.data);
      const append = toLedgerAppend(result.events);
      const ledger = append
        ? time("selector", "appendToLedger", () => appendToLedger(state.ledger, data, append))
        : ledgerFor(data);

      setState({ events, ledger: cacheLedger(ledger) });

      // The entry is in memory; whether it reached the device is a separate
      // question. A quota-exhausted or blocked write used to return `false`
      // silently while the merchant read a success toast — so the entry looked
      // saved and vanished on the next open. Never confirm what was not stored.
      if (!saveLog(events)) {
        setFeedback({
          message: "NOT SAVED — this device is out of space. Export a backup, then retry.",
          tone: "warning",
        });
        return { ok: false, error: STORAGE_FULL };
      }

      // Remember what the merchant just used, so the next capture is fewer
      // taps. Derived from the events, so any command that records an entry
      // gets this for free.
      const entry = result.events.find(
        (e) => e.type === "CreditRecorded" || e.type === "PaymentRecorded"
      );
      if (entry) {
        const row = entry.type === "CreditRecorded" ? entry.transaction : entry.payment;
        setSettings((previous) => {
          const next: MerchantSettings = {
            ...previous,
            recentContactIds: touchRecent(previous.recentContactIds, row.partyId),
            lastAmount: row.amount,
          };
          saveSettings(next);
          return next;
        });
      }
      return result;
    },
    [context, state]
  );

  const check = useCallback((command: Command) => validateCommand(context, command), [context]);

  const reset = useCallback(() => {
    clearLog();
    setState(initialState());
  }, []);

  const value = useMemo<VyoraContextValue>(
    () => ({
      ready,
      ledger: state.ledger,
      data: state.ledger.data,
      events: state.events,
      dispatch,
      check,
      reset,
      storageBytes: storageSizeBytes,
      settings,
      updateSettings,
      pwaFlags,
      setPwaFlags,
    }),
    [ready, state, dispatch, check, reset, settings, updateSettings, pwaFlags, setPwaFlags]
  );

  return (
    <VyoraContext.Provider value={value}>
      {children}
      <Toast feedback={feedback} onDone={() => setFeedback(null)} />
    </VyoraContext.Provider>
  );
}

export function useVyora(): VyoraContextValue {
  const ctx = useContext(VyoraContext);
  if (!ctx) throw new Error("useVyora must be used within <VyoraProvider>");
  return ctx;
}
