/**
 * The ledger gates.
 *
 * Four flags now stack: Party reads → Party writes → ledger reads → ledger
 * writes. Each decision calls the one below it rather than repeating its
 * checks, so a gate can only ever narrow. These tests pin that ordering,
 * because the dangerous shape is a build that can *write* ledger entries it
 * cannot *read* — the developer would be changing a balance they cannot see.
 */

import { describe, expect, it } from "vitest";
import {
  LEDGER_READS_FLAG,
  LEDGER_WRITES_FLAG,
  decideLedgerReads,
  decideLedgerWrites,
  decidePartyApi,
  decidePartyWrites,
} from "@/lib/vyora/party-api-config";

const LOCAL = "http://127.0.0.1:4000";
const all = {
  flag: "true",
  writeFlag: "true",
  ledgerReadFlag: "true",
  ledgerWriteFlag: "true",
  nodeEnv: "development",
  apiUrl: LOCAL,
};

describe("defaults are off", () => {
  it("ledger reads are disabled without their flag", () => {
    expect(decideLedgerReads({ ...all, ledgerReadFlag: undefined }).enabled).toBe(false);
  });

  it("ledger writes are disabled without their flag", () => {
    expect(decideLedgerWrites({ ...all, ledgerWriteFlag: undefined }).enabled).toBe(false);
  });

  it.each(["false", "", "1", "yes", "TRUE"])("read flag %j does not enable", (ledgerReadFlag) => {
    expect(decideLedgerReads({ ...all, ledgerReadFlag }).enabled).toBe(false);
  });

  it.each(["false", "", "1", "yes", "TRUE"])("write flag %j does not enable", (ledgerWriteFlag) => {
    expect(decideLedgerWrites({ ...all, ledgerWriteFlag }).enabled).toBe(false);
  });

  it("names the flag it wants", () => {
    const r = decideLedgerReads({ ...all, ledgerReadFlag: undefined });
    const w = decideLedgerWrites({ ...all, ledgerWriteFlag: undefined });
    if (!r.enabled) expect(r.reason).toContain(LEDGER_READS_FLAG);
    if (!w.enabled) expect(w.reason).toContain(LEDGER_WRITES_FLAG);
  });

  it("enables both only when every flag is set", () => {
    expect(decideLedgerReads(all).enabled).toBe(true);
    expect(decideLedgerWrites(all).enabled).toBe(true);
  });
});

describe("the gates stack, narrowest last", () => {
  it("ledger reads require Party reads", () => {
    const noPartyReads = { ...all, flag: undefined };
    expect(decidePartyApi(noPartyReads).enabled).toBe(false);
    const d = decideLedgerReads(noPartyReads);
    expect(d.enabled).toBe(false);
    if (!d.enabled) expect(d.reason).toContain("require Party reads");
  });

  it("ledger writes require ledger reads", () => {
    const noLedgerReads = { ...all, ledgerReadFlag: "false" };
    const d = decideLedgerWrites(noLedgerReads);
    expect(d.enabled).toBe(false);
    if (!d.enabled) expect(d.reason).toContain("require ledger reads");
  });

  it("ledger writes require Party writes", () => {
    const noPartyWrites = { ...all, writeFlag: "false" };
    // Reads are fine; only the write chain is broken.
    expect(decideLedgerReads(noPartyWrites).enabled).toBe(true);
    expect(decidePartyWrites(noPartyWrites).enabled).toBe(false);
    const d = decideLedgerWrites(noPartyWrites);
    expect(d.enabled).toBe(false);
    if (!d.enabled) expect(d.reason).toContain("require Party writes");
  });

  it("never permits a ledger write while ledger reads are refused", () => {
    const combos = [
      { ...all, flag: undefined },
      { ...all, writeFlag: undefined },
      { ...all, ledgerReadFlag: undefined },
      { ...all, nodeEnv: "production" },
      { ...all, apiUrl: "https://api.example.com" },
    ];
    for (const env of combos) {
      if (!decideLedgerReads(env).enabled) {
        expect(decideLedgerWrites(env).enabled).toBe(false);
      }
    }
  });
});

describe("production refuses every remote ledger path", () => {
  it("refuses reads and writes with all four flags forced true", () => {
    const prod = { ...all, nodeEnv: "production" };
    expect(decideLedgerReads(prod).enabled).toBe(false);
    expect(decideLedgerWrites(prod).enabled).toBe(false);
  });

  it("stays refused across every URL shape", () => {
    for (const apiUrl of [LOCAL, "http://localhost:4000", "https://api.example.com", undefined]) {
      const prod = { ...all, nodeEnv: "production", apiUrl };
      expect(decideLedgerReads(prod).enabled).toBe(false);
      expect(decideLedgerWrites(prod).enabled).toBe(false);
    }
  });

  it("refuses a non-loopback API even in development", () => {
    const remote = { ...all, apiUrl: "https://api.example.com" };
    expect(decideLedgerReads(remote).enabled).toBe(false);
    expect(decideLedgerWrites(remote).enabled).toBe(false);
  });

  it("does not leak credentials from a URL into the reason", () => {
    const d = decideLedgerWrites({ ...all, apiUrl: "https://u:sup3rsecret@api.example.com" });
    expect(d.enabled).toBe(false);
    if (!d.enabled) {
      expect(d.reason).not.toContain("sup3rsecret");
      expect(d.reason).toContain("api.example.com");
    }
  });
});
