/**
 * Vyora — Founder Mode demo data (V1-003): seed a labelled demo book and remove
 * exactly it, never touching real records.
 */

import { describe, it, expect } from "vitest";
import { emptyData, addParty, seedDemoData, clearDemoData } from "@/lib/vyora/store";

const TODAY = "2026-07-26";

describe("demo data", () => {
  it("seeds a demo book with only demo-prefixed ids", () => {
    const d = seedDemoData(emptyData(), TODAY);
    expect(d.parties).toHaveLength(5);
    expect(d.transactions).toHaveLength(5);
    expect(d.payments).toHaveLength(2);
    expect(d.parties.every((p) => p.id.startsWith("demo_"))).toBe(true);
    expect(d.transactions.every((t) => t.id.startsWith("demo_"))).toBe(true);
  });

  it("is idempotent (re-seeding adds no duplicates)", () => {
    const once = seedDemoData(emptyData(), TODAY);
    const twice = seedDemoData(once, TODAY);
    expect(twice.parties).toHaveLength(5);
    expect(twice.transactions).toHaveLength(5);
    expect(twice.payments).toHaveLength(2);
  });

  it("clears only demo records, leaving real data intact", () => {
    let d = seedDemoData(emptyData(), TODAY);
    d = addParty(d, { name: "Real Person" }).data;
    const cleared = clearDemoData(d);
    expect(cleared.parties).toHaveLength(1);
    expect(cleared.parties[0]!.name).toBe("Real Person");
    expect(cleared.transactions).toHaveLength(0);
    expect(cleared.payments).toHaveLength(0);
  });
});
