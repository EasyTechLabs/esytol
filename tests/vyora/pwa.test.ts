/**
 * Vyora — install & offline tests (V2-005).
 *
 * The rules that keep the install experience from becoming nagware:
 * a banner that can lead somewhere or is not shown, a tutorial that appears
 * exactly once, and an update that waits for the merchant.
 *
 * Also guards the thing that would be hardest to undo on a live site: the
 * service worker must stay scoped to /vyora/, because esytol hosts other tools
 * on the same origin.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_PWA_FLAGS,
  SW_PATH,
  SW_SCOPE,
  TUTORIAL_PAGES,
  detectInstallState,
  detectPlatform,
  normalizePwaFlags,
  shouldShowInstallBanner,
  shouldShowTutorial,
} from "@/lib/vyora/pwa";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120";

const browserWindow = { matchMedia: () => ({ matches: false }) };
const standaloneWindow = { matchMedia: () => ({ matches: true }) };

describe("platform detection", () => {
  it("recognises the three cases that behave differently", () => {
    expect(detectPlatform(IPHONE)).toBe("ios");
    expect(detectPlatform(ANDROID)).toBe("android");
    expect(detectPlatform(DESKTOP)).toBe("desktop");
  });

  it("falls back to desktop rather than guessing", () => {
    expect(detectPlatform("")).toBe("desktop");
  });
});

describe("installed detection", () => {
  it("reads display-mode: standalone", () => {
    const state = detectInstallState(standaloneWindow, { userAgent: ANDROID });
    expect(state.installed).toBe(true);
    expect(state.mode).toBe("standalone");
  });

  it("also honours navigator.standalone, which iOS shipped first", () => {
    const state = detectInstallState(browserWindow, { userAgent: IPHONE, standalone: true });
    expect(state.installed).toBe(true);
  });

  it("reports a plain browser tab as not installed", () => {
    const state = detectInstallState(browserWindow, { userAgent: ANDROID });
    expect(state.installed).toBe(false);
    expect(state.mode).toBe("browser");
  });

  it("only asks iOS for a manual install, and only while uninstalled", () => {
    expect(detectInstallState(browserWindow, { userAgent: IPHONE }).needsManualInstall).toBe(true);
    expect(detectInstallState(browserWindow, { userAgent: ANDROID }).needsManualInstall).toBe(
      false
    );
    const iosInstalled = detectInstallState(browserWindow, {
      userAgent: IPHONE,
      standalone: true,
    });
    expect(iosInstalled.needsManualInstall).toBe(false);
  });

  it("survives an environment with no matchMedia at all", () => {
    expect(detectInstallState({}, {}).installed).toBe(false);
  });
});

describe("the install banner only appears when it can lead somewhere", () => {
  const android = detectInstallState(browserWindow, { userAgent: ANDROID });
  const ios = detectInstallState(browserWindow, { userAgent: IPHONE });
  const installed = detectInstallState(standaloneWindow, { userAgent: ANDROID });

  it("shows on Android once a prompt is available", () => {
    expect(shouldShowInstallBanner(android, DEFAULT_PWA_FLAGS, true)).toBe(true);
  });

  it("stays hidden on Android with no prompt to offer", () => {
    expect(shouldShowInstallBanner(android, DEFAULT_PWA_FLAGS, false)).toBe(false);
  });

  it("shows on iOS even without a prompt, because instructions are the install", () => {
    expect(shouldShowInstallBanner(ios, DEFAULT_PWA_FLAGS, false)).toBe(true);
  });

  it("never shows once installed", () => {
    expect(shouldShowInstallBanner(installed, DEFAULT_PWA_FLAGS, true)).toBe(false);
  });

  it("never shows again after dismissal", () => {
    const dismissed = { ...DEFAULT_PWA_FLAGS, installBannerDismissed: true };
    expect(shouldShowInstallBanner(android, dismissed, true)).toBe(false);
    expect(shouldShowInstallBanner(ios, dismissed, false)).toBe(false);
  });
});

describe("the tutorial is shown once, ever", () => {
  it("appears on first launch", () => {
    expect(shouldShowTutorial(DEFAULT_PWA_FLAGS)).toBe(true);
  });

  it("never appears again once seen", () => {
    expect(shouldShowTutorial({ ...DEFAULT_PWA_FLAGS, tutorialSeen: true })).toBe(false);
  });

  it("is at most three pages", () => {
    expect(TUTORIAL_PAGES.length).toBeLessThanOrEqual(3);
    expect(TUTORIAL_PAGES.map((p) => p.title)).toEqual([
      "Add a customer",
      "Record credit",
      "Recover money",
    ]);
  });

  it("treats a corrupt flag file as a fresh install rather than throwing", () => {
    expect(normalizePwaFlags("nonsense")).toEqual(DEFAULT_PWA_FLAGS);
    expect(normalizePwaFlags({ tutorialSeen: "yes" }).tutorialSeen).toBe(false);
    expect(normalizePwaFlags({ tutorialSeen: true }).tutorialSeen).toBe(true);
  });
});

// ─── The manifest and worker, read off disk ──────────────────────────────────

const ROOT = process.cwd();
const manifest = JSON.parse(
  readFileSync(join(ROOT, "public", "vyora", "manifest.webmanifest"), "utf8")
);

describe("the manifest is installable and correctly scoped", () => {
  it("declares everything a browser needs to offer an install", () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBe("Vyora");
    expect(manifest.display).toBe("standalone");
    expect(manifest.orientation).toBe("portrait");
    expect(manifest.theme_color).toBe("#2563eb");
    expect(manifest.background_color).toBeTruthy();
  });

  it("starts and stays inside /vyora", () => {
    expect(manifest.start_url).toBe("/vyora");
    expect(manifest.scope).toBe("/vyora/");
  });

  it("ships a maskable icon as well as a plain one", () => {
    const purposes = manifest.icons.map((i: { purpose: string }) => i.purpose);
    expect(purposes).toContain("any");
    expect(purposes).toContain("maskable");
    expect(manifest.icons.some((i: { sizes: string }) => i.sizes === "192x192")).toBe(true);
    expect(manifest.icons.some((i: { sizes: string }) => i.sizes === "512x512")).toBe(true);
  });

  it("points every icon and shortcut at a real path", () => {
    for (const icon of manifest.icons) expect(icon.src.startsWith("/")).toBe(true);
    for (const shortcut of manifest.shortcuts) expect(shortcut.url.startsWith("/vyora")).toBe(true);
  });
});

describe("the service worker cannot escape /vyora", () => {
  const sw = readFileSync(join(ROOT, "public", "vyora", "sw.js"), "utf8");

  it("is served from a path that scopes it to /vyora/", () => {
    expect(SW_PATH).toBe("/vyora/sw.js");
    expect(SW_SCOPE).toBe("/vyora/");
  });

  it("never refreshes the merchant without being asked", () => {
    // skipWaiting must only run from the explicit message, never on install.
    expect(sw).toContain("VYORA_SKIP_WAITING");
    const install = sw.indexOf('addEventListener("install"');
    const activate = sw.indexOf('addEventListener("activate"');
    // The CALL, not the word — the install handler documents that it
    // deliberately does not skip waiting, and a bare-word check fails on its
    // own comment.
    expect(sw.slice(install, activate)).not.toContain("self.skipWaiting()");
  });

  it("registers no push, sync or background handler", () => {
    // Match real handler registration, not the words in the file's own comments.
    for (const api of ['addEventListener("push"', 'addEventListener("sync"', "pushManager"]) {
      expect({ api, present: sw.includes(api) }).toEqual({ api, present: false });
    }
  });

  it("has an offline fallback and phones nobody", () => {
    expect(sw).toContain("/vyora/offline.html");
    for (const forbidden of ["sendBeacon", "importScripts(", "analytics"]) {
      expect({ forbidden, present: sw.includes(forbidden) }).toEqual({ forbidden, present: false });
    }
  });

  it("ships an offline page that needs nothing from the network", () => {
    const offline = readFileSync(join(ROOT, "public", "vyora", "offline.html"), "utf8");
    expect(offline).toContain("offline");
    expect(offline).not.toMatch(/<script src=/);
    expect(offline).not.toMatch(/https?:\/\//);
  });
});
