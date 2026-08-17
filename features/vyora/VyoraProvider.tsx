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
  loadClockFloor,
  loadPwaFlags,
  loadSettings,
  saveClockFloor,
  savePwaFlags,
  saveSettings,
  storageSizeBytes,
} from "@/lib/vyora/store";
import { time } from "@/lib/vyora/debug";
import type { LedgerRepository } from "@/lib/vyora/sync/repository";
import { fallbackRepository, openRepository } from "@/lib/vyora/sync/repository";
import { migrateFromLocalStorage } from "@/lib/vyora/sync/migration";
import { readActiveShop } from "@/lib/vyora/active-shop";
import { enterShop, signOutLocal } from "@/lib/vyora/sync/session";
import type { SyncSnapshot, SyncState } from "@/lib/vyora/sync/engine";
import { readSnapshot, sync as runSync } from "@/lib/vyora/sync/engine";

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
  /**
   * What syncing is doing, in terms a merchant can read.
   *
   * `idle` on a browser that is not signed into a shop, or has no IndexedDB —
   * both of which are working states, not failures. Nothing here exposes a
   * cursor, an event id or an outbox.
   */
  sync: SyncSnapshot;
  /** Sync now. Joins the cycle already running rather than starting a second. */
  syncNow: () => Promise<void>;
  /**
   * Start working in a shop.
   *
   * Erases this browser's book first if it belonged to a *different* shop —
   * there is one local book and it cannot hold two. Call after the server has
   * confirmed the selection, never before.
   */
  enterShop: (merchantId: string) => Promise<void>;
  /**
   * Stop holding this shop's book on this browser.
   *
   * The local half of signing out, and it runs whether or not the server call
   * succeeded: a browser that could not reach the server must still not be left
   * holding somebody's ledger.
   */
  signOutLocally: () => Promise<void>;
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
   *
   * A fingerprint rather than the log itself since WEB-SYNC-003 — against
   * IndexedDB, reading the whole book to decide whether to read the whole book
   * would be the cost this milestone exists to remove.
   */
  const lastSeenRaw = useRef<string | null>(null);

  /**
   * Where the book is kept.
   *
   * Starts on the fallback store so a render before the mount effect has an honest
   * answer rather than a null, and is replaced with the IndexedDB store once it
   * opens. A browser with no IndexedDB keeps this one for good and simply does
   * not sync — the app is unchanged for them.
   */
  const repository = useRef<LedgerRepository>(fallbackRepository);
  const [syncSnapshot, setSyncSnapshot] = useState<SyncSnapshot>({
    state: "idle",
    pending: 0,
    lastSyncAt: null,
    message: null,
  });

  /**
   * Open the book, once, before anything can be recorded.
   *
   * The order matters and is the whole of the migration's safety:
   *
   *   1. open the best store this browser has;
   *   2. if that is IndexedDB, copy the existing log across — which
   *      verifies count, id sequence and folded projection before marking
   *      itself done, and on any failure clears its partial copy and leaves the
   *      merchant on the store they already had;
   *   3. only then read, fold, and let the app render.
   *
   * A failed migration is therefore not a failed startup. It is a browser that
   * opens the book it already had, and does not sync. The original key is
   * never deleted either way — see `migration.ts`.
   *
   * Runs once. Not on every render, and not per screen: the guard is the empty
   * dependency list plus `ready`, and nothing else calls it.
   */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const opened = await openRepository();
      let chosen = opened.repository;

      if (chosen.kind === "indexeddb" && chosen.db) {
        const result = await migrateFromLocalStorage(chosen.db);
        if (result.kind === "failed") {
          // The copy could not be proven, so the copy is not used. The original
          // is untouched and this browser keeps working, unsynced.
          chosen = fallbackRepository;
        }
      }
      if (cancelled) return;

      repository.current = chosen;
      const events = await chosen.load();
      const revision = await chosen.revision();
      if (cancelled) return;

      // Before anything can be recorded. The clock's "never the same instant
      // twice" guarantee is per-page; the floor that carries it across a reload —
      // or a device clock moved backwards — is on the device.
      nowISO.seed(loadClockFloor(events));
      lastSeenRaw.current = revision;
      setState({ events, ledger: ledgerFor(reduceEvents(events)) });
      setSettings(loadSettings());
      setPwaFlagsState(loadPwaFlags());
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
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
      void (async () => {
        const repo = repository.current;
        const events = await repo.load();
        lastSeenRaw.current = await repo.revision();
        setState({ events, ledger: ledgerFor(reduceEvents(events)) });
      })();
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

  /**
   * Run a sync cycle, or join the one already running.
   *
   * **Never called from inside `withLedgerLock`.** The engine takes that same
   * lock — deliberately, because applying a pulled page *is* a ledger write —
   * and `navigator.locks` is not reentrant, so a sync started from within a
   * dispatch would wait for a lock its own caller is holding and never return.
   * Every call site here is after the locked section has resolved.
   *
   * Two gates, and both are ordinary states rather than errors:
   *
   *  - no IndexedDB, so no sync-capable store and nothing to sync from;
   *  - no shop selected, so nothing to sync *to* — a browser that has not signed
   *    in has a perfectly good local book and no server to reconcile it with.
   */
  const syncNow = useCallback(async () => {
    const repo = repository.current;
    const db = repo.db;
    if (!db) return;

    const shopId = readActiveShop();
    if (!shopId) return;

    setSyncSnapshot((previous) => ({ ...previous, state: "pushing", message: null }));

    const outcome = await runSync({ db, shopId });

    // A build with no local API path answers 404 from the proxy — the gate in
    // `shop-session.ts`, not a failure of the merchant's. Reported as idle
    // rather than as "needs attention", which would ask them to fix something
    // that is working as designed.
    const state: SyncState =
      outcome.state === "error" && outcome.message === null ? "idle" : outcome.state;

    // The fold order changed if anything moved: a pushed event takes the
    // server's clock and leaves the pending tail, and a pulled one joins the
    // shared history. Re-read rather than guess.
    if (outcome.pushed > 0 || outcome.pulled > 0) {
      // Skipped while a write is in flight, exactly as the cross-tab listener
      // is: that dispatch is inside the lock and about to re-read anyway, and
      // replacing its state underneath it would discard the entry being
      // recorded.
      if (inFlight.current === 0) {
        const events = await repo.load();
        lastSeenRaw.current = await repo.revision();
        setState({ events, ledger: ledgerFor(reduceEvents(events)) });
      }
    }

    setSyncSnapshot({
      ...(await readSnapshot(db, state)),
      message: outcome.message,
    });
  }, []);

  /**
   * Sync when there is a reason to.
   *
   * Startup, and coming back online. Not a timer: a poll would spend a
   * merchant's data allowance asking a question nothing suggests has a new
   * answer, and every local write triggers its own sync below.
   */
  useEffect(() => {
    if (!ready) return;
    void syncNow();

    const onOnline = () => void syncNow();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [ready, syncNow]);

  /**
   * Point this browser at a shop, erasing another shop's book if it holds one.
   *
   * Under the ledger lock, because it can erase — a switch landing between
   * another tab's write and its verification is the race the lock exists for.
   * The sync that follows is outside it, as every other trigger is.
   */
  const enterShopLocally = useCallback(
    async (merchantId: string) => {
      const repo = repository.current;
      inFlight.current += 1;
      try {
        await withLedgerLock(async () => {
          const outcome = await enterShop(repo.db, merchantId);
          if (outcome.kind === "switched") {
            // A different shop's book has just been erased. Nothing in memory
            // may survive it.
            lastSeenRaw.current = await repo.revision();
            setState(initialState());
            setSyncSnapshot({ state: "idle", pending: 0, lastSyncAt: null, message: null });
          }
        });
      } finally {
        inFlight.current -= 1;
      }
      void syncNow();
    },
    [syncNow]
  );

  const signOutLocally = useCallback(async () => {
    const repo = repository.current;
    inFlight.current += 1;
    try {
      await withLedgerLock(async () => {
        await signOutLocal(repo.db);
        // A browser on the fallback store has no IndexedDB to clear, so its book
        // is cleared through the repository that owns it.
        if (!repo.db) await repo.clear();
        lastSeenRaw.current = await repo.revision();
        setState(initialState());
        setSyncSnapshot({ state: "idle", pending: 0, lastSyncAt: null, message: null });
      });
    } finally {
      inFlight.current -= 1;
    }
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

      const repo = repository.current;
      inFlight.current += 1;
      let recorded = false;
      try {
        const outcome = await withLedgerLock<CommandResult>(async () => {
          // Another tab may have appended since this one loaded — or a sync may
          // have applied a page.
          const raw = await repo.revision();
          const changed = raw !== lastSeenRaw.current;
          const base = changed
            ? await (async () => {
                const events = await repo.load();
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
          //
          // Against IndexedDB this writes only `result.events` — one record per
          // entry, whatever the book already holds. Against the fallback store it
          // rewrites the whole log, as it always did.
          let written: boolean;
          try {
            written = await repo.append(result.events, events);
          } catch {
            written = false;
          }
          if (!written) {
            setFeedback({
              message: "NOT SAVED — this device is out of space. Export a backup, then retry.",
              tone: "warning",
            });
            return { ok: false, error: STORAGE_FULL };
          }

          // Read back inside the lock. A store reporting success is not proof
          // the record is there, and this is the last moment another tab cannot
          // have intervened.
          const persisted = await repo.verify(events);
          const storedRaw = await repo.revision();

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
          recorded = true;
          return result;
        });

        // Outside the lock, and it has to be: the sync engine takes the same
        // mutex, so starting a cycle from inside this section would wait on a
        // lock this call is holding. The merchant's entry is already durable
        // either way — syncing is what happens to work already recorded, never
        // a condition of recording it.
        if (recorded) void syncNow();

        return outcome;
      } finally {
        inFlight.current -= 1;
      }
    },
    [state, syncNow]
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
  const restore = useCallback(
    async (events: readonly LedgerEvent[]): Promise<CommandResult> => {
      if (!hasWebLocks() && !claimWriting(tabId.current)) {
        setFeedback({ message: READ_ONLY_TAB.message, tone: "warning" });
        return { ok: false, error: READ_ONLY_TAB };
      }

      const repo = repository.current;
      inFlight.current += 1;
      let replaced = false;
      try {
        const outcome = await withLedgerLock<CommandResult>(async () => {
          const next = [...events];
          let written: boolean;
          try {
            written = await repo.replace(next);
          } catch {
            written = false;
          }
          if (!written) {
            setFeedback({
              message: "NOT RESTORED — this device is out of space. Your book is unchanged.",
              tone: "warning",
            });
            return { ok: false, error: STORAGE_FULL };
          }

          // Read back before believing it, as every write does.
          const stored = await repo.load();
          const storedRaw = await repo.revision();
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
          replaced = true;
          return { ok: true, value: { events: stored.length }, events: [] };
        });

        // A restored book is this browser's unsent work — `replace` cleared the
        // cursor with it, so the next cycle pushes what the file brought and
        // re-reads the shop's history from the beginning. Outside the lock, for
        // the same reason a dispatch's sync is.
        if (replaced) void syncNow();

        return outcome;
      } finally {
        inFlight.current -= 1;
      }
    },
    [syncNow]
  );

  /**
   * Erase everything on this device.
   *
   * Under the same lock as a write. Erasing while another tab is mid-append
   * would otherwise interleave with it, and "erase all my data" landing between
   * another tab's `saveLog` and its verification is exactly the kind of race
   * that leaves a merchant unsure what happened.
   */
  const reset = useCallback(async () => {
    const repo = repository.current;
    inFlight.current += 1;
    try {
      await withLedgerLock(async () => {
        await repo.clear();
        lastSeenRaw.current = await repo.revision();
        setState(initialState());
        setSyncSnapshot({ state: "idle", pending: 0, lastSyncAt: null, message: null });
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
      sync: syncSnapshot,
      syncNow,
      enterShop: enterShopLocally,
      signOutLocally,
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
      syncSnapshot,
      syncNow,
      enterShopLocally,
      signOutLocally,
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
