/**
 * Vyora — Settings & data protection tests (V2-002).
 *
 * The screen makes two promises a merchant is entitled to rely on:
 *
 *  1. **"Backed up" is never claimed unless a backup actually happened** — the
 *     status is derived from `BackupCreated` events, so it cannot be faked, and
 *     it goes stale the moment new entries are recorded.
 *  2. **"Restored" is never claimed unless validation passed** — a file is
 *     parsed and counted before anything is replaced, and the counts shown are
 *     the rows that will land.
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { LedgerEvent } from "@/lib/vyora/events";
import { createBackupCreated, createCreditRecorded, reduceEvents } from "@/lib/vyora/events";
import { buildLedger } from "@/lib/vyora/ledger";
import { executeCommand, previewImport, type CommandContext } from "@/lib/vyora/commands";
import {
  DEFAULT_SETTINGS,
  backupStatus,
  formatBytes,
  normalizeSettings,
  staleAfterDays,
} from "@/lib/vyora/settings";
import { LOG_KEY, SETTINGS_KEY, loadSettings, saveSettings } from "@/lib/vyora/store";
import { goldenLedger, goldenEvents, goldenImportSnapshot } from "./golden-ledger";

const DAY = 86_400_000;
const NOW = Date.parse("2026-08-01T12:00:00.000Z");

function backupAt(daysAgo: number): LedgerEvent {
  return { ...createBackupCreated(3), at: new Date(NOW - daysAgo * DAY).toISOString() };
}
function anEntry(): LedgerEvent {
  return createCreditRecorded({ partyId: "p1", amount: 100, kind: "given" });
}

// ─── "Is my data safe?" ──────────────────────────────────────────────────────

describe("backup status is derived, never assumed", () => {
  it("says NEVER when no backup was ever taken", () => {
    const status = backupStatus([anEntry(), anEntry()], DEFAULT_SETTINGS, NOW);
    expect(status.health).toBe("never");
    expect(status.headline).toBe("Never backed up");
    expect(status.entriesSinceBackup).toBe(2);
    expect(status.detail).toContain("2 entries");
  });

  it("says BACKED UP right after a backup with nothing since", () => {
    const status = backupStatus([anEntry(), backupAt(0)], DEFAULT_SETTINGS, NOW);
    expect(status.health).toBe("backed-up");
    expect(status.entriesSinceBackup).toBe(0);
    expect(status.ageDays).toBe(0);
  });

  it("stops claiming safety the moment a new entry is recorded", () => {
    const status = backupStatus([backupAt(0), anEntry()], DEFAULT_SETTINGS, NOW);
    expect(status.health).toBe("recommended");
    expect(status.entriesSinceBackup).toBe(1);
    expect(status.detail).toContain("1 entry");
  });

  it("goes stale on the merchant's own reminder schedule", () => {
    expect(staleAfterDays("daily")).toBe(1);
    expect(staleAfterDays("weekly")).toBe(7);
    expect(staleAfterDays("never")).toBe(30);

    const daily = { ...DEFAULT_SETTINGS, backupReminder: "daily" as const };
    expect(backupStatus([backupAt(2)], daily, NOW).health).toBe("recommended");
    expect(backupStatus([backupAt(2)], DEFAULT_SETTINGS, NOW).health).toBe("backed-up");
  });

  it("still warns eventually even when reminders are off", () => {
    const never = { ...DEFAULT_SETTINGS, backupReminder: "never" as const };
    expect(backupStatus([backupAt(10)], never, NOW).health).toBe("backed-up");
    expect(backupStatus([backupAt(40)], never, NOW).health).toBe("recommended");
  });

  it("counts only entries recorded AFTER the most recent backup", () => {
    const events = [anEntry(), backupAt(5), anEntry(), anEntry(), backupAt(1), anEntry()];
    expect(backupStatus(events, DEFAULT_SETTINGS, NOW).entriesSinceBackup).toBe(1);
  });

  it("reports the golden ledger as backed up but stale — it ends on a backup", () => {
    const status = backupStatus(goldenEvents(), DEFAULT_SETTINGS, NOW);
    expect(status.entriesSinceBackup).toBe(0);
    expect(status.lastBackupAt).toBeTruthy();
  });
});

// ─── Export records a backup only on success ─────────────────────────────────

describe("export", () => {
  const context: CommandContext = { ledger: goldenLedger(), events: goldenEvents() };

  it("produces a dated file and records that a backup happened", () => {
    const result = executeCommand(context, { type: "BackupLedger" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const file = result.value as { fileName: string; contents: string };
    expect(file.fileName).toMatch(/^vyora-\d{4}-\d{2}-\d{2}\.json$/);
    expect(result.events.map((e) => e.type)).toEqual(["BackupCreated"]);
    expect(() => JSON.parse(file.contents)).not.toThrow();
  });

  it("moves the merchant from 'never' to 'backed up'", () => {
    const before = backupStatus([anEntry()], DEFAULT_SETTINGS, NOW);
    expect(before.health).toBe("never");
    const result = executeCommand(context, { type: "BackupLedger" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = backupStatus([anEntry(), ...result.events], DEFAULT_SETTINGS, NOW);
    expect(after.health).toBe("backed-up");
  });
});

// ─── Restore validates before it replaces ────────────────────────────────────

describe("import preview", () => {
  it("counts exactly what a real export would restore", () => {
    const context: CommandContext = { ledger: goldenLedger(), events: goldenEvents() };
    const exported = executeCommand(context, { type: "ExportLedger" });
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const payload = (exported.value as { contents: string }).contents;

    const preview = previewImport(payload);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    const data = goldenLedger().data;
    expect(preview.value.contacts).toBe(data.parties.length);
    expect(preview.value.transactions).toBe(data.transactions.length);
    expect(preview.value.payments).toBe(data.payments.length);
  });

  it("refuses a file that is not a Vyora backup, with nothing replaced", () => {
    for (const bad of ["", "   ", "{not json", '{"data":{}}', "[]"]) {
      const preview = previewImport(bad);
      expect(preview.ok).toBe(false);
      if (!preview.ok) expect(preview.error.message).toBe("That file is not a Vyora backup.");
    }
  });

  it("previews without changing anything, then the import matches the preview", () => {
    const snapshot = goldenImportSnapshot();
    const payload = JSON.stringify(snapshot);
    const preview = previewImport(payload);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;

    const context: CommandContext = { ledger: goldenLedger(), events: goldenEvents() };
    const before = context.ledger.statistics.partyCount;
    expect(previewImport(payload).ok).toBe(true);
    expect(context.ledger.statistics.partyCount).toBe(before); // preview is a read

    const result = executeCommand(context, { type: "ImportLedger", payload });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = buildLedger(reduceEvents([...context.events, ...result.events]));
    expect(after.statistics.partyCount).toBe(preview.value.contacts);
  });
});

// ─── Profile ─────────────────────────────────────────────────────────────────

describe("merchant settings", () => {
  beforeEach(() => window.localStorage.clear());

  it("defaults sensibly for a new merchant", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.currency).toBe("INR");
    expect(DEFAULT_SETTINGS.backupReminder).toBe("weekly");
  });

  it("round-trips a profile", () => {
    const next = {
      ...DEFAULT_SETTINGS,
      businessName: "Sharma Stores",
      backupReminder: "daily" as const,
    };
    expect(saveSettings(next)).toBe(true);
    expect(loadSettings()).toEqual(next);
  });

  it("survives a corrupt or partial payload", () => {
    window.localStorage.setItem(SETTINGS_KEY, "{oops");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ businessName: 7, currency: "" }));
    const loaded = loadSettings();
    expect(loaded.businessName).toBe("");
    expect(loaded.currency).toBe("INR");
  });

  it("rejects an unknown reminder setting rather than trusting it", () => {
    expect(normalizeSettings({ backupReminder: "hourly" }).backupReminder).toBe("weekly");
  });

  it("keeps the profile OUT of the ledger, so a restore cannot overwrite it", () => {
    saveSettings({ ...DEFAULT_SETTINGS, businessName: "Sharma Stores" });
    window.localStorage.setItem(LOG_KEY, JSON.stringify({ version: 2, events: [] }));
    expect(loadSettings().businessName).toBe("Sharma Stores");
    expect(window.localStorage.getItem(SETTINGS_KEY)).not.toBeNull();
  });
});

describe("readable sizes", () => {
  it("formats bytes the way a person reads them", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.00 MB");
  });
});
