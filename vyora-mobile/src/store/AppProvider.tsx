/**
 * Application state.
 *
 * One provider holding the database handle, the development configuration and
 * the sync status. Screens read from here and never open a database or build an
 * API client themselves — a second connection would give two views of one
 * ledger, and two clients would give two identities.
 *
 * The database opens once, migrates, and stays open for the life of the
 * process. Every screen renders from it synchronously after that, so a merchant
 * never watches a spinner to see a balance that is already on the device.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { openDeviceDatabase, type SqlDatabase } from "../database/driver";
import { migrate } from "../database/migrate";
import { readSettings, writeSettings, type DevSettings } from "./settings";
import { decideApi, defaultBaseUrl, type ConfigDecision } from "../api/config";
import { createApiClient, type ApiClient } from "../api/client";
import { drain, readStatus, type DrainResult, type SyncStatus } from "../sync/engine";

export interface AppState {
  readonly ready: boolean;
  readonly error: string | null;
  readonly db: SqlDatabase | null;
  readonly settings: DevSettings;
  readonly decision: ConfigDecision;
  readonly api: ApiClient | null;
  readonly status: SyncStatus;
  readonly syncing: boolean;
  /** Bumped whenever the ledger changes, so screens can re-read. */
  readonly revision: number;
  saveSettings(next: Partial<DevSettings>): Promise<void>;
  syncNow(): Promise<DrainResult | null>;
  refresh(): void;
}

const EMPTY_STATUS: SyncStatus = {
  pending: 0,
  blocked: 0,
  sent: 0,
  lastResult: null,
  lastRunAt: null,
};

const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside <AppProvider>");
  return value;
}

/**
 * `__DEV__` is React Native's build-time development flag. It is the honest
 * source for "is this a release build" — a runtime setting could be flipped by
 * anyone holding the phone.
 */
declare const __DEV__: boolean;

export function AppProvider({
  children,
  openDatabase = openDeviceDatabase,
  isDev = typeof __DEV__ === "undefined" ? false : __DEV__,
}: {
  children: ReactNode;
  openDatabase?: () => Promise<SqlDatabase>;
  isDev?: boolean;
}) {
  const [db, setDb] = useState<SqlDatabase | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<DevSettings>({ apiBaseUrl: null, identity: null });
  const [status, setStatus] = useState<SyncStatus>(EMPTY_STATUS);
  const [syncing, setSyncing] = useState(false);
  const [revision, setRevision] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const handle = await openDatabase();
        await migrate(handle);
        const loaded = await readSettings(handle);
        if (cancelled) return;
        setDb(handle);
        setSettings(loaded);
        setStatus(await readStatus(handle));
        setReady(true);
      } catch (cause) {
        if (cancelled) return;
        // A database that will not open is not recoverable in-app, and
        // pretending otherwise would show a merchant an empty ledger as though
        // their entries were gone.
        setError(`The device database could not be opened. ${(cause as Error).message}`);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openDatabase]);

  const decision = useMemo(
    () =>
      decideApi({
        baseUrl: settings.apiBaseUrl ?? undefined,
        identity: settings.identity ?? undefined,
        isDev,
      }),
    [settings.apiBaseUrl, settings.identity, isDev]
  );

  const api = useMemo(
    () => (decision.enabled ? createApiClient(decision.config) : null),
    [decision]
  );

  const refresh = useCallback(() => setRevision((n) => n + 1), []);

  const saveSettings = useCallback(
    async (next: Partial<DevSettings>) => {
      if (!db) return;
      await writeSettings(db, next);
      setSettings(await readSettings(db));
      refresh();
    },
    [db, refresh]
  );

  const syncNow = useCallback(async (): Promise<DrainResult | null> => {
    if (!db || !api) return null;
    setSyncing(true);
    try {
      const result = await drain(db, api);
      if (!mounted.current) return result;
      setStatus(await readStatus(db, result, new Date().toISOString()));
      refresh();
      return result;
    } finally {
      if (mounted.current) setSyncing(false);
    }
  }, [db, api, refresh]);

  // Recount after every ledger change so the pending badge is never stale.
  useEffect(() => {
    if (!db) return;
    let cancelled = false;
    readStatus(db, status.lastResult, status.lastRunAt).then((next) => {
      if (!cancelled) setStatus(next);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, revision]);

  const value: AppState = {
    ready,
    error,
    db,
    settings,
    decision,
    api,
    status,
    syncing,
    revision,
    saveSettings,
    syncNow,
    refresh,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export { defaultBaseUrl };
