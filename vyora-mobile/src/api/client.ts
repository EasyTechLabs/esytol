/**
 * The Vyora API client.
 *
 * Types come from `contract.generated.ts`, which is emitted from the OpenAPI
 * document and checked for drift by the test suite — so the shapes below are
 * the contract's, not a developer's recollection of it.
 *
 * The client classifies every failure into exactly one of three outcomes,
 * because the outbox has to decide what to do next and "it failed" is not
 * enough information to decide anything:
 *
 *   `ok`        — accepted. Includes an idempotent replay, which is a success
 *                 that happens to be the second time.
 *   `retry`     — nothing was decided. No connection, a timeout, a 5xx. The
 *                 write may or may not have landed; retrying with the same key
 *                 is safe either way, which is the whole reason the key exists.
 *   `permanent` — refused, and it will be refused again. A malformed body, an
 *                 unknown party, a conflicting entry id.
 *
 * A 409 is `permanent` on purpose. It means this entry id already exists with
 * different content, and the one thing that must never happen is the app
 * "fixing" that by minting a new id and sending the entry twice.
 */

import type {
  LedgerEntry,
  Party,
  PartyLedgerSummary,
  PartyPage,
  PartyStatement,
} from "./contract.generated";
import { OPERATIONS } from "./contract.generated";
import type { ApiConfig } from "./config";

export const IDENTITY_HEADER = "x-vyora-dev-identity";

export type ApiOutcome<T> =
  | { kind: "ok"; value: T; status: number }
  | { kind: "retry"; message: string; status: number | null }
  | { kind: "permanent"; message: string; code: string; status: number };

export interface RequestOptions {
  readonly idempotencyKey?: string;
  readonly signal?: AbortSignal;
  /** Milliseconds before a request is abandoned as unanswered. */
  readonly timeoutMs?: number;
}

/** A shop's connection stalls more often than it refuses outright. */
export const DEFAULT_TIMEOUT_MS = 10_000;

type Fetch = typeof fetch;

export interface ApiClient {
  listParties(options?: RequestOptions): Promise<ApiOutcome<PartyPage>>;
  createParty(
    body: Record<string, unknown>,
    options: RequestOptions
  ): Promise<ApiOutcome<Party>>;
  recordCredit(
    partyId: string,
    body: Record<string, unknown>,
    options: RequestOptions
  ): Promise<ApiOutcome<LedgerEntry>>;
  recordPayment(
    partyId: string,
    body: Record<string, unknown>,
    options: RequestOptions
  ): Promise<ApiOutcome<LedgerEntry>>;
  statement(partyId: string, options?: RequestOptions): Promise<ApiOutcome<PartyStatement>>;
  summary(partyId: string, options?: RequestOptions): Promise<ApiOutcome<PartyLedgerSummary>>;
}

interface ErrorBody {
  error?: { code?: string; message?: string; details?: Array<{ message?: string }> };
}

/**
 * Statuses that mean "ask again later".
 *
 * 408 and 429 are timing, 5xx is the server's problem. Everything else the
 * server has actually decided, and asking again will get the same answer.
 */
function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export function createApiClient(config: ApiConfig, doFetch: Fetch = fetch): ApiClient {
  async function request<T>(
    method: string,
    path: string,
    options: RequestOptions,
    body?: Record<string, unknown>
  ): Promise<ApiOutcome<T>> {
    const headers: Record<string, string> = {
      accept: "application/json",
      // Development scheme. The server refuses this header outright unless it
      // was started with dev auth enabled, which it refuses in production.
      [IDENTITY_HEADER]: config.identity,
    };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (options.idempotencyKey) headers["idempotency-key"] = options.idempotencyKey;

    // A request that never answers must not pin an outbox row open forever.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    if (options.signal) {
      options.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    let response: Response;
    try {
      response = await doFetch(`${config.baseUrl}${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
    } catch (cause) {
      // No answer at all. Whether the write landed is unknown — which is
      // exactly the case the idempotency key makes safe to retry.
      return { kind: "retry", message: describeCause(cause), status: null };
    } finally {
      clearTimeout(timeout);
    }

    const text = await response.text();

    if (response.ok) {
      try {
        return { kind: "ok", value: JSON.parse(text) as T, status: response.status };
      } catch {
        return {
          kind: "retry",
          message: `The API returned ${response.status} with a body that is not JSON.`,
          status: response.status,
        };
      }
    }

    if (isRetryableStatus(response.status)) {
      return {
        kind: "retry",
        message: `The API returned ${response.status}.`,
        status: response.status,
      };
    }

    let code = "UNKNOWN";
    let message = `The API refused the request (${response.status}).`;
    try {
      const parsed = JSON.parse(text) as ErrorBody;
      if (parsed.error?.code) code = parsed.error.code;
      if (parsed.error?.message) message = parsed.error.message;
      const fields = parsed.error?.details?.map((d) => d.message).filter(Boolean);
      if (fields?.length) message += ` (${fields.join("; ")})`;
    } catch {
      // Non-JSON error body; the status is all there is.
    }
    return { kind: "permanent", message, code, status: response.status };
  }

  const partyPath = (partyId: string, suffix: string) =>
    `/api/v1/parties/${encodeURIComponent(partyId)}${suffix}`;

  return {
    listParties: (options = {}) => request<PartyPage>("GET", OPERATIONS.listParties.path, options),

    createParty: (body, options) =>
      request<Party>("POST", OPERATIONS.createParty.path, options, body),

    recordCredit: (partyId, body, options) =>
      request<LedgerEntry>("POST", partyPath(partyId, "/credits"), options, body),

    recordPayment: (partyId, body, options) =>
      request<LedgerEntry>("POST", partyPath(partyId, "/payments"), options, body),

    statement: (partyId, options = {}) =>
      request<PartyStatement>("GET", partyPath(partyId, "/statement?limit=200"), options),

    summary: (partyId, options = {}) =>
      request<PartyLedgerSummary>("GET", partyPath(partyId, "/summary"), options),
  };
}

function describeCause(cause: unknown): string {
  const error = cause as { name?: string; message?: string };
  if (error?.name === "AbortError") return "The API did not answer in time.";
  return `Could not reach the API. ${error?.message ?? String(cause)}`;
}
