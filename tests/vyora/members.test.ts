/**
 * Vyora — the browser's half of shop membership.
 *
 * The API decides everything here, and its decision is the one that counts.
 * What these tests pin is what the *browser* is allowed to see and send:
 *
 *   - the token still never reaches client code on the new routes;
 *   - write bodies are rebuilt, so no client field can reach the contract;
 *   - the person-scoped invitation routes stay person-scoped;
 *   - no route can delete a membership, only mark it.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const API_DIR = join(process.cwd(), "app", "api", "vyora-shops");
const read = (...parts: string[]) => readFileSync(join(...parts), "utf8");

describe("the membership routes keep the token on the server", () => {
  it("never names a credential in client-side membership code", () => {
    for (const file of [
      join(process.cwd(), "lib", "vyora", "shop-client.ts"),
      join(process.cwd(), "features", "vyora", "screens", "People.tsx"),
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("vyora_session");
      expect(source).not.toContain("Bearer");
      expect(source).not.toContain("localStorage");
      expect(source).not.toContain("sessionStorage");
    }
  });

  it("routes every membership call through this app's own server", () => {
    const client = read(process.cwd(), "lib", "vyora", "shop-client.ts");
    for (const method of [
      "listShopMembers",
      "updateShopMembership",
      "listShopInvitations",
      "createShopInvitation",
      "cancelShopInvitation",
      "listMyInvitations",
      "acceptInvitation",
      "declineInvitation",
    ]) {
      expect(client).toContain(`${method}:`);
    }
    // No direct call to the API. Everything goes through `${ROOT}`.
    expect(client).not.toMatch(/fetch\(\s*["'`]https?:/);
  });
});

describe("what the membership routes can express", () => {
  it("rebuilds the role-change body rather than relaying it", () => {
    // The contract sets `additionalProperties: false`, so a pass-through turns
    // a stray client field into a 400 that reads like a server fault.
    const source = read(API_DIR, "members", "[personId]", "route.ts");
    expect(source).toContain("ROLES.has");
    expect(source).toContain("STATUSES.has");
    expect(source).not.toContain("...incoming");
  });

  it("refuses an empty role change here rather than spending a round trip", () => {
    const source = read(API_DIR, "members", "[personId]", "route.ts");
    expect(source).toContain("status: 400");
  });

  it("adds no validation of its own to the invite route", () => {
    // The API answers identically whether an address has an account or not. A
    // stricter check here would turn that into a membership oracle by
    // rejecting some inputs faster than others.
    const source = read(API_DIR, "invitations", "route.ts");
    expect(source).not.toContain("status: 400");
    expect(source).not.toMatch(/EMAIL|isValidEmail/);
  });

  it("keeps my own invitations on a person-scoped path", () => {
    // Someone deciding whether to join a shop is not in it yet. If these moved
    // under a shop-scoped path they would need a shop the caller cannot name.
    const mine = read(API_DIR, "my-invitations", "route.ts");
    expect(mine).toContain("/api/v1/invitations");
    expect(mine).not.toContain("/api/v1/shops/");

    for (const verb of ["accept", "decline"]) {
      const source = read(API_DIR, "my-invitations", "[invitationId]", verb, "route.ts");
      expect(source).toContain(`/api/v1/invitations/`);
      expect(source).toContain("encodeURIComponent");
    }
  });

  it("cannot delete a membership or an invitation, only mark one", () => {
    // Removing somebody is a status change. A physical delete would take the
    // record of who worked here with it.
    for (const file of [
      join(API_DIR, "members", "route.ts"),
      join(API_DIR, "members", "[personId]", "route.ts"),
      join(API_DIR, "invitations", "route.ts"),
      join(API_DIR, "invitations", "[invitationId]", "cancel", "route.ts"),
      join(API_DIR, "my-invitations", "route.ts"),
    ]) {
      expect(readFileSync(file, "utf8")).not.toContain("export async function DELETE");
    }
  });

  it("sends a merge patch, which is what the contract declares", () => {
    // Plain JSON on that operation is a 415 on a body the server would
    // otherwise have accepted.
    const forward = read(API_DIR, "forward.ts");
    expect(forward).toContain("application/merge-patch+json");
    expect(forward).toContain('method === "PATCH"');
  });
});

describe("the people screen", () => {
  const screen = () =>
    readFileSync(join(process.cwd(), "features", "vyora", "screens", "People.tsx"), "utf8");

  it("treats a 403 as a different view, not an error", () => {
    // Staff and viewers must not be shown an empty admin panel with an
    // apology. A 403 is how the page learns which of two views to render.
    expect(screen()).toContain("people-restricted");
    expect(screen()).toMatch(/status === 403/);
  });

  it("explains the last-owner rule instead of letting the server refuse", () => {
    const source = screen();
    expect(source).toContain("isLastActiveOwner");
    expect(source).toContain("at least one owner");
  });

  it("does not count an inactive owner as holding the shop up", () => {
    // Counting them would make the page hide a change the database allows.
    const source = screen();
    expect(source).toMatch(/role === "owner" && m\.status === "active"/);
  });

  it("shows the server's own wording for a role", () => {
    // Served rather than written here, so the browser and the phone cannot
    // describe the same role differently.
    expect(screen()).toContain("roleSummaries");
  });

  it("does not claim an email was delivered", () => {
    // The server answers identically whether the address has an account, so
    // this app does not know anybody was reached.
    //
    // Matched against the code with comments stripped. The first version of
    // this assertion failed on the comment that explains why the page must not
    // say "we have emailed them" — which is the phrase, in the one place it
    // belongs. What matters is what a merchant reads, not what the file says
    // about itself.
    const code = screen()
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    expect(code).not.toMatch(/we (have )?emailed/i);
    expect(code).not.toMatch(/check your (inbox|email)/i);
    // The wording comes from the server, which is the only party that knows.
    expect(code).toContain("res.value.message");
  });
});
