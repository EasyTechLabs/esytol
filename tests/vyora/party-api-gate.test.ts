/**
 * The gate that decides whether development Party API reads may happen.
 *
 * This is the security-relevant half of VYORA-PLATFORM-005: the flag defaults
 * off, a production build ignores it entirely, and a non-loopback URL is
 * refused. All three are asserted here rather than trusted, because the
 * consequence of getting them wrong is a pilot device reading from a server.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_API_URL,
  PARTY_READS_FLAG,
  decidePartyApi,
  isLoopbackUrl,
} from "@/lib/vyora/party-api-config";

const LOCAL = "http://127.0.0.1:4000";

describe("default configuration", () => {
  it("is disabled when the flag is absent", () => {
    const decision = decidePartyApi({ flag: undefined, nodeEnv: "development", apiUrl: LOCAL });
    expect(decision.enabled).toBe(false);
  });

  it("is disabled for an empty flag", () => {
    expect(decidePartyApi({ flag: "", nodeEnv: "development", apiUrl: LOCAL }).enabled).toBe(false);
  });

  it.each(["false", "0", "yes", "TRUE", "1", "on"])(
    'is disabled for flag value %j — only the exact string "true" enables it',
    (flag) => {
      expect(decidePartyApi({ flag, nodeEnv: "development", apiUrl: LOCAL }).enabled).toBe(false);
    }
  );

  it("names the flag it is looking for, so a developer is not left guessing", () => {
    const decision = decidePartyApi({ flag: undefined, nodeEnv: "development", apiUrl: LOCAL });
    expect(decision.enabled).toBe(false);
    if (!decision.enabled) expect(decision.reason).toContain(PARTY_READS_FLAG);
  });

  it("checks the repository default is the disabled value", () => {
    // `.env.example` documents the flag as false. If someone flips that
    // default, this fails.
    expect(PARTY_READS_FLAG).toBe("NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED");
  });
});

describe("development flag plus localhost API", () => {
  it("enables reads", () => {
    const decision = decidePartyApi({ flag: "true", nodeEnv: "development", apiUrl: LOCAL });
    expect(decision.enabled).toBe(true);
    if (decision.enabled) expect(decision.apiUrl).toBe(LOCAL);
  });

  it("falls back to the loopback default when no URL is configured", () => {
    const decision = decidePartyApi({ flag: "true", nodeEnv: "development", apiUrl: undefined });
    expect(decision.enabled).toBe(true);
    if (decision.enabled) expect(decision.apiUrl).toBe(DEFAULT_API_URL);
  });

  it("also enables under the test environment", () => {
    expect(decidePartyApi({ flag: "true", nodeEnv: "test", apiUrl: LOCAL }).enabled).toBe(true);
  });

  it.each(["http://localhost:4000", "http://127.0.0.1:4000", "http://[::1]:4000"])(
    "accepts loopback URL %s",
    (url) => {
      expect(decidePartyApi({ flag: "true", nodeEnv: "development", apiUrl: url }).enabled).toBe(
        true
      );
    }
  );
});

describe("a production build cannot activate development API reads", () => {
  it("ignores the flag even when it is enabled and the URL is loopback", () => {
    const decision = decidePartyApi({ flag: "true", nodeEnv: "production", apiUrl: LOCAL });
    expect(decision.enabled).toBe(false);
    if (!decision.enabled) expect(decision.reason).toContain("production build");
  });

  it("stays disabled in production regardless of URL", () => {
    for (const apiUrl of [LOCAL, "https://api.example.com", undefined]) {
      expect(decidePartyApi({ flag: "true", nodeEnv: "production", apiUrl }).enabled).toBe(false);
    }
  });
});

describe("remote reads are localhost-only", () => {
  it.each([
    "https://api.example.com",
    "http://192.168.1.10:4000",
    "http://vyora-api.internal:4000",
    "http://169.254.169.254/",
  ])("refuses non-loopback URL %s", (apiUrl) => {
    const decision = decidePartyApi({ flag: "true", nodeEnv: "development", apiUrl });
    expect(decision.enabled).toBe(false);
    if (!decision.enabled) expect(decision.reason).toContain("loopback");
  });

  it("refuses a malformed URL rather than assuming it is safe", () => {
    expect(
      decidePartyApi({ flag: "true", nodeEnv: "development", apiUrl: "not a url" }).enabled
    ).toBe(false);
    expect(isLoopbackUrl("not a url")).toBe(false);
  });

  it("does not leak credentials from a URL into the reason shown in the UI", () => {
    const decision = decidePartyApi({
      flag: "true",
      nodeEnv: "development",
      apiUrl: "https://user:sup3rsecret@api.example.com",
    });
    expect(decision.enabled).toBe(false);
    if (!decision.enabled) {
      expect(decision.reason).not.toContain("sup3rsecret");
      expect(decision.reason).toContain("api.example.com");
    }
  });
});
