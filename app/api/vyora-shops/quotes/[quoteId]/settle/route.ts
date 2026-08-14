/**
 * Record that a bill was paid outside Vyora.
 *
 * Appends one audit-only `BillSettled` upstream. **It moves no balance**, and
 * it is emphatically not a payment — recording an externally-paid bill as one
 * would reduce an unrelated debt, because payments in Vyora are unallocated.
 * See ADR-0014 §4.
 *
 * Vyora verifies nothing here. Two people said it was settled.
 */

import type { NextResponse } from "next/server";
import { forwardWithSession } from "../../../forward";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ quoteId: string }> }
): Promise<NextResponse> {
  const { quoteId } = await context.params;
  return forwardWithSession(
    "POST",
    `/api/v1/quotes/${encodeURIComponent(quoteId)}/settle`,
    await request.text(),
    request.headers.get("idempotency-key")
  );
}
