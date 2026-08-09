/**
 * The database port.
 *
 * Every query in this app goes through this interface rather than importing
 * `expo-sqlite` directly. That is not indirection for its own sake: it is what
 * lets the tests run the **real SQL** against real SQLite (`node:sqlite`)
 * instead of against a hand-written fake.
 *
 * A fake would let a typo in a CHECK constraint, a missing index or a wrong
 * ORDER BY pass every test and fail on a merchant's phone. Testing the actual
 * statements is the entire point, so the port is shaped to match `expo-sqlite`'s
 * async API exactly — the production adapter is then a pass-through with no
 * translation layer that could itself be wrong.
 */

export type SqlParam = string | number | null;

export interface SqlRunResult {
  readonly changes: number;
  readonly lastInsertRowId: number;
}

export interface SqlDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: SqlParam[]): Promise<SqlRunResult>;
  getAllAsync<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
  /**
   * Runs `fn` inside one transaction, rolling back if it throws.
   *
   * Recording an entry and queueing its delivery must be atomic. A crash
   * between the two would either lose the merchant's entry or leave the server
   * permanently unaware of it, and both are silent.
   */
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
}

export const DATABASE_NAME = "vyora.db";

/**
 * Open the device database.
 *
 * `expo-sqlite` is imported lazily so that pure-logic modules importing this
 * file — and the Node test process — never pull in a native module they have no
 * use for.
 */
export async function openDeviceDatabase(name: string = DATABASE_NAME): Promise<SqlDatabase> {
  const { openDatabaseAsync } = await import("expo-sqlite");
  const db = await openDatabaseAsync(name);
  // Foreign keys are OFF by default in SQLite. An entry pointing at a party
  // that does not exist is exactly the corruption this schema declares against.
  await db.execAsync("PRAGMA foreign_keys = ON");
  return db as unknown as SqlDatabase;
}
