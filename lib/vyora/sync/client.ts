/**
 * Vyora — talking to the API from a browser (WEB-SYNC-002).
 *
 * Every call goes to this app's own server, never to the API directly. The
 * session token is an `httpOnly` cookie that browser JavaScript cannot read,
 * which is the entire reason it is safe to keep one in a browser at all — see
 * `shop-session.ts`. This module therefore has no idea what the credential is,
 * and could not leak it if it tried.
 *
 * ## Why the outcome is a value and not an exception
 *
 * The caller has to treat "the café wifi dropped" and "the server refused this
 * event" completely differently: the first is retried and the merchant is told
 * nothing, the second stops and needs a person. A thrown `Error` flattens both
 * into a string, and the sync engine would be left matching on message text to
 * decide whether a merchant's work is safe.
 *
 * So the four outcomes are named:
 *
 *   ok         it worked
 *   retry      nothing was decided — network, timeout, 5xx, 429
 *   auth       the session is gone; syncing must stop until sign-in
 *   permanent  the server decided, and decided no
 *
 * `retry` is the one that matters most, because it is the one where the outbox
 * must be left exactly as it was. A request that timed out may well have been
 * applied, which is why every push carries ids the server deduplicates on.
 */

export type ApiOutcome<T> =
  | { readonly kind: "ok"; readonly value: T }
  | { readonly kind: "retry"; readonly message: string }
  | { readonly kind: "auth"; readonly message: string }
  | {
      readonly kind: "permanent";
      readonly status: number;
      readonly code: string;
      readonly message: string;
    };

/** Long enough for a slow connection, short enough that a dead one is noticed. */
export const REQUEST_TIMEOUT_MS = 20_000;

export const PUSH_PATH = "/api/vyora-sync/push";
export const PULL_PATH = "/api/vyora-sync/pull";

export interface SyncFetchOptions {
  readonly shopId: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

interface ErrorBody {
  error?: { code?: string; message?: string };
}

/**
 * One request, one outcome.
 *
 * The timeout is enforced here rather than left to the browser's default, which
 * on a captive-portal wifi can be minutes. A sync that hangs for two minutes is
 * indistinguishable to a merchant from one that is broken.
 */
async function callApi<T>(
  path: string,
  init: RequestInit,
  options: SyncFetchOptions
): Promise<ApiOutcome<T>> {
  const doFetch = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await doFetch(path, {
      ...init,
      signal: controller.signal,
      headers: { ...(init.headers ?? {}), "x-vyora-shop": options.shopId },
    });
  } catch (cause) {
    // Includes the abort. Nothing was decided, so nothing local changes.
    const message =
      (cause as Error)?.name === "AbortError"
        ? "The connection timed out."
        : "Could not reach Vyora.";
    return { kind: "retry", message };
  } finally {
    clearTimeout(timeout);
  }

  if (response.ok) {
    try {
      return { kind: "ok", value: (await response.json()) as T };
    } catch {
      // A 200 this client cannot read is not a success it can act on, and it
      // is not the merchant's problem to solve — retry rather than discard
      // their queued work over a malformed body.
      return { kind: "retry", message: "Vyora sent a reply this browser could not read." };
    }
  }

  let body: ErrorBody = {};
  try {
    body = (await response.json()) as ErrorBody;
  } catch {
    // Leave it empty; status still classifies the outcome.
  }
  const code = body.error?.code ?? "UNKNOWN";
  const message = body.error?.message ?? `The server answered ${response.status}.`;

  if (response.status === 401) return { kind: "auth", message };
  if (response.status === 429 || response.status >= 500) return { kind: "retry", message };
  return { kind: "permanent", status: response.status, code, message };
}

// ── Push ─────────────────────────────────────────────────────────────────────

export interface PushBody {
  readonly schemaVersion: number;
  readonly events: readonly unknown[];
}

export interface PushResponse {
  readonly accepted: readonly { eventId: string; recordedAt: string }[];
  readonly duplicate: readonly { eventId: string; recordedAt: string }[];
  readonly rejected: readonly { eventId: string; reason: string; message: string }[];
  readonly cursor: string;
  readonly serverTime: string;
}

/**
 * Send a batch.
 *
 * **No `deviceId`.** A browser registers no device and needs none: the server
 * attributes every event to an eligible device of the shop (ADR-0016). The
 * absence of that field here is the web half of that decision.
 *
 * The idempotency key is minted by the caller and passed through, never
 * generated in this function — a key minted per attempt is a *new* key on every
 * retry, which is how one batch becomes two.
 */
export async function pushEvents(
  body: PushBody,
  idempotencyKey: string,
  options: SyncFetchOptions
): Promise<ApiOutcome<PushResponse>> {
  return callApi<PushResponse>(
    PUSH_PATH,
    {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify(body),
    },
    options
  );
}

// ── Pull ─────────────────────────────────────────────────────────────────────

export interface PullResponse {
  readonly events: readonly {
    eventId: string;
    type: string;
    aggregateId: string | null;
    payload: Record<string, unknown>;
    occurredAt: string;
    recordedAt: string;
  }[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
  readonly serverTime: string;
}

/**
 * Ask for everything after a cursor.
 *
 * No `deviceId` and no `includeOwnDevice`. A cursor identifies a position in
 * the shop's log rather than a reader (ADR-0015), and a browser has no device
 * whose events it would want excluded — so it receives its own work back and
 * applies it harmlessly, because storing an event it already holds is a no-op.
 */
export async function pullEvents(
  cursor: string | null,
  limit: number,
  options: SyncFetchOptions
): Promise<ApiOutcome<PullResponse>> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set("cursor", cursor);
  return callApi<PullResponse>(
    `${PULL_PATH}?${query.toString()}`,
    { method: "GET", headers: { accept: "application/json" } },
    options
  );
}
