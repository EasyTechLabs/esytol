/**
 * Vyora — the browser's half of proposals.
 *
 * Two kinds of claim are pinned here.
 *
 * **Wording.** A proposal is not an entry. Until the server has finalised it
 * *and* the event exists, no screen may say it is in the book. The gap between
 * `accepted` and `recorded` is real — it is where a retry lives — and a page
 * that closes it with a sentence sends a merchant to look for money that has
 * not arrived.
 *
 * **Reach.** The session token never enters browser code, and the browser
 * cannot name a shop on any proposal request. Active-shop safety on the web is
 * not a filter applied after the fact; it is that there is no shop parameter to
 * tamper with.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ACCEPT_EXPLANATION,
  canAnswer,
  canRevise,
  canWithdraw,
  describeHistory,
  describeState,
  describeType,
  explainRefusal,
  present,
  splitSided,
} from "@/lib/vyora/proposals";
import type { Proposal } from "@/lib/vyora/shop-client";

const API_DIR = join(process.cwd(), "app", "api", "vyora-shops");
const read = (...parts: string[]) => readFileSync(join(...parts), "utf8");

const NOW = Date.parse("2026-08-14T10:00:00.000Z");
const inMinutes = (n: number) => new Date(NOW + n * 60_000).toISOString();

function proposal(over: Partial<Proposal> = {}): Proposal {
  return {
    proposalId: "11111111-1111-4111-8111-111111111111",
    type: "credit",
    initiator: "shop",
    status: "proposed",
    version: 1,
    amount: 2500,
    dueDate: "2026-09-14",
    note: null,
    partyId: "pty_1",
    partyName: "Ramesh",
    shopId: "VYR-TPK9-S9",
    shopName: "Sharma Pan Shop",
    expiresAt: null,
    finalEventId: null,
    awaitingSide: "customer",
    createdAt: "2026-08-14T09:00:00.000Z",
    updatedAt: "2026-08-14T09:00:00.000Z",
    history: [
      {
        version: 1,
        amount: 2500,
        dueDate: "2026-09-14",
        note: null,
        side: "shop",
        at: "2026-08-14T09:00:00.000Z",
      },
    ],
    ...over,
  };
}

describe("a proposal is not an entry", () => {
  it("is not recorded while it is still being negotiated", () => {
    const pending = present(proposal(), "customer", NOW);
    expect(pending.recorded).toBe(false);
    expect(pending.state).toMatch(/waiting/i);
  });

  it("is still not recorded once agreed but not yet written", () => {
    // The gap this whole area is careful about. The server has agreed; the
    // ledger entry does not exist yet, and saying it does would send somebody
    // to look for money that has not arrived.
    const agreed = present(proposal({ status: "accepted", awaitingSide: null }), "shop", NOW);
    expect(agreed.recorded).toBe(false);
    expect(agreed.state).toMatch(/adding it to the book/i);
    expect(agreed.state).not.toMatch(/recorded in the book/i);
  });

  it("says it is in the book only once the server has recorded it", () => {
    const done = present(
      proposal({ status: "recorded", finalEventId: "evt_1", awaitingSide: null }),
      "shop",
      NOW
    );
    expect(done.recorded).toBe(true);
    expect(done.state).toMatch(/recorded in the book/i);
    expect(done.finished).toBe(true);
  });

  it("never claims a ledger entry anywhere in the screen's own wording", () => {
    // A guard on the file itself: an optimistic "added to your book" written
    // beside an accept handler would pass every behavioural test above.
    const screen = read(process.cwd(), "features", "vyora", "screens", "Proposals.tsx");
    expect(screen).toContain('result.value.status === "recorded"');
    expect(screen).not.toMatch(/setNote\(\s*["'`][^"'`]*in the book[^"'`]*["'`]\s*\)/);
  });
});

describe("whose turn it is", () => {
  it("tells the side being waited for that it is theirs", () => {
    const forCustomer = present(proposal({ awaitingSide: "customer" }), "customer", NOW);
    expect(forCustomer.mine).toBe(true);
    expect(forCustomer.state).toBe("Waiting for you to answer");
    expect(canAnswer(forCustomer)).toBe(true);
  });

  it("tells the other side to wait, from the same server state", () => {
    const forShop = present(proposal({ awaitingSide: "customer" }), "shop", NOW);
    expect(forShop.mine).toBe(false);
    expect(forShop.state).toBe("Waiting for them");
    expect(canAnswer(forShop)).toBe(false);
  });

  it("treats a counter-offer in flight as still answerable", () => {
    // `revised` is transient server-side, but the contract exposes it. A client
    // that called it finished would show a live negotiation with no buttons.
    const mid = present(proposal({ status: "revised", awaitingSide: "shop" }), "shop", NOW);
    expect(canAnswer(mid)).toBe(true);
    expect(canRevise(mid)).toBe(true);
    expect(mid.finished).toBe(false);
  });
});

describe("expiry, recomputed while the page sits open", () => {
  it("stops offering an answer the moment the window closes", () => {
    const lapsed = present(proposal({ expiresAt: inMinutes(-1) }), "customer", NOW);
    expect(lapsed.status).toBe("expired");
    expect(canAnswer(lapsed)).toBe(false);
    expect(canRevise(lapsed)).toBe(false);
    expect(lapsed.state).toMatch(/expired/i);
  });

  it("leaves a live one answerable, and no deadline means no deadline", () => {
    expect(canAnswer(present(proposal({ expiresAt: inMinutes(30) }), "customer", NOW))).toBe(true);
    expect(canAnswer(present(proposal({ expiresAt: null }), "customer", NOW))).toBe(true);
  });
});

describe("the two lists", () => {
  it("puts what the other side started under incoming", () => {
    const { incoming, sent } = splitSided(
      [
        { proposal: proposal({ proposalId: "theirs", initiator: "customer" }), side: "shop" },
        { proposal: proposal({ proposalId: "ours", initiator: "shop" }), side: "shop" },
      ],
      NOW
    );

    expect(incoming.map((p) => p.proposalId)).toEqual(["theirs"]);
    expect(sent.map((p) => p.proposalId)).toEqual(["ours"]);
  });

  it("keeps a declined request you made under what you asked", () => {
    // "Sent" is not "needs an answer" — it is where you will go looking.
    const { incoming, sent } = splitSided(
      [
        {
          proposal: proposal({ initiator: "shop", status: "rejected", awaitingSide: null }),
          side: "shop",
        },
      ],
      NOW
    );
    expect(sent).toHaveLength(1);
    expect(incoming).toEqual([]);
  });

  it("reads a shop row and a customer row correctly in the same list", () => {
    // One person, both sides. The shop reads the customer's name; the customer
    // reads the shop's.
    const { incoming } = splitSided(
      [
        { proposal: proposal({ initiator: "customer" }), side: "shop" },
        { proposal: proposal({ proposalId: "b", initiator: "shop" }), side: "customer" },
      ],
      NOW
    );

    expect(incoming.map((p) => p.counterparty).sort()).toEqual(["Ramesh", "Sharma Pan Shop"]);
  });

  it("puts what needs answering first", () => {
    const { incoming } = splitSided(
      [
        {
          proposal: proposal({
            proposalId: "done",
            initiator: "customer",
            status: "recorded",
            awaitingSide: null,
          }),
          side: "shop",
        },
        {
          proposal: proposal({ proposalId: "mine", initiator: "customer", awaitingSide: "shop" }),
          side: "shop",
        },
      ],
      NOW
    );

    expect(incoming.map((p) => p.proposalId)).toEqual(["mine", "done"]);
  });
});

describe("who may do what", () => {
  it("lets either side counter-offer while it is live", () => {
    expect(canRevise(present(proposal({ awaitingSide: "shop" }), "shop", NOW))).toBe(true);
    expect(canRevise(present(proposal({ awaitingSide: "customer" }), "shop", NOW))).toBe(true);
  });

  it("lets only the side that asked withdraw", () => {
    expect(canWithdraw(present(proposal({ initiator: "shop" }), "shop", NOW))).toBe(true);
    expect(canWithdraw(present(proposal({ initiator: "shop" }), "customer", NOW))).toBe(false);
  });

  it("offers nothing at all once it is finished", () => {
    for (const status of ["recorded", "rejected", "cancelled", "expired"] as const) {
      const done = present(proposal({ status, awaitingSide: null }), "shop", NOW);
      expect(canAnswer(done)).toBe(false);
      expect(canRevise(done)).toBe(false);
      expect(canWithdraw(done)).toBe(false);
    }
  });
});

describe("a revision is a new version, never an edit", () => {
  it("counts the changes so somebody sees this has moved", () => {
    const haggled = present(
      proposal({
        version: 3,
        amount: 1800,
        history: [
          { version: 1, amount: 2500, dueDate: null, note: null, side: "shop", at: "" },
          { version: 2, amount: 2000, dueDate: null, note: null, side: "customer", at: "" },
          { version: 3, amount: 1800, dueDate: null, note: null, side: "shop", at: "" },
        ],
      }),
      "customer",
      NOW
    );

    expect(haggled.revisions).toBe(2);
    expect(haggled.amount).toBe(1800);
  });

  it("shows the history in words, with no identifier in it", () => {
    const lines = describeHistory(
      proposal({
        history: [
          { version: 1, amount: 2500, dueDate: "2026-09-14", note: null, side: "shop", at: "" },
          { version: 2, amount: 1800, dueDate: null, note: null, side: "customer", at: "" },
        ],
      }),
      "shop"
    );

    expect(lines).toEqual(["You asked for ₹2,500, due 2026-09-14", "They changed it to ₹1,800"]);
    for (const line of lines) {
      expect(line).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
      expect(line).not.toMatch(/version|proposalId|pty_/i);
    }
  });
});

describe("what somebody is told before agreeing", () => {
  it("names the consequence rather than asking are you sure", () => {
    expect(ACCEPT_EXPLANATION).toMatch(/cannot be edited/i);
    expect(ACCEPT_EXPLANATION).toMatch(/corrected by a new entry/i);
  });

  it("replaces a technical refusal and keeps a merchant-facing one", () => {
    expect(explainRefusal("409 Conflict")).toBe("Vyora could not do that just now.");
    expect(explainRefusal("The amount changed while you were looking.")).toBe(
      "The amount changed while you were looking."
    );
    expect(explainRefusal("   ")).toBe("Vyora could not do that just now.");
  });

  it("says what kind of money this is in words", () => {
    expect(describeType("credit")).toBe("Credit");
    expect(describeType("payment")).toBe("Payment");
    expect(describeType("advance_payment")).toBe("Advance payment");
  });

  it("describes a withdrawn request as withdrawn, not failed", () => {
    expect(describeState(proposal({ status: "cancelled" }), "shop", NOW)).toBe("Withdrawn");
  });
});

describe("the browser never holds a credential, and never names a shop", () => {
  it("keeps the token out of everything client code can read", () => {
    for (const file of [
      join(process.cwd(), "lib", "vyora", "shop-client.ts"),
      join(process.cwd(), "lib", "vyora", "proposals.ts"),
      join(process.cwd(), "features", "vyora", "screens", "Proposals.tsx"),
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("vyora_session");
      expect(source).not.toContain("Bearer");
      expect(source).not.toContain("localStorage");
      expect(source).not.toContain("sessionStorage");
    }
  });

  it("sends no shop, no merchant id and no person id on any proposal call", () => {
    // Active-shop safety, stated as an absence. The shop is the one this person
    // selected, resolved on the server; there is no parameter here to tamper
    // with, so a browser cannot reach another shop's proposals by editing a URL.
    const client = read(process.cwd(), "lib", "vyora", "shop-client.ts");
    const block = client.slice(
      client.indexOf("listProposals:"),
      client.indexOf("suggestLocalities:")
    );

    expect(block).toContain("`${ROOT}/proposals`");
    expect(block).toContain("`${ROOT}/my-proposals`");
    expect(block).not.toContain("merchantId");
    expect(block).not.toContain("shopId");
    expect(block).not.toContain("personId");
    expect(block).not.toContain("x-vyora-shop");
  });

  it("forwards every proposal route with the session rather than building its own request", () => {
    const routes = [
      read(API_DIR, "proposals", "route.ts"),
      read(API_DIR, "my-proposals", "route.ts"),
      read(API_DIR, "proposals", "[proposalId]", "accept", "route.ts"),
      read(API_DIR, "proposals", "[proposalId]", "reject", "route.ts"),
      read(API_DIR, "proposals", "[proposalId]", "revise", "route.ts"),
      read(API_DIR, "proposals", "[proposalId]", "cancel", "route.ts"),
    ];

    for (const route of routes) {
      expect(route).toContain("forwardWithSession");
      expect(route).not.toContain("Bearer");
      expect(route).not.toMatch(/fetch\(/);
    }
  });

  it("exposes no DELETE on any proposal route", () => {
    // Nothing routed through the browser can remove a proposal or an event. A
    // withdrawal is a status, recorded and visible to both sides.
    for (const route of [
      read(API_DIR, "proposals", "route.ts"),
      read(API_DIR, "my-proposals", "route.ts"),
      read(API_DIR, "proposals", "[proposalId]", "cancel", "route.ts"),
    ]) {
      expect(route).not.toMatch(/export async function DELETE/);
    }
  });
});
