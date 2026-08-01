/**
 * Vyora — Recovery Workspace tests (V2-001), against the Golden Ledger.
 *
 * Four things the merchant's trust depends on:
 *
 *  1. **The right person is at the top**, by a formula that is fixed and
 *     explainable — and suppliers never appear, because chasing someone you owe
 *     is a mistake you cannot take back.
 *  2. **Priority is deterministic.** Same ledger, same order, every time. No AI,
 *     no ML, no randomness.
 *  3. **"Last reminder" is honest**, derived from the event log, so it can only
 *     say a message was sent if one was actually recorded.
 *  4. **Every message is safe to send** — in all three tones.
 */

import { describe, it, expect } from "vitest";
import { applyEvent, reduceEvents } from "@/lib/vyora/events";
import { buildLedger, readPartyNet } from "@/lib/vyora/ledger";
import { executeCommand, validateCommand, type CommandContext } from "@/lib/vyora/commands";
import {
  PRIORITY_WEIGHTS,
  REMINDER_TONES,
  bucketFor,
  buildRecoveryList,
  buildReminderMessage,
  daysBetween,
  recoveryTotals,
  remindersByParty,
  statementPreview,
} from "@/lib/vyora/recovery";
import { GOLDEN_TODAY, goldenEvents, goldenLedger } from "./golden-ledger";

const LEDGER = goldenLedger();
const EVENTS = goldenEvents();
const LIST = buildRecoveryList(LEDGER, EVENTS, GOLDEN_TODAY);

describe("aging arithmetic", () => {
  it("counts whole days between dates", () => {
    expect(daysBetween("2026-07-01", "2026-07-31")).toBe(30);
    expect(daysBetween("2026-08-01", "2026-08-01")).toBe(0);
    expect(daysBetween("2026-09-01", "2026-08-01")).toBeLessThan(0);
  });

  it("buckets on the MLP boundaries", () => {
    expect(bucketFor(0)).toBe("current");
    expect(bucketFor(30)).toBe("0-30");
    expect(bucketFor(31)).toBe("30-60");
    expect(bucketFor(61)).toBe("60+");
  });
});

describe("the worklist at golden scale", () => {
  it("lists only people who owe the merchant", () => {
    expect(LIST.length).toBeGreaterThan(50);
    for (const item of LIST) {
      expect(item.outstanding).toBeGreaterThan(0);
      expect(readPartyNet(LEDGER, item.party.id)).toBe(item.outstanding);
    }
  });

  it("never shows a contact the merchant owes", () => {
    const payables = LEDGER.balances.ranked.filter((b) => b.net < 0).map((b) => b.party.id);
    expect(payables.length).toBeGreaterThan(0); // the fixture really has suppliers
    const listed = new Set(LIST.map((i) => i.party.id));
    for (const id of payables) expect(listed.has(id)).toBe(false);
  });

  it("carries every field the row needs", () => {
    const item = LIST[0];
    expect(item.party.name).toBeTruthy();
    expect(item.outstanding).toBeGreaterThan(0);
    expect(item.agingDays).toBeGreaterThanOrEqual(0);
    expect(item.priority).toBeGreaterThanOrEqual(0);
    expect(item.suggestedAction).toBeTruthy();
    expect(Array.isArray(item.reminderHistory)).toBe(true);
  });

  it("reports portfolio totals that agree with the rows", () => {
    const totals = recoveryTotals(LIST);
    expect(totals.totalCount).toBe(LIST.length);
    expect(totals.overdueCount).toBeGreaterThan(0);
    let pending = 0;
    for (const item of LIST) pending += item.outstanding;
    expect(totals.pendingAmount).toBe(pending);
  });

  it("previews the most recent statement rows, newest first", () => {
    const preview = statementPreview(LEDGER, LIST[0].party.id, 5);
    expect(preview.length).toBeGreaterThan(0);
    expect(preview.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < preview.length; i++) {
      expect(preview[i - 1].createdAt >= preview[i].createdAt).toBe(true);
    }
  });
});

describe("priority is deterministic and explainable", () => {
  it("produces an identical list on every build", () => {
    const again = buildRecoveryList(LEDGER, EVENTS, GOLDEN_TODAY);
    expect(again.map((i) => i.party.id)).toEqual(LIST.map((i) => i.party.id));
    expect(again.map((i) => i.priority)).toEqual(LIST.map((i) => i.priority));
  });

  it("sorts strictly by descending priority", () => {
    for (let i = 1; i < LIST.length; i++) {
      expect(LIST[i - 1].priority).toBeGreaterThanOrEqual(LIST[i].priority);
    }
  });

  it("keeps every score inside 0–100", () => {
    for (const item of LIST) {
      expect(item.priority).toBeGreaterThanOrEqual(0);
      expect(item.priority).toBeLessThanOrEqual(100);
    }
  });

  it("adds the four weighted components up to the score", () => {
    for (const item of LIST.slice(0, 25)) {
      const { outstanding, aging, behaviour, reminder } = item.priorityBreakdown;
      expect(Math.round(outstanding + aging + behaviour + reminder)).toBe(item.priority);
    }
  });

  it("respects the published 40/30/20/10 weighting", () => {
    expect(PRIORITY_WEIGHTS).toEqual({
      outstanding: 0.4,
      aging: 0.3,
      behaviour: 0.2,
      reminder: 0.1,
    });
    for (const item of LIST.slice(0, 25)) {
      expect(item.priorityBreakdown.outstanding).toBeLessThanOrEqual(40.001);
      expect(item.priorityBreakdown.aging).toBeLessThanOrEqual(30.001);
      expect(item.priorityBreakdown.behaviour).toBeLessThanOrEqual(20.001);
      expect(item.priorityBreakdown.reminder).toBeLessThanOrEqual(10.001);
    }
  });

  it("gives the largest debt the full outstanding weight", () => {
    const biggest = LIST.reduce((a, b) => (b.outstanding > a.outstanding ? b : a));
    expect(biggest.priorityBreakdown.outstanding).toBeCloseTo(40, 5);
  });

  it("scores a never-paying contact worse than a recent payer, all else equal", () => {
    const neverPaid = LIST.filter((i) => i.daysSinceLastPayment === undefined);
    expect(neverPaid.length).toBeGreaterThan(0);
    for (const item of neverPaid) expect(item.priorityBreakdown.behaviour).toBeCloseTo(20, 5);
  });
});

describe("reminders are derived from history, never assumed", () => {
  const context: CommandContext = { ledger: LEDGER, events: EVENTS };
  const target = LIST[0];

  it("says nothing before any reminder is recorded", () => {
    expect(remindersByParty(EVENTS).size).toBe(0);
    expect(target.lastRemindedAt).toBeUndefined();
    expect(target.reminderHistory).toEqual([]);
  });

  it("records a reminder and reads it straight back as history", () => {
    const result = executeCommand(context, {
      type: "RecordReminder",
      contactId: target.party.id,
      tone: "firm",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events.map((e) => e.type)).toEqual(["ContactReminded"]);

    const events = [...EVENTS, ...result.events];
    const after = buildRecoveryList(buildLedger(reduceEvents(events)), events, GOLDEN_TODAY);
    const updated = after.find((i) => i.party.id === target.party.id);
    expect(updated?.reminderHistory).toHaveLength(1);
    expect(updated?.reminderHistory[0].tone).toBe("firm");
    expect(updated?.suggestedAction).toMatch(/Reminded today/);
    // A just-reminded contact loses the whole reminder component.
    expect(updated?.priorityBreakdown.reminder).toBeCloseTo(0, 5);
  });

  it("changes no balance — a reminder is audit, not money", () => {
    const before = LEDGER.statistics.net;
    const result = executeCommand(context, {
      type: "RecordReminder",
      contactId: target.party.id,
      tone: "gentle",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(buildLedger(result.events.reduce(applyEvent, LEDGER.data)).statistics.net).toBe(before);
  });

  it("refuses to record a reminder for a contact who is gone", () => {
    expect(
      validateCommand(context, { type: "RecordReminder", contactId: "ghost", tone: "gentle" })?.code
    ).toBe("CONTACT_NOT_FOUND");
  });
});

describe("every message is safe to send", () => {
  const item = LIST[0];

  it("offers exactly gentle, normal and firm", () => {
    expect(REMINDER_TONES).toEqual(["gentle", "normal", "firm"]);
  });

  it("names the person, the amount and asks politely, in every tone", () => {
    for (const tone of REMINDER_TONES) {
      const message = buildReminderMessage(item, { tone, shopName: "Sharma Stores" });
      expect(message).toContain(item.party.name);
      expect(message).toContain("₹");
      expect(message.toLowerCase()).toContain("thank you");
      expect(message.trimEnd().endsWith("— Sharma Stores")).toBe(true);
    }
  });

  it("never threatens, shames or mentions legal action", () => {
    const forbidden = [
      "legal",
      "police",
      "court",
      "lawyer",
      "notice",
      "cheat",
      "fraud",
      "shame",
      "defaulter",
      "blacklist",
      "warning",
      "or else",
      "last chance",
      "immediately",
      "consequences",
      "action will",
    ];
    for (const tone of REMINDER_TONES) {
      const message = buildReminderMessage(item, { tone }).toLowerCase();
      for (const word of forbidden) {
        expect({ tone, word, present: message.includes(word) }).toEqual({
          tone,
          word,
          present: false,
        });
      }
    }
  });

  it("states the due date and the last payment when it knows them", () => {
    const overdue = LIST.find((i) => i.daysOverdue > 0 && i.lastPaymentAt);
    expect(overdue).toBeDefined();
    if (!overdue) return;
    const message = buildReminderMessage(overdue, { tone: "normal" });
    expect(message).toContain(String(overdue.daysOverdue));
    expect(message).toContain(overdue.lastPaymentAt as string);
  });

  it("omits the signature when the merchant has not set a shop name", () => {
    const lines = buildReminderMessage(item).trimEnd().split("\n");
    expect(lines[lines.length - 1].startsWith("— ")).toBe(false);
  });
});
