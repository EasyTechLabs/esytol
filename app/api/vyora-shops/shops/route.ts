/**
 * The caller's shops, and creating one.
 *
 * The create body is rebuilt field by field rather than relayed. Two reasons:
 * the contract sets `additionalProperties: false`, so a pass-through would turn
 * a stray client field into a 400 that reads like a server fault — and a
 * rebuilt body makes it structurally impossible for this route to forward a
 * `merchantId`, which is the one field that must never come from a client.
 */

import type { NextResponse } from "next/server";
import { forwardWithSession } from "../forward";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return forwardWithSession("GET", "/api/v1/shops");
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optional(value: unknown): string | null {
  const trimmed = text(value);
  return trimmed === "" ? null : trimmed;
}

export async function POST(request: Request): Promise<NextResponse> {
  const incoming = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const body = JSON.stringify({
    name: text(incoming.name),
    addressLine: text(incoming.addressLine),
    pincode: optional(incoming.pincode),
    localitySuggested: optional(incoming.localitySuggested),
    localityConfirmed: text(incoming.localityConfirmed),
  });

  return forwardWithSession("POST", "/api/v1/shops", body);
}
