/**
 * Party reads.
 *
 * Every query is scoped by `merchantId` from the token — there is no overload
 * that omits it. Balance is folded from entries on read; no balance column
 * exists, because a stored one would be a second source of truth and would
 * drift the moment a late offline event arrived.
 */

import type { Pool, PoolClient } from "../../db/pool.js";

export type PartyPosition = "owes_merchant" | "merchant_owes" | "settled" | "no_entries";

export interface PartyBalance {
  net: number;
  position: PartyPosition;
  entryCount: number;
  lastActivityAt: string | null;
}

export interface Party {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  balance: PartyBalance;
}

interface Row {
  party_id: string;
  name: string;
  phone: string | null;
  note: string | null;
  created_at: Date;
  updated_at: Date;
  version: number;
  net: number | null;
  entry_count: number | null;
  last_activity_at: Date | null;
}

/**
 * `net` is signed from the merchant's point of view:
 *   +given, +paid   → the party owes the merchant more
 *   −taken, −received → the merchant owes the party more
 * This is the only signed number in the API, and it is derived, never stored.
 */
const BALANCE_FOLD = `
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(SUM(CASE e.direction
        WHEN 'given'    THEN  e.amount
        WHEN 'paid'     THEN  e.amount
        WHEN 'taken'    THEN -e.amount
        WHEN 'received' THEN -e.amount
      END), 0)::bigint AS net,
      COUNT(*)::bigint AS entry_count,
      MAX(e.created_at) AS last_activity_at
    FROM entry_projection e
    WHERE e.merchant_id = p.merchant_id
      AND e.party_id = p.party_id
      AND e.deleted = false
  ) bal ON true
`;

const SELECT_PARTY = `
  SELECT p.party_id, p.name, p.phone, p.note, p.created_at, p.updated_at, p.version,
         bal.net, bal.entry_count, bal.last_activity_at
    FROM party_projection p
    ${BALANCE_FOLD}
`;

function position(net: number, entryCount: number): PartyPosition {
  if (entryCount === 0) return "no_entries";
  if (net > 0) return "owes_merchant";
  if (net < 0) return "merchant_owes";
  return "settled";
}

function toParty(row: Row): Party {
  const net = row.net ?? 0;
  const entryCount = row.entry_count ?? 0;
  return {
    id: row.party_id,
    name: row.name,
    phone: row.phone,
    note: row.note,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    version: row.version,
    balance: {
      net,
      position: position(net, entryCount),
      entryCount,
      lastActivityAt: row.last_activity_at ? row.last_activity_at.toISOString() : null,
    },
  };
}

export async function findParty(
  db: Pool | PoolClient,
  merchantId: string,
  partyId: string
): Promise<Party | null> {
  const { rows } = await db.query<Row>(
    `${SELECT_PARTY} WHERE p.merchant_id = $1 AND p.party_id = $2 AND p.deleted = false`,
    [merchantId, partyId]
  );
  const row = rows[0];
  return row ? toParty(row) : null;
}

export interface ListOptions {
  readonly q?: string;
  readonly position?: PartyPosition;
  readonly updatedSince?: string;
  readonly cursor?: string;
  readonly limit: number;
}

export interface ListResult {
  readonly items: Party[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export async function listParties(
  db: Pool | PoolClient,
  merchantId: string,
  options: ListOptions
): Promise<ListResult> {
  const where: string[] = ["p.merchant_id = $1", "p.deleted = false"];
  const params: unknown[] = [merchantId];

  if (options.q) {
    params.push(`%${options.q}%`);
    where.push(`(p.name ILIKE $${params.length} OR p.phone ILIKE $${params.length})`);
  }
  if (options.updatedSince) {
    params.push(options.updatedSince);
    where.push(`p.updated_at >= $${params.length}`);
  }
  // Keyset pagination on party_id — stable, and unaffected by concurrent writes
  // in a way that OFFSET is not.
  if (options.cursor) {
    params.push(options.cursor);
    where.push(`p.party_id > $${params.length}`);
  }

  // `position` filters a derived value, so it must be applied after the fold.
  const having =
    options.position === undefined
      ? ""
      : options.position === "no_entries"
        ? "AND COALESCE(bal.entry_count, 0) = 0"
        : options.position === "owes_merchant"
          ? "AND COALESCE(bal.entry_count, 0) > 0 AND COALESCE(bal.net, 0) > 0"
          : options.position === "merchant_owes"
            ? "AND COALESCE(bal.entry_count, 0) > 0 AND COALESCE(bal.net, 0) < 0"
            : "AND COALESCE(bal.entry_count, 0) > 0 AND COALESCE(bal.net, 0) = 0";

  params.push(options.limit + 1); // one extra row answers hasMore without a count
  const { rows } = await db.query<Row>(
    `${SELECT_PARTY} WHERE ${where.join(" AND ")} ${having}
      ORDER BY p.party_id ASC
      LIMIT $${params.length}`,
    params
  );

  const hasMore = rows.length > options.limit;
  const page = hasMore ? rows.slice(0, options.limit) : rows;
  const last = page[page.length - 1];

  return {
    items: page.map(toParty),
    nextCursor: hasMore && last ? last.party_id : null,
    hasMore,
  };
}

/** Row-level state needed for `If-Match`, including tombstoned parties. */
export async function findPartyVersion(
  db: Pool | PoolClient,
  merchantId: string,
  partyId: string
): Promise<{ version: number; deleted: boolean } | null> {
  const { rows } = await db.query<{ version: number; deleted: boolean }>(
    `SELECT version, deleted FROM party_projection WHERE merchant_id = $1 AND party_id = $2`,
    [merchantId, partyId]
  );
  return rows[0] ?? null;
}

export const etagFor = (version: number): string => `"${version}"`;
