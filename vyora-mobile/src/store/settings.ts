/**
 * Development settings, kept in the device database.
 *
 * They live in SQLite rather than a bundled config file for one reason: a value
 * compiled into the app ships with the app. A developer identity that can only
 * be typed in at runtime cannot be in a release binary, whatever anyone forgets
 * to delete before a build.
 *
 * Nothing here is a secret in the production sense — the identity names a
 * seeded synthetic workspace and the server refuses the whole scheme unless it
 * was started with development auth. But "not a real secret" is not a reason to
 * bake a credential-shaped string into a shippable artefact.
 */

import type { SqlDatabase } from "../database/driver";

export const KEY_API_URL = "dev.apiBaseUrl";
export const KEY_IDENTITY = "dev.identity";

export interface DevSettings {
  readonly apiBaseUrl: string | null;
  readonly identity: string | null;
}

export async function readSettings(db: SqlDatabase): Promise<DevSettings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM meta WHERE key IN (?, ?)`,
    [KEY_API_URL, KEY_IDENTITY]
  );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    apiBaseUrl: map.get(KEY_API_URL) ?? null,
    identity: map.get(KEY_IDENTITY) ?? null,
  };
}

export async function writeSettings(db: SqlDatabase, next: Partial<DevSettings>): Promise<void> {
  const pairs: Array<[string, string | null]> = [];
  if (next.apiBaseUrl !== undefined) pairs.push([KEY_API_URL, next.apiBaseUrl]);
  if (next.identity !== undefined) pairs.push([KEY_IDENTITY, next.identity]);

  for (const [key, value] of pairs) {
    if (value === null || value.trim() === "") {
      await db.runAsync(`DELETE FROM meta WHERE key = ?`, [key]);
      continue;
    }
    await db.runAsync(
      `INSERT INTO meta (key, value) VALUES (?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      [key, value.trim()]
    );
  }
}
