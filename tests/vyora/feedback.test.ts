/**
 * Vyora — success feedback & bulk recovery tests (V2-006.1).
 *
 * Two properties:
 *
 *  1. **Every command that changes something confirms it, once.** One pure
 *     function decides the wording, so a screen cannot grow a second toast.
 *  2. **Failures never produce success feedback** — errors keep using the
 *     workflow machine's existing path.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { successFeedback } from "@/lib/vyora/feedback";
import { executeCommand, type Command, type CommandContext } from "@/lib/vyora/commands";
import { buildBulkReminderMessage, buildRecoveryList } from "@/lib/vyora/recovery";
import { buildDailyClosing } from "@/lib/vyora/closing";
import { DEFAULT_SETTINGS } from "@/lib/vyora/settings";
import { GOLDEN_TODAY, goldenEvents, goldenLedger, goldenSample } from "./golden-ledger";

const LEDGER = goldenLedger();
const EVENTS = goldenEvents();
const CONTEXT: CommandContext = { ledger: LEDGER, events: EVENTS };
const SAMPLE = goldenSample();

/** Every command a merchant can trigger, with arguments that succeed. */
function everyCommand(): Command[] {
  const closing = buildDailyClosing(LEDGER, EVENTS, DEFAULT_SETTINGS, GOLDEN_TODAY);
  return [
    { type: "CreateContact", name: "Ramesh Kaka" },
    { type: "RecordCredit", contactName: "Ramesh Kaka", amount: 500, kind: "given" },
    { type: "RecordPayment", contactName: "Ramesh Kaka", amount: 200, kind: "received" },
    { type: "RecordReminder", contactId: SAMPLE.contact.id, tone: "normal" },
    { type: "DeleteEntry", entryId: SAMPLE.transaction.id },
    { type: "DeleteContact", contactId: SAMPLE.contact.id },
    { type: "ExportLedger" },
    { type: "BackupLedger" },
    { type: "CloseDay", date: GOLDEN_TODAY, summary: closing.summary, notes: "" },
  ];
}

describe("every successful action confirms itself", () => {
  for (const command of everyCommand()) {
    it(`confirms ${command.type}`, () => {
      const result = executeCommand(CONTEXT, command);
      expect(result.ok).toBe(true);
      const feedback = successFeedback(command, result);
      expect(feedback).not.toBeNull();
      expect(feedback?.message.length).toBeGreaterThan(3);
      expect(["success", "warning"]).toContain(feedback?.tone);
    });
  }

  it("names what actually happened, not just 'success'", () => {
    const command: Command = {
      type: "RecordCredit",
      contactName: "Ramesh Kaka",
      amount: 500,
      kind: "given",
    };
    const feedback = successFeedback(command, executeCommand(CONTEXT, command));
    expect(feedback?.message).toContain("₹500");
    expect(feedback?.message).toContain("Ramesh Kaka");
  });

  it("marks destructive actions as a warning, not a celebration", () => {
    const del: Command = { type: "DeleteEntry", entryId: SAMPLE.transaction.id };
    expect(successFeedback(del, executeCommand(CONTEXT, del))?.tone).toBe("warning");
    const contact: Command = { type: "DeleteContact", contactId: SAMPLE.contact.id };
    const feedback = successFeedback(contact, executeCommand(CONTEXT, contact));
    expect(feedback?.tone).toBe("warning");
    expect(feedback?.message).toMatch(/entries|entry/);
  });

  it("says nothing at all when a command fails", () => {
    const bad: Command = { type: "RecordCredit", contactName: "", amount: 0, kind: "given" };
    const result = executeCommand(CONTEXT, bad);
    expect(result.ok).toBe(false);
    expect(successFeedback(bad, result)).toBeNull();
  });

  it("reports restore and import in the merchant's terms", () => {
    const exported = executeCommand(CONTEXT, { type: "ExportLedger" });
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const payload = (exported.value as { contents: string }).contents;
    const command: Command = { type: "ImportLedger", payload };
    const feedback = successFeedback(command, executeCommand(CONTEXT, command));
    expect(feedback?.message).toMatch(/Restored \d+ contacts and \d+ entries/);
  });
});

describe("there is exactly one toast in the app", () => {
  const ROOT = process.cwd();
  const UI = join(ROOT, "features", "vyora");

  function sources(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...sources(full));
      else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  it("keeps the feedback module out of every screen — the provider owns it", () => {
    // Check the IMPORT, not the word: a screen that cannot reach the module
    // cannot invent its own wording, whatever its comments mention.
    for (const file of sources(UI)) {
      if (file.endsWith("VyoraProvider.tsx")) continue;
      const src = readFileSync(file, "utf8");
      const imports = /import[^;]*from\s+["']@\/lib\/vyora\/feedback["']/.test(src);
      // Toast may import the TYPE only; it must not import the decision function.
      const importsDecision = /import\s*\{[^}]*successFeedback[^}]*\}/.test(src);
      expect({ file, imports: imports && importsDecision }).toEqual({ file, imports: false });
    }
  });

  it("renders the Toast component in exactly one place", () => {
    const renders = sources(UI).filter((file) => /<Toast[\s/>]/.test(readFileSync(file, "utf8")));
    expect(renders).toHaveLength(1);
    expect(renders[0].endsWith("VyoraProvider.tsx")).toBe(true);
  });
});

describe("bulk recovery", () => {
  const list = buildRecoveryList(LEDGER, EVENTS, GOLDEN_TODAY);

  it("combines several reminders into one shareable message", () => {
    const chosen = list.slice(0, 3);
    const text = buildBulkReminderMessage(chosen);
    for (const item of chosen) expect(text).toContain(item.party.name);
    expect(text.split("---")).toHaveLength(3);
  });

  it("reuses the single-reminder template, so tone can never drift", () => {
    const one = list.slice(0, 1);
    expect(buildBulkReminderMessage(one)).toBe(buildBulkReminderMessage(one, { tone: "normal" }));
    const firm = buildBulkReminderMessage(one, { tone: "firm" });
    expect(firm).not.toBe(buildBulkReminderMessage(one, { tone: "gentle" }));
  });

  it("carries the shop name into every message in the batch", () => {
    const text = buildBulkReminderMessage(list.slice(0, 2), { shopName: "Sharma Stores" });
    expect(text.match(/Sharma Stores/g)).toHaveLength(2);
  });

  it("stays safe to send in bulk — no threats in any tone", () => {
    const forbidden = ["legal", "police", "court", "defaulter", "or else", "last chance"];
    for (const tone of ["gentle", "normal", "firm"] as const) {
      const text = buildBulkReminderMessage(list.slice(0, 5), { tone }).toLowerCase();
      for (const word of forbidden) {
        expect({ tone, word, present: text.includes(word) }).toEqual({
          tone,
          word,
          present: false,
        });
      }
    }
  });

  it("produces nothing for an empty selection", () => {
    expect(buildBulkReminderMessage([])).toBe("");
  });
});
