"use client";

/**
 * Vyora — which Party writer a screen should use.
 *
 * Exactly one destination per action. When remote writes are enabled the write
 * goes to the API and **only** the API; when they are not, it goes through the
 * local command engine and only there. There is no path that does both, and no
 * path that tries one and then the other.
 *
 * That last part is the important one. A remote write that failed must **not**
 * fall back to a local write: the merchant pressed "Add" once, and turning one
 * intent into two records — one on the device, one possibly half-applied on the
 * server — leaves nobody able to say which is real. A failed write must simply
 * fail, visibly, with a retry.
 *
 * Reads may fall back to local, because showing a stale row is harmless.
 * Writes may not, because inventing a second record is not.
 */

import { useCallback, useMemo, useState } from "react";
import { useVyora } from "./VyoraProvider";
import type {
  CreatePartyInput,
  PartySourceKind,
  PartyWriteResult,
  PartyWriter,
  UpdatePartyInput,
} from "@/lib/vyora/party-source";
import { remotePartyWriter } from "@/lib/vyora/party-source-remote";
import { partyWriteDecision } from "@/lib/vyora/party-api-config";

export interface PartyWriteState {
  /** Where a write would go. Surfaced so a developer can see it before acting. */
  readonly target: PartySourceKind;
  /** Developer-facing failure from the last attempt, or null. Never merchant wording. */
  readonly error: string | null;
  /** True when the last failure was a version conflict rather than an outage. */
  readonly conflict: boolean;
  readonly pending: boolean;
  createParty(input: CreatePartyInput): Promise<boolean>;
  updateParty(partyId: string, etag: string, patch: UpdatePartyInput): Promise<boolean>;
  /** ETag of the most recent successful remote write, for the next If-Match. */
  readonly lastEtag: string | null;
  clearError(): void;
}

export interface PartyWriterOverrides {
  readonly remote?: PartyWriter;
  readonly enabled?: boolean;
}

export function usePartyWriter(overrides: PartyWriterOverrides = {}): PartyWriteState {
  const { dispatch } = useVyora();

  const decision = useMemo(() => partyWriteDecision(), []);
  const enabled = overrides.enabled ?? decision.enabled;
  const override = overrides.remote;

  const remote = useMemo(() => {
    if (!enabled) return null;
    return override ?? remotePartyWriter();
  }, [enabled, override]);

  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [pending, setPending] = useState(false);
  const [lastEtag, setLastEtag] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
    setConflict(false);
  }, []);

  /** Run a remote write. On failure: record it and return null. Never writes locally. */
  const runRemote = useCallback(
    async (work: () => Promise<PartyWriteResult>): Promise<PartyWriteResult | null> => {
      setPending(true);
      setError(null);
      setConflict(false);
      try {
        const result = await work();
        setLastEtag(result.etag);
        return result;
      } catch (cause) {
        const err = cause as Error & { status?: number };
        // 412 is a stale If-Match, 428 a missing one. Both mean the server's
        // record is newer than what this client saw, and neither may be
        // resolved by overwriting.
        setConflict(err.status === 412 || err.status === 428);
        setError(err.message);
        return null;
      } finally {
        setPending(false);
      }
    },
    []
  );

  const createParty = useCallback(
    async (input: CreatePartyInput): Promise<boolean> => {
      if (remote) {
        const id = `pty_${newUuid()}`;
        const result = await runRemote(() => remote.create(id, input));
        // No local fallback. A failed remote create wrote nothing, anywhere.
        return result !== null;
      }

      // Local path, unchanged from before this milestone: the command engine
      // is still the only thing that touches the device's log.
      const outcome = dispatch({
        type: "CreateContact",
        name: input.name,
        phone: input.phone || undefined,
      });
      if (!outcome.ok) {
        setError(outcome.error.message);
        return false;
      }
      return true;
    },
    [remote, runRemote, dispatch]
  );

  const updateParty = useCallback(
    async (partyId: string, etag: string, patch: UpdatePartyInput): Promise<boolean> => {
      if (remote) {
        const result = await runRemote(() => remote.update(partyId, etag, patch));
        return result !== null;
      }

      // The local command surface has no party-update command today, so the
      // local path deliberately reports that rather than inventing one. This
      // milestone adds no new local behaviour.
      setError("Local party update is not implemented; this is a development-only API capability.");
      return false;
    },
    [remote, runRemote]
  );

  return {
    target: remote ? "remote" : "local",
    error,
    conflict,
    pending,
    createParty,
    updateParty,
    lastEtag,
    clearError,
  };
}

function newUuid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, "0").slice(-12)}`;
}
