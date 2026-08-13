/**
 * Renaming one phone.
 *
 * The body is **rebuilt** from the one field the operation takes rather than
 * forwarded. That is the rule for every write route here: a browser cannot send
 * a field this route does not name, so a client that learned to post something
 * extra could not reach the contract with it.
 *
 * A device belongs to the person signed in, and the API scopes the update by
 * person — so renaming somebody else's answers exactly as renaming one that
 * does not exist. Nothing in this file needs to know that; it is stated here so
 * nobody later adds a check that accidentally distinguishes the two.
 */

import type { NextResponse } from "next/server";
import { forwardWithSession } from "../../forward";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ deviceId: string }> }
): Promise<NextResponse> {
  const { deviceId } = await params;
  const incoming = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  // One field, and `null` is meaningful — it is how a merchant clears a name —
  // so it is passed through rather than folded into "absent".
  const label = typeof incoming.label === "string" ? incoming.label : null;

  return forwardWithSession(
    "PATCH",
    `/api/v1/devices/${encodeURIComponent(deviceId)}`,
    JSON.stringify({ label })
  );
}
