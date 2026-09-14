import { NextResponse } from "next/server";
import { forwardToApi } from "@/lib/udharpe/admin-forward";

const STATUSES = new Set([
  "pending",
  "under_review",
  "changes_requested",
  "approved",
  "rejected",
  "suspended",
  "withdrawn",
]);

export async function GET(request: Request): Promise<NextResponse> {
  // The status is the only thing the caller supplies, and it is checked against
  // a closed set rather than passed through — a query string reaching upstream
  // unexamined is how an innocuous-looking parameter becomes a surprise.
  const status = new URL(request.url).searchParams.get("status") ?? "pending";
  if (!STATUSES.has(status)) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: `'${status}' is not an application status.` } },
      { status: 400 }
    );
  }
  return forwardToApi({
    path: `/api/v1/admin/applications?status=${status}`,
    method: "GET",
    request,
  });
}
