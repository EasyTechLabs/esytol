/**
 * Development-only proxy: record a payment.
 *
 * Gated by the ledger *write* decision, the same narrowest gate the credit
 * route uses — ledger reads, party writes and its own flag, all required. There
 * is no GET, PATCH or DELETE here: a payment is appended once and never edited
 * or removed.
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
    `/${encodeURIComponent(partyId)}/payments`,
    await request.text(),
    request.headers
  );
}
