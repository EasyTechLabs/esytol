/**
 * A real SQLite database for tests.
 *
 * `node:sqlite` (built into Node 22+) is driven through the same `SqlDatabase`
 * port the app uses, so the tests execute the *actual* SQL — the same CHECK
 * constraints, the same indexes, the same ORDER BY. A hand-written fake would
 * let a typo in a constraint pass every test and fail on a merchant's phone.
 *
 * In-memory, so each test gets a clean ledger with no files to clean up.
 */

import { DatabaseSync } from "node:sqlite";
import type { SqlDatabase, SqlParam, SqlRunResult } from "../src/database/driver";
import { migrate } from "../src/database/migrate";

export interface TestDatabase extends SqlDatabase {
  close(): void;
}

export function createTestDatabase(): TestDatabase {
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys = ON");

  let depth = 0;

  const db: TestDatabase = {
    async execAsync(sql: string): Promise<void> {
      raw.exec(sql);
    },

    async runAsync(sql: string, params: SqlParam[] = []): Promise<SqlRunResult> {
      const result = raw.prepare(sql).run(...params);
      return {
        changes: Number(result.changes),
        lastInsertRowId: Number(result.lastInsertRowid),
      };
    },

    async getAllAsync<T>(sql: string, params: SqlParam[] = []): Promise<T[]> {
      return raw.prepare(sql).all(...params) as T[];
    },

    async getFirstAsync<T>(sql: string, params: SqlParam[] = []): Promise<T | null> {
      const row = raw.prepare(sql).get(...params);
      return (row as T | undefined) ?? null;
    },

    async withTransactionAsync(fn: () => Promise<void>): Promise<void> {
      // Nested calls join the outer transaction rather than starting a second
      // one, matching expo-sqlite. The sync engine wraps a transaction around
      // work that itself transacts.
      if (depth > 0) {
        depth += 1;
        try {
          await fn();
        } finally {
          depth -= 1;
        }
        return;
      }

      depth = 1;
      raw.exec("BEGIN");
      try {
        await fn();
        raw.exec("COMMIT");
      } catch (cause) {
        raw.exec("ROLLBACK");
        throw cause;
      } finally {
        depth = 0;
      }
    },

    close() {
      raw.close();
    },
  };

  return db;
}

export async function migratedDatabase(): Promise<TestDatabase> {
  const db = createTestDatabase();
  await migrate(db);
  return db;
}

/** A fixed clock, so backoff and ordering assertions are not time-dependent. */
export function fixedClock(startMs = Date.parse("2026-08-09T10:00:00.000Z")) {
  let current = startMs;
  return {
    nowMs: () => current,
    nowIso: () => new Date(current).toISOString(),
    advance(ms: number) {
      current += ms;
    },
  };
}
