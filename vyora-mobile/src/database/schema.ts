/**
 * The device database.
 *
 * Vyora is offline-first, so this is not a cache of the server — it is the
 * merchant's ledger. The server is a place copies are delivered to. That
 * ordering decides every schema choice below.
 *
 * **`entries` is append-only.** No UPDATE, no DELETE, no balance column. A
 * correction is a further entry, exactly as on the server, so a phone that has
 * been offline for a week holds a log that can be replayed rather than a
 * snapshot that has to be reconciled.
 *
 * **`outbox` is delivery, not truth.** Rows here say "this entry has not been
 * acknowledged yet". Deleting the whole outbox would lose nothing a merchant
 * typed; it would only mean the server never hears about it. Keeping that
 * separation is what makes retry safe: the retry re-reads the entry, it does
 * not re-create it.
 *
 * A single migration list, applied in order and recorded, for the same reason
 * the server has one: a device that skipped a version must be able to catch up
 * without a developer guessing which statements it already ran.
 */

export interface Migration {
  readonly name: string;
  readonly statements: readonly string[];
}

export const MIGRATIONS: readonly Migration[] = [
  {
    name: "001_init",
    statements: [
      `CREATE TABLE IF NOT EXISTS meta (
         key   TEXT PRIMARY KEY,
         value TEXT NOT NULL
       )`,

      // Contacts. No role column: the same party can owe the merchant one day
      // and be owed the next, which is why direction lives on the entry.
      `CREATE TABLE IF NOT EXISTS parties (
         id         TEXT PRIMARY KEY,
         name       TEXT NOT NULL,
         phone      TEXT,
         note       TEXT,
         created_at TEXT NOT NULL,
         updated_at TEXT NOT NULL,
         /* Server acknowledgement, not a lifecycle. 0 = not yet delivered. */
         synced     INTEGER NOT NULL DEFAULT 0
       )`,

      `CREATE INDEX IF NOT EXISTS parties_name_idx ON parties (name)`,

      // Entries: credits and payments in one append-only table, exactly as the
      // server's projection holds them. `direction` carries the sign; there is
      // deliberately no signed amount and no running total stored.
      `CREATE TABLE IF NOT EXISTS entries (
         id            TEXT PRIMARY KEY,
         party_id      TEXT NOT NULL,
         entry_type    TEXT NOT NULL CHECK (entry_type IN ('credit', 'payment')),
         direction     TEXT NOT NULL CHECK (direction IN ('given', 'taken', 'received', 'paid')),
         amount        INTEGER NOT NULL CHECK (amount > 0),
         note          TEXT,
         business_date TEXT NOT NULL,
         due_date      TEXT,
         created_at    TEXT NOT NULL,
         synced        INTEGER NOT NULL DEFAULT 0,
         FOREIGN KEY (party_id) REFERENCES parties (id)
       )`,

      // The statement's read order. Same tiebreak as the server: two entries in
      // the same millisecond must not reorder between reads, or a running
      // balance appears to change on refresh.
      `CREATE INDEX IF NOT EXISTS entries_party_idx
         ON entries (party_id, created_at, id)`,

      `CREATE INDEX IF NOT EXISTS entries_unsynced_idx ON entries (synced)`,

      // Delivery queue.
      //
      // `idempotency_key` is minted once, when the row is created, and reused
      // for every attempt. Minting a fresh key per retry is precisely how one
      // action becomes two entries on the server, and it is the single most
      // dangerous mistake available in this file.
      `CREATE TABLE IF NOT EXISTS outbox (
         id              INTEGER PRIMARY KEY AUTOINCREMENT,
         kind            TEXT NOT NULL CHECK (kind IN ('party', 'credit', 'payment')),
         subject_id      TEXT NOT NULL,
         idempotency_key TEXT NOT NULL,
         payload         TEXT NOT NULL,
         status          TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'sent', 'blocked')),
         attempts        INTEGER NOT NULL DEFAULT 0,
         last_error      TEXT,
         next_attempt_at TEXT,
         created_at      TEXT NOT NULL,
         updated_at      TEXT NOT NULL
       )`,

      // One queued delivery per subject. A second enqueue for the same entry is
      // a bug, and a unique index turns it into an error here rather than a
      // duplicate on the server.
      `CREATE UNIQUE INDEX IF NOT EXISTS outbox_subject_idx ON outbox (kind, subject_id)`,

      `CREATE INDEX IF NOT EXISTS outbox_pending_idx ON outbox (status, next_attempt_at)`,
    ],
  },
];

export const CURRENT_SCHEMA = MIGRATIONS[MIGRATIONS.length - 1]!.name;
