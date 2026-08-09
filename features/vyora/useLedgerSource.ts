"use client";

/**
 * Vyora — remote statements and remote credit recording.
 *
 * Same two rules as the party slice, for the same reasons:
 *
 *   Reads fall back to local. A stale statement is harmless.
 *   Writes do not. A failed remote credit writes nothing, anywhere — no dual
 *   write, no fallback. One recorded entry, or none.
 *
 * Nothing in this file writes to the device on the remote path.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StatementRow } from "@/lib/vyora/ledger";
import { readStatement, readPartyNet } from "@/lib/vyora/ledger";
import { useVyora } from "./VyoraProvider";
import type { PartySourceKind } from "@/lib/vyora/party-source";
import type {
  LedgerSource,
  RecordCreditInput,
  RecordPaymentInput,
  RemoteSummary,
} from "@/lib/vyora/ledger-source";
import { remoteLedgerSource, toLocalStatementRow } from "@/lib/vyora/ledger-source";
import { ledgerReadDecision, ledgerWriteDecision } from "@/lib/vyora/party-api-config";

export interface LedgerOverrides {
  readonly remote?: LedgerSource;
  readonly readsEnabled?: boolean;
  readonly writesEnabled?: boolean;
}

export interface StatementState {
  readonly rows: readonly StatementRow[];
  readonly net: number;
  readonly source: PartySourceKind;
  readonly error: string | null;
  readonly loading: boolean;
  reload(): void;
}

export interface CreditWriteState {
  readonly target: PartySourceKind;
  readonly error: string | null;
  readonly pending: boolean;
  recordCredit(partyId: string, input: RecordCreditInput): Promise<boolean>;
  clearError(): void;
}

export interface PaymentWriteState {
  readonly target: PartySourceKind;
  readonly error: string | null;
  readonly pending: boolean;
  recordPayment(partyId: string, input: RecordPaymentInput): Promise<boolean>;
  clearError(): void;
}

export interface SummaryState {
  readonly summary: RemoteSummary | null;
  readonly error: string | null;
  readonly loading: boolean;
  reload(): void;
}

function useRemote(overrides: LedgerOverrides, forWrites: boolean): LedgerSource | null {
  const decision = useMemo(
    () => (forWrites ? ledgerWriteDecision() : ledgerReadDecision()),
    [forWrites]
  );
  const enabled =
    (forWrites ? overrides.writesEnabled : overrides.readsEnabled) ?? decision.enabled;
  const override = overrides.remote;
  return useMemo(() => {
    if (!enabled) return null;
    return override ?? remoteLedgerSource();
  }, [enabled, override]);
}

/** A party's statement. Local by default; remote replaces it only on success. */
export function useStatement(
  partyId: string,
  partyName: string,
  overrides: LedgerOverrides = {}
): StatementState {
  const { ledger } = useVyora();
  const remote = useRemote(overrides, false);

  // Synchronous, exactly as before this milestone, so the screen never flashes
  // empty while a remote request is in flight.
  const localRows = useMemo(() => readStatement(ledger, partyId), [ledger, partyId]);
  const localNet = useMemo(() => readPartyNet(ledger, partyId), [ledger, partyId]);

  const [remoteRows, setRemoteRows] = useState<readonly StatementRow[] | null>(null);
  const [remoteNet, setRemoteNet] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    if (!remote) {
      setRemoteRows(null);
      setRemoteNet(null);
      setError(null);
      return;
    }
    const ticket = ++latest.current;
    let cancelled = false;
    setLoading(true);

    remote
      .statement(partyId)
      .then((s) => {
        if (cancelled || ticket !== latest.current) return;
        setRemoteRows(s.rows.map((r) => toLocalStatementRow(r, partyName)));
        setRemoteNet(s.balance.net);
        setError(null);
      })
      .catch((cause: Error) => {
        // Fall back to local. The local ledger is untouched; this only stops us
        // displaying remote rows.
        if (cancelled || ticket !== latest.current) return;
        setRemoteRows(null);
        setRemoteNet(null);
        setError(cause.message);
      })
      .finally(() => {
        if (!cancelled && ticket === latest.current) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [remote, partyId, partyName, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const usingRemote = remote !== null && remoteRows !== null;

  return {
    rows: usingRemote ? remoteRows : localRows,
    net: usingRemote && remoteNet !== null ? remoteNet : localNet,
    source: usingRemote ? "remote" : "local",
    error,
    loading,
    reload,
  };
}

/**
 * Record a credit.
 *
 * When the remote path is enabled the entry goes to the API and only the API.
 * When it is not, this hook does nothing and the caller keeps its existing
 * local `dispatch` — this milestone adds no new local write.
 */
export function useCreditWriter(overrides: LedgerOverrides = {}): CreditWriteState {
  const remote = useRemote(overrides, true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const clearError = useCallback(() => setError(null), []);

  const recordCredit = useCallback(
    async (partyId: string, input: RecordCreditInput): Promise<boolean> => {
      if (!remote) {
        setError("Remote ledger writes are disabled; use the local credit flow.");
        return false;
      }
      setPending(true);
      setError(null);
      try {
        await remote.recordCredit(partyId, input);
        return true;
      } catch (cause) {
        // No local fallback. The entry reached nothing, and inventing a local
        // copy of it would leave two records of one action.
        setError((cause as Error).message);
        return false;
      } finally {
        setPending(false);
      }
    },
    [remote]
  );

  return { target: remote ? "remote" : "local", error, pending, recordCredit, clearError };
}

/**
 * Record a payment.
 *
 * Deliberately a separate hook from `useCreditWriter` rather than one writer
 * with a `kind` argument. They call different endpoints and mint different
 * events, and a single writer parameterised by kind is the shape in which a
 * later edit sends a payment down the credit path.
 *
 * Same rule as every other remote write in this app: the API or nothing. A
 * failure writes nothing locally.
 */
export function usePaymentWriter(overrides: LedgerOverrides = {}): PaymentWriteState {
  const remote = useRemote(overrides, true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const clearError = useCallback(() => setError(null), []);

  const recordPayment = useCallback(
    async (partyId: string, input: RecordPaymentInput): Promise<boolean> => {
      if (!remote) {
        setError("Remote ledger writes are disabled; use the local payment flow.");
        return false;
      }
      setPending(true);
      setError(null);
      try {
        await remote.recordPayment(partyId, input);
        return true;
      } catch (cause) {
        setError((cause as Error).message);
        return false;
      } finally {
        setPending(false);
      }
    },
    [remote]
  );

  return { target: remote ? "remote" : "local", error, pending, recordPayment, clearError };
}

/**
 * A party's remote ledger summary.
 *
 * Unlike `useStatement` this has **no local fallback**, and returns `null`
 * rather than a locally computed total when the API cannot be reached. The
 * statement falls back because a stale history is still a history; a summary
 * that silently swapped its source would show one set of totals from the device
 * and another from the server under the same heading, with nothing on screen to
 * say which. Absent is honest; substituted is not.
 */
export function usePartySummary(partyId: string, overrides: LedgerOverrides = {}): SummaryState {
  const remote = useRemote(overrides, false);
  const [summary, setSummary] = useState<RemoteSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    if (!remote) {
      setSummary(null);
      setError(null);
      return;
    }
    const ticket = ++latest.current;
    let cancelled = false;
    setLoading(true);

    remote
      .summary(partyId)
      .then((s) => {
        if (cancelled || ticket !== latest.current) return;
        setSummary(s);
        setError(null);
      })
      .catch((cause: Error) => {
        if (cancelled || ticket !== latest.current) return;
        setSummary(null);
        setError(cause.message);
      })
      .finally(() => {
        if (!cancelled && ticket === latest.current) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [remote, partyId, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { summary, error, loading, reload };
}
