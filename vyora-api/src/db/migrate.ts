/**
 * Migration runner.
 *
 * Numbered SQL files applied in order, each in its own transaction, recorded in
 * `schema_migrations`. Deliberately not an ORM auto-sync: a schema that a tool
 * derives from code can silently drop a column it no longer sees, and an
 * append-only event log is exactly the thing you cannot recover from that.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPool, type Pool } from "./pool.js";
import { loadConfig } from "../config.js";
import { isMainModule } from "../main-module.js";

const here = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(here, "..", "..", "migrations");

export interface Migration {
  readonly name: string;
  readonly sql: string;
}

export function readMigrations(dir: string = MIGRATIONS_DIR): Migration[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(dir, name), "utf8") }));
}

async function ensureTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

/** Apply every migration not yet recorded. Returns the names applied. */
export async function migrateUp(pool: Pool, dir: string = MIGRATIONS_DIR): Promise<string[]> {
  await ensureTable(pool);
  const { rows } = await pool.query<{ name: string }>("SELECT name FROM schema_migrations");
  const done = new Set(rows.map((r) => r.name));
  const applied: string[] = [];

  for (const migration of readMigrations(dir)) {
    if (done.has(migration.name)) continue;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(migration.sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [migration.name]);
      await client.query("COMMIT");
      applied.push(migration.name);
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`migration ${migration.name} failed: ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }
  return applied;
}

/** Drop everything and re-apply. Local development only. */
export async function resetDatabase(pool: Pool, dir: string = MIGRATIONS_DIR): Promise<string[]> {
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  return migrateUp(pool, dir);
}

if (isMainModule(import.meta.url)) {
  const config = loadConfig();
  const pool = createPool(config.databaseUrl);
  const command = process.argv[2] ?? "up";
  try {
    const applied = command === "reset" ? await resetDatabase(pool) : await migrateUp(pool);
    console.log(applied.length ? `applied: ${applied.join(", ")}` : "already up to date");
  } catch (err) {
    console.error((err as Error).message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
