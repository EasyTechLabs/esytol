/**
 * Migrations, in their own file.
 *
 * These tests drop and rebuild the schema. That is incompatible with sharing a
 * database with tests that rely on seeded fixtures, so they are isolated —
 * `fileParallelism` is off and every other file re-seeds on entry.
 */

import { describe, expect, it, afterAll, beforeAll } from "vitest";
import { pathToFileURL } from "node:url";
import { createPool, type Pool } from "../src/db/pool.js";
import { migrateUp, resetDatabase } from "../src/db/migrate.js";
import { seed } from "../src/seed/seed.js";
import { isMainModule } from "../src/main-module.js";
import { TEST_DATABASE_URL } from "./helpers.js";

let pool: Pool;
beforeAll(() => {
  pool = createPool(TEST_DATABASE_URL);
});
afterAll(async () => {
  // Leave the database in a seeded state so a later file starting mid-run is
  // never surprised by an empty schema.
  await resetDatabase(pool);
  await seed(pool, 1);
  await pool.end();
});

describe("CLI entrypoint detection", () => {
  // Regression guard. The naive `"file://" + argv[1]` form silently returns
  // false on Windows, so `db:migrate` and `db:seed` exited 0 having done
  // nothing — indistinguishable from success until a query failed much later.
  it("recognises the invoked script on this platform", () => {
    const entry = process.argv[1]!;
    expect(isMainModule(pathToFileURL(entry).href)).toBe(true);
  });

  it("does not match a different module", () => {
    expect(isMainModule("file:///somewhere/else/not-the-entry.ts")).toBe(false);
  });

  it("matches a Windows-style absolute path correctly", () => {
    // `pathToFileURL("C:\\a\\b.ts")` is `file:///C:/a/b.ts` — three slashes.
    // A hand-built `file://C:/a/b.ts` has two, and would never compare equal.
    const url = pathToFileURL(process.argv[1]!).href;
    expect(url.startsWith("file:///")).toBe(true);
    expect(isMainModule(`file://${process.argv[1]!.replace(/\\/g, "/")}`)).toBe(false);
  });
});

describe("migrations", () => {
  it("run from a completely empty database", async () => {
    const applied = await resetDatabase(pool);
    expect(applied).toContain("001_init.sql");

    const { rows } = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' ORDER BY table_name`
    );
    const tables = rows.map((r) => r.table_name);
    for (const expected of [
      "access_tokens",
      "dev_identities",
      "devices",
      "entry_projection",
      "events",
      "idempotency_keys",
      "merchants",
      "party_projection",
      "schema_migrations",
      "users",
    ]) {
      expect(tables).toContain(expected);
    }
  });

  it("are idempotent — a second run applies nothing", async () => {
    await resetDatabase(pool);
    const second = await migrateUp(pool);
    expect(second).toEqual([]);
  });

  it("record what they applied", async () => {
    await resetDatabase(pool);
    const { rows } = await pool.query<{ name: string }>(
      `SELECT name FROM schema_migrations ORDER BY name`
    );
    expect(rows.map((r) => r.name)).toEqual(["001_init.sql"]);
  });

  it("store no balance column anywhere", async () => {
    await resetDatabase(pool);
    // Balances are folded from entries. A stored one would be a second source
    // of truth and would drift the moment a late offline event arrived.
    const { rows } = await pool.query(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name ILIKE '%balance%'`
    );
    expect(rows).toEqual([]);
  });

  it("keep recorded_at at millisecond precision so cursors round-trip exactly", async () => {
    await resetDatabase(pool);
    const { rows } = await pool.query<{ datetime_precision: number }>(
      `SELECT datetime_precision FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'recorded_at'`
    );
    expect(rows[0]?.datetime_precision).toBe(3);
  });

  it("seed two independent workspaces into a freshly migrated database", async () => {
    await resetDatabase(pool);
    const result = await seed(pool, 1);

    expect(result.alpha.merchantId).not.toBe(result.beta.merchantId);

    const { rows } = await pool.query<{ merchant_id: string; n: number }>(
      `SELECT merchant_id, count(*)::int AS n FROM party_projection GROUP BY merchant_id`
    );
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.n).toBeGreaterThan(0);
  });
});
