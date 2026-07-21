/**
 * Vyora Alpha — domain types.
 *
 * The whole domain, deliberately tiny (Mission Alpha 001): Party, Transaction,
 * Payment, and a derived Balance. Nothing else. Every party is simply a Party —
 * they can be a customer, supplier, contractor, or friend at the same time. The
 * DIRECTION of each entry (not a fixed role) decides whether a party owes the
 * merchant or the merchant owes them, so one party can be both over time.
 */

/** A credit event's direction, from the MERCHANT's point of view. */
export type EntryKind =
  | "given" // I gave goods/credit → THEY owe ME (receivable ↑)
  | "taken"; // I took goods/credit from them → I owe THEM (payable ↑)

/** A payment's direction, from the MERCHANT's point of view. */
export type PaymentKind =
  | "received" // THEY paid ME → they owe me less (receivable ↓)
  | "paid"; // I paid THEM → I owe them less (payable ↓)

/** How a payment was made. */
export type PaymentMode = "cash" | "upi" | "bank" | "cheque";

export interface Party {
  id: string;
  name: string;
  phone?: string;
  note?: string;
  /** ISO timestamp. */
  createdAt: string;
}

/** A credit entry (goods/money given or taken on credit). */
export interface Transaction {
  id: string;
  partyId: string;
  /** Rupees, positive. */
  amount: number;
  kind: EntryKind;
  /** Free-text notes (e.g. "cement, 3 bags"). */
  description?: string;
  /** Optional short reference — bill no., invoice, order id. */
  reference?: string;
  /** Business date, YYYY-MM-DD. */
  date: string;
  /** Optional due date, YYYY-MM-DD. */
  dueDate?: string;
  createdAt: string;
}

/** A payment (settling a credit, in either direction). */
export interface Payment {
  id: string;
  partyId: string;
  amount: number;
  kind: PaymentKind;
  /** How it was paid — cash / UPI / bank / cheque. */
  mode?: PaymentMode;
  /** Optional short reference — UPI txn id, cheque no., etc. */
  reference?: string;
  note?: string;
  date: string;
  createdAt: string;
}

/** Local-only housekeeping — never tracked, never sent anywhere. Powers Founder Mode + the backup reminder. */
export interface Meta {
  /** When the merchant last made a local backup (ISO), or null. */
  lastBackupAt: string | null;
  /** How many times the merchant exported (device-local counter). */
  exportCount: number;
  /** How many times the merchant imported (device-local counter). */
  importCount: number;
}

/** The entire Vyora Alpha dataset — lives in one localStorage key on the device. */
/**
 * A soft-deleted record (P3-001). Deleting a contact or an entry moves it here
 * instead of erasing it: recoverable from Settings → Recently Deleted for 30 days.
 * An entry delete keeps `parties: []` (the contact stays); a contact delete carries
 * the contact plus its whole history so Restore brings everything back together.
 */
export interface TrashEntry {
  id: string;
  deletedAt: string; // ISO
  kind: "entry" | "contact";
  parties: Party[];
  transactions: Transaction[];
  payments: Payment[];
}

export interface VyoraData {
  version: number;
  parties: Party[];
  transactions: Transaction[];
  payments: Payment[];
  meta: Meta;
  /** Recently-deleted records, newest first (P3-001). Optional for migration safety. */
  trash?: TrashEntry[];
}

/**
 * How an entry names its party. Existing parties are bound by immutable **id**
 * (never by typed name) so a slightly different spelling can never silently
 * create a duplicate ledger. A brand-new party is created only on explicit intent.
 */
export type PartyRef = { kind: "existing"; id: string } | { kind: "new"; name: string };

/** The envelope written by Export / read by Import — human-readable, versioned, timestamped. */
export interface ExportFile {
  app: "vyora";
  schemaVersion: number;
  exportedAt: string;
  data: VyoraData;
}

/** A party's computed position. `net > 0` = they owe the merchant; `net < 0` = the merchant owes them. */
export interface PartyBalance {
  party: Party;
  /** Signed: + = receivable (they owe me), − = payable (I owe them). Rupees. */
  net: number;
}

/** The dashboard headline numbers, all derived — never stored. */
export interface DashboardTotals {
  /** Sum of all positive party nets — money the merchant will collect. */
  receivable: number;
  /** Sum of all negative party nets (as a positive number) — money the merchant owes. */
  payable: number;
  /** receivable − payable. The true net position. */
  net: number;
  /** Payments received today. */
  todaysCollections: number;
  /** Payments made today. */
  todaysPayments: number;
}

/** A unified item for the "recent activity" and party-statement lists. */
export interface ActivityItem {
  id: string;
  partyId: string;
  partyName: string;
  date: string;
  createdAt: string;
  /** Signed effect on "they owe me": +given/+paid, −taken/−received. */
  signedAmount: number;
  amount: number;
  label: string; // e.g. "Credit given", "Payment received"
  note?: string;
  /** Short reference — bill no. / invoice (credit) or UPI/cheque ref (payment). */
  reference?: string;
  /** Payment mode (payments only). */
  mode?: PaymentMode;
  type: "transaction" | "payment";
}
