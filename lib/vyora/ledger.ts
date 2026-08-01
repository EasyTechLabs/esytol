/**
 * Vyora — Ledger Engine v2 (ARCH-001).
 *
 * ONE normalized index set, built in a single linear scan, from which every
 * merchant-visible number is read. Before this engine each selector re-scanned
 * the whole ledger per call — `allBalances` alone was O(P×N) because it called
 * `partyNet` (a full scan) once per party, and it ran again on every render and
 * on every keystroke in the party picker.
 *
 * Design rules (the reason this file exists):
 *  - **One source of truth.** Balances are still *derived*, never stored — but
 *    derived exactly once per data version. `selectors.ts` reads this engine;
 *    it does not re-implement any of it.
 *  - **Immutable.** Every index is a ReadonlyMap / readonly array, and an
 *    update returns a NEW `Ledger`; nothing is ever mutated in place.
 *  - **Memoized.** Keyed on `VyoraData` object identity (see
 *    `selectors.ledgerFor`). Data is replaced wholesale on every mutation, so
 *    identity is a correct cache key and the cache can never go stale.
 *  - **Incremental.** `appendToLedger` folds an append-only change into the
 *    previous indexes without re-deriving anything, and falls back to a full
 *    rebuild whenever its preconditions do not hold. A wrong balance is far
 *    worse than a slow one, so the fast path is taken only when it is provably
 *    equivalent — pinned by the equivalence tests in tests/vyora/ledger.test.ts.
 *
 * No schema change, no data migration, no UI or workflow change.
 */

import type {
  VyoraData,
  Party,
  Transaction,
  Payment,
  PartyBalance,
  DashboardTotals,
  ActivityItem,
} from "./types";

// ─── Domain primitives (defined here so the engine has no upward dependency) ─

/** Signed effect of a credit entry on "they owe me". given → +, taken → −. */
export function transactionEffect(t: Transaction): number {
  return t.kind === "given" ? t.amount : -t.amount;
}

/** Signed effect of a payment on "they owe me". received → −, paid → +. */
export function paymentEffect(p: Payment): number {
  return p.kind === "paid" ? p.amount : -p.amount;
}

/** Round to whole rupees for display/summing (Vyora deals in rupees, not paise). */
export function rupees(n: number): number {
  return Math.round(n);
}

/** Today's date as YYYY-MM-DD in the device's local timezone. */
export function todayISO(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

/** The one place a party name is normalised for exact matching. */
export function normalizePartyName(name: string): string {
  return name.trim().toLowerCase();
}

// ─── Index shapes ────────────────────────────────────────────────────────────

/** A statement row: an activity item plus the running outstanding after it. */
export type StatementRow = ActivityItem & { runningNet: number };

export interface PartyIndex {
  readonly byId: ReadonlyMap<string, Party>;
  /** Normalised name → the FIRST party with that name (create-or-reuse semantics). */
  readonly byNormalizedName: ReadonlyMap<string, Party>;
  readonly all: readonly Party[];
}

export interface TransactionIndex {
  readonly transactionsByParty: ReadonlyMap<string, readonly Transaction[]>;
  readonly paymentsByParty: ReadonlyMap<string, readonly Payment[]>;
  readonly transactionById: ReadonlyMap<string, Transaction>;
  readonly paymentById: ReadonlyMap<string, Payment>;
}

export interface BalanceIndex {
  /** Signed net per party id. + = they owe the merchant. Zero-entry parties included. */
  readonly netByParty: ReadonlyMap<string, number>;
  /** Every party with its net, biggest absolute exposure first. */
  readonly ranked: readonly PartyBalance[];
}

export interface StatisticsIndex {
  readonly receivable: number;
  readonly payable: number;
  readonly net: number;
  /** Payments RECEIVED summed per business date — keeps the index date-independent. */
  readonly collectionsByDate: ReadonlyMap<string, number>;
  /** Payments MADE summed per business date. */
  readonly paymentsMadeByDate: ReadonlyMap<string, number>;
  readonly partyCount: number;
  readonly entryCount: number;
}

export interface TimelineIndex {
  /** Every entry as an activity item, newest first. */
  readonly newestFirst: readonly ActivityItem[];
  /** Per-party statement rows, oldest first, running balance precomputed. */
  readonly statementByParty: ReadonlyMap<string, readonly StatementRow[]>;
}

export interface SearchRecord {
  readonly balance: PartyBalance;
  /** Lowercased name + NUL + phone — precomputed so a keystroke allocates nothing. */
  readonly haystack: string;
}

export interface SearchIndex {
  /** Ordered by exposure (same order as `BalanceIndex.ranked`). */
  readonly records: readonly SearchRecord[];
}

export interface DueIndex {
  readonly transactionsByDueDate: ReadonlyMap<string, readonly Transaction[]>;
  readonly dueDatesAscending: readonly string[];
  readonly earliestDueDateByParty: ReadonlyMap<string, string>;
}

/** The whole derived state of one `VyoraData` version. */
export interface Ledger {
  readonly data: VyoraData;
  readonly parties: PartyIndex;
  readonly transactions: TransactionIndex;
  readonly balances: BalanceIndex;
  readonly statistics: StatisticsIndex;
  readonly timeline: TimelineIndex;
  readonly search: SearchIndex;
  readonly due: DueIndex;
}

const EMPTY_STATEMENT: readonly StatementRow[] = [];

/**
 * Field separator inside a search haystack. A visible separator (a space) would
 * let a query straddling the boundary match a name+phone pair that neither
 * field actually contains; NUL is unreachable from a typed query.
 */
const HAYSTACK_SEPARATOR = "\u0000";

// ─── Small shared helpers ────────────────────────────────────────────────────

function pushInto<T>(map: Map<string, T[]>, key: string, value: T): void {
  const existing = map.get(key);
  if (existing) existing.push(value);
  else map.set(key, [value]);
}

function addInto(map: Map<string, number>, key: string, amount: number): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function resolvePartyName(partyById: ReadonlyMap<string, Party>, partyId: string): string {
  return partyById.get(partyId)?.name ?? "Unknown";
}

function toTransactionItem(
  transaction: Transaction,
  partyById: ReadonlyMap<string, Party>
): ActivityItem {
  return {
    id: transaction.id,
    partyId: transaction.partyId,
    partyName: resolvePartyName(partyById, transaction.partyId),
    date: transaction.date,
    createdAt: transaction.createdAt,
    amount: transaction.amount,
    signedAmount: transactionEffect(transaction),
    label: transaction.kind === "given" ? "Credit given" : "Credit taken",
    note: transaction.description,
    type: "transaction",
  };
}

function toPaymentItem(payment: Payment, partyById: ReadonlyMap<string, Party>): ActivityItem {
  return {
    id: payment.id,
    partyId: payment.partyId,
    partyName: resolvePartyName(partyById, payment.partyId),
    date: payment.date,
    createdAt: payment.createdAt,
    amount: payment.amount,
    signedAmount: paymentEffect(payment),
    label: payment.kind === "received" ? "Payment received" : "Payment made",
    note: payment.note,
    type: "payment",
  };
}

// ─── Party index ─────────────────────────────────────────────────────────────

function buildPartyIndex(data: VyoraData): PartyIndex {
  const byId = new Map<string, Party>();
  const byNormalizedName = new Map<string, Party>();
  for (const party of data.parties) {
    byId.set(party.id, party);
    // First writer wins, matching the old `.find()` create-or-reuse behaviour.
    const key = normalizePartyName(party.name);
    if (!byNormalizedName.has(key)) byNormalizedName.set(key, party);
  }
  return { byId, byNormalizedName, all: data.parties };
}

// ─── The single scan of the raw entries ──────────────────────────────────────

interface LedgerScan {
  readonly transactions: TransactionIndex;
  readonly netRawByParty: Map<string, number>;
  readonly transactionItems: ActivityItem[];
  readonly paymentItems: ActivityItem[];
  readonly collectionsByDate: Map<string, number>;
  readonly paymentsMadeByDate: Map<string, number>;
  readonly due: DueIndex;
}

/**
 * Walk every transaction and payment exactly once, emitting every raw grouping
 * the higher-level indexes need. This is the ONLY place the ledger is scanned.
 */
function scanLedger(data: VyoraData, partyById: ReadonlyMap<string, Party>): LedgerScan {
  const transactionsByParty = new Map<string, Transaction[]>();
  const paymentsByParty = new Map<string, Payment[]>();
  const transactionById = new Map<string, Transaction>();
  const paymentById = new Map<string, Payment>();
  const netRawByParty = new Map<string, number>();
  const transactionItems: ActivityItem[] = [];
  const paymentItems: ActivityItem[] = [];
  const collectionsByDate = new Map<string, number>();
  const paymentsMadeByDate = new Map<string, number>();
  const transactionsByDueDate = new Map<string, Transaction[]>();
  const earliestDueDateByParty = new Map<string, string>();

  // Every known party is a key even with zero entries, so reads never miss.
  for (const party of data.parties) netRawByParty.set(party.id, 0);

  for (const transaction of data.transactions) {
    transactionById.set(transaction.id, transaction);
    pushInto(transactionsByParty, transaction.partyId, transaction);
    addInto(netRawByParty, transaction.partyId, transactionEffect(transaction));
    transactionItems.push(toTransactionItem(transaction, partyById));
    const dueDate = transaction.dueDate;
    if (dueDate) {
      pushInto(transactionsByDueDate, dueDate, transaction);
      const earliest = earliestDueDateByParty.get(transaction.partyId);
      if (!earliest || dueDate < earliest) {
        earliestDueDateByParty.set(transaction.partyId, dueDate);
      }
    }
  }

  for (const payment of data.payments) {
    paymentById.set(payment.id, payment);
    pushInto(paymentsByParty, payment.partyId, payment);
    addInto(netRawByParty, payment.partyId, paymentEffect(payment));
    paymentItems.push(toPaymentItem(payment, partyById));
    const bucket = payment.kind === "received" ? collectionsByDate : paymentsMadeByDate;
    addInto(bucket, payment.date, payment.amount);
  }

  return {
    transactions: { transactionsByParty, paymentsByParty, transactionById, paymentById },
    netRawByParty,
    transactionItems,
    paymentItems,
    collectionsByDate,
    paymentsMadeByDate,
    due: {
      transactionsByDueDate,
      dueDatesAscending: [...transactionsByDueDate.keys()].sort(),
      earliestDueDateByParty,
    },
  };
}

// ─── Timeline ────────────────────────────────────────────────────────────────

function isAscendingByCreatedAt(items: readonly ActivityItem[]): boolean {
  for (let i = 1; i < items.length; i++) {
    if (items[i - 1].createdAt > items[i].createdAt) return false;
  }
  return true;
}

/**
 * Merge two createdAt-ascending lists in O(n+m). On a tie the transaction side
 * wins, which reproduces a *stable* sort of `[...transactions, ...payments]` —
 * the exact ordering the screens and tests have always seen.
 */
function mergeAscending(
  transactionItems: readonly ActivityItem[],
  paymentItems: readonly ActivityItem[]
): ActivityItem[] {
  const merged = new Array<ActivityItem>(transactionItems.length + paymentItems.length);
  let left = 0;
  let right = 0;
  let out = 0;
  while (left < transactionItems.length && right < paymentItems.length) {
    const paymentIsOlder = paymentItems[right].createdAt < transactionItems[left].createdAt;
    merged[out++] = paymentIsOlder ? paymentItems[right++] : transactionItems[left++];
  }
  while (left < transactionItems.length) merged[out++] = transactionItems[left++];
  while (right < paymentItems.length) merged[out++] = paymentItems[right++];
  return merged;
}

/**
 * Oldest-first activity. The store is append-only, so both source arrays are
 * already createdAt-ascending and merge in O(N); an out-of-order array (only
 * reachable through an imported or hand-edited backup) falls back to a stable
 * sort, so correctness never depends on the append-only assumption holding.
 */
function buildAscendingActivity(
  transactionItems: readonly ActivityItem[],
  paymentItems: readonly ActivityItem[]
): ActivityItem[] {
  if (isAscendingByCreatedAt(transactionItems) && isAscendingByCreatedAt(paymentItems)) {
    return mergeAscending(transactionItems, paymentItems);
  }
  const all = [...transactionItems, ...paymentItems];
  all.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  return all;
}

/**
 * Reverse into newest-first while keeping each equal-createdAt group in its
 * original order — exactly what a stable descending sort produces. A plain
 * `.reverse()` would flip tied entries and silently reorder same-instant rows.
 */
function toNewestFirst(ascending: readonly ActivityItem[]): ActivityItem[] {
  const newestFirst: ActivityItem[] = [];
  let end = ascending.length;
  while (end > 0) {
    const stamp = ascending[end - 1].createdAt;
    let start = end - 1;
    while (start > 0 && ascending[start - 1].createdAt === stamp) start--;
    for (let i = start; i < end; i++) newestFirst.push(ascending[i]);
    end = start;
  }
  return newestFirst;
}

function buildStatementByParty(ascending: readonly ActivityItem[]): Map<string, StatementRow[]> {
  const statementByParty = new Map<string, StatementRow[]>();
  const runningByParty = new Map<string, number>();
  for (const item of ascending) {
    const running = rupees((runningByParty.get(item.partyId) ?? 0) + item.signedAmount);
    runningByParty.set(item.partyId, running);
    pushInto(statementByParty, item.partyId, { ...item, runningNet: running });
  }
  return statementByParty;
}

function buildTimelineIndex(
  transactionItems: readonly ActivityItem[],
  paymentItems: readonly ActivityItem[]
): TimelineIndex {
  const ascending = buildAscendingActivity(transactionItems, paymentItems);
  return {
    newestFirst: toNewestFirst(ascending),
    statementByParty: buildStatementByParty(ascending),
  };
}

// ─── Balances, statistics, search ────────────────────────────────────────────

/** Rank every party by absolute exposure. Stable, so ties keep store order. */
function rankBalances(
  parties: readonly Party[],
  netByParty: ReadonlyMap<string, number>
): PartyBalance[] {
  return parties
    .map((party) => ({ party, net: netByParty.get(party.id) ?? 0 }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

function buildBalanceIndex(
  data: VyoraData,
  netRawByParty: ReadonlyMap<string, number>
): BalanceIndex {
  const netByParty = new Map<string, number>();
  for (const [partyId, raw] of netRawByParty) netByParty.set(partyId, rupees(raw));
  return { netByParty, ranked: rankBalances(data.parties, netByParty) };
}

function buildStatisticsIndex(
  data: VyoraData,
  ranked: readonly PartyBalance[],
  collectionsByDate: ReadonlyMap<string, number>,
  paymentsMadeByDate: ReadonlyMap<string, number>
): StatisticsIndex {
  let receivable = 0;
  let payable = 0;
  for (const { net } of ranked) {
    if (net > 0) receivable += net;
    else if (net < 0) payable += -net;
  }
  return {
    receivable: rupees(receivable),
    payable: rupees(payable),
    net: rupees(receivable - payable),
    collectionsByDate,
    paymentsMadeByDate,
    partyCount: data.parties.length,
    entryCount: data.transactions.length + data.payments.length,
  };
}

function toHaystack(party: Party): string {
  const name = party.name.toLowerCase();
  const phone = (party.phone ?? "").toLowerCase();
  return name + HAYSTACK_SEPARATOR + phone;
}

/**
 * Precomputed lowercase haystacks in exposure order. Search stays a linear scan
 * over PARTIES (hundreds, not millions — a trie would be speculative here), but
 * a keystroke now allocates nothing and never recomputes a balance.
 *
 * `reuse` is keyed on the Party OBJECT, not its id: parties are immutable, so a
 * renamed party is a new object, correctly misses the cache, and can never keep
 * a stale haystack.
 */
function buildSearchIndex(
  ranked: readonly PartyBalance[],
  reuse?: ReadonlyMap<Party, string>
): SearchIndex {
  const records = ranked.map((balance) => ({
    balance,
    haystack: reuse?.get(balance.party) ?? toHaystack(balance.party),
  }));
  return { records };
}

// ─── Build ───────────────────────────────────────────────────────────────────

/** Derive every index for one data version. Single scan; O(N + P log P). */
export function buildLedger(data: VyoraData): Ledger {
  const parties = buildPartyIndex(data);
  const scan = scanLedger(data, parties.byId);
  const balances = buildBalanceIndex(data, scan.netRawByParty);
  return {
    data,
    parties,
    transactions: scan.transactions,
    balances,
    statistics: buildStatisticsIndex(
      data,
      balances.ranked,
      scan.collectionsByDate,
      scan.paymentsMadeByDate
    ),
    timeline: buildTimelineIndex(scan.transactionItems, scan.paymentItems),
    search: buildSearchIndex(balances.ranked),
    due: scan.due,
  };
}

// ─── Incremental append ──────────────────────────────────────────────────────

/** An append-only change: at most one new party plus exactly one new entry. */
export interface LedgerAppend {
  readonly party?: Party;
  readonly transaction?: Transaction;
  readonly payment?: Payment;
}

/**
 * Guard for the incremental fast path. Every condition here is one where the
 * folded indexes could disagree with a full rebuild; failing any of them sends
 * us down the rebuild path instead.
 */
function isAppendable(previous: Ledger, next: VyoraData, change: LedgerAppend): boolean {
  const entry = change.transaction ?? change.payment;
  if (!entry) return false;
  if (change.transaction && change.payment) return false;

  // The counts must be exactly "previous + this change", or our picture of what
  // was appended is wrong and every index derived from it would be wrong too.
  const expectedParties = previous.data.parties.length + (change.party ? 1 : 0);
  const expectedTransactions = previous.data.transactions.length + (change.transaction ? 1 : 0);
  const expectedPayments = previous.data.payments.length + (change.payment ? 1 : 0);
  if (next.parties.length !== expectedParties) return false;
  if (next.transactions.length !== expectedTransactions) return false;
  if (next.payments.length !== expectedPayments) return false;

  // The entry must genuinely be the newest, or the timeline order would break.
  const newest = previous.timeline.newestFirst[0];
  if (newest && entry.createdAt < newest.createdAt) return false;

  // A brand-new party must not collide with an existing normalised name, or the
  // first-writer-wins name index would start resolving to the wrong party.
  if (change.party) {
    const key = normalizePartyName(change.party.name);
    if (previous.parties.byNormalizedName.has(key)) return false;
  }

  // A new party must be the entry's OWN party. Folding in an unrelated new
  // party would leave it without a balance key, where a rebuild would give it
  // an explicit zero — a real divergence, however unreachable today.
  if (change.party) return change.party.id === entry.partyId;

  // Otherwise the owning party must already be known.
  return previous.parties.byId.has(entry.partyId);
}

function withAppendedParty(previous: PartyIndex, next: VyoraData, party?: Party): PartyIndex {
  if (!party) return { ...previous, all: next.parties };
  const byId = new Map(previous.byId);
  byId.set(party.id, party);
  const byNormalizedName = new Map(previous.byNormalizedName);
  byNormalizedName.set(normalizePartyName(party.name), party);
  return { byId, byNormalizedName, all: next.parties };
}

function withAppendedEntry(previous: TransactionIndex, change: LedgerAppend): TransactionIndex {
  if (change.transaction) {
    const transaction = change.transaction;
    const transactionsByParty = new Map(previous.transactionsByParty);
    const own = transactionsByParty.get(transaction.partyId) ?? [];
    transactionsByParty.set(transaction.partyId, [...own, transaction]);
    const transactionById = new Map(previous.transactionById);
    transactionById.set(transaction.id, transaction);
    return { ...previous, transactionsByParty, transactionById };
  }
  const payment = change.payment as Payment;
  const paymentsByParty = new Map(previous.paymentsByParty);
  const own = paymentsByParty.get(payment.partyId) ?? [];
  paymentsByParty.set(payment.partyId, [...own, payment]);
  const paymentById = new Map(previous.paymentById);
  paymentById.set(payment.id, payment);
  return { ...previous, paymentsByParty, paymentById };
}

function withAppendedDue(previous: DueIndex, transaction?: Transaction): DueIndex {
  const dueDate = transaction?.dueDate;
  if (!transaction || !dueDate) return previous;
  const transactionsByDueDate = new Map(previous.transactionsByDueDate);
  const own = transactionsByDueDate.get(dueDate) ?? [];
  transactionsByDueDate.set(dueDate, [...own, transaction]);
  const earliestDueDateByParty = new Map(previous.earliestDueDateByParty);
  const earliest = earliestDueDateByParty.get(transaction.partyId);
  if (!earliest || dueDate < earliest) {
    earliestDueDateByParty.set(transaction.partyId, dueDate);
  }
  return {
    transactionsByDueDate,
    // Only a previously unseen due date changes the sorted date list.
    dueDatesAscending: own.length
      ? previous.dueDatesAscending
      : [...transactionsByDueDate.keys()].sort(),
    earliestDueDateByParty,
  };
}

function withAppendedStatistics(
  previous: StatisticsIndex,
  partyCount: number,
  previousNet: number,
  nextNet: number,
  payment?: Payment
): StatisticsIndex {
  // Only one party's net moved, so the portfolio totals shift by that party's
  // delta — no re-summing every party.
  const receivable = previous.receivable + Math.max(nextNet, 0) - Math.max(previousNet, 0);
  const payable = previous.payable + Math.max(-nextNet, 0) - Math.max(-previousNet, 0);
  let collectionsByDate = previous.collectionsByDate;
  let paymentsMadeByDate = previous.paymentsMadeByDate;
  if (payment) {
    const received = payment.kind === "received";
    const source = received ? previous.collectionsByDate : previous.paymentsMadeByDate;
    const updated = new Map(source);
    updated.set(payment.date, (updated.get(payment.date) ?? 0) + payment.amount);
    if (received) collectionsByDate = updated;
    else paymentsMadeByDate = updated;
  }
  return {
    receivable: rupees(receivable),
    payable: rupees(payable),
    net: rupees(receivable - payable),
    collectionsByDate,
    paymentsMadeByDate,
    partyCount,
    entryCount: previous.entryCount + 1,
  };
}

function withAppendedTimeline(previous: TimelineIndex, item: ActivityItem): TimelineIndex {
  const statementByParty = new Map(previous.statementByParty);
  const own = statementByParty.get(item.partyId) ?? [];
  const running = rupees((own[own.length - 1]?.runningNet ?? 0) + item.signedAmount);
  statementByParty.set(item.partyId, [...own, { ...item, runningNet: running }]);
  return { newestFirst: [item, ...previous.newestFirst], statementByParty };
}

function collectHaystacks(search: SearchIndex): Map<Party, string> {
  const haystacks = new Map<Party, string>();
  for (const record of search.records) haystacks.set(record.balance.party, record.haystack);
  return haystacks;
}

/**
 * Fold one append-only change into an existing ledger without re-deriving
 * anything, returning a NEW ledger. Falls back to a full rebuild whenever the
 * change is not a clean append — correctness first, speed second.
 *
 * `next` is the store's authoritative data; the indexes are folded from
 * `change`. The two are pinned to agree by the equivalence tests.
 */
export function appendToLedger(previous: Ledger, next: VyoraData, change: LedgerAppend): Ledger {
  if (!isAppendable(previous, next, change)) return buildLedger(next);

  const parties = withAppendedParty(previous.parties, next, change.party);
  const transaction = change.transaction;
  const entry = transaction ?? (change.payment as Payment);
  const effect = transaction
    ? transactionEffect(transaction)
    : paymentEffect(change.payment as Payment);

  const previousNet = previous.balances.netByParty.get(entry.partyId) ?? 0;
  const nextNet = rupees(previousNet + effect);
  const netByParty = new Map(previous.balances.netByParty);
  netByParty.set(entry.partyId, nextNet);
  const ranked = rankBalances(next.parties, netByParty);

  const item = transaction
    ? toTransactionItem(transaction, parties.byId)
    : toPaymentItem(change.payment as Payment, parties.byId);

  return {
    data: next,
    parties,
    transactions: withAppendedEntry(previous.transactions, change),
    balances: { netByParty, ranked },
    statistics: withAppendedStatistics(
      previous.statistics,
      next.parties.length,
      previousNet,
      nextNet,
      change.payment
    ),
    timeline: withAppendedTimeline(previous.timeline, item),
    search: buildSearchIndex(ranked, collectHaystacks(previous.search)),
    due: withAppendedDue(previous.due, transaction),
  };
}

// ─── Reads (O(1) or O(matches) — no screen ever rescans the ledger) ──────────

export function readPartyNet(ledger: Ledger, partyId: string): number {
  return ledger.balances.netByParty.get(partyId) ?? 0;
}

export function readParty(ledger: Ledger, partyId: string): Party | undefined {
  return ledger.parties.byId.get(partyId);
}

export function readStatement(ledger: Ledger, partyId: string): readonly StatementRow[] {
  return ledger.timeline.statementByParty.get(partyId) ?? EMPTY_STATEMENT;
}

export function readRecentActivity(ledger: Ledger, limit = 12): readonly ActivityItem[] {
  return ledger.timeline.newestFirst.slice(0, limit);
}

/**
 * The dashboard headline numbers. Portfolio totals are precomputed; the two
 * "today" figures are a single map lookup, which is why the index itself can
 * stay date-independent and never goes stale when the clock rolls past midnight.
 */
export function readDashboardTotals(ledger: Ledger, today: string = todayISO()): DashboardTotals {
  const { statistics } = ledger;
  return {
    receivable: statistics.receivable,
    payable: statistics.payable,
    net: statistics.net,
    todaysCollections: rupees(statistics.collectionsByDate.get(today) ?? 0),
    todaysPayments: rupees(statistics.paymentsMadeByDate.get(today) ?? 0),
  };
}

/** Instant search. Empty query → every party, biggest exposure first. */
export function readSearch(ledger: Ledger, query: string): readonly PartyBalance[] {
  const needle = normalizePartyName(query);
  if (!needle) return ledger.balances.ranked;
  const matches: PartyBalance[] = [];
  for (const record of ledger.search.records) {
    if (record.haystack.includes(needle)) matches.push(record.balance);
  }
  return matches;
}

/** Exact (case-insensitive, trimmed) name lookup — create-or-reuse on fast entry. */
export function readPartyByName(ledger: Ledger, name: string): Party | undefined {
  return ledger.parties.byNormalizedName.get(normalizePartyName(name));
}
