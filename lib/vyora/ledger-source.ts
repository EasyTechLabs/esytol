/**
 * Vyora — the development-only remote ledger boundary.
 *
 * Four operations, matching the contract exactly: read a party's statement,
 * read its summary, record one credit, record one payment. There is no update,
 * no delete and no sync — each of those is either a later slice or an
 * unresolved domain question, and a boundary that exposed them would invite
 * their use before that work is done.
 *
 * All traffic goes through this app's own server route, never the API directly,
 * so the development identity stays server-side.
 */

import type { StatementRow as LocalStatementRow } from "./ledger";
import type { PartySourceKind } from "./party-source";
import { PARTY_PROXY_PATH } from "./party-api-config";
import { PartyApiError } from "./party-source-remote";

/** A statement row as the API returns it. */
export interface RemoteStatementRow {
  id: string;
  partyId: string;
  entryType: "credit" | "payment";
  direction: "given" | "taken" | "received" | "paid";
  amount: number;
  description: string | null;
  date: string;
  dueDate: string | null;
  createdAt: string;
  eventId: string;
  signedAmount: number;
  runningNet: number;
  label: string;
}

export interface RemoteStatement {
  partyId: string;
  rows: RemoteStatementRow[];
  balance: { net: number; position: string; entryCount: number; lastActivityAt: string | null };
}

export interface RecordCreditInput {
  readonly amount: number;
  readonly kind: "given" | "taken";
  readonly description?: string | undefined;
  readonly date: string;
  readonly dueDate?: string | undefined;
}

export interface RecordPaymentInput {
  readonly amount: number;
  readonly kind: "received" | "paid";
  readonly note?: string | undefined;
  readonly date: string;
}

/** Gross totals per direction, beside the one signed net. */
export interface RemoteLedgerTotals {
  creditGiven: number;
  creditTaken: number;
  paymentReceived: number;
  paymentPaid: number;
}

export interface RemoteSummary {
  partyId: string;
  balance: { net: number; position: string; entryCount: number; lastActivityAt: string | null };
  totals: RemoteLedgerTotals;
  counts: { credits: number; payments: number };
  firstActivityAt: string | null;
}

export interface LedgerSource {
  readonly kind: PartySourceKind;
  statement(partyId: string): Promise<RemoteStatement>;
  summary(partyId: string): Promise<RemoteSummary>;
  recordCredit(partyId: string, input: RecordCreditInput): Promise<RemoteStatementRow>;
  recordPayment(partyId: string, input: RecordPaymentInput): Promise<RemoteStatementRow>;
}

/**
 * Map a remote statement row onto the shape the statement screen already
 * renders, so the display path is identical whichever source supplied it.
 *
 * `runningNet` is taken from the API rather than recomputed here. Folding it
 * twice, in two languages, is how the two copies eventually disagree.
 */
export function toLocalStatementRow(row: RemoteStatementRow, partyName: string): LocalStatementRow {
  return {
    id: row.id,
    partyId: row.partyId,
    partyName,
    date: row.date,
    createdAt: row.createdAt,
    signedAmount: row.signedAmount,
    amount: row.amount,
    label: row.label,
    ...(row.description ? { note: row.description } : {}),
    type: row.entryType === "credit" ? "transaction" : "payment",
    runningNet: row.runningNet,
  };
}

function newUuid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, "0").slice(-12)}`;
}

async function parseFailure(response: Response): Promise<never> {
  let detail = `HTTP ${response.status}`;
  try {
    const body = (await response.json()) as {
      error?: { code?: string; message?: string; details?: Array<{ message?: string }> };
    };
    if (body?.error?.code) {
      detail = `${body.error.code}: ${body.error.message ?? ""}`.trim();
      const fields = body.error.details?.map((d) => d.message).filter(Boolean);
      if (fields?.length) detail += ` (${fields.join("; ")})`;
    }
  } catch {
    // Non-JSON body; the status is all we have.
  }
  throw new PartyApiError(detail, response.status);
}

export function remoteLedgerSource(basePath: string = PARTY_PROXY_PATH): LedgerSource {
  return {
    kind: "remote",

    async statement(partyId: string): Promise<RemoteStatement> {
      let response: Response;
      try {
        response = await fetch(`${basePath}/${encodeURIComponent(partyId)}/statement?limit=200`, {
          cache: "no-store",
        });
      } catch (cause) {
        throw new PartyApiError(
          `Could not reach the development API. Is it running? (${(cause as Error).message})`
        );
      }
      if (!response.ok) await parseFailure(response);
      return (await response.json()) as RemoteStatement;
    },

    async summary(partyId: string): Promise<RemoteSummary> {
      // No `limit`. A total over the first page is not a total, so this call
      // deliberately cannot be given one.
      let response: Response;
      try {
        response = await fetch(`${basePath}/${encodeURIComponent(partyId)}/summary`, {
          cache: "no-store",
        });
      } catch (cause) {
        throw new PartyApiError(
          `Could not reach the development API. Is it running? (${(cause as Error).message})`
        );
      }
      if (!response.ok) await parseFailure(response);
      return (await response.json()) as RemoteSummary;
    },

    async recordCredit(partyId: string, input: RecordCreditInput): Promise<RemoteStatementRow> {
      // The entry id is client-minted, so the entry has an identity from the
      // moment the merchant records it — and it deduplicates a retry alongside
      // the idempotency key.
      const body: Record<string, unknown> = {
        id: `txn_${newUuid()}`,
        amount: input.amount,
        kind: input.kind,
        date: input.date,
        createdAt: new Date().toISOString(),
      };
      if (input.description) body.description = input.description;
      if (input.dueDate) body.dueDate = input.dueDate;

      let response: Response;
      try {
        response = await fetch(`${basePath}/${encodeURIComponent(partyId)}/credits`, {
          method: "POST",
          headers: { "content-type": "application/json", "idempotency-key": newUuid() },
          body: JSON.stringify(body),
          cache: "no-store",
        });
      } catch (cause) {
        throw new PartyApiError(
          `Could not reach the development API. Is it running? (${(cause as Error).message})`
        );
      }
      if (!response.ok) await parseFailure(response);
      return (await response.json()) as RemoteStatementRow;
    },

    async recordPayment(partyId: string, input: RecordPaymentInput): Promise<RemoteStatementRow> {
      // `pay_` prefix, matching the local `Payment` id. Entry ids are unique
      // across credits and payments, and the prefix is what makes a mistaken
      // reuse legible in a log rather than merely rejected.
      const body: Record<string, unknown> = {
        id: `pay_${newUuid()}`,
        amount: input.amount,
        kind: input.kind,
        date: input.date,
        createdAt: new Date().toISOString(),
      };
      if (input.note) body.note = input.note;

      let response: Response;
      try {
        response = await fetch(`${basePath}/${encodeURIComponent(partyId)}/payments`, {
          method: "POST",
          headers: { "content-type": "application/json", "idempotency-key": newUuid() },
          body: JSON.stringify(body),
          cache: "no-store",
        });
      } catch (cause) {
        throw new PartyApiError(
          `Could not reach the development API. Is it running? (${(cause as Error).message})`
        );
      }
      if (!response.ok) await parseFailure(response);
      return (await response.json()) as RemoteStatementRow;
    },
  };
}
