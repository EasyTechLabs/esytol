/**
 * Apply migrations, in order, recording what ran.
 *
 * Same contract as the server's migrator: idempotent, ordered, and a second run
 * applies nothing. A device that skipped a release must be able to catch up
 * without anyone guessing which statements it already executed.
 */

import type { SqlDatabase } from "./driver";
import { MIGRATIONS } from "./schema";

const LEDGER_TABLE = `CREATE TABLE IF NOT EXISTS schema_migrations (
  name       TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
)`;

export async function migrate(db: SqlDatabase, now: () => string = isoNow): Promise<string[]> {
  await db.execAsync(LEDGER_TABLE);

  const applied = await db.getAllAsync<{ name: string }>(`SELECT name FROM schema_migrations`);
  const done = new Set(applied.map((row) => row.name));

  const ran: string[] = [];
  for (const migration of MIGRATIONS) {
    if (done.has(migration.name)) continue;

    // One transaction per migration. A half-applied migration is worse than an
    // unapplied one, because the next run believes it succeeded.
    await db.withTransactionAsync(async () => {
      for (const statement of migration.statements) {
        await db.execAsync(statement);
      }
      await db.runAsync(`INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)`, [
        migration.name,
        now(),
      ]);
    });
    ran.push(migration.name);
  }
  return ran;
}

export function isoNow(): string {
  return new Date().toISOString();
}
