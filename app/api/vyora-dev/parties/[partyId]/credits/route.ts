/**
 * Development-only proxy: record a credit.
 *
 * Gated by the ledger *write* decision, the narrowest gate in the app — it
 * requires ledger reads, party writes and its own flag. There is no GET, PATCH
 * or DELETE here: an entry is appended once and never edited or removed.
 */

import type { NextResponse } from "next/server";
import { forwardLedgerWrite } from "../../forward";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ partyId: string }> }
): Promise<NextResponse> {
  const { partyId } = await context.params;
  return forwardLedgerWrite(
    `/${encodeURIComponent(partyId)}/credits`,
    await request.text(),
    request.headers
  );
}
