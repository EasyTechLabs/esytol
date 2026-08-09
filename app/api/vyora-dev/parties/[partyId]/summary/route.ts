/**
 * Development-only proxy: a party's ledger summary.
 *
 * Gated by the ledger *read* decision, exactly as the statement route is — the
 * summary is the same data folded differently, so it must not be reachable
 * under a looser gate than the rows it totals.
 *
 * Takes no query parameters. The summary has no limit by design, and forwarding
 * one would silently produce a total over part of the ledger.
 */

import type { NextResponse } from "next/server";
import { forwardLedgerRead } from "../../forward";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ partyId: string }> }
): Promise<NextResponse> {
  const { partyId } = await context.params;
  return forwardLedgerRead(`/${encodeURIComponent(partyId)}/summary`, "");
}
