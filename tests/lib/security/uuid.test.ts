/**
 * UUID engine tests.
 *
 * Random versions are checked structurally (version nibble, variant bits, format,
 * uniqueness) with an injectable RNG pinning the deterministic cases. Name-based
 * versions are pinned to the authoritative Python `uuid` module vectors. Timestamp
 * round-trips confirm v1/v7 encode and decode the same instant.
 */

import { describe, it, expect } from "vitest";
import {
  uuidV1,
  uuidV3,
  uuidV4,
  uuidV5,
  uuidV7,
  NAMESPACES,
  NIL_UUID,
  MAX_UUID,
  isValidUuid,
  inspectUuid,
  extractTimestamp,
  formatUuid,
  resolveNamespace,
  type RandomBytes,
} from "@/lib/security/uuid";

const CANONICAL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const versionNibble = (u: string) => u[14];
const variantNibble = (u: string) => parseInt(u[19], 16);

/** Deterministic RNG: fills with a fixed, non-trivial pattern. */
const fixedRand: RandomBytes = (n) =>
  Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) & 0xff);

describe("uuidV4", () => {
  it("is canonical, version 4, RFC variant", () => {
    const u = uuidV4();
    expect(u).toMatch(CANONICAL);
    expect(versionNibble(u)).toBe("4");
    expect(variantNibble(u) >> 2).toBe(0b10); // 10xx
  });

  it("is unique across many draws", () => {
    const set = new Set(Array.from({ length: 5000 }, () => uuidV4()));
    expect(set.size).toBe(5000);
  });

  it("is deterministic under an injected RNG", () => {
    expect(uuidV4(fixedRand)).toBe(uuidV4(fixedRand));
  });
});

describe("uuidV7", () => {
  it("is canonical, version 7, and time-ordered", () => {
    const u = uuidV7(1_700_000_000_000);
    expect(u).toMatch(CANONICAL);
    expect(versionNibble(u)).toBe("7");
    expect(variantNibble(u) >> 2).toBe(0b10);
  });

  it("round-trips its millisecond timestamp", () => {
    const now = 1_726_000_000_123;
    const ts = extractTimestamp(uuidV7(now, fixedRand));
    expect(ts?.getTime()).toBe(now);
  });

  it("sorts by creation time (earlier timestamp → lexicographically smaller)", () => {
    const a = uuidV7(1_000_000_000_000, fixedRand);
    const b = uuidV7(2_000_000_000_000, fixedRand);
    expect(a < b).toBe(true);
  });
});

describe("uuidV1 (privacy-safe)", () => {
  it("is canonical, version 1, RFC variant", () => {
    const u = uuidV1(1_700_000_000_000);
    expect(u).toMatch(CANONICAL);
    expect(versionNibble(u)).toBe("1");
    expect(variantNibble(u) >> 2).toBe(0b10);
  });

  it("uses a random node with the multicast bit set (never a real MAC)", () => {
    const u = uuidV1(Date.now(), fixedRand);
    const firstNodeOctet = parseInt(u.slice(24, 26), 16);
    expect(firstNodeOctet & 0x01).toBe(1);
  });

  it("round-trips its timestamp (to the millisecond)", () => {
    const now = 1_726_000_000_000;
    const ts = extractTimestamp(uuidV1(now, fixedRand));
    expect(ts?.getTime()).toBe(now);
  });
});

describe("uuidV3 / uuidV5 — authoritative vectors (python.org, DNS namespace)", () => {
  it("v3 matches the Python uuid3(NAMESPACE_DNS, 'python.org') vector", async () => {
    expect(await uuidV3(NAMESPACES.DNS, "python.org")).toBe("6fa459ea-ee8a-3ca4-894e-db77e160355e");
  });

  it("v5 matches the Python uuid5(NAMESPACE_DNS, 'python.org') vector", async () => {
    expect(await uuidV5(NAMESPACES.DNS, "python.org")).toBe("886313e1-3b8a-5372-9b90-0c9aee199e5d");
  });

  it("is deterministic and namespace-sensitive", async () => {
    const a = await uuidV5(NAMESPACES.DNS, "example.com");
    const a2 = await uuidV5(NAMESPACES.DNS, "example.com");
    const b = await uuidV5(NAMESPACES.URL, "example.com");
    expect(a).toBe(a2);
    expect(a).not.toBe(b);
    expect(versionNibble(a)).toBe("5");
  });
});

describe("isValidUuid", () => {
  it("accepts canonical, braced, and urn forms; rejects junk", () => {
    expect(isValidUuid("6fa459ea-ee8a-3ca4-894e-db77e160355e")).toBe(true);
    expect(isValidUuid("{6fa459ea-ee8a-3ca4-894e-db77e160355e}")).toBe(true);
    expect(isValidUuid("urn:uuid:6fa459ea-ee8a-3ca4-894e-db77e160355e")).toBe(true);
    expect(isValidUuid("not-a-uuid")).toBe(false);
    expect(isValidUuid("6fa459ea-ee8a-3ca4-894e-db77e160355")).toBe(false); // short
    expect(isValidUuid("gggggggg-ee8a-3ca4-894e-db77e160355e")).toBe(false); // non-hex
  });
});

describe("inspectUuid", () => {
  it("detects version and variant", () => {
    const r = inspectUuid("886313e1-3b8a-5372-9b90-0c9aee199e5d");
    expect(r.valid).toBe(true);
    expect(r.version).toBe(5);
    expect(r.variant?.label).toContain("RFC");
  });

  it("recognises the Nil and Max UUIDs", () => {
    expect(inspectUuid(NIL_UUID).version).toBe("nil");
    expect(inspectUuid(MAX_UUID).version).toBe("max");
  });

  it("extracts a timestamp for v7 but not v4", () => {
    const v7 = uuidV7(1_726_000_000_000);
    expect(inspectUuid(v7).timestamp?.getTime()).toBe(1_726_000_000_000);
    expect(inspectUuid(uuidV4()).timestamp).toBeUndefined();
  });

  it("reports an error for invalid input", () => {
    expect(inspectUuid("nope").valid).toBe(false);
    expect(inspectUuid("").error).toMatch(/enter a uuid/i);
  });
});

describe("formatUuid", () => {
  const u = "6fa459ea-ee8a-3ca4-894e-db77e160355e";
  it("applies uppercase and hyphen options", () => {
    expect(formatUuid(u, { uppercase: true, hyphens: true })).toBe(u.toUpperCase());
    expect(formatUuid(u, { uppercase: false, hyphens: false })).toBe(u.replace(/-/g, ""));
    expect(formatUuid(u, { uppercase: true, hyphens: false })).toBe(
      u.replace(/-/g, "").toUpperCase()
    );
  });
});

describe("resolveNamespace", () => {
  it("resolves predefined keys and validates a custom UUID", () => {
    expect(resolveNamespace("DNS", "")).toBe(NAMESPACES.DNS);
    expect(resolveNamespace("custom", "6fa459ea-ee8a-3ca4-894e-db77e160355e")).toBe(
      "6fa459ea-ee8a-3ca4-894e-db77e160355e"
    );
    expect(resolveNamespace("custom", "bad")).toBeNull();
  });
});
