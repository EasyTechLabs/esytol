/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Emitted from vyora-api/openapi/openapi.yaml by
 * scripts/generate-api-types.mjs. Run `npm run api:types` after any
 * contract change; `npm run api:types:check` fails if this file is stale,
 * and the mobile test suite runs that check.
 *
 * Editing this by hand reintroduces exactly the drift it exists to prevent.
 */

/* eslint-disable */

export const CONTRACT_VERSION = "1.0.0-draft.1";

/** Operations this client is allowed to call, exactly as the contract declares them. */
export const OPERATIONS = {
  createParty: { method: "POST", path: "/api/v1/parties" },
  getParty: { method: "GET", path: "/api/v1/parties/{partyId}" },
  getPartyLedgerSummary: { method: "GET", path: "/api/v1/parties/{partyId}/summary" },
  getPartyStatement: { method: "GET", path: "/api/v1/parties/{partyId}/statement" },
  listParties: { method: "GET", path: "/api/v1/parties" },
  recordCredit: { method: "POST", path: "/api/v1/parties/{partyId}/credits" },
  recordPayment: { method: "POST", path: "/api/v1/parties/{partyId}/payments" },
} as const;

export type OperationId = keyof typeof OPERATIONS;

/**
 * The merchant's trading date, `YYYY-MM-DD`, in their local timezone.
 * Distinct from a timestamp: a sale on the evening of the 4th belongs to
 * the 4th's book regardless of UTC offset.
 */
export type BusinessDate = string;

/**
 * Note what is absent: no `merchantId`, no role, no type, no balance.
 * The workspace comes from the token; role and balance are derived.
 */
export interface CreatePartyRequest {
  /** Client-minted. The party must be usable offline the moment the */
  id: PartyRef;
  name: string;
  phone?: string | null;
  note?: string | null;
  /** When the merchant actually created the contact on their device. */
  createdAt?: Timestamp;
}

/**
 * Credit direction from the merchant's point of view. `given` — the
 * merchant handed over goods or money, so the party owes them. `taken` —
 * the merchant received on credit, so they owe the party.
 *
 * **This is where role lives.** The same party can be on either side on
 * different days, which is exactly why no role is stored on the contact.
 */
export type EntryKind = "given" | "taken";

/**
 * Machine-readable failure class. Stable; new values may be added.
 */
export type ErrorCode = "BAD_REQUEST" | "UNAUTHENTICATED" | "TOKEN_EXPIRED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_FAILED" | "VERSION_CONFLICT" | "PRECONDITION_REQUIRED" | "IDEMPOTENCY_KEY_REUSED" | "RESOURCE_ALREADY_EXISTS" | "PAYLOAD_TOO_LARGE" | "RATE_LIMITED" | "SYNC_CURSOR_INVALID" | "SYNC_CURSOR_EXPIRED" | "SYNC_CLIENT_TOO_OLD" | "SYNC_SCHEMA_VERSION_UNSUPPORTED" | "DEPENDENCY_UNAVAILABLE" | "INTERNAL_ERROR";

export interface ErrorEnvelope {
  error: ErrorObject;
}

export interface ErrorObject {
  code: ErrorCode;
  /** Developer-facing English. **Never rendered to a merchant.** The */
  message: string;
  /** Matches the `X-Request-Id` response header. Quote it in bug reports. */
  requestId: Uuid;
  /** Present when the failure is attributable to specific fields. */
  details?: FieldError[];
}

export interface FieldError {
  /** RFC 9535 JSONPath to the offending value, e.g. `$.events[3].payload.amount`. */
  field: string;
  /** Machine-readable field failure. */
  code: "REQUIRED" | "INVALID_FORMAT" | "OUT_OF_RANGE" | "TOO_LONG" | "NOT_ALLOWED";
  message: string;
}

export interface LedgerCounts {
  credits: number;
  payments: number;
}

/**
 * One accepted entry, as stored. Read-only.
 */
export interface LedgerEntry {
  id: VyoraId;
  partyId: PartyRef;
  /** `credit` from `POST …/credits`, `payment` from `POST …/payments`. */
  entryType: "credit" | "payment";
  direction: "given" | "taken" | "received" | "paid";
  amount: Money;
  description?: string | null;
  date: BusinessDate;
  dueDate?: string | null;
  createdAt: Timestamp;
  /** The immutable event this entry came from. The audit handle. */
  eventId: VyoraId;
}

/**
 * Gross unsigned amounts per direction. Deliberately not netted against
 * each other here — `PartyBalance.net` is the one signed number, and
 * keeping the gross figures separate is what lets a merchant see that a
 * quiet ₹1,500 balance sits on ₹40,000 of trade rather than ₹1,500 of it.
 */
export interface LedgerTotals {
  /** Total credit the merchant handed over. */
  creditGiven: Money;
  /** Total credit the merchant received. */
  creditTaken: Money;
  /** Total the party paid the merchant. */
  paymentReceived: Money;
  /** Total the merchant paid the party. */
  paymentPaid: Money;
}

export interface Me {
  merchant: {
    /** The workspace this token resolved to. **Read-only and */
    merchantId: Uuid;
    displayName: string;
    createdAt: Timestamp;
  };
  user: {
    userId: Uuid;
    displayName?: string | null;
    /** Only `owner` exists today. Multi-user workspaces are a later */
    role: "owner";
  };
  device: {
    /** An identifier, never a credential. Authorisation comes from the */
    deviceId: Uuid;
    label?: string | null;
    registeredAt: Timestamp;
  };
  sync: {
    /** Envelope version this server emits. */
    schemaVersion: number;
    /** Oldest client envelope version still accepted on push. */
    minSupportedSchemaVersion: number;
    /** Maximum events per push batch. */
    maxBatchEvents: number;
  };
  /** Which scheme authenticated this request. `development` can only */
  authMode?: "bearer" | "development";
}

/**
 * Rupees as a non-negative integer. Direction is carried by the entry's
 * `kind`, never by the sign of the amount, so an amount is never
 * negative anywhere in this contract.
 */
export type Money = number;

export interface PageInfo {
  nextCursor?: string | null;
  hasMore: boolean;
}

export interface Party {
  id: PartyRef;
  name: string;
  phone?: string | null;
  note?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** Optimistic concurrency counter, incremented on every accepted */
  version: number;
  balance?: PartyBalance;
}

/**
 * Derived projection of this party's entries. **No balance is stored
 * anywhere** — server or device. A stored balance would be a second
 * source of truth and would drift the instant a late offline event
 * arrived, which offline-first makes routine rather than exceptional.
 */
export interface PartyBalance {
  /** Signed rupees. Positive means the party owes the merchant; */
  net: number;
  position: PartyPosition;
  entryCount: number;
  lastActivityAt?: string | null;
}

/**
 * The statement's arithmetic without its rows. Folded from the same
 * entries through the same code path as `/statement`, so the two cannot
 * report different balances for the same party.
 */
export interface PartyLedgerSummary {
  partyId: PartyRef;
  balance: PartyBalance;
  totals: LedgerTotals;
  counts: LedgerCounts;
  /** When this relationship started. `null` when the party has no */
  firstActivityAt?: string | null;
}

export interface PartyPage {
  items: Party[];
  page: PageInfo;
}

/**
 * **Derived, never stored.** Computed by folding entry direction at read
 * time. A party is not "a customer" or "a supplier"; they hold a position
 * that can invert with the next entry.
 */
export type PartyPosition = "owes_merchant" | "merchant_owes" | "settled" | "no_entries";

/**
 * A `VyoraId` restricted to the party prefix.
 */
export type PartyRef = VyoraId;

export interface PartyStatement {
  partyId: PartyRef;
  /** Oldest first, so `runningNet` reads as a ledger does. */
  rows: StatementRow[];
  balance: PartyBalance;
}

/**
 * Payment direction from the merchant's point of view. `received` — the
 * party paid the merchant. `paid` — the merchant paid the party.
 */
export type PaymentKind = "received" | "paid";

/**
 * Note what is absent: no `merchantId`, no `partyId` in the body (it is in
 * the path), and no balance. The workspace comes from the token and the
 * balance is derived.
 */
export interface RecordCreditRequest {
  /** Client-minted entry id, so the entry exists offline immediately. */
  id: VyoraId;
  amount: Money;
  kind: EntryKind;
  description?: string | null;
  date: BusinessDate;
  dueDate?: string | null;
  /** When the merchant actually recorded it. Preserved so an entry made */
  createdAt?: Timestamp;
}

/**
 * Mirrors `RecordCreditRequest` deliberately: same absences (no
 * `merchantId`, no `partyId` in the body, no balance), same client-minted
 * id, same offline-first reasoning.
 *
 * There is no `dueDate` and no `appliesTo`. A payment has nothing falling
 * due, and it settles the running position rather than a nominated entry.
 */
export interface RecordPaymentRequest {
  /** Client-minted entry id, so the payment exists offline immediately. */
  id: VyoraId;
  amount: Money;
  kind: PaymentKind;
  /** The merchant's own words — "part payment", "cash at shop". Named */
  note?: string | null;
  date: BusinessDate;
  /** When the merchant actually recorded it. Preserved so a payment */
  createdAt?: Timestamp;
}

export type StatementRow = LedgerEntry & {
  /** This entry's effect on "they owe me": `+given`, `+paid`, */
  signedAmount: number;
  /** The outstanding after this entry, folded oldest-first. */
  runningNet: number;
  /** Developer-facing, e.g. `Credit given`. The client owns merchant wording. */
  label: string;
};

/**
 * ISO-8601 instant with an explicit offset, e.g. `2026-08-05T09:14:22.115Z`.
 */
export type Timestamp = string;

/**
 * JSON Merge Patch. An explicit `null` clears an optional field; an
 * omitted key leaves it untouched. `id`, `createdAt`, `version` and
 * `balance` are not editable and are rejected with `NOT_ALLOWED`.
 */
export interface UpdatePartyRequest {
  name?: string;
  phone?: string | null;
  note?: string | null;
}

/**
 * Server-minted identifier. Always a bare RFC 4122 UUID.
 */
export type Uuid = string;

/**
 * Client-minted domain identifier: a type prefix, an underscore, then a
 * UUID (`pty_1f0c…`). The prefix makes an id self-describing in a log
 * line and lets entry ids stay unique across credits and payments.
 *
 * The UUID fallback for pre-`crypto.randomUUID` runtimes emits a shorter
 * base-36 suffix, which is why the pattern is a length range rather than
 * a strict UUID. **This format already exists on merchants' devices and
 * cannot be changed without rewriting their event logs**, so the contract
 * accepts it as-is rather than forcing a migration.
 */
export type VyoraId = string;
