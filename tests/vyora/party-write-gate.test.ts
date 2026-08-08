/**
 * The write gate.
 *
 * Writes are strictly narrower than reads by construction: `decidePartyWrites`
 * calls `decidePartyApi` first and can only ever refuse further. These tests
 * pin that relationship, because the dangerous failure is a build where writes
 * are somehow permitted while reads are not — the developer would be changing
 * data they cannot see.
 */

import { describe, expect, it } from "vitest";
import { PARTY_WRITES_FLAG, decidePartyApi, decidePartyWrites } from "@/lib/vyora/party-api-config";

const LOCAL = "http://127.0.0.1:4000";
const on = { flag: "true", writeFlag: "true", nodeEnv: "development", apiUrl: LOCAL };

describe("default configuration writes locally", () => {
  it("is disabled when the write flag is absent", () => {
    expect(decidePartyWrites({ ...on, writeFlag: undefined }).enabled).toBe(false);
  });

  it.each(["false", "", "1", "yes", "TRUE", "on"])(
    'is disabled for write flag %j — only the exact string "true" enables it',
    (writeFlag) => {
      expect(decidePartyWrites({ ...on, writeFlag }).enabled).toBe(false);
    }
  );

  it("names the write flag so a developer is not left guessing", () => {
    const d = decidePartyWrites({ ...on, writeFlag: undefined });
    expect(d.enabled).toBe(false);
    if (!d.enabled) expect(d.reason).toContain(PARTY_WRITES_FLAG);
  });

  it("is enabled only when every condition holds", () => {
    const d = decidePartyWrites(on);
    expect(d.enabled).toBe(true);
    if (d.enabled) expect(d.apiUrl).toBe(LOCAL);
  });
});

describe("writes can never be broader than reads", () => {
  it("refuses writes whenever reads are refused, for every reason reads use", () => {
    const cases = [
      { ...on, flag: undefined }, // read flag off
      { ...on, nodeEnv: "production" }, // production build
      { ...on, apiUrl: "https://api.example.com" }, // non-loopback
      { ...on, apiUrl: "not a url" }, // unparseable
    ];
    for (const env of cases) {
      expect(decidePartyApi(env).enabled).toBe(false);
      expect(decidePartyWrites(env).enabled).toBe(false);
    }
  });

  it("explains that reads are the prerequisite", () => {
    const d = decidePartyWrites({ ...on, flag: undefined });
    expect(d.enabled).toBe(false);
    if (!d.enabled) expect(d.reason).toContain("Writes require reads");
  });

  it("refuses writes when reads are on but writes are off — never the reverse", () => {
    const readsOnly = { ...on, writeFlag: "false" };
    expect(decidePartyApi(readsOnly).enabled).toBe(true);
    expect(decidePartyWrites(readsOnly).enabled).toBe(false);
  });
});

describe("remote write mode is impossible in production", () => {
  it("refuses even with both flags on and a loopback URL", () => {
    const d = decidePartyWrites({ ...on, nodeEnv: "production" });
    expect(d.enabled).toBe(false);
    if (!d.enabled) expect(d.reason).toContain("production build");
  });

  it("stays refused in production across every URL shape", () => {
    for (const apiUrl of [LOCAL, "http://localhost:4000", "https://api.example.com", undefined]) {
      expect(decidePartyWrites({ ...on, nodeEnv: "production", apiUrl }).enabled).toBe(false);
    }
  });

  it("does not leak credentials from a URL into the reason shown in the UI", () => {
    const d = decidePartyWrites({ ...on, apiUrl: "https://user:sup3rsecret@api.example.com" });
    expect(d.enabled).toBe(false);
    if (!d.enabled) {
      expect(d.reason).not.toContain("sup3rsecret");
      expect(d.reason).toContain("api.example.com");
    }
  });
});
