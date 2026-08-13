/**
 * Signing one phone out of this account.
 *
 * The confirmation flag is rebuilt rather than forwarded, and only ever as a
 * literal `true` or omitted — a browser cannot smuggle any other shape through
 * this route.
 *
 * It is worth being clear about what that flag is and is not. It does **not**
 * authorise anything: the API refuses to revoke the calling device without it,
 * and the API is the one deciding. Here it means only "the person was shown
 * what this does and said yes". The browser is never the caller's own device —
 * a device is a phone that registered an installation key, and this server has
 * none — so in practice this flag is unused from the web and is accepted so
 * that the two surfaces speak the same operation.
 */

import type { NextResponse } from "next/server";
import { forwardWithSession } from "../../../forward";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ deviceId: string }> }
): Promise<NextResponse> {
  const { deviceId } = await params;
  const incoming = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const body = incoming.confirmCurrentDevice === true ? { confirmCurrentDevice: true } : {};

  return forwardWithSession(
    "POST",
    `/api/v1/devices/${encodeURIComponent(deviceId)}/revoke`,
    JSON.stringify(body)
  );
}
