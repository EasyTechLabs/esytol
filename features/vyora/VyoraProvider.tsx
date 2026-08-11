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

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { VyoraData } from "@/lib/vyora/types";
import type { Ledger, LedgerAppend } from "@/lib/vyora/ledger";
import { appendToLedger } from "@/lib/vyora/ledger";
import { cacheLedger, ledgerFor } from "@/lib/vyora/selectors";
import type { LedgerEvent } from "@/lib/vyora/events";
import { applyEvent, emptyData, newId, reduceEvents } from "@/lib/vyora/events";
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
import { latestInstantMs } from "@/lib/vyora/backup";
import { nowISO } from "@/lib/vyora/clock";
import { hasWebLocks, withLedgerLock } from "@/lib/vyora/locks";
import {
  STALE_AFTER_MS,
  claimWriting,
  isWriting,
  releaseWriting,
  writerElsewhere,
} from "@/lib/vyora/writer";
import {
  LOG_KEY,
  clearLog,
  loadClockFloor,
  loadLog,
  loadPwaFlags,
  loadSettings,
  readRawLog,
  saveClockFloor,
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
  /**
   * Run a command. The ONLY way to change anything.
   *
   * Async because the write is serialised across tabs with `navigator.locks`,
   * which is promise-based — see `lib/vyora/locks.ts`. Await it before reading
   * the result or the ledger.
   */
  dispatch: (command: Command) => Promise<CommandResult>;
  /** Why this command would be rejected, or null. Drives both buttons and messages. */
  check: (command: Command) => CommandError | null;
  /**
   * Can this tab record anything?
   *
   * False only where the browser has no `navigator.locks` **and** another tab
   * already holds the writer claim. Screens should show a read-only notice
   * rather than letting a merchant fill in a form that cannot be saved.
   */
  writable: boolean;
  /**
   * Replace this book with a validated backup's events. Replace-only: no merge,
   * no snapshot event, no network. Validate the file before calling.
   */
  restore: (events: readonly LedgerEvent[]) => Promise<CommandResult>;
  /** Erase everything on this device (with confirmation in the UI). */
  reset: () => Promise<void>;
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

/**
 * This browser cannot serialise writes between tabs, and another tab is the one
 * doing the writing. Refusing is the honest outcome: letting this tab save would
 * overwrite whatever the other tab has recorded since this one loaded.
 */
const READ_ONLY_TAB: CommandError = {
  code: "READ_ONLY_TAB",
  message:
    "This tab is read-only because Vyora is already open in another tab. Use that tab, or close it and reload this one.",
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

  /**
   * False only on browsers without Web Locks, in a tab that does not hold the
   * writer claim. Everywhere else every tab writes, serialised by the lock.
   */
  const [writable, setWritable] = useState(true);
  /** Identifies this tab to the writer claim. Never leaves the device. */
  const tabId = useRef(newId("tab"));

  /** Writes in progress. A tab is busy until the whole locked write completes. */
  const inFlight = useRef(0);
  /**
   * The stored log exactly as this tab last saw it.
   *
   * A write compares this against storage to tell "nothing has changed, my
   * projection is current" from "another tab appended". Equal means the
   * incremental append path still applies; different means re-fold before doing
   * anything, because executing against a stale projection is how an entry gets
   * overwritten even while the lock is held.
   */
  const lastSeenRaw = useRef<string | null>(null);

  useEffect(() => {
    const events = loadLog();
    // Before anything can be recorded. The clock's "never the same instant
    // twice" guarantee is per-page; the floor that carries it across a reload —
    // or a device clock moved backwards — is on the device.
    nowISO.seed(loadClockFloor(events));
    lastSeenRaw.current = readRawLog();
    setState({ events, ledger: ledgerFor(reduceEvents(events)) });
    setSettings(loadSettings());
    setPwaFlagsState(loadPwaFlags());
    setReady(true);
  }, []);

  /**
   * Another tab wrote. Pick up its work.
   *
   * `storage` fires only in the *other* tabs of an origin, never in the one that
   * wrote — exactly the semantics needed, and it needs no channel to be opened.
   * A tab mid-write is skipped: it is inside the lock and about to re-read
   * anyway, and replacing its state underneath itself would discard the entry
   * the merchant is currently recording.
   */
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== LOG_KEY) return;
      if (inFlight.current > 0) return;
      const events = loadLog();
      lastSeenRaw.current = readRawLog();
      setState({ events, ledger: ledgerFor(reduceEvents(events)) });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /**
   * May this tab write?
   *
   * With Web Locks, yes — every tab can write, because the lock serialises them.
   * Without it there is no way to make two tabs safe, so exactly one holds a
   * claim and the rest go read-only rather than being told a comforting lie.
   */
  useEffect(() => {
    if (hasWebLocks()) {
      setWritable(true);
      return;
    }

    const id = tabId.current;
    const sync = () => {
      // Refresh a claim this tab already holds — that is what tells the others
      // it is still alive. Never take one merely by being open: a session that
      // only reads, or one using the remote party source, must write nothing.
      // The claim is taken at the first actual write instead.
      if (isWriting(id)) {
        claimWriting(id);
        setWritable(true);
        return;
      }
      setWritable(!writerElsewhere(id));
    };
    sync();

    // Liveness, not a retry loop: nothing here waits on or races for a lock.
    const timer = window.setInterval(sync, Math.floor(STALE_AFTER_MS / 3));
    const release = () => releaseWriting(id);
    window.addEventListener("pagehide", release);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", release);
      release();
    };
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

  /**
   * Run a command. The only way to change anything.
   *
   * **Async, and it has to be.** The whole read-modify-write runs inside one
   * critical section — fresh read, execute, append, persist, verify — and
   * `navigator.locks` is the only cross-tab mutex browsers offer, which is
   * promise-based. Serialising a narrower slice would not help: two tabs each
   * computing from their own stale projection still produce a log missing one
   * of them, so re-reading *inside* the lock is the part that does the work.
   */
  const dispatch = useCallback(
    async (command: Command): Promise<CommandResult> => {
      // Exclusivity is established here, at the moment it matters. With Web
      // Locks every tab may write and the lock serialises them; without it,
      // exactly one tab may hold the claim and the rest refuse before computing
      // anything — so no id and no instant is spent on a write that cannot
      // happen.
      if (!hasWebLocks() && !claimWriting(tabId.current)) {
        setWritable(false);
        setFeedback({ message: READ_ONLY_TAB.message, tone: "warning" });
        return { ok: false, error: READ_ONLY_TAB };
      }

      inFlight.current += 1;
      try {
        return await withLedgerLock(async () => {
          // Another tab may have appended since this one loaded.
          const raw = readRawLog();
          const changed = raw !== lastSeenRaw.current;
          const base = changed
            ? (() => {
                const events = loadLog();
                return { events, ledger: ledgerFor(reduceEvents(events)) };
              })()
            : { events: state.events, ledger: state.ledger };

          const result = time("command", command.type, () =>
            executeCommand({ ledger: base.ledger, events: base.events }, command)
          );

          // Nothing to persist — a rejection, or a read such as ExportLedger.
          // Still adopt the other tab's work if this read revealed some.
          if (!result.ok || result.events.length === 0) {
            if (changed) {
              lastSeenRaw.current = raw;
              setState({ events: base.events, ledger: cacheLedger(base.ledger) });
            }
            setFeedback(successFeedback(command, result));
            return result;
          }

          const events = [...base.events, ...result.events];
          const data = result.events.reduce(applyEvent, base.ledger.data);
          const append = toLedgerAppend(result.events);
          const ledger = append
            ? time("selector", "appendToLedger", () => appendToLedger(base.ledger, data, append))
            : ledgerFor(data);

          // Spend the instant before writing the log that used it. A floor
          // stored without its entries merely wastes an instant, which nothing
          // can perceive; entries stored without the floor let the next page
          // load reissue one, and that is what reorders a running balance.
          saveClockFloor(nowISO.lastMs());

          // Whether it reached the device is a separate question from whether
          // it is in memory. A quota-exhausted write returns `false`, and a
          // merchant who reads a success toast for an entry that vanishes on
          // the next open has been lied to. Never confirm what was not stored.
          if (!saveLog(events)) {
            setFeedback({
              message: "NOT SAVED — this device is out of space. Export a backup, then retry.",
              tone: "warning",
            });
            return { ok: false, error: STORAGE_FULL };
          }

          // Read back inside the lock. `saveLog` reporting success is not proof
          // the bytes are there, and this is the last moment another tab cannot
          // have intervened.
          const storedRaw = readRawLog();
          const stored = loadLog();
          const persisted =
            stored.length === events.length &&
            stored[stored.length - 1]?.id === events[events.length - 1]?.id;

          if (!persisted) {
            setFeedback({
              message: "NOT SAVED — this device did not keep the entry. Try again.",
              tone: "warning",
            });
            return { ok: false, error: STORAGE_FULL };
          }

          lastSeenRaw.current = storedRaw;
          setState({ events, ledger: cacheLedger(ledger) });

          // Only now: the entry is on the device, so saying so is true.
          setFeedback(successFeedback(command, result));

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
        });
      } finally {
        inFlight.current -= 1;
      }
    },
    [state]
  );

  const check = useCallback((command: Command) => validateCommand(context, command), [context]);

  /**
   * Replace this browser's book with a validated backup.
   *
   * **Replace, not merge, and no snapshot event.** The restored log *is* the
   * book, so the log is swapped wholesale rather than having a snapshot appended
   * to it. Two books folded together would produce balances belonging to
   * neither, and a merchant cannot un-merge them; the pre-restore file the UI
   * takes first is what makes the replacement recoverable.
   *
   * Runs through the same locked path as a write, so a restore cannot land
   * between another tab's save and its verification. Other tabs pick it up from
   * the `storage` event, exactly as they pick up an entry.
   *
   * Callers must validate the file **before** calling this. By the time it runs,
   * the decision has been made.
   */
  const restore = useCallback(async (events: readonly LedgerEvent[]): Promise<CommandResult> => {
    if (!hasWebLocks() && !claimWriting(tabId.current)) {
      setFeedback({ message: READ_ONLY_TAB.message, tone: "warning" });
      return { ok: false, error: READ_ONLY_TAB };
    }

    inFlight.current += 1;
    try {
      return await withLedgerLock(async () => {
        const next = [...events];
        if (!saveLog(next)) {
          setFeedback({
            message: "NOT RESTORED — this device is out of space. Your book is unchanged.",
            tone: "warning",
          });
          return { ok: false, error: STORAGE_FULL };
        }

        // Read back before believing it, as every write does.
        const storedRaw = readRawLog();
        const stored = loadLog();
        if (stored.length !== next.length) {
          setFeedback({
            message: "NOT RESTORED — this device did not keep the file. Your book is unchanged.",
            tone: "warning",
          });
          return { ok: false, error: STORAGE_FULL };
        }

        // The merchant's next action happens AFTER the restore, so it has to
        // sort after everything the restore brought in.
        //
        // A floor set merely to "now" does not achieve that. Restore a book
        // from a device whose clock ran ahead and the next entry lands in the
        // *middle* of it — today's credit inserted into last year's history,
        // silently reordering every running balance after it. A ledger whose
        // balance sequence a restore can rewrite is not a ledger.
        //
        // So the floor clears the whole restored book by a millisecond. The
        // cost is real and deliberate: after restoring a fast-clock backup,
        // new entries carry timestamps that look like the future. That is the
        // lesser harm, and it is written down rather than hidden — see
        // `vyora/architecture/backup-envelope.md`.
        const floor = Math.max(Date.now(), latestInstantMs(stored)) + 1;
        nowISO.seed(floor);
        saveClockFloor(floor);

        lastSeenRaw.current = storedRaw;
        setState({ events: stored, ledger: cacheLedger(ledgerFor(reduceEvents(stored))) });
        setFeedback({ message: "Restored. This browser now holds that book.", tone: "success" });
        return { ok: true, value: { events: stored.length }, events: [] };
      });
    } finally {
      inFlight.current -= 1;
    }
  }, []);

  /**
   * Erase everything on this device.
   *
   * Under the same lock as a write. Erasing while another tab is mid-append
   * would otherwise interleave with it, and "erase all my data" landing between
   * another tab's `saveLog` and its verification is exactly the kind of race
   * that leaves a merchant unsure what happened.
   */
  const reset = useCallback(async () => {
    inFlight.current += 1;
    try {
      await withLedgerLock(async () => {
        clearLog();
        lastSeenRaw.current = readRawLog();
        setState(initialState());
      });
    } finally {
      inFlight.current -= 1;
    }
  }, []);

  const value = useMemo<VyoraContextValue>(
    () => ({
      ready,
      ledger: state.ledger,
      data: state.ledger.data,
      events: state.events,
      dispatch,
      check,
      writable,
      restore,
      reset,
      storageBytes: storageSizeBytes,
      settings,
      updateSettings,
      pwaFlags,
      setPwaFlags,
    }),
    [
      ready,
      state,
      dispatch,
      check,
      writable,
      restore,
      reset,
      settings,
      updateSettings,
      pwaFlags,
      setPwaFlags,
    ]
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
