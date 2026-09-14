import { NextResponse } from "next/server";
import { forwardToApi } from "@/lib/udharpe/admin-forward";

/**
 * The three sign-in steps, named rather than proxied.
 *
 * `/api/v1/auth/` holds more than these three, and a route that forwarded any
 * step under it would grow reachable surface every time the API did.
 */
const STEPS: Record<string, string> = {
  "request-code": "/api/v1/auth/email/request-code",
  "verify-code": "/api/v1/auth/email/verify-code",
  logout: "/api/v1/auth/logout",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ step: string }> }
): Promise<NextResponse> {
  const { step } = await params;
  const path = STEPS[step];
  if (!path) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No such endpoint." } },
      { status: 404 }
    );
  }
  return forwardToApi({ path, method: "POST", request });
}
