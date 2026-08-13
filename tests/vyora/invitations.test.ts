/**
 * Vyora — an invitation as the browser presents it, and what a role may see.
 *
 * Two halves of the same milestone.
 *
 * The first is the inbox's logic: the server decides what an invitation is,
 * and this pins what the *page* does with one — chiefly that Accept stops being
 * offered the moment the offer stops meaning anything, without waiting for a
 * request to come back refused.
 *
 * The second is the boundary between what an owner sees and what everyone else
 * does. Those assertions read source, not behaviour, and that is deliberate:
 * the claim being made is "this page cannot render an admin control for a
 * non-owner", which is a property of its structure. A rendering test proves it
 * for the states the test happens to set up; reading the file proves the
 * control is inside the branch that only owners reach.
 *
 * Neither half is a security control. The API refuses every one of these
 * requests on its own, and `vyora-api/tests/family-shop.test.ts` proves it does
 * so for requests made with no page involved at all.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EXPIRED_EXPLANATION,
  SAFE_FIELDS,
  canAccept,
  describeExpiry,
  explainRefusal,
  present,
  presentAll,
} from "@/lib/vyora/invitations";
import type { IncomingInvitation } from "@/lib/vyora/shop-client";

const NOW = Date.parse("2026-08-13T10:00:00.000Z");
const inDays = (n: number) => new Date(NOW + n * 24 * 60 * 60 * 1000).toISOString();

function invitation(over: Partial<IncomingInvitation> = {}): IncomingInvitation {
  return {
    invitationId: "11111111-1111-4111-8111-111111111111",
    shopId: "VYR-TPK9-S9",
    shopName: "Sharma Pan Shop",
    locality: "Bengaluru GPO",
    role: "staff",
    expiresAt: inDays(7),
    ...over,
  };
}

describe("what an invitation shows its recipient", () => {
  it("carries the shop's name, code, area and the role offered", () => {
    const shown = present(invitation(), NOW);
    expect(shown.shopName).toBe("Sharma Pan Shop");
    expect(shown.shopId).toBe("VYR-TPK9-S9");
    expect(shown.locality).toBe("Bengaluru GPO");
    expect(shown.role).toBe("staff");
  });

  it("carries nothing a stranger to that shop may not see", () => {
    // Until they accept, the recipient is exactly as much a stranger as
    // somebody holding the shop's printed QR code — the line ADR-0006 draws for
    // the verification window. This assertion fails if the API ever widens what
    // it sends.
    expect(Object.keys(invitation()).sort()).toEqual([...SAFE_FIELDS]);

    const serialised = JSON.stringify(present(invitation(), NOW));
    for (const forbidden of ["addressLine", "pincode", "merchantId", "members", "email", "token"]) {
      expect(serialised).not.toContain(forbidden);
    }
  });
});

describe("how long is left", () => {
  it("is said in words rather than as a date", () => {
    expect(describeExpiry(inDays(7), NOW)).toBe("Expires in 7 days");
    expect(describeExpiry(inDays(1.5), NOW)).toBe("Expires tomorrow");
    expect(describeExpiry(inDays(0.5), NOW)).toBe("Expires today");
    expect(describeExpiry(new Date(NOW + 30 * 60 * 1000).toISOString(), NOW)).toBe(
      "Expires within the hour"
    );
  });

  it("says plainly when it has lapsed", () => {
    expect(describeExpiry(inDays(-1), NOW)).toBe("This invitation has expired");
  });

  it("does not invent a life for an unreadable timestamp", () => {
    expect(describeExpiry("not a date", NOW)).toBe("Expiry unknown");
  });
});

describe("whether Accept is offered", () => {
  it("is offered while the invitation stands", () => {
    expect(canAccept(present(invitation(), NOW))).toBe(true);
  });

  it("is withdrawn the moment it lapses, without asking the server", () => {
    // A tab left open over lunch. The button has to stop being live when the
    // offer does, not when a request comes back refused.
    const expired = present(invitation({ expiresAt: inDays(-0.001) }), NOW);
    expect(expired.state).toBe("expired");
    expect(canAccept(expired)).toBe(false);
  });

  it("treats an unreadable expiry as expired rather than open", () => {
    expect(canAccept(present(invitation({ expiresAt: "nonsense" }), NOW))).toBe(false);
  });
});

describe("the order they appear in", () => {
  it("puts live offers above lapsed ones", () => {
    const list = presentAll(
      [
        invitation({ invitationId: "dead", expiresAt: inDays(-1) }),
        invitation({ invitationId: "live", expiresAt: inDays(5) }),
      ],
      NOW
    );
    expect(list.map((i) => i.invitationId)).toEqual(["live", "dead"]);
  });

  it("renders an empty list without inventing a row", () => {
    expect(presentAll([], NOW)).toEqual([]);
  });
});

describe("what a merchant is told when the server refuses", () => {
  it("never shows a status code or permissions jargon", () => {
    for (const technical of [
      "403 Forbidden",
      "401 unauthorized",
      "HTTP 404",
      "Forbidden: role lacks capability",
    ]) {
      const said = explainRefusal(technical);
      expect(said).toBe("That invitation is no longer available.");
      expect(said).not.toMatch(/40[134]|forbidden|unauthori[sz]ed/i);
    }
  });

  it("passes through a sentence the API already wrote for a merchant", () => {
    // The API's refusals name the role's limit — "Only an owner can add or
    // change the people in this shop" — and rewriting those would lose the one
    // thing that tells the person what to do next.
    const said = "Only an owner can take or restore a backup of this shop's book.";
    expect(explainRefusal(said)).toBe(said);
  });

  it("takes the substitute from the caller, because context decides it", () => {
    expect(explainRefusal("403 Forbidden", "Ask an owner.")).toBe("Ask an owner.");
    expect(explainRefusal("   ", "Ask an owner.")).toBe("Ask an owner.");
  });

  it("says something rather than nothing for an empty message", () => {
    expect(explainRefusal("   ")).toBe("That invitation is no longer available.");
  });

  it("has a sentence for an expired offer that tells the person what to do", () => {
    expect(EXPIRED_EXPLANATION).toMatch(/ask the shop/i);
  });
});

// ── The role boundary, read off the pages themselves ─────────────────────────

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

describe("the people page keeps its two views apart", () => {
  const source = read("features", "vyora", "screens", "People.tsx");

  it("returns before reaching any control when the caller is not an owner", () => {
    // Structural, not cosmetic. The restricted branch renders one card and
    // returns; everything that can change a membership is authored after that
    // return. So there is no state this component can be put in where a
    // non-owner is shown a role button — not "no state the tests try".
    const restricted = source.indexOf('if (view.kind === "restricted")');
    const ownerView = source.indexOf("const pending = invitations.filter");
    expect(restricted).toBeGreaterThan(-1);
    expect(ownerView).toBeGreaterThan(restricted);

    // Everything between the two is what a staff member or viewer can reach.
    const branch = source.slice(restricted, ownerView);
    expect(branch).toContain("people-restricted");
    for (const control of [
      "createShopInvitation",
      "updateShopMembership",
      "cancelShopInvitation",
      "invite-role-",
      "role-",
    ]) {
      expect(branch).not.toContain(control);
    }
  });

  it("treats a refusal as a different page rather than an error", () => {
    // A 403 here is the answer to "which of the two views is this", so it must
    // not reach `setProblem` and be rendered as something that went wrong.
    expect(source).toMatch(/people\.status === 403/);
    expect(source).toContain("Staff or viewer. Not an error");
  });
});

describe("no page shows a merchant how the refusal was carried", () => {
  it("never renders a status code or permissions vocabulary", () => {
    // Literal strings only — `people.status === 403` is a comparison, not
    // something a merchant reads, so the check is for quoted text.
    const pages = [
      read("features", "vyora", "screens", "People.tsx"),
      read("features", "vyora", "InvitationInbox.tsx"),
      read("features", "vyora", "screens", "ShopSetup.tsx"),
    ];

    for (const page of pages) {
      for (const quoted of page.match(/"[^"\n]{4,}"/g) ?? []) {
        expect(quoted).not.toMatch(/\b(403|401|forbidden|unauthori[sz]ed|permission denied)\b/i);
      }
    }
  });
});
