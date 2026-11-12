import { NextResponse } from "next/server";
import { forwardToApi, UUID } from "@/lib/udharpe/admin-forward";

/**
 * Delete an application's photographs, by hand, with a reason.
 *
 * A literal action, like the review decisions beside it: nothing to supply but
 * the application and the body, which the API validates (reason required) and
 * audits. Refused by the API while a retention hold stands.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ applicationId: string }> }
): Promise<NextResponse> {
  const { applicationId } = await params;
  if (!UUID.test(applicationId)) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No such endpoint." } },
      { status: 404 }
    );
  }
  return forwardToApi({
    path: `/api/v1/admin/applications/${applicationId}/photos/delete`,
    method: "POST",
    request,
  });
}
