/**
 * Vyora — the development-only remote Party source.
 *
 * Reads through this app's own server route (`/api/vyora-dev/parties`), never
 * the API directly. That indirection is the whole point: the development
 * identity is a credential, and a credential in browser JavaScript is a
 * credential you have published. The proxy holds it server-side, so nothing
 * privileged is ever inlined into a client bundle.
 *
 * Reads only. No create, update or sync exists here, by design.
 */

import type { PartyBalance } from "./types";
import type { PartyRead, PartySource } from "./party-source";
import { PARTY_PROXY_PATH } from "./party-api-config";

/** Shapes the API returns. Kept minimal — only what a read actually needs. */
interface ApiParty {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  createdAt: string;
  balance?: { net: number };
}

export class PartyApiError extends Error {
  override readonly name = "PartyApiError";
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
  }
}

function toBalance(row: ApiParty): PartyBalance {
  return {
    party: {
      id: row.id,
      name: row.name,
      ...(row.phone ? { phone: row.phone } : {}),
      ...(row.note ? { note: row.note } : {}),
      createdAt: row.createdAt,
    },
    net: row.balance?.net ?? 0,
  };
}

async function readJson(url: string, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { signal, cache: "no-store" });
  } catch (cause) {
    // The API not running is the *expected* failure while developing, so it
    // gets a plain sentence rather than a stack trace in the UI.
    throw new PartyApiError(
      `Could not reach the development API. Is it running? (${(cause as Error).message})`
    );
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: { code?: string; message?: string } };
      if (body?.error?.code) detail = `${body.error.code}: ${body.error.message ?? ""}`.trim();
    } catch {
      // Non-JSON error body; the status is all we have and that is fine.
    }
    throw new PartyApiError(detail, response.status);
  }

  return response.json();
}

/**
 * Development-only remote reads.
 *
 * Every failure throws `PartyApiError`. The caller catches it, shows a
 * developer-visible banner, and keeps using the local ledger — the remote
 * source is never allowed to become the reason a party list is empty.
 */
export function remotePartySource(fetchUrl: string = PARTY_PROXY_PATH): PartySource {
  return {
    kind: "remote",

    async list(query: string) {
      const url = new URL(fetchUrl, "http://localhost");
      url.searchParams.set("limit", "200");
      if (query.trim()) url.searchParams.set("q", query.trim());

      const body = (await readJson(`${url.pathname}${url.search}`)) as { items?: ApiParty[] };
      return (body.items ?? []).map(toBalance);
    },

    async get(partyId: string): Promise<PartyRead | null> {
      const body = (await readJson(
        `${fetchUrl}/${encodeURIComponent(partyId)}`
      )) as ApiParty | null;
      if (!body) return null;
      const { party, net } = toBalance(body);
      return { party, net };
    },
  };
}
