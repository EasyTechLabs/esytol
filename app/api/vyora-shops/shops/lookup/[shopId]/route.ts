/**
 * Resolve a shop code, for the verification window.
 *
 * The code is parsed here before anything is forwarded. A code that cannot be a
 * Vyora shop code is refused locally with the same 404 the API gives an unknown
 * one — so a wrong check symbol costs nothing, and this route cannot be used to
 * probe the API with arbitrary path segments.
 *
 * The canonical spelling is what goes upstream, so `vyr7k2m4q` and
 * `VYR-7K2M-4Q` resolve identically rather than the second one 404ing.
 */

import { NextResponse } from "next/server";
import { forwardWithSession } from "../../../forward";
import { parsePublicId } from "@/lib/vyora/identity";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ shopId: string }> }
): Promise<NextResponse> {
  const { shopId } = await context.params;
  const parsed = parsePublicId(shopId, "shop");

  if (!parsed.ok) {
    // Identical to an unknown shop. Distinguishing "malformed" from "no such
    // shop" would tell someone enumerating codes which of their guesses were
    // at least well-formed.
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No shop answers to that code." } },
      { status: 404 }
    );
  }

  return forwardWithSession("GET", `/api/v1/shops/lookup/${encodeURIComponent(parsed.canonical)}`);
}
