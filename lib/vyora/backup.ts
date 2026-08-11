/**
 * Vyora — the local backup envelope (SETTINGS-TRUST-WEB-001).
 *
 * A backup is a file the merchant holds. It never goes to a server, carries no
 * credential, and restoring it is a deliberate replacement of this browser's
 * book — never a merge.
 *
 * ## Why the format changed, and what was wrong before
 *
 * The previous file (`fileVersion: 2`) serialised the **projection** —
 * `{parties, transactions, payments}`. But the projection is not the book. Closed
 * days live *only* in the event log: `closing.ts` reads them straight from
 * `DayClosed` events, and `VyoraData` has no field for them at all. So exporting
 * and restoring a v2 backup **silently destroyed every day-closing sign-off**,
 * along with reminder history and the record of deleted entries.
 *
 * A closing is the one figure a merchant signs. Losing it in the very feature
 * that exists to keep their data safe is the worst possible place to lose it.
 *
 * Schema 3 carries the **event log** instead, which is what the app rebuilds
 * every projection from. Nothing derived is stored, so nothing derived can
 * disagree with it.
 *
 * ## The checksum detects corruption. It does not prove authenticity.
 *
 * `fnv1a-32x2` over a canonical serialisation of the events: stable key order,
 * so the same log always produces the same digest. It catches a truncated
 * download, a half-written file, an editor that mangled the JSON.
 *
 * It is **not** cryptographic and this version does not claim to be. Anyone who
 * edits the events can recompute the digest, and no signature is checked. That
 * is an acceptable limit for a file the merchant keeps themselves, and it is
 * stated in the UI in those words rather than dressed up as "encrypted".
 */

import type { LedgerEvent } from "./events";
import { LOG_VERSION } from "./events";
import { migrateLegacyData } from "./store";
import type { VyoraData } from "./types";

/**
 * The events a validated backup yielded.
 *
 * Re-exported here so a screen can hold a parsed backup without importing
 * `events.ts` — a screen that cannot reach the event layer cannot mint an
 * event, and `commands.test.ts` enforces exactly that.
 */
export type BackupEvents = readonly LedgerEvent[];

export const BACKUP_FORMAT = "vyora.backup";
export const BACKUP_SCHEMA_VERSION = 3;
/** The projection-only file this replaces. Still restorable — see `parseBackup`. */
export const LEGACY_FILE_VERSION = 2;
/** Named for what it is, so a reader never mistakes it for a signature. */
export const CHECKSUM_ALGORITHM = "fnv1a-32x2";

export interface BackupEnvelope {
  readonly format: typeof BACKUP_FORMAT;
  readonly schemaVersion: number;
  readonly exportedAt: string;
  readonly app: { readonly name: string; readonly version: string };
  readonly logVersion: number;
  readonly eventCount: number;
  readonly checksum: { readonly algorithm: string; readonly value: string };
  readonly events: readonly LedgerEvent[];
}

/**
 * JSON with every object key in sorted order, so a digest depends on the data
 * and not on the order a browser happened to parse it in.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

/**
 * Two independent FNV-1a lanes, 32 bits each, concatenated into a 64-bit digest.
 *
 * Two lanes rather than one because 32 bits is a coin-flip collision at a few
 * tens of thousands of files and this is the only damage check a merchant gets.
 * Two lanes rather than BigInt because the project targets below ES2020, and
 * widening the whole app's compile target to hash a backup would be the tail
 * wagging the dog — `Math.imul` gives exact 32-bit multiplication everywhere.
 *
 * The second lane mixes in the byte position, so it is not a function of the
 * first and a transposition changes both.
 *
 * Deterministic, dependency-free, corruption detection only.
 */
export function checksumOf(events: readonly LedgerEvent[]): string {
  const text = canonicalJson(events);
  const PRIME = 0x01000193;
  let a = 0x811c9dc5 | 0;
  let b = 0x9e3779b9 | 0;

  const mix = (lo: number, i: number) => {
    a = Math.imul(a ^ lo, PRIME);
    b = Math.imul(b ^ (lo + i), PRIME);
  };

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    mix(code & 0xff, i);
    // Characters above U+00FF contribute their high byte too, so two strings
    // differing only there cannot collide by construction.
    const high = code >>> 8;
    if (high) mix(high, i);
  }

  return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
}

export interface BackupSummary {
  readonly schemaVersion: number;
  readonly exportedAt: string | null;
  readonly appVersion: string | null;
  readonly parties: number;
  readonly entries: number;
  readonly events: number;
  readonly closedDays: number;
  readonly firstEntryDate: string | null;
  readonly lastEntryDate: string | null;
  /** Merchant-readable notes. Never a reason to hide the confirm button. */
  readonly warnings: readonly string[];
}

/** What a file contains, counted from the events themselves. */
export function summarise(
  events: readonly LedgerEvent[],
  meta: { schemaVersion: number; exportedAt: string | null; appVersion: string | null },
  warnings: readonly string[] = []
): BackupSummary {
  const parties = new Set<string>();
  const entries = new Set<string>();
  const closedDays = new Set<string>();
  let first: string | null = null;
  let last: string | null = null;

  const note = (date: string) => {
    if (!date) return;
    if (first === null || date < first) first = date;
    if (last === null || date > last) last = date;
  };

  for (const event of events) {
    switch (event.type) {
      case "ContactCreated":
        parties.add(event.party.id);
        break;
      case "ContactDeleted":
        parties.delete(event.partyId);
        break;
      case "CreditRecorded":
        entries.add(event.transaction.id);
        note(event.transaction.date);
        break;
      case "PaymentRecorded":
        entries.add(event.payment.id);
        note(event.payment.date);
        break;
      case "EntryDeleted":
        entries.delete(event.entryId);
        break;
      case "DayClosed":
        closedDays.add(event.date);
        break;
      default:
        break;
    }
  }

  return {
    schemaVersion: meta.schemaVersion,
    exportedAt: meta.exportedAt,
    appVersion: meta.appVersion,
    parties: parties.size,
    entries: entries.size,
    events: events.length,
    closedDays: closedDays.size,
    firstEntryDate: first,
    lastEntryDate: last,
    warnings,
  };
}

/**
 * The latest instant anywhere in a book, in milliseconds, or -1 if it holds none.
 *
 * Every timestamp that can become an ordering key is considered, not just the
 * event's own `at`: the statement folds entries by their `createdAt`, so a
 * restored entry stamped later than its event would otherwise be missed.
 *
 * This is what a restore raises the device clock past. See `restore` in
 * `VyoraProvider` for why that matters more than the timestamps looking tidy.
 */
export function latestInstantMs(events: readonly LedgerEvent[]): number {
  let latest = -1;

  const consider = (value: unknown) => {
    if (typeof value !== "string") return;
    const ms = Date.parse(value);
    if (Number.isFinite(ms) && ms > latest) latest = ms;
  };

  for (const event of events) {
    consider(event.at);
    switch (event.type) {
      case "ContactCreated":
        consider(event.party.createdAt);
        break;
      case "CreditRecorded":
        consider(event.transaction.createdAt);
        break;
      case "PaymentRecorded":
        consider(event.payment.createdAt);
        break;
      case "ImportCompleted":
      case "RestoreCompleted": {
        // A snapshot carried inside an older event still holds instants that
        // will be folded into the projection.
        for (const party of event.snapshot?.parties ?? []) consider(party.createdAt);
        for (const row of event.snapshot?.transactions ?? []) consider(row.createdAt);
        for (const row of event.snapshot?.payments ?? []) consider(row.createdAt);
        break;
      }
      default:
        break;
    }
  }

  return latest;
}

export interface BackupFile {
  readonly fileName: string;
  readonly contents: string;
}

/**
 * Build the file. Pure: it reads the log and returns text, and touches neither
 * storage, the clock, nor anything remote.
 */
export function buildBackup(
  events: readonly LedgerEvent[],
  app: { name: string; version: string },
  exportedAt: string
): BackupFile {
  const envelope: BackupEnvelope = {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    app: { name: app.name, version: app.version },
    logVersion: LOG_VERSION,
    eventCount: events.length,
    checksum: { algorithm: CHECKSUM_ALGORITHM, value: checksumOf(events) },
    events,
  };

  return {
    fileName: `vyora-backup-${exportedAt.slice(0, 10)}.json`,
    contents: JSON.stringify(envelope, null, 2),
  };
}

export type ParsedBackup =
  | { readonly ok: true; readonly events: readonly LedgerEvent[]; readonly summary: BackupSummary }
  | { readonly ok: false; readonly reason: string };

const EVENT_TYPES = new Set([
  "ContactCreated",
  "ContactUpdated",
  "ContactDeleted",
  "CreditRecorded",
  "PaymentRecorded",
  "DueDateChanged",
  "EntryDeleted",
  "ContactReminded",
  "DayClosed",
  "BackupCreated",
  "RestoreCompleted",
  "ImportCompleted",
]);

/**
 * Every event must have an id, a timestamp and a type this build understands.
 *
 * A file written by a *newer* Vyora may contain event types this build cannot
 * fold. `applyEvent` would ignore them, which is right for a log that grew
 * under our feet but wrong for a restore: the merchant would be told their book
 * was restored while part of it was quietly dropped. So it is refused instead.
 */
function validateEvents(events: unknown): { events: LedgerEvent[] } | { reason: string } {
  if (!Array.isArray(events)) return { reason: "This file has no event history in it." };

  const seen = new Set<string>();
  for (let i = 0; i < events.length; i++) {
    const event = events[i] as Partial<LedgerEvent>;
    if (!event || typeof event !== "object") return { reason: `Entry ${i + 1} is not readable.` };
    if (typeof event.id !== "string" || !event.id) {
      return { reason: `Entry ${i + 1} has no id, so this file cannot be trusted.` };
    }
    if (seen.has(event.id)) {
      return { reason: `Entry ${i + 1} repeats an id (${event.id}), so this file is damaged.` };
    }
    seen.add(event.id);
    if (typeof event.at !== "string" || Number.isNaN(Date.parse(event.at))) {
      return { reason: `Entry ${i + 1} has no usable timestamp.` };
    }
    if (typeof event.type !== "string" || !EVENT_TYPES.has(event.type)) {
      return {
        reason: `Entry ${i + 1} is a "${String(event.type)}", which this version of Vyora does not understand. Update Vyora, then restore again.`,
      };
    }
  }

  return { events: events as LedgerEvent[] };
}

/**
 * Read a file completely before anything is allowed to change.
 *
 * Order matters: shape, then version, then checksum, then event structure. A
 * merchant should hear the most specific true thing about their file, and
 * "the checksum does not match" is more useful than "not a Vyora backup" when
 * the file is obviously a Vyora backup that got truncated.
 */
export function parseBackup(payload: string): ParsedBackup {
  if (!payload || !payload.trim()) return { ok: false, reason: "That file is empty." };

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "That file is not readable JSON, so it is not a Vyora backup." };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, reason: "That file is not a Vyora backup." };
  }

  // ── Schema 3: the event log ────────────────────────────────────────────────
  if (parsed.format === BACKUP_FORMAT) {
    const version = Number(parsed.schemaVersion);
    if (!Number.isFinite(version)) {
      return { ok: false, reason: "This backup does not say which version it is." };
    }
    if (version > BACKUP_SCHEMA_VERSION) {
      return {
        ok: false,
        reason: `This backup was written by a newer Vyora (version ${version}). Update Vyora, then restore it — restoring it here could drop part of your book.`,
      };
    }
    if (version < BACKUP_SCHEMA_VERSION) {
      return {
        ok: false,
        reason: `This backup uses an old layout (version ${version}) that this version cannot read safely.`,
      };
    }

    const checked = validateEvents(parsed.events);
    if ("reason" in checked) return { ok: false, reason: checked.reason };

    const stored = (parsed.checksum ?? {}) as { algorithm?: string; value?: string };
    if (stored.algorithm !== CHECKSUM_ALGORITHM || typeof stored.value !== "string") {
      return { ok: false, reason: "This backup has no usable integrity check." };
    }
    if (stored.value !== checksumOf(checked.events)) {
      return {
        ok: false,
        reason:
          "This file does not match its own integrity check — it was changed or did not download completely. Nothing has been touched.",
      };
    }

    const declared = Number(parsed.eventCount);
    const warnings: string[] = [];
    if (Number.isFinite(declared) && declared !== checked.events.length) {
      warnings.push(
        `The file says it holds ${declared} events but contains ${checked.events.length}.`
      );
    }

    const app = (parsed.app ?? {}) as { version?: string };
    return {
      ok: true,
      events: checked.events,
      summary: summarise(
        checked.events,
        {
          schemaVersion: version,
          exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : null,
          appVersion: typeof app.version === "string" ? app.version : null,
        },
        warnings
      ),
    };
  }

  // ── Legacy: the projection-only file ──────────────────────────────────────
  //
  // Still restorable, because refusing a merchant's only backup would be worse
  // than restoring it with its limits named. It is converted to the equivalent
  // log by the same function that migrates a v1 device, so the restored book
  // goes through exactly one code path.
  const body = (parsed.data ?? parsed) as Partial<VyoraData>;
  if (parsed.app === "vyora" || Array.isArray(body?.parties)) {
    if (!Array.isArray(body?.parties)) {
      return { ok: false, reason: "That file is not a Vyora backup." };
    }

    const snapshot: VyoraData = {
      version: LEGACY_FILE_VERSION,
      parties: body.parties ?? [],
      transactions: Array.isArray(body.transactions) ? body.transactions : [],
      payments: Array.isArray(body.payments) ? body.payments : [],
    };
    const events = migrateLegacyData(snapshot);

    return {
      ok: true,
      events,
      summary: summarise(
        events,
        {
          schemaVersion: LEGACY_FILE_VERSION,
          exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : null,
          appVersion: null,
        },
        [
          "This is an older backup that saved only contacts and entries. Closed-day sign-offs, reminders and deletion history are not in it and cannot be restored.",
          "It carries no integrity check, so damage to the file cannot be detected.",
        ]
      ),
    };
  }

  return { ok: false, reason: "That file is not a Vyora backup." };
}
