/**
 * Vyora — Import Wizard core (P3-005): parse CSV/JSON, map columns, validate,
 * skip duplicates, and MERGE into the ledger (reuse contacts by name, never
 * replace). All local, all pure.
 */

import { describe, it, expect } from "vitest";
import { emptyData, addParty, addTransaction } from "@/lib/vyora/store";
import {
  parseCsv,
  parseImportSource,
  guessMapping,
  parseAmount,
  parseDateISO,
  interpretKind,
  buildImportPlan,
  applyImportPlan,
  type ColumnMapping,
} from "@/lib/vyora/import";

const TODAY = "2026-07-26";

describe("parse — CSV", () => {
  it("handles quoted fields, escaped quotes, and embedded commas", () => {
    const csv = 'Name,Amount,Notes\n"Sharma, Ramesh",1500,"3 bags ""cement"""\nGeeta,200,tea';
    const table = parseCsv(csv);
    expect(table).toHaveLength(3);
    expect(table[1]).toEqual(["Sharma, Ramesh", "1500", '3 bags "cement"']);
  });

  it("normalises to columns + row objects", () => {
    const res = parseImportSource("Name,Amount\nRavi,500\nGeeta,200", "book.csv");
    expect("error" in res).toBe(false);
    if ("error" in res) return;
    expect(res.format).toBe("csv");
    expect(res.columns).toEqual(["Name", "Amount"]);
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0]).toEqual({ Name: "Ravi", Amount: "500" });
  });

  it("rejects a CSV with no data rows", () => {
    const res = parseImportSource("Name,Amount", "x.csv");
    expect("error" in res).toBe(true);
  });
});

describe("parse — JSON", () => {
  it("reads an array of objects", () => {
    const res = parseImportSource(
      '[{"name":"Ravi","amt":500},{"name":"Geeta","amt":200}]',
      "x.json"
    );
    if ("error" in res) throw new Error(res.error);
    expect(res.format).toBe("json");
    expect(res.columns).toEqual(["name", "amt"]);
    expect(res.rows[1]).toEqual({ name: "Geeta", amt: "200" });
  });

  it("reads a wrapped { rows: [...] }", () => {
    const res = parseImportSource('{"rows":[{"name":"Ravi","amt":500}]}', "x.json");
    if ("error" in res) throw new Error(res.error);
    expect(res.rows).toHaveLength(1);
  });
});

describe("field parsing", () => {
  it("guesses a mapping from headers", () => {
    const m = guessMapping(["Customer Name", "Mobile", "Amount", "Txn Date", "Type", "Remarks"]);
    expect(m.name).toBe("Customer Name");
    expect(m.phone).toBe("Mobile");
    expect(m.amount).toBe("Amount");
    expect(m.date).toBe("Txn Date");
    expect(m.type).toBe("Type");
    expect(m.notes).toBe("Remarks");
  });

  it("parses money-ish amounts, rejecting unusable ones", () => {
    expect(parseAmount("₹1,500.50")).toBe(1500.5);
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });

  it("parses dates day-first and falls back to today", () => {
    expect(parseDateISO("2026-03-04", TODAY)).toBe("2026-03-04");
    expect(parseDateISO("04/03/2026", TODAY)).toBe("2026-03-04");
    expect(parseDateISO("", TODAY)).toBe(TODAY);
    expect(parseDateISO("garbage", TODAY)).toBe(TODAY);
  });

  it("interprets type keywords, else the fallback", () => {
    expect(interpretKind("udhaar", "given")).toBe("given");
    expect(interpretKind("Received", "given")).toBe("received");
    expect(interpretKind("jama", "given")).toBe("received");
    expect(interpretKind("", "given")).toBe("given");
    expect(interpretKind(undefined, "received")).toBe("received");
  });
});

const MAP: ColumnMapping = {
  name: "Name",
  phone: "Phone",
  amount: "Amount",
  date: "Date",
  type: "Type",
  notes: "Notes",
};

describe("buildImportPlan", () => {
  it("classifies ok / invalid / duplicate and counts contacts", () => {
    // Existing ledger: Ravi owes 500 on 2026-07-01.
    let data = emptyData();
    const a = addParty(data, { name: "Ravi" });
    data = a.data;
    data = addTransaction(data, {
      partyId: a.party.id,
      amount: 500,
      kind: "given",
      date: "2026-07-01",
    }).data;

    const rows = [
      { Name: "Ravi", Phone: "", Amount: "500", Date: "2026-07-01", Type: "udhaar", Notes: "" }, // dup
      {
        Name: "Geeta",
        Phone: "99",
        Amount: "200",
        Date: "05/07/2026",
        Type: "udhaar",
        Notes: "tea",
      }, // ok, new
      { Name: "", Phone: "", Amount: "300", Date: "", Type: "", Notes: "" }, // invalid: no name
      { Name: "Mohan", Phone: "", Amount: "abc", Date: "", Type: "", Notes: "" }, // invalid: bad amount
      { Name: "Ravi", Phone: "", Amount: "150", Date: "2026-07-10", Type: "jama", Notes: "" }, // ok, matched contact, payment
    ];
    const plan = buildImportPlan(rows, MAP, "given", data, TODAY);
    expect(plan.summary.importable).toBe(2);
    expect(plan.summary.duplicates).toBe(1);
    expect(plan.summary.invalid).toBe(2);
    expect(plan.summary.newContacts).toBe(1); // Geeta
    expect(plan.summary.matchedContacts).toBe(1); // Ravi
    expect(plan.rows[0]!.status).toBe("duplicate");
    expect(plan.rows[4]!.kind).toBe("received"); // "jama"
  });

  it("dedupes identical rows within the same file", () => {
    const rows = [
      { Name: "Ravi", Amount: "500", Date: "2026-07-01", Type: "udhaar" },
      { Name: "Ravi", Amount: "500", Date: "2026-07-01", Type: "udhaar" },
    ];
    const plan = buildImportPlan(rows, MAP, "given", emptyData(), TODAY);
    expect(plan.summary.importable).toBe(1);
    expect(plan.summary.duplicates).toBe(1);
  });
});

describe("applyImportPlan", () => {
  it("creates a contact once and adds each entry", () => {
    const rows = [
      { Name: "Geeta", Amount: "200", Date: "2026-07-05", Type: "udhaar", Notes: "tea" },
      { Name: "Geeta", Amount: "150", Date: "2026-07-06", Type: "jama", Notes: "" },
    ];
    const plan = buildImportPlan(rows, MAP, "given", emptyData(), TODAY);
    const { data, contacts, entries } = applyImportPlan(emptyData(), plan);
    expect(contacts).toBe(1);
    expect(entries).toBe(2);
    expect(data.parties).toHaveLength(1);
    expect(data.transactions).toHaveLength(1); // the "udhaar" credit
    expect(data.payments).toHaveLength(1); // the "jama" payment
  });

  it("reuses an existing contact by name instead of duplicating it", () => {
    let data = emptyData();
    data = addParty(data, { name: "Ravi" }).data;
    const rows = [{ Name: "ravi", Amount: "500", Date: "2026-07-02", Type: "udhaar" }];
    const plan = buildImportPlan(rows, MAP, "given", data, TODAY);
    const out = applyImportPlan(data, plan);
    expect(out.contacts).toBe(0); // matched existing "Ravi"
    expect(out.data.parties).toHaveLength(1);
    expect(out.data.transactions).toHaveLength(1);
  });
});
