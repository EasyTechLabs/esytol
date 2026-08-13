/**
 * Shops that have invited **me**.
 *
 * Person-scoped rather than shop-scoped: the caller is not in these shops yet,
 * which is the whole point. Named `my-invitations` here so the browser cannot
 * confuse it with the owner's list of invitations a shop has issued.
 */

import type { NextResponse } from "next/server";
import { forwardWithSession } from "../forward";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return forwardWithSession("GET", "/api/v1/invitations");
}
