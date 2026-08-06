"use client";

/**
 * Vyora — which Party source a screen should read from.
 *
 * The local ledger is the answer unless a developer has explicitly opted in.
 * When the remote source is enabled and then fails, this returns the **local**
 * result and an error to display. The remote path is never allowed to be the
 * reason a party list looks empty: a merchant's book showing nothing is
 * indistinguishable from a merchant's book being lost.
 *
 * Nothing here writes. No local data is created, mutated or cleared by any code
 * path in this file, whatever the API says or fails to say.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Party, PartyBalance } from "@/lib/vyora/types";
import { readParty, readPartyNet, readSearch } from "@/lib/vyora/ledger";
import { useVyora } from "./VyoraProvider";
import type { PartySource, PartySourceKind } from "@/lib/vyora/party-source";
import { remotePartySource } from "@/lib/vyora/party-source-remote";
import { partyApiDecision } from "@/lib/vyora/party-api-config";

interface RemoteState<T> {
  readonly value: T | null;
  readonly error: string | null;
  readonly loading: boolean;
  retry: () => void;
}

/** Overridable for tests; production callers pass nothing. */
export interface PartySourceOverrides {
  readonly remote?: PartySource;
  readonly enabled?: boolean;
}

export interface PartyListState {
  /** Rows to render. Falls back to local data whenever remote is unavailable. */
  readonly results: readonly PartyBalance[];
  /** Where `results` actually came from — not merely what was requested. */
  readonly source: PartySourceKind;
  /** Developer-visible message when the remote read failed. Never merchant-facing. */
  readonly error: string | null;
  readonly loading: boolean;
  retry: () => void;
}

export interface PartyDetailState {
  readonly party: Party | undefined;
  readonly net: number;
  readonly source: PartySourceKind;
  readonly error: string | null;
  readonly loading: boolean;
  retry: () => void;
}

/** Resolve the remote source once, or null when reads are not permitted. */
function useRemoteSource(overrides: PartySourceOverrides): PartySource | null {
  const decision = useMemo(() => partyApiDecision(), []);
  const enabled = overrides.enabled ?? decision.enabled;
  const override = overrides.remote;
  return useMemo(() => {
    if (!enabled) return null;
    return override ?? remotePartySource();
  }, [enabled, override]);
}

/**
 * Run one remote read, tolerating failure.
 *
 * A stale response can never overwrite a fresher one: each request takes a
 * ticket and only the newest is allowed to set state.
 */
function useRemoteRead<T>(
  source: PartySource | null,
  key: string,
  read: (source: PartySource) => Promise<T>
): RemoteState<T> {
  const [value, setValue] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(0);

  // `read` is redefined every render by callers; the key is what identifies the
  // request, so the effect depends on that instead.
  const readRef = useRef(read);
  readRef.current = read;

  useEffect(() => {
    if (!source) {
      setValue(null);
      setError(null);
      setLoading(false);
      return;
    }

    const ticket = ++latest.current;
    let cancelled = false;
    setLoading(true);

    readRef
      .current(source)
      .then((result) => {
        if (cancelled || ticket !== latest.current) return;
        setValue(result);
        setError(null);
      })
      .catch((cause: Error) => {
        if (cancelled || ticket !== latest.current) return;
        // Drop back to local. The local ledger is untouched — this only stops
        // us *displaying* remote rows.
        setValue(null);
        setError(cause.message);
      })
      .finally(() => {
        if (!cancelled && ticket === latest.current) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [source, key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { value, error, loading, retry };
}

/** Search/list parties. Local results render immediately; remote replaces them if it succeeds. */
export function usePartyList(query: string, overrides: PartySourceOverrides = {}): PartyListState {
  const { ledger } = useVyora();
  const remote = useRemoteSource(overrides);

  // Synchronous, exactly as before this milestone. The screen never flashes
  // empty while a remote request is in flight.
  const local = useMemo(() => readSearch(ledger, query), [ledger, query]);

  const { value, error, loading, retry } = useRemoteRead(remote, `list:${query}`, (s) =>
    s.list(query)
  );

  return {
    results: value ?? local,
    source: value ? "remote" : "local",
    error,
    loading,
    retry,
  };
}

/** One party plus its net. Same fallback rule as the list. */
export function usePartyDetail(
  partyId: string,
  overrides: PartySourceOverrides = {}
): PartyDetailState {
  const { ledger } = useVyora();
  const remote = useRemoteSource(overrides);

  const localParty = useMemo(() => readParty(ledger, partyId), [ledger, partyId]);
  const localNet = useMemo(() => readPartyNet(ledger, partyId), [ledger, partyId]);

  const { value, error, loading, retry } = useRemoteRead(remote, `party:${partyId}`, (s) =>
    s.get(partyId)
  );

  return {
    party: value?.party ?? localParty,
    net: value ? value.net : localNet,
    source: value ? "remote" : "local",
    error,
    loading,
    retry,
  };
}
