/**
 * Vyora — the browser's half of item lists.
 *
 * The claim under test is ADR-0014's, and it is a claim about **wording** as
 * much as about code: a list is not a debt, and a bill paid outside Vyora is
 * not a payment and was not verified by Vyora.
 *
 * A screen that quietly dropped the disclaimer would still pass every
 * behavioural test, so the disclaimer itself is asserted — and so is its
 * presence in the file that renders a receipt.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AGREE_EXPLANATION,
  CREDIT_EXPLANATION,
  SETTLED_DISCLAIMER,
  SETTLE_EXPLANATION,
  canAgree,
  canCancel,
  canChooseOutcome,
  canPrice,
  canRevise,
  describeChanges,
  describeLine,
  describeMethod,
  isPriced,
  isShopsOwn,
  present,
  splitSided,
  sumLines,
} from "@/lib/vyora/quotes";
import type { Quote, QuoteLine } from "@/lib/vyora/shop-client";

const API_DIR = join(process.cwd(), "app", "api", "vyora-shops");
const read = (...parts: string[]) => readFileSync(join(...parts), "utf8");

const NOW = Date.parse("2026-08-14T10:00:00.000Z");
const inMinutes = (n: number) => new Date(NOW + n * 60_000).toISOString();

const line = (over: Partial<QuoteLine> = {}): QuoteLine => ({
  lineId: "11111111-1111-4111-8111-111111111111",
  title: "Rice",
  quantity: 2,
  unit: "bags",
  amount: 2400,
  ...over,
});

function quote(over: Partial<Quote> = {}): Quote {
  const lines = over.lines ?? [line()];
  return {
    quoteId: "22222222-2222-4222-8222-222222222222",
    initiator: "customer",
    status: "proposed",
    version: 2,
    total: 2400,
    lines,
    note: null,
    partyId: "pty_1",
    partyName: "Ramesh",
    shopId: "VYR-TPK9-S9",
    shopName: "Sharma Kirana",
    expiresAt: null,
    awaitingSide: "customer",
    creditProposalId: null,
    settledEventId: null,
    settledMethod: null,
    settledJointly: null,
    createdAt: "2026-08-14T09:00:00.000Z",
    updatedAt: "2026-08-14T09:30:00.000Z",
    history: [
      {
        version: 1,
        total: 0,
        note: null,
        lines: [line({ amount: null })],
        side: "customer",
        at: "",
      },
      { version: 2, total: 2400, note: null, lines, side: "shop", at: "" },
    ],
    ...over,
  };
}

describe("a list is not a debt", () => {
  it("never claims anything is in a book, at any stage", () => {
    const stages: Quote[] = [
      quote({ status: "proposed" }),
      quote({ status: "revised" }),
      quote({ status: "agreed" }),
      quote({ status: "credited", creditProposalId: "p1", awaitingSide: null }),
      quote({
        status: "settled",
        settledEventId: "evt_1",
        settledMethod: "upi",
        settledJointly: true,
        awaitingSide: null,
      }),
      quote({ status: "cancelled", awaitingSide: null }),
    ];

    for (const q of stages) {
      for (const side of ["shop", "customer"] as const) {
        const said = present(q, side, NOW).state;
        expect(said).not.toMatch(/in (the|your) book/i);
        expect(said).not.toMatch(/recorded/i);
      }
    }
  });

  it("calls a credited list a request, not money owed", () => {
    const credited = present(
      quote({ status: "credited", creditProposalId: "p1", awaitingSide: null }),
      "shop",
      NOW
    );
    expect(credited.state).toBe("Sent as a credit request");
  });
});

describe("paid outside Vyora is not a payment", () => {
  it("says both sides confirmed, and that Vyora did not", () => {
    expect(SETTLED_DISCLAIMER).toMatch(/confirmed by both sides/i);
    expect(SETTLED_DISCLAIMER).toMatch(/not verified by vyora/i);
  });

  it("warns before it happens that no balance will move", () => {
    expect(SETTLE_EXPLANATION).toMatch(/does not change what they owe/i);
    expect(SETTLE_EXPLANATION).toMatch(/does not check that the money arrived/i);
  });

  it("renders the disclaimer wherever a receipt is shown", () => {
    // A behavioural test cannot catch a screen that stops rendering the
    // sentence, so the file is checked directly.
    const screen = read(process.cwd(), "features", "vyora", "screens", "Quotes.tsx");
    expect(screen).toContain("SETTLED_DISCLAIMER");
    expect(screen).toContain("This does not change what they owe you.");
    // And never a bare tick or the unqualified word.
    expect(screen).not.toMatch(/>\s*Paid\s*<\/(p|span|div)>/);
  });

  it("never describes a shop's own record as jointly confirmed", () => {
    const own = present(
      quote({
        status: "settled",
        settledEventId: "evt_1",
        settledMethod: "cash",
        settledJointly: false,
        awaitingSide: null,
      }),
      "shop",
      NOW
    );
    expect(own.settledJointly).toBe(false);

    const screen = read(process.cwd(), "features", "vyora", "screens", "Quotes.tsx");
    expect(screen).toContain("nobody else confirmed it");
  });

  it("names the method in words", () => {
    expect(describeMethod("cash")).toBe("Cash");
    expect(describeMethod("upi")).toBe("UPI");
    expect(describeMethod("bank_transfer")).toBe("Bank transfer");
  });
});

describe("the total", () => {
  it("is the sum of the line amounts and nothing else", () => {
    expect(sumLines([line({ amount: 2400 }), line({ lineId: "b", amount: 300 })])).toBe(2700);
  });

  it("does not multiply by quantity", () => {
    expect(sumLines([line({ quantity: 5, amount: 2400 })])).toBe(2400);
  });

  it("treats a part-priced list as unpriced", () => {
    expect(isPriced([line({ amount: 2400 }), line({ lineId: "b", amount: null })])).toBe(false);
  });

  it("is never sent by the browser", () => {
    // Not merely untrusted: there is no field for it anywhere in the client.
    // Checked as a declared property rather than as the word, so the comment
    // that explains the absence does not trip the test that enforces it.
    const client = read(process.cwd(), "lib", "vyora", "shop-client.ts");
    const block = client.slice(client.indexOf("listQuotes:"), client.indexOf("suggestLocalities:"));
    const code = block
      .split("\n")
      .filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"))
      .join("\n");

    expect(code).not.toMatch(/\btotal\s*[:?]/);
    // And the request types name only what the server accepts.
    expect(code).toContain("lines:");
  });
});

describe("who may do what", () => {
  it("lets only the shop price a list", () => {
    const q = quote({ lines: [line({ amount: null })], total: 0, awaitingSide: "shop" });
    expect(canPrice(present(q, "shop", NOW))).toBe(true);
    expect(canPrice(present(q, "customer", NOW))).toBe(false);
  });

  it("offers agreement only to the side being waited for, and only when priced", () => {
    expect(canAgree(present(quote({ awaitingSide: "customer" }), "customer", NOW))).toBe(true);
    expect(canAgree(present(quote({ awaitingSide: "customer" }), "shop", NOW))).toBe(false);
    expect(
      canAgree(
        present(
          quote({ lines: [line({ amount: null })], total: 0, awaitingSide: "customer" }),
          "customer",
          NOW
        )
      )
    ).toBe(false);
  });

  it("offers an outcome only once both sides agreed", () => {
    expect(canChooseOutcome(present(quote({ status: "proposed" }), "customer", NOW))).toBe(false);
    expect(canChooseOutcome(present(quote({ status: "agreed" }), "customer", NOW))).toBe(true);
  });

  it("offers nothing once finished", () => {
    for (const status of ["credited", "settled", "cancelled", "expired"] as const) {
      const done = present(quote({ status, awaitingSide: null }), "shop", NOW);
      expect(canAgree(done)).toBe(false);
      expect(canRevise(done)).toBe(false);
      expect(canCancel(done)).toBe(false);
    }
  });
});

describe("expiry, recomputed while the page sits open", () => {
  it("stops offering anything the moment the window closes", () => {
    const lapsed = present(quote({ expiresAt: inMinutes(-1) }), "customer", NOW);
    expect(lapsed.status).toBe("expired");
    expect(canAgree(lapsed)).toBe(false);
  });
});

describe("a customer with no Vyora account", () => {
  it("is the shop's own list and says so, without claiming anybody is waiting", () => {
    const draft = present(quote({ status: "draft", awaitingSide: null }), "shop", NOW);
    expect(isShopsOwn(draft)).toBe(true);
    expect(draft.state).toMatch(/does not use Vyora/i);
    expect(draft.state).not.toMatch(/waiting/i);
  });
});

describe("what a merchant reads", () => {
  it("writes a line as quantity, unit, name and price", () => {
    expect(describeLine(line())).toBe("2 bags × Rice — ₹2,400");
    expect(describeLine(line({ amount: null }))).toBe("2 bags × Rice");
  });

  it("says what changed in rupees and item names", () => {
    expect(describeChanges([line({ amount: null })], [line({ amount: 2400 })])).toEqual([
      "Priced Rice at ₹2,400",
    ]);
    expect(describeChanges([line({ amount: 2400 })], [line({ amount: 1800 })])).toEqual([
      "Rice: ₹2,400 → ₹1,800",
    ]);
  });

  it("names no identifier in anything shown", () => {
    const said = [
      ...describeChanges([line({ amount: null })], [line({ amount: 2400 })]),
      describeLine(line()),
      AGREE_EXPLANATION,
      CREDIT_EXPLANATION,
      SETTLE_EXPLANATION,
      SETTLED_DISCLAIMER,
    ];
    for (const sentence of said) {
      expect(sentence).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
      expect(sentence).not.toMatch(/quoteId|lineId/i);
    }
  });
});

describe("the two lists", () => {
  it("splits by who started it, not by whose turn it is", () => {
    const { incoming, sent } = splitSided(
      [
        { quote: quote({ quoteId: "theirs", initiator: "customer" }), side: "shop" },
        { quote: quote({ quoteId: "ours", initiator: "shop" }), side: "shop" },
      ],
      NOW
    );
    expect(incoming.map((q) => q.quoteId)).toEqual(["theirs"]);
    expect(sent.map((q) => q.quoteId)).toEqual(["ours"]);
  });
});

describe("the browser holds no credential, and names no shop", () => {
  it("keeps the token out of everything client code can read", () => {
    for (const file of [
      join(process.cwd(), "lib", "vyora", "quotes.ts"),
      join(process.cwd(), "features", "vyora", "screens", "Quotes.tsx"),
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("vyora_session");
      expect(source).not.toContain("Bearer");
      expect(source).not.toContain("localStorage");
      expect(source).not.toContain("sessionStorage");
    }
  });

  it("sends no shop, merchant or person id on any shop-side quote call", () => {
    // Active-shop safety, stated as an absence: there is no parameter to
    // tamper with, so a browser cannot reach another shop's lists.
    const client = read(process.cwd(), "lib", "vyora", "shop-client.ts");
    const block = client.slice(
      client.indexOf("listQuotes:"),
      client.indexOf("createQuoteForShop:")
    );
    expect(block).toContain("`${ROOT}/quotes`");
    expect(block).not.toContain("merchantId");
    expect(block).not.toContain("x-vyora-shop");
  });

  it("forwards every quote route with the session and never builds its own request", () => {
    for (const route of [
      read(API_DIR, "quotes", "route.ts"),
      read(API_DIR, "my-quotes", "route.ts"),
      read(API_DIR, "shops", "[shopId]", "quotes", "route.ts"),
      read(API_DIR, "quotes", "[quoteId]", "revise", "route.ts"),
      read(API_DIR, "quotes", "[quoteId]", "agree", "route.ts"),
      read(API_DIR, "quotes", "[quoteId]", "credit", "route.ts"),
      read(API_DIR, "quotes", "[quoteId]", "settle", "route.ts"),
      read(API_DIR, "quotes", "[quoteId]", "cancel", "route.ts"),
    ]) {
      expect(route).toContain("forwardWithSession");
      expect(route).not.toContain("Bearer");
      expect(route).not.toMatch(/fetch\(/);
      expect(route).not.toMatch(/export async function DELETE/);
    }
  });

  it("passes an idempotency key through on the two operations that append events", () => {
    // The forwarder used to drop it, and the API had been refusing every
    // acceptance from the browser with `400 Idempotency-Key header is
    // required`. The key is minted by the caller, never here, so a retry
    // carries the same one.
    const forward = read(API_DIR, "forward.ts");
    expect(forward).toContain("idempotency-key");

    for (const route of [
      read(API_DIR, "proposals", "[proposalId]", "accept", "route.ts"),
      read(API_DIR, "quotes", "[quoteId]", "settle", "route.ts"),
    ]) {
      expect(route).toContain('request.headers.get("idempotency-key")');
    }

    const client = read(process.cwd(), "lib", "vyora", "shop-client.ts");
    expect(client).toContain("idempotencyKey");
  });
});
