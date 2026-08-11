/**
 * Vyora — shop drafts, the verification window, and the session gate.
 *
 * The rules a merchant can be hurt by: a draft that quietly fills in an area
 * nobody agreed to, a verification window that shows one shop's details under
 * another shop's code, an unreachable server reported as "no such shop", and a
 * token that ends up somewhere script can read it.
 */

import { describe, expect, it } from "vitest";
import {
  EMPTY_DRAFT,
  MISMATCH_MESSAGE,
  NOT_FOUND_MESSAGE,
  UNREACHABLE_MESSAGE,
  checkDraft,
  confirmLocality,
  describeLocality,
  describeMaskedAddress,
  identifiesTheSameShop,
  interpretLookup,
  isCompletePincode,
  withSuggestions,
  type ShopDraft,
  type ShopVerification,
} from "@/lib/vyora/shops";
import { SESSION_COOKIE, decideShopApi, sessionCookieOptions } from "@/lib/vyora/shop-session";

const COMPLETE: ShopDraft = {
  name: "Sharma General Store",
  addressLine: "14 Nehru Road, Rampur",
  pincode: "560001",
  localitySuggested: "Bengaluru GPO",
  localityConfirmed: "Bengaluru GPO",
};

const SHOP_ID = "VYR-TPK9-S9";
const OTHER_SHOP_ID = "VYR-6WR3-0P";

function verification(over: Partial<ShopVerification> = {}): ShopVerification {
  return {
    shopId: SHOP_ID,
    name: "Sharma General Store",
    locality: "Bengaluru GPO",
    addressMasked: "14 …",
    status: "active",
    ...over,
  };
}

describe("checking a shop draft", () => {
  it("accepts a complete one and produces the contract's body", () => {
    const checked = checkDraft(COMPLETE);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;

    expect(checked.body).toEqual({
      name: "Sharma General Store",
      addressLine: "14 Nehru Road, Rampur",
      pincode: "560001",
      localitySuggested: "Bengaluru GPO",
      localityConfirmed: "Bengaluru GPO",
    });
  });

  it("reports every problem at once, not the first", () => {
    const checked = checkDraft(EMPTY_DRAFT);
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(checked.problems.map((p) => p.field).sort()).toEqual([
      "addressLine",
      "localityConfirmed",
      "name",
    ]);
  });

  it("requires a street address, because the masked form is all a stranger sees", () => {
    const checked = checkDraft({ ...COMPLETE, addressLine: "   " });
    expect(checked.ok).toBe(false);
  });

  it("treats the PIN code as optional and sends null rather than an empty string", () => {
    const checked = checkDraft({ ...COMPLETE, pincode: "" });
    expect(checked.ok && checked.body.pincode).toBeNull();
  });

  it("rejects a PIN code that is not six digits, or starts with zero", () => {
    for (const pincode of ["5600", "56000A", "012345", "5600012"]) {
      const checked = checkDraft({ ...COMPLETE, pincode });
      expect(checked.ok, pincode).toBe(false);
    }
  });
});

describe("suggested areas are never confirmed areas", () => {
  it("does not confirm a lone suggestion", () => {
    // The tempting shortcut. A suggestion nobody read is not a fact, and this
    // value is printed on statements customers keep.
    const draft = withSuggestions(EMPTY_DRAFT, ["Connaught Place"]);
    expect(draft.localitySuggested).toBe("Connaught Place");
    expect(draft.localityConfirmed).toBe("");
  });

  it("keeps what was suggested even when the merchant types something else", () => {
    const draft = confirmLocality(
      withSuggestions(EMPTY_DRAFT, ["Connaught Place"]),
      "Behind the bus stand"
    );
    expect(draft.localitySuggested).toBe("Connaught Place");
    expect(draft.localityConfirmed).toBe("Behind the bus stand");
  });

  it("only asks for suggestions once the PIN code could possibly match", () => {
    expect(isCompletePincode("5600")).toBe(false);
    expect(isCompletePincode(" 560001 ")).toBe(true);
    expect(isCompletePincode("060001")).toBe(false);
  });
});

describe("the verification window", () => {
  it("confirms when the answer describes the code that was entered", () => {
    expect(interpretLookup(SHOP_ID, { kind: "ok", value: verification() }).kind).toBe("confirmed");
  });

  it("accepts a code spelled differently but meaning the same thing", () => {
    expect(identifiesTheSameShop("vyrtpk9s9", verification())).toBe(true);
    expect(identifiesTheSameShop("vyr-tpk9-s9", verification())).toBe(true);
  });

  it("refuses an answer that describes a different shop", () => {
    // The realistic cause is a stale response arriving after a second code was
    // entered. "Confirm this shop" over the wrong shop's details is the single
    // outcome this screen exists to prevent.
    const outcome = interpretLookup(OTHER_SHOP_ID, { kind: "ok", value: verification() });
    expect(outcome.kind).toBe("mismatch");
    expect(outcome.kind === "mismatch" && outcome.message).toBe(MISMATCH_MESSAGE);
  });

  it("never reports 'no such shop' for a refusal that is not a 404", () => {
    // A 401 means "we cannot tell you", not "it does not exist".
    for (const status of [401, 403, 429]) {
      expect(interpretLookup(SHOP_ID, { kind: "refused", status }).kind).toBe("unreachable");
    }
    const missing = interpretLookup(SHOP_ID, { kind: "refused", status: 404 });
    expect(missing.kind === "unknown" && missing.message).toBe(NOT_FOUND_MESSAGE);
  });

  it("says unreachable when the lookup could not be made", () => {
    const outcome = interpretLookup(SHOP_ID, { kind: "unreachable" });
    expect(outcome.kind === "unreachable" && outcome.message).toBe(UNREACHABLE_MESSAGE);
  });

  it("names the absence of an address rather than rendering an empty row", () => {
    expect(describeMaskedAddress(verification({ addressMasked: null }))).toBe(
      "No address recorded"
    );
    expect(describeLocality(verification({ locality: "  " }))).toBe("Area not confirmed");
  });

  it("carries no field a stranger should not receive", () => {
    // Entering a code is not consent to receive someone's address, pincode,
    // email, or the list of people who work there.
    const shape = Object.keys(verification()).sort();
    expect(shape).toEqual(["addressMasked", "locality", "name", "shopId", "status"]);
    for (const forbidden of ["addressLine", "pincode", "email", "merchantId", "members"]) {
      expect(shape).not.toContain(forbidden);
    }
  });
});

describe("where the browser's session is allowed to live", () => {
  it("is httpOnly, so no script on the page can read it", () => {
    // `localStorage` and a readable cookie are both readable by every
    // dependency in the bundle, forever. This is the assertion that fails if
    // somebody makes the token available to client code "just for debugging".
    const options = sessionCookieOptions(false);
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  it("is marked secure on https and not on loopback http", () => {
    // Marking it secure on a loopback development stack would mean the browser
    // never sends it at all, and every request would 401 for no visible reason.
    expect(sessionCookieOptions(true).secure).toBe(true);
    expect(sessionCookieOptions(false).secure).toBe(false);
  });

  it("has no NEXT_PUBLIC name anywhere near it", () => {
    // A `NEXT_PUBLIC_` value is inlined into the client bundle. The cookie name
    // is server-side only, and the token never has a name at all.
    expect(SESSION_COOKIE.startsWith("NEXT_PUBLIC")).toBe(false);
    expect(SESSION_COOKIE).toBe("vyora_session");
  });
});

describe("which builds may sign in at all", () => {
  it("refuses a production build outright", () => {
    // Not a deployment note. `sameSite: "lax"` with no CSRF token is fine for a
    // local stack and is not a considered answer for the public internet.
    const decision = decideShopApi({ nodeEnv: "production", apiUrl: "http://127.0.0.1:4000" });
    expect(decision.enabled).toBe(false);
  });

  it("refuses a non-loopback API URL", () => {
    const decision = decideShopApi({
      nodeEnv: "development",
      apiUrl: "https://api.example.com",
    });
    expect(decision.enabled).toBe(false);
  });

  it("allows a local development stack", () => {
    const decision = decideShopApi({ nodeEnv: "development", apiUrl: "http://127.0.0.1:4000" });
    expect(decision.enabled).toBe(true);
    expect(decision.enabled && decision.apiUrl).toBe("http://127.0.0.1:4000");
  });

  it("does not require a party flag or a fixture identity", () => {
    // Deliberately not built on `decidePartyApi`. Sharing that gate would have
    // meant either exposing sign-in whenever party reads were on, or requiring
    // a shared fixture identity to sign in as yourself.
    const decision = decideShopApi({ nodeEnv: "development", apiUrl: undefined });
    expect(decision.enabled).toBe(true);
  });
});
