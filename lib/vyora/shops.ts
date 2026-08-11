/**
 * Vyora — creating a shop, and checking one before acting on it.
 *
 * Pure: no fetch, no storage, no React. The screens call in to decide what is
 * valid and what to say; the routes carry the result.
 *
 * The same rules live in `vyora-mobile/src/features/shops.ts` and,
 * authoritatively, on the server. The duplication is deliberate — the phone has
 * to answer "one character is wrong" with no signal, and this app has to answer
 * it without a round trip. What no client does is treat its own check as final:
 * a code that parses cleanly is still resolved by the server before anything is
 * shown about the shop it names.
 *
 * ## Suggested and confirmed are different fields on purpose
 *
 * A PIN code suggests localities; it never proves one. The same PIN code covers
 * several, and the boundaries are not what a merchant means by "where my shop
 * is". A draft therefore carries both — what was offered, and what the person
 * agreed to — and only the confirmed value is ever displayed as a fact.
 */

import { parsePublicId } from "./identity";

const NAME_MAX = 120;
const ADDRESS_MAX = 240;

/** Indian PIN codes. Six digits, never leading zero — matches the API's CHECK. */
const PINCODE = /^[1-9][0-9]{5}$/;

export interface ShopDraft {
  readonly name: string;
  readonly addressLine: string;
  readonly pincode: string;
  /** What the lookup offered for `pincode`, or null if none was asked for. */
  readonly localitySuggested: string | null;
  readonly localityConfirmed: string;
}

export const EMPTY_DRAFT: ShopDraft = {
  name: "",
  addressLine: "",
  pincode: "",
  localitySuggested: null,
  localityConfirmed: "",
};

export type ShopField = "name" | "addressLine" | "pincode" | "localityConfirmed";

export interface CreateShopBody {
  readonly name: string;
  readonly addressLine: string;
  readonly pincode: string | null;
  readonly localitySuggested: string | null;
  readonly localityConfirmed: string;
}

export type DraftCheck =
  | { readonly ok: true; readonly body: CreateShopBody }
  | { readonly ok: false; readonly problems: ReadonlyArray<{ field: ShopField; message: string }> };

/**
 * Check a draft and, if it holds, produce the request body.
 *
 * Returns **every** problem rather than the first, so a merchant learns four
 * things in one submit rather than four.
 */
export function checkDraft(draft: ShopDraft): DraftCheck {
  const problems: Array<{ field: ShopField; message: string }> = [];

  const name = draft.name.trim();
  if (!name) {
    problems.push({ field: "name", message: "Your shop needs a name." });
  } else if (name.length > NAME_MAX) {
    problems.push({ field: "name", message: `Keep the name under ${NAME_MAX} characters.` });
  }

  const addressLine = draft.addressLine.trim();
  if (!addressLine) {
    // Required because the masked form of this line is the whole of what a
    // stranger sees in the verification window.
    problems.push({ field: "addressLine", message: "Add the street address of the shop." });
  } else if (addressLine.length > ADDRESS_MAX) {
    problems.push({
      field: "addressLine",
      message: `Keep the address under ${ADDRESS_MAX} characters.`,
    });
  }

  const pincode = draft.pincode.trim();
  if (pincode && !PINCODE.test(pincode)) {
    problems.push({ field: "pincode", message: "A PIN code is six digits, like 560001." });
  }

  const localityConfirmed = draft.localityConfirmed.trim();
  if (!localityConfirmed) {
    problems.push({
      field: "localityConfirmed",
      message: "Choose or type the area your shop is in.",
    });
  }

  if (problems.length) return { ok: false, problems };

  return {
    ok: true,
    body: {
      name,
      addressLine,
      // Null rather than "": an empty string reads as "we asked and they said
      // nothing", which is not what happened.
      pincode: pincode || null,
      localitySuggested: draft.localitySuggested,
      localityConfirmed,
    },
  };
}

/** Whether asking the server for suggestions is worth a request yet. */
export function isCompletePincode(pincode: string): boolean {
  return PINCODE.test(pincode.trim());
}

/**
 * Record what a lookup offered.
 *
 * Deliberately does not confirm anything, even when exactly one locality comes
 * back. A single suggestion is still a suggestion, and auto-confirming it would
 * put a value the merchant never read into a field printed on statements.
 */
export function withSuggestions(draft: ShopDraft, localities: readonly string[]): ShopDraft {
  return { ...draft, localitySuggested: localities[0] ?? null };
}

export function confirmLocality(draft: ShopDraft, locality: string): ShopDraft {
  return { ...draft, localityConfirmed: locality };
}

// ── The verification window ──────────────────────────────────────────────────

/**
 * What a stranger holding a code may learn (ADR-0006).
 *
 * Not the full record: no unmasked address, no pincode, no membership list, no
 * internal id, nothing about balances or other shops.
 */
export interface ShopVerification {
  readonly shopId: string;
  readonly name: string;
  readonly locality: string | null;
  readonly addressMasked: string | null;
  readonly status: "active";
}

/**
 * Whether what came back describes the code that was read.
 *
 * Both sides go through the parser first, so a difference in spelling is never
 * reported as a mismatch.
 */
export function identifiesTheSameShop(scanned: string, verified: ShopVerification): boolean {
  const a = parsePublicId(scanned, "shop");
  const b = parsePublicId(verified.shopId, "shop");
  return a.ok && b.ok && a.canonical === b.canonical;
}

export type VerificationOutcome =
  | { readonly kind: "confirmed"; readonly shop: ShopVerification }
  | { readonly kind: "unknown"; readonly message: string }
  | { readonly kind: "unreachable"; readonly message: string }
  | { readonly kind: "mismatch"; readonly message: string };

export const NOT_FOUND_MESSAGE =
  "No shop answers to that code. Check it against the card, or ask the shop to read it out.";

export const UNREACHABLE_MESSAGE =
  "Vyora could not check that code right now. Nothing has been sent, and you can try again in a moment.";

export const MISMATCH_MESSAGE =
  "That answer describes a different shop than the code you entered. Nothing has been done. Enter the code again.";

/**
 * Turn a lookup result into what the window shows.
 *
 * The unknown case is identical whether the shop does not exist or the server
 * declines to describe it. Distinguishing them would make this an oracle for
 * whether an arbitrary six-character code is real.
 */
export function interpretLookup(
  scanned: string,
  result:
    | { readonly kind: "ok"; readonly value: ShopVerification }
    | { readonly kind: "unreachable" }
    | { readonly kind: "refused"; readonly status: number }
): VerificationOutcome {
  if (result.kind === "unreachable") {
    return { kind: "unreachable", message: UNREACHABLE_MESSAGE };
  }
  if (result.kind === "refused") {
    // A 401 lands here too. It is "we cannot tell you", not "no such shop".
    return result.status === 404
      ? { kind: "unknown", message: NOT_FOUND_MESSAGE }
      : { kind: "unreachable", message: UNREACHABLE_MESSAGE };
  }
  if (!identifiesTheSameShop(scanned, result.value)) {
    return { kind: "mismatch", message: MISMATCH_MESSAGE };
  }
  return { kind: "confirmed", shop: result.value };
}

/** The server already masks this. Name the absence rather than render an empty row. */
export function describeMaskedAddress(shop: ShopVerification): string {
  return shop.addressMasked?.trim() || "No address recorded";
}

/** The confirmed locality only. A suggestion never reaches this screen. */
export function describeLocality(shop: ShopVerification): string {
  return shop.locality?.trim() || "Area not confirmed";
}
