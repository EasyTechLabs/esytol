/**
 * JWT teaching-engine tests.
 *
 * The decode/verify primitives are tested elsewhere (parse/crypto); here we test the
 * educational layer: algorithm classification, claim explanations, timestamp/expiry
 * analysis, and — most importantly — that the security notes are technically correct
 * and never imply verification that did not happen.
 */

import { describe, it, expect } from "vitest";
import {
  algFamily,
  isVerifiableHere,
  explainHeader,
  explainPayload,
  analyzeTemporal,
  relativeTime,
  securityNotes,
} from "@/lib/security/jwtInsights";

describe("algFamily", () => {
  it("classifies the standard algorithms", () => {
    expect(algFamily("HS256")).toBe("hmac");
    expect(algFamily("HS512")).toBe("hmac");
    expect(algFamily("RS256")).toBe("rsa");
    expect(algFamily("PS384")).toBe("rsa");
    expect(algFamily("ES256")).toBe("ecdsa");
    expect(algFamily("EdDSA")).toBe("eddsa");
    expect(algFamily("none")).toBe("none");
    expect(algFamily("NONE")).toBe("none");
    expect(algFamily("wat")).toBe("unknown");
    expect(algFamily(undefined)).toBe("unknown");
  });

  it("marks only HS256 verifiable here", () => {
    expect(isVerifiableHere("HS256")).toBe(true);
    expect(isVerifiableHere("HS384")).toBe(false);
    expect(isVerifiableHere("RS256")).toBe(false);
  });
});

describe("explainHeader / explainPayload", () => {
  it("labels known claims and marks unknown ones as custom", () => {
    const header = explainHeader({ alg: "HS256", typ: "JWT", kid: "abc" });
    expect(header.find((c) => c.key === "alg")?.label).toBe("Algorithm");
    expect(header.every((c) => c.known)).toBe(true);

    const payload = explainPayload({ sub: "1234", role: "admin" });
    expect(payload.find((c) => c.key === "sub")?.known).toBe(true);
    const custom = payload.find((c) => c.key === "role");
    expect(custom?.known).toBe(false);
    expect(custom?.description).toMatch(/custom/i);
  });

  it("attaches an ISO time to NumericDate claims", () => {
    const payload = explainPayload({ iat: 1516239022 });
    expect(payload[0].time).toBe(new Date(1516239022 * 1000).toISOString());
  });
});

describe("analyzeTemporal", () => {
  const NOW = 1_700_000_000_000;

  it("detects an expired token", () => {
    const t = analyzeTemporal({ exp: NOW / 1000 - 3600 }, NOW);
    expect(t.hasExp).toBe(true);
    expect(t.expired).toBe(true);
    expect(t.msUntilExpiry).toBeLessThan(0);
  });

  it("detects a still-valid token and computes the countdown", () => {
    const t = analyzeTemporal({ exp: NOW / 1000 + 3600 }, NOW);
    expect(t.expired).toBe(false);
    expect(t.msUntilExpiry).toBeCloseTo(3_600_000, -3);
  });

  it("detects a not-yet-valid (nbf) token", () => {
    const t = analyzeTemporal({ nbf: NOW / 1000 + 60 }, NOW);
    expect(t.notYetValid).toBe(true);
  });

  it("reports absence of temporal claims", () => {
    const t = analyzeTemporal({ sub: "x" }, NOW);
    expect(t.hasExp).toBe(false);
    expect(t.hasNbf).toBe(false);
    expect(t.hasIat).toBe(false);
  });
});

describe("relativeTime", () => {
  it("formats future and past durations", () => {
    expect(relativeTime(2 * 86400_000)).toBe("in 2 days");
    expect(relativeTime(-3 * 3600_000)).toBe("3 hours ago");
    expect(relativeTime(-1 * 60_000)).toBe("1 minute ago");
    expect(relativeTime(0)).toBe("now");
  });
});

describe("securityNotes — technically correct, never over-claims", () => {
  const temporalNone = analyzeTemporal({}, 1_700_000_000_000);

  it('flags alg:"none" as critical/unsigned', () => {
    const notes = securityNotes({ alg: "none" }, temporalNone);
    const crit = notes.find((n) => n.severity === "critical");
    expect(crit).toBeDefined();
    expect(crit?.title).toMatch(/unsigned/i);
  });

  it("explains that asymmetric algorithms cannot be verified here", () => {
    const notes = securityNotes({ alg: "RS256" }, temporalNone);
    const warn = notes.find((n) => /asymmetric/i.test(n.title));
    expect(warn?.detail).toMatch(/public key/i);
  });

  it("offers HS256 verification but never claims it happened without a check", () => {
    const notes = securityNotes({ alg: "HS256" }, temporalNone);
    // No verified flag → there must be NO "verified" ok-note.
    expect(notes.some((n) => n.severity === "ok")).toBe(false);
    expect(notes.some((n) => /verify the signature here/i.test(n.detail))).toBe(true);
  });

  it("reports a verified signature only when verification actually passed", () => {
    const ok = securityNotes({ alg: "HS256" }, temporalNone, true);
    expect(ok.some((n) => n.severity === "ok" && /verified/i.test(n.title))).toBe(true);

    const bad = securityNotes({ alg: "HS256" }, temporalNone, false);
    expect(bad.some((n) => /did not match/i.test(n.title))).toBe(true);
    expect(bad.some((n) => n.severity === "ok")).toBe(false);
  });

  it("always warns that decoding is not encryption", () => {
    const notes = securityNotes({ alg: "HS256" }, temporalNone);
    expect(notes.some((n) => /not encryption/i.test(n.title))).toBe(true);
  });

  it("warns on an expired token and notes a missing exp", () => {
    const expired = securityNotes({ alg: "HS256" }, analyzeTemporal({ exp: 1 }, 1_700_000_000_000));
    expect(expired.some((n) => /expired/i.test(n.title))).toBe(true);

    const noExp = securityNotes({ alg: "HS256" }, temporalNone);
    expect(noExp.some((n) => /no expiry/i.test(n.title))).toBe(true);
  });
});
