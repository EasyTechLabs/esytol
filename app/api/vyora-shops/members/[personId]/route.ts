/**
 * Change somebody's role, or whether they still work here.
 *
 * The body is rebuilt from the two fields the operation takes. A pass-through
 * would let a client field reach a contract that sets
 * `additionalProperties: false`, and would make it possible to forward
 * something this route has no business carrying.
 *
 * The last-owner rule is not checked here and must not be. It is a database
 * trigger holding the shop's row while it counts, which is the only way two
 * owners demoting each other at the same instant is caught.
 */

import { NextResponse } from "next/server";
import { forwardWithSession } from "../../forward";

export const dynamic = "force-dynamic";

const ROLES = new Set(["owner", "staff", "viewer"]);
const STATUSES = new Set(["active", "inactive"]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ personId: string }> }
): Promise<NextResponse> {
  const { personId } = await context.params;
  const incoming = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const body: Record<string, string> = {};
  if (typeof incoming.role === "string" && ROLES.has(incoming.role)) body.role = incoming.role;
  if (typeof incoming.status === "string" && STATUSES.has(incoming.status)) {
    body.status = incoming.status;
  }

  if (Object.keys(body).length === 0) {
    return NextResponse.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: "Say what to change: a role, or whether they are still working here.",
        },
      },
      { status: 400 }
    );
  }

  return forwardWithSession(
    "PATCH",
    `/api/v1/shops/members/${encodeURIComponent(personId)}`,
    JSON.stringify(body)
  );
}
