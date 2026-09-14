import { NextResponse } from "next/server";
import { forwardToApi, UUID } from "@/lib/udharpe/admin-forward";

/**
 * One review decision, named in the path.
 *
 * Six small files rather than one route taking the action as a segment. Two
 * adjacent dynamic segments would have been fewer files and would have made
 * this route a general-purpose door into the admin namespace, reachable for
 * whatever gets added there next. The action is a literal; there is nothing to
 * validate because there is nothing to supply.
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
    path: `/api/v1/admin/applications/${applicationId}/approve`,
    method: "POST",
    request,
  });
}
