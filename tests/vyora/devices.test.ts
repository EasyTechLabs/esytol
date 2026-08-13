/**
 * Vyora — the browser's half of device management.
 *
 * The API decides everything here. What these tests pin is what the *browser*
 * is allowed to hold and to send: no credential of any kind reaches client
 * code, write bodies are rebuilt rather than relayed, and the page cannot show
 * a merchant anything about their handset because there is nothing about it to
 * show.
 *
 * The last one matters more than it looks. A device list is the natural place
 * for somebody to add "and the model, so they can tell them apart" — and the
 * moment that exists, a page a merchant might screen-share is publishing which
 * phones their staff carry.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const API_DIR = join(process.cwd(), "app", "api", "vyora-shops");
const read = (...parts: string[]) => readFileSync(join(...parts), "utf8");

describe("the device routes keep the token on the server", () => {
  it("names no credential anywhere the browser can read", () => {
    for (const file of [
      join(process.cwd(), "lib", "vyora", "shop-client.ts"),
      join(process.cwd(), "features", "vyora", "Devices.tsx"),
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("vyora_session");
      expect(source).not.toContain("Bearer");
      expect(source).not.toContain("localStorage");
      expect(source).not.toContain("sessionStorage");
      // The installation key exists only on the phone that made it. A browser
      // could not send one even if this file asked for it.
      expect(source).not.toContain("installationKey");
    }
  });

  it("routes every device call through this app's own server", () => {
    const client = read(process.cwd(), "lib", "vyora", "shop-client.ts");
    for (const method of ["listDevices", "renameDevice", "revokeDevice"]) {
      expect(client).toContain(`${method}:`);
    }
    expect(client).not.toMatch(/fetch\(\s*["'`]https?:/);
  });

  it("forwards with the session rather than building its own request", () => {
    for (const route of [
      read(API_DIR, "devices", "route.ts"),
      read(API_DIR, "devices", "[deviceId]", "route.ts"),
      read(API_DIR, "devices", "[deviceId]", "revoke", "route.ts"),
    ]) {
      expect(route).toContain("forwardWithSession");
      expect(route).not.toMatch(/fetch\(/);
    }
  });
});

describe("what the device routes can express", () => {
  it("rebuilds the rename body rather than relaying it", () => {
    // The contract sets `additionalProperties: false`, so a pass-through turns
    // a stray client field into a rejection that reads like a server fault —
    // and, worse, would let a browser reach fields this route never named.
    const source = read(API_DIR, "devices", "[deviceId]", "route.ts");
    expect(source).not.toContain("...incoming");
    expect(source).toContain("JSON.stringify({ label })");
  });

  it("keeps null meaningful when renaming", () => {
    // `null` is how a merchant clears a name. Folding it into "absent" would
    // make the name unclearable once set.
    const source = read(API_DIR, "devices", "[deviceId]", "route.ts");
    expect(source).toContain('typeof incoming.label === "string" ? incoming.label : null');
  });

  it("sends the self-revoke confirmation only as a literal true", () => {
    const source = read(API_DIR, "devices", "[deviceId]", "revoke", "route.ts");
    expect(source).toContain("incoming.confirmCurrentDevice === true");
    expect(source).not.toContain("...incoming");
  });

  it("exposes no way to delete a device", () => {
    // Revocation keeps the row: the events a device wrote reference it, and a
    // shop's history must not develop holes because somebody lost a phone.
    for (const route of [
      read(API_DIR, "devices", "route.ts"),
      read(API_DIR, "devices", "[deviceId]", "route.ts"),
      read(API_DIR, "devices", "[deviceId]", "revoke", "route.ts"),
    ]) {
      expect(route).not.toMatch(/export async function DELETE/);
    }
  });
});

describe("what the devices page may show a merchant", () => {
  const page = read(process.cwd(), "features", "vyora", "Devices.tsx");
  const client = read(process.cwd(), "lib", "vyora", "shop-client.ts");

  it("declares only the safe fields", () => {
    // The closed list, mirrored from the contract. A field added here without
    // being added there would render `undefined`; a field added *there* and
    // copied here without thinking is what this is guarding against.
    const shape = client.slice(client.indexOf("export interface Device {"));
    const body = shape.slice(0, shape.indexOf("}"));

    for (const field of ["deviceId", "label", "registeredAt", "lastSeenAt", "current", "status"]) {
      expect(body).toContain(field);
    }
    for (const forbidden of [
      "installation",
      "hash",
      "token",
      "androidId",
      "advertising",
      "imei",
      "macAddress",
      "sim",
      "ipAddress",
      "userAgent",
      "model",
      "manufacturer",
    ]) {
      expect(body).not.toContain(forbidden);
    }
  });

  it("renders no identifier a merchant cannot act on", () => {
    // The device id is used as a key and in test ids — never printed as text.
    expect(page).not.toMatch(/\{device\.deviceId\}\s*</);
    expect(page).not.toMatch(/>\s*\{device\.deviceId\}/);
    expect(page).not.toContain("registeredAt}");
  });

  it("promises that signing a phone out does not erase its book", () => {
    // The load-bearing sentence: somebody who believes this wipes the phone
    // will not use it on the phone they have lost, which is the only one they
    // need it for.
    expect(page).toMatch(/does not erase the book/i);
    expect(page).toMatch(/stops that phone syncing/i);
  });

  it("shows a signed-out phone rather than hiding it", () => {
    expect(page).toMatch(/no longer sync/i);
    expect(page).toContain('"revoked"');
  });

  it("says nothing technical to a merchant", () => {
    for (const quoted of page.match(/"[^"\n]{4,}"/g) ?? []) {
      expect(quoted).not.toMatch(/\b(40[0-9]|token|bearer|endpoint|forbidden|unauthori[sz]ed)\b/i);
    }
  });

  it("has no self-revoke path, because a browser is never a device", () => {
    // A device is a phone that registered an installation key. This server has
    // none, so `current` can never be true here and the confirmation the API
    // requires for revoking the calling device is unreachable by construction.
    expect(page).not.toContain("confirmCurrentDevice");
    expect(client).toContain("never is");
  });
});
