import { NextResponse } from "next/server";
import { forwardToApi, UUID } from "@/lib/udharpe/admin-forward";

/**
 * One photograph an application was submitted with — `owner` or `shop` — for
 * the review panel (P-10, pilot audit, 12 November).
 *
 * The bytes come back through this server route on the administrator's
 * httpOnly session, `no-store`. The browser is never given a token, a capture
 * id or a storage URL, and the API audits every view against the application.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ applicationId: string; which: string }> }
): Promise<NextResponse> {
  const { applicationId, which } = await params;
  if (!UUID.test(applicationId) || (which !== "owner" && which !== "shop")) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No such endpoint." } },
      { status: 404 }
    );
  }
  return forwardToApi({
    path: `/api/v1/admin/applications/${applicationId}/photos/${which}`,
    method: "GET",
    request,
  });
}
