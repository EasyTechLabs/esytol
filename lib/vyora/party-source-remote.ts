/**
 * Vyora — the development-only remote Party source.
 *
 * Reads through this app's own server route (`/api/vyora-dev/parties`), never
 * the API directly. That indirection is the whole point: the development
 * identity is a credential, and a credential in browser JavaScript is a
 * credential you have published. The proxy holds it server-side, so nothing
 * privileged is ever inlined into a client bundle.
 *
 * Reads, plus create and update. There is deliberately no delete and no sync:
 * deletion has an unresolved domain question (delete versus a concurrent
 * entry) and sync belongs to a slice that has not been designed.
 *
 * Nothing here writes to the device. A remote write goes to the API and only to
 * the API — never to local storage, and never to both.
 */

import type { PartyBalance } from "./types";
import type {
  CreatePartyInput,
  PartyRead,
  PartySource,
  PartyWriteResult,
  PartyWriter,
  UpdatePartyInput,
} from "./party-source";
import { PARTY_PROXY_PATH } from "./party-api-config";

/** Shapes the API returns. Kept minimal — only what a read actually needs. */
interface ApiParty {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  createdAt: string;
  /** Optimistic concurrency counter. Mirrors the ETag; present on writes. */
  version?: number;
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
 * Development-only remote writes: create and update.
 *
 * Every method here talks to the proxy, never the API. A failure throws
 * `PartyApiError` and the caller must **not** fall back to a local write:
 * writing locally after a failed remote write is a dual write, and it leaves
 * two divergent records of the same intent with no way to tell which is real.
 */
export function remotePartyWriter(fetchUrl: string = PARTY_PROXY_PATH): PartyWriter {
  return {
    kind: "remote",

    async create(id: string, input: CreatePartyInput): Promise<PartyWriteResult> {
      const body: Record<string, unknown> = { id, name: input.name };
      if (input.phone) body.phone = input.phone;
      if (input.note) body.note = input.note;
      body.createdAt = new Date().toISOString();

      const { json, etag } = await sendJson(fetchUrl, "POST", body, {
        // Client-generated, so a retried create is deduplicated by the API
        // rather than producing a second party.
        "idempotency-key": newUuid(),
      });
      return toWriteResult(json as ApiParty, etag);
    },

    async update(
      partyId: string,
      etag: string,
      patch: UpdatePartyInput
    ): Promise<PartyWriteResult> {
      const { json, etag: nextEtag } = await sendJson(
        `${fetchUrl}/${encodeURIComponent(partyId)}`,
        "PATCH",
        patch as Record<string, unknown>,
        {
          // Required by the contract. Without it the API answers 428, which is
          // the correct refusal — an update must say which version it saw.
          "if-match": etag,
          "idempotency-key": newUuid(),
        }
      );
      return toWriteResult(json as ApiParty, nextEtag);
    },
  };
}

function toWriteResult(row: ApiParty, etag: string | null): PartyWriteResult {
  const { party } = toBalance(row);
  return { party, etag, version: typeof row.version === "number" ? row.version : null };
}

function newUuid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  // Only reached on runtimes without crypto.randomUUID; still unique enough to
  // scope one request, which is all an idempotency key must do.
  return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, "0").slice(-12)}`;
}

/** POST/PATCH JSON through the proxy, surfacing the API's own error shape. */
async function sendJson(
  url: string,
  method: "POST" | "PATCH",
  body: Record<string, unknown>,
  headers: Record<string, string>
): Promise<{ json: unknown; etag: string | null }> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (cause) {
    throw new PartyApiError(
      `Could not reach the development API. Is it running? (${(cause as Error).message})`
    );
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const parsed = (await response.json()) as {
        error?: { code?: string; message?: string; details?: Array<{ message?: string }> };
      };
      if (parsed?.error?.code) {
        detail = `${parsed.error.code}: ${parsed.error.message ?? ""}`.trim();
        const fields = parsed.error.details?.map((d) => d.message).filter(Boolean);
        if (fields?.length) detail += ` (${fields.join("; ")})`;
      }
    } catch {
      // Non-JSON body; the status is all we have.
    }
    throw new PartyApiError(detail, response.status);
  }

  return { json: await response.json(), etag: response.headers.get("etag") };
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
