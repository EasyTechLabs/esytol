/**
 * Vyora — Data Integrity (ENG-005). The ledger must never become inconsistent.
 *
 * `runIntegrity` verifies a dataset and applies SAFE, non-destructive repairs —
 * never a silent data loss:
 *   • negative amounts are corrected to their magnitude (the sign lives in `kind`);
 *   • entries whose contact is missing are reattached to a clearly-labelled
 *     "Recovered entries" contact (kept visible, not hidden);
 *   • missing/duplicate ids are regenerated;
 *   • entries with an unusable amount (NaN / ∞ / 0) are QUARANTINED into Recently
 *     Deleted (recoverable) rather than dropped.
 * Anything it cannot safely repair is reported as a WARNING.
 *
 * It runs after import, after restore, and at startup, and produces an Integrity
 * Report for debugging (surfaced in Founder Mode). Pure: data in → repaired data +
 * report out. It never touches the network. No workflow behaviour changes.
 */

import type { VyoraData, Party, Transaction, Payment, TrashEntry } from "./types";

export type IntegritySeverity = "repaired" | "warning";

export interface IntegrityIssue {
  code: string;
  severity: IntegritySeverity;
  message: string;
  count: number;
}

export interface IntegrityReport {
  /** No warning-level issues — i.e. no major corruption that couldn't be safely repaired. */
  ok: boolean;
  /** At least one repair or quarantine was applied. */
  repaired: boolean;
  checkedAt: string;
  totals: { parties: number; transactions: number; payments: number; trash: number };
  issues: IntegrityIssue[];
}

export interface IntegrityResult {
  data: VyoraData;
  report: IntegrityReport;
}

const RECOVERED_PARTY_ID = "pty_recovered";

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** A unique id not already present in `taken`; deterministic given its inputs. */
function uniqueId(prefix: string, taken: Set<string>): string {
  let n = 1;
  let id = `${prefix}_fix${n}`;
  while (taken.has(id)) {
    n++;
    id = `${prefix}_fix${n}`;
  }
  taken.add(id);
  return id;
}

/**
 * Verify and repair a dataset. `checkedAt` is the timestamp stamped on the report
 * and on any quarantined/recovered records (passed in for determinism).
 */
export function runIntegrity(input: VyoraData, checkedAt: string): IntegrityResult {
  const issues: IntegrityIssue[] = [];
  const flag = (code: string, severity: IntegritySeverity, message: string, count: number) => {
    if (count > 0) issues.push({ code, severity, message, count });
  };

  // 0 — structural: parties/transactions/payments must be arrays of objects.
  const wasStructural =
    !Array.isArray(input.parties) ||
    !Array.isArray(input.transactions) ||
    !Array.isArray(input.payments);
  let parties: Party[] = (Array.isArray(input.parties) ? input.parties : []).filter(
    (p): p is Party => !!p && typeof p === "object"
  );
  let transactions: Transaction[] = (
    Array.isArray(input.transactions) ? input.transactions : []
  ).filter((t): t is Transaction => !!t && typeof t === "object");
  let payments: Payment[] = (Array.isArray(input.payments) ? input.payments : []).filter(
    (p): p is Payment => !!p && typeof p === "object"
  );
  if (wasStructural) {
    flag("structure", "warning", "Ledger structure was incomplete and was reset where needed.", 1);
  }

  const taken = new Set<string>();

  // 1 — contact ids: present and unique (re-id keeps contacts distinct).
  let missingPartyId = 0;
  let dupPartyId = 0;
  parties = parties.map((p) => {
    if (typeof p.id !== "string" || p.id.length === 0) {
      missingPartyId++;
      return { ...p, id: uniqueId("pty", taken) };
    }
    if (taken.has(p.id)) {
      dupPartyId++;
      return { ...p, id: uniqueId("pty", taken) };
    }
    taken.add(p.id);
    return p;
  });
  flag(
    "party-id-missing",
    "repaired",
    "Contacts with a missing id were given a new id.",
    missingPartyId
  );
  flag(
    "party-id-duplicate",
    "warning",
    "Duplicate contact ids were separated (their histories may have merged).",
    dupPartyId
  );

  const partyIds = new Set(parties.map((p) => p.id));

  // 2 — amounts: correct negatives; quarantine the unusable (NaN / ∞ / 0).
  const quarantineTxns: Transaction[] = [];
  const quarantinePays: Payment[] = [];
  let negativeAmts = 0;
  let invalidAmts = 0;

  transactions = transactions.filter((t) => {
    if (!isFiniteNumber(t.amount) || t.amount === 0) {
      invalidAmts++;
      quarantineTxns.push(t);
      return false;
    }
    return true;
  });
  transactions = transactions.map((t) => {
    if (t.amount < 0) {
      negativeAmts++;
      return { ...t, amount: Math.abs(t.amount) };
    }
    return t;
  });
  payments = payments.filter((p) => {
    if (!isFiniteNumber(p.amount) || p.amount === 0) {
      invalidAmts++;
      quarantinePays.push(p);
      return false;
    }
    return true;
  });
  payments = payments.map((p) => {
    if (p.amount < 0) {
      negativeAmts++;
      return { ...p, amount: Math.abs(p.amount) };
    }
    return p;
  });
  flag(
    "amount-negative",
    "repaired",
    "Negative amounts were corrected to their value.",
    negativeAmts
  );
  flag(
    "amount-invalid",
    "warning",
    "Entries with an unusable amount were moved to Recently Deleted.",
    invalidAmts
  );

  // 3 — entry ids: present and unique across BOTH collections (and vs contact ids).
  let missingEntryId = 0;
  let dupEntryId = 0;
  const fixEntryId = <T extends { id: string }>(e: T): T => {
    if (typeof e.id !== "string" || e.id.length === 0) {
      missingEntryId++;
      return { ...e, id: uniqueId("txn", taken) };
    }
    if (taken.has(e.id)) {
      dupEntryId++;
      return { ...e, id: uniqueId("txn", taken) };
    }
    taken.add(e.id);
    return e;
  };
  transactions = transactions.map(fixEntryId);
  payments = payments.map(fixEntryId);
  flag(
    "entry-id-missing",
    "repaired",
    "Entries with a missing id were given a new id.",
    missingEntryId
  );
  flag("entry-id-duplicate", "repaired", "Duplicate entry ids were regenerated.", dupEntryId);

  // 4 — orphans / invalid contact refs: reattach to a "Recovered entries" contact.
  const needsRecovery = (pid: unknown) => typeof pid !== "string" || !partyIds.has(pid);
  const orphans =
    transactions.filter((t) => needsRecovery(t.partyId)).length +
    payments.filter((p) => needsRecovery(p.partyId)).length;
  if (orphans > 0) {
    const recId = RECOVERED_PARTY_ID;
    if (!partyIds.has(recId)) {
      parties = [...parties, { id: recId, name: "Recovered entries", createdAt: checkedAt }];
      partyIds.add(recId);
      taken.add(recId);
    }
    transactions = transactions.map((t) =>
      needsRecovery(t.partyId) ? { ...t, partyId: recId } : t
    );
    payments = payments.map((p) => (needsRecovery(p.partyId) ? { ...p, partyId: recId } : p));
  }
  flag(
    "orphan-entry",
    "repaired",
    "Entries with no matching contact were moved to a “Recovered entries” contact.",
    orphans
  );

  // 5 — fold quarantined entries into the trash (recoverable), newest first.
  const existingTrash: TrashEntry[] = Array.isArray(input.trash) ? input.trash : [];
  const quarantined: TrashEntry[] = [
    ...quarantineTxns.map((t) => ({
      id: uniqueId("trash", taken),
      deletedAt: checkedAt,
      kind: "entry" as const,
      parties: [],
      transactions: [t],
      payments: [],
    })),
    ...quarantinePays.map((p) => ({
      id: uniqueId("trash", taken),
      deletedAt: checkedAt,
      kind: "entry" as const,
      parties: [],
      transactions: [],
      payments: [p],
    })),
  ];
  const trash = [...quarantined, ...existingTrash];

  const data: VyoraData = { ...input, parties, transactions, payments, trash };
  const report: IntegrityReport = {
    ok: !issues.some((i) => i.severity === "warning"),
    repaired: issues.length > 0,
    checkedAt,
    totals: {
      parties: parties.length,
      transactions: transactions.length,
      payments: payments.length,
      trash: trash.length,
    },
    issues,
  };
  return { data, report };
}
