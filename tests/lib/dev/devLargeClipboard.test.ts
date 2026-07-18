/**
 * Large-input, performance, and clipboard tests — DEVELOPER-001.
 *
 * The DX layer must survive big pastes (chunked Base64) and time transforms
 * cheaply, and its clipboard helpers must fail soft when the browser blocks
 * access. These pin the "large files / performance / clipboard" requirements.
 */

import { describe, it, expect, vi } from "vitest";
import { encodeBase64, decodeBase64 } from "@/lib/dev/base64";
import { formatJson } from "@/lib/dev/jsonFormat";
import { measure } from "@/lib/dev/metrics";
import { copyText, pasteText, readTextFile, DEFAULT_MAX_FILE_BYTES } from "@/lib/dev/files";

describe("large input + performance", () => {
  it("Base64 round-trips a 1M-character string without stack overflow, under budget", () => {
    const big = "a₹b".repeat(350_000); // ~1.05M chars, multibyte included
    const start = performance.now();
    const enc = encodeBase64(big);
    const dec = decodeBase64(enc.output);
    const elapsed = performance.now() - start;
    expect(enc.ok).toBe(true);
    expect(dec.output).toBe(big);
    expect(elapsed).toBeLessThan(3000);
  });

  it("formats a large JSON array quickly", () => {
    const arr = JSON.stringify(Array.from({ length: 20_000 }, (_, i) => ({ i, v: i * 2 })));
    const start = performance.now();
    const r = formatJson(arr, { indent: "2" });
    expect(r.ok).toBe(true);
    expect(performance.now() - start).toBeLessThan(2000);
  });

  it("measures a large string correctly", () => {
    const m = measure("x".repeat(100_000) + "\n" + "y".repeat(50_000));
    expect(m.characters).toBe(150_001);
    expect(m.lines).toBe(2);
    expect(m.bytes).toBe(150_001);
  });
});

describe("file size cap", () => {
  it("rejects a file over the cap without reading it", async () => {
    const oversized = {
      size: DEFAULT_MAX_FILE_BYTES + 1,
      name: "big.json",
      text: () => Promise.resolve("x"),
    } as unknown as File;
    const r = await readTextFile(oversized);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/limit/i);
  });

  it("reads a file under the cap", async () => {
    // jsdom doesn't implement File.text(); real browsers do, so supply it.
    const file = {
      size: 5,
      name: "ok.txt",
      text: () => Promise.resolve("hello"),
    } as unknown as File;
    const r = await readTextFile(file);
    expect(r.ok).toBe(true);
    expect(r.text).toBe("hello");
  });
});

describe("clipboard helpers fail soft", () => {
  it("copyText returns true on success, false when blocked", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(await copyText("hi")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("hi");

    vi.stubGlobal("navigator", {
      clipboard: { writeText: () => Promise.reject(new Error("blocked")) },
    });
    expect(await copyText("hi")).toBe(false);
    vi.unstubAllGlobals();
  });

  it("pasteText returns text on success, null when blocked", async () => {
    vi.stubGlobal("navigator", { clipboard: { readText: () => Promise.resolve("pasted") } });
    expect(await pasteText()).toBe("pasted");
    vi.stubGlobal("navigator", {
      clipboard: { readText: () => Promise.reject(new Error("blocked")) },
    });
    expect(await pasteText()).toBeNull();
    vi.unstubAllGlobals();
  });
});
