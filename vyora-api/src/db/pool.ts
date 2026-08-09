import pg from "pg";

/**
 * `bigint` (OID 20) arrives from pg as a string so precision is never lost.
 * Amounts here are integer rupees well inside Number.MAX_SAFE_INTEGER, and the
 * contract types them as numbers, so parse them back.
 */
pg.types.setTypeParser(20, (value: string) => Number.parseInt(value, 10));

/**
 * `date` (OID 1082) stays a string.
 *
 * A business date is `YYYY-MM-DD` in the merchant's own timezone — a calendar
 * day, not an instant. Letting pg parse it into a JS `Date` re-interprets it in
 * the server's timezone and then serialises as a full timestamp, which both
 * breaks the contract's `format: date` and can shift a sale onto the wrong
 * trading day. PostgreSQL already hands it over in exactly the form we want.
 */
pg.types.setTypeParser(1082, (value: string) => value);

export type Pool = pg.Pool;
export type PoolClient = pg.PoolClient;

export function createPool(databaseUrl: string): Pool {
  return new pg.Pool({ connectionString: databaseUrl, max: 10 });
}

/** Run `fn` inside a transaction, rolling back on any throw. */
export async function withTransaction<T>(
  pool: Pool,
  fn: (c: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
